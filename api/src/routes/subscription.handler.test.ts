import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const mocks = vi.hoisted(() => {
  return {
    organizationUpdate: vi.fn(),
    paymentCreate: vi.fn(),
    transaction: vi.fn(async (ops: unknown[]) => ops),
  }
})

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    organization: { update: mocks.organizationUpdate },
    payment: { create: mocks.paymentCreate },
    $transaction: mocks.transaction,
  },
}))

import { computeWebhookSignature, handlePaystackWebhook } from './subscription.js'

function createRes() {
  const res = {
    statusCode: 200,
    body: '',
    status(code: number) {
      this.statusCode = code
      return this
    },
    send(payload: string) {
      this.body = payload
      return this
    },
  }
  return res
}

describe('handlePaystackWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PAYSTACK_WEBHOOK_SECRET = 'webhook-secret'
  })

  it('returns 400 for invalid signature', async () => {
    const raw = Buffer.from('{"event":"charge.success"}', 'utf8')
    const req = { headers: { 'x-paystack-signature': 'bad-signature' }, body: raw } as any
    const res = createRes() as any

    await handlePaystackWebhook(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toBe('Invalid signature')
  })

  it('returns 400 for invalid json payload', async () => {
    const raw = Buffer.from('{"event":', 'utf8')
    const sig = computeWebhookSignature(raw, process.env.PAYSTACK_WEBHOOK_SECRET as string)
    const req = { headers: { 'x-paystack-signature': sig }, body: raw } as any
    const res = createRes() as any

    await handlePaystackWebhook(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toBe('Invalid JSON payload')
  })

  it('treats duplicate payment reference as idempotent success', async () => {
    const raw = Buffer.from('{"event":"charge.success","data":{"amount":1200,"currency":"GHS","reference":"ref-1","metadata":{"orgId":"org-1","plan":"standard","period":"monthly"}}}', 'utf8')
    const sig = computeWebhookSignature(raw, process.env.PAYSTACK_WEBHOOK_SECRET as string)
    const req = { headers: { 'x-paystack-signature': sig }, body: raw } as any
    const res = createRes() as any

    mocks.organizationUpdate.mockResolvedValue({ id: 'org-1' })
    mocks.paymentCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: 'test',
      })
    )

    await handlePaystackWebhook(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('OK')
  })
})
