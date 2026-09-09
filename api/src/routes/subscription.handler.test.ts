import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const mocks = vi.hoisted(() => {
  return {
    organizationUpdate: vi.fn(),
    paymentCreate: vi.fn(),
    paymentUpdate: vi.fn(),
    paymentFindUnique: vi.fn(),
    transaction: vi.fn(),
  }
})

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    organization: { update: mocks.organizationUpdate },
    payment: {
      create: mocks.paymentCreate,
      update: mocks.paymentUpdate,
      findUnique: mocks.paymentFindUnique,
    },
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
    delete process.env.PAYSTACK_SECRET_KEY
    delete process.env.PAYSTACK_SECRET
    mocks.transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return arg({
          organization: { update: mocks.organizationUpdate },
          payment: { update: mocks.paymentUpdate, create: mocks.paymentCreate },
        })
      }
      return arg
    })
    mocks.paymentFindUnique.mockResolvedValue(null)
    mocks.organizationUpdate.mockResolvedValue({ id: 'org-1' })
    mocks.paymentCreate.mockResolvedValue({ id: 'pay-1' })
    mocks.paymentUpdate.mockResolvedValue({ id: 'pay-1' })
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

  it('fulfills charge.success and treats duplicate payment reference as idempotent success', async () => {
    const raw = Buffer.from(
      '{"event":"charge.success","data":{"amount":1200,"currency":"GHS","reference":"ref-1","metadata":{"orgId":"org-1","plan":"standard","period":"monthly"}}}',
      'utf8'
    )
    const sig = computeWebhookSignature(raw, process.env.PAYSTACK_WEBHOOK_SECRET as string)
    const req = { headers: { 'x-paystack-signature': sig }, body: raw } as any
    const res = createRes() as any

    mocks.paymentCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: 'test',
      })
    )

    await handlePaystackWebhook(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('OK')
    expect(mocks.organizationUpdate).toHaveBeenCalled()
  })

  it('fulfills from checkout reference when metadata is missing', async () => {
    const reference = 'brs_org1id0000000000000001_premium_yearly_1710000000000'
    const raw = Buffer.from(
      JSON.stringify({
        event: 'charge.success',
        data: { amount: 150000, currency: 'GHS', reference, metadata: {} },
      }),
      'utf8'
    )
    const sig = computeWebhookSignature(raw, process.env.PAYSTACK_WEBHOOK_SECRET as string)
    const req = { headers: { 'x-paystack-signature': sig }, body: raw } as any
    const res = createRes() as any

    await handlePaystackWebhook(req, res)

    expect(res.statusCode).toBe(200)
    expect(mocks.organizationUpdate).toHaveBeenCalledWith({
      where: { id: 'org1id0000000000000001' },
      data: { plan: 'premium' },
    })
    expect(mocks.paymentCreate).toHaveBeenCalled()
  })

  it('accepts signature computed with PAYSTACK_SECRET_KEY', async () => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_live_abc'
    const raw = Buffer.from(
      '{"event":"charge.success","data":{"amount":100,"currency":"GHS","reference":"brs_org1id0000000000000001_basic_monthly_1","metadata":{"orgId":"org1id0000000000000001","plan":"basic","period":"monthly"}}}',
      'utf8'
    )
    const sig = computeWebhookSignature(raw, 'sk_live_abc')
    const req = { headers: { 'x-paystack-signature': sig }, body: raw } as any
    const res = createRes() as any

    await handlePaystackWebhook(req, res)

    expect(res.statusCode).toBe(200)
    expect(mocks.paymentCreate).toHaveBeenCalled()
  })
})
