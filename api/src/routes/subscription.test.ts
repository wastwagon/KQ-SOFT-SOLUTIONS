import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import { computeWebhookSignature, parseWebhookEvent, isUniqueConstraintError } from './subscription.js'

describe('subscription webhook helpers', () => {
  it('computes deterministic signature from raw bytes', () => {
    const raw = Buffer.from('{"event":"charge.success","data":{"reference":"abc"}}', 'utf8')
    const sig1 = computeWebhookSignature(raw, 'secret-key')
    const sig2 = computeWebhookSignature(raw, 'secret-key')
    expect(sig1).toBe(sig2)
    expect(sig1).toHaveLength(128)
  })

  it('parses raw webhook JSON payload', () => {
    const raw = Buffer.from('{"event":"charge.success","data":{"metadata":{"orgId":"org1","plan":"standard"}}}', 'utf8')
    const parsed = parseWebhookEvent(raw)
    expect(parsed.event).toBe('charge.success')
    expect(parsed.data?.metadata?.orgId).toBe('org1')
    expect(parsed.data?.metadata?.plan).toBe('standard')
  })

  it('detects prisma unique constraint error', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: 'test',
    })
    expect(isUniqueConstraintError(err)).toBe(true)
    expect(isUniqueConstraintError(new Error('other'))).toBe(false)
  })
})
