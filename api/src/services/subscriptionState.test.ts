import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { getSubscriptionSnapshot } from './subscriptionState.js'

describe('getSubscriptionSnapshot', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-14T12:00:00.000Z'))
    process.env.TRIAL_DAYS = '14'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('applies trial end override when there is no payment', () => {
    const snapshot = getSubscriptionSnapshot(
      { createdAt: new Date('2026-04-01T00:00:00.000Z') },
      null,
      { trialEndsAt: new Date('2026-06-01T00:00:00.000Z') }
    )
    expect(snapshot.status).toBe('trial')
    expect(snapshot.trialEndsAt).toBe('2026-06-01T00:00:00.000Z')
  })

  it('applies forced status override even if period is expired', () => {
    const snapshot = getSubscriptionSnapshot(
      { createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { createdAt: new Date('2026-02-01T00:00:00.000Z'), period: 'monthly', amount: new Prisma.Decimal(120) },
      { status: 'active' }
    )
    expect(snapshot.status).toBe('active')
    expect(snapshot.latestPaymentPeriod).toBe('monthly')
    expect(snapshot.latestPaymentAmount).toBe(120)
  })

  it('returns free when trial expires with no payments', () => {
    const snapshot = getSubscriptionSnapshot(
      { createdAt: new Date('2026-03-01T00:00:00.000Z') },
      null
    )
    expect(snapshot.status).toBe('free')
  })

  it('returns active for current monthly payment period', () => {
    const snapshot = getSubscriptionSnapshot(
      { createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { createdAt: new Date('2026-04-01T00:00:00.000Z'), period: 'monthly', amount: new Prisma.Decimal(90) }
    )
    expect(snapshot.status).toBe('active')
    expect(snapshot.currentPeriodEnd).toBe('2026-05-01T00:00:00.000Z')
  })

  it('returns expired for old yearly payment period', () => {
    const snapshot = getSubscriptionSnapshot(
      { createdAt: new Date('2024-01-01T00:00:00.000Z') },
      { createdAt: new Date('2025-01-01T00:00:00.000Z'), period: 'yearly', amount: new Prisma.Decimal(1000) }
    )
    expect(snapshot.status).toBe('expired')
    expect(snapshot.latestPaymentPeriod).toBe('yearly')
  })
})
