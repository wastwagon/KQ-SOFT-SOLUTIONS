import { describe, expect, it } from 'vitest'
import {
  checkoutAmountAfterCredit,
  isSelfServeDowngrade,
  prorationCreditGhs,
  rulesWithinCap,
  seatedBankAccountIds,
  seatedUserIds,
} from './planChange.js'

describe('plan change', () => {
  it('credits the unused share of the current plan only', () => {
    const paymentAt = new Date('2026-10-01T00:00:00.000Z')
    const now = new Date('2026-10-16T00:00:00.000Z')
    const credit = prorationCreditGhs({
      now,
      paymentAt,
      period: 'monthly',
      amount: 300,
      paymentPlan: 'standard',
      currentPlan: 'standard',
    })
    expect(credit).toBe(150)
    expect(
      prorationCreditGhs({
        now,
        paymentAt,
        period: 'monthly',
        amount: 300,
        paymentPlan: 'basic',
        currentPlan: 'standard',
      })
    ).toBe(0)
  })

  it('covers checkout when unused time is worth at least the new price', () => {
    expect(checkoutAmountAfterCredit(199, 250)).toEqual({
      charge: 0,
      creditApplied: 199,
      covered: true,
    })
    expect(checkoutAmountAfterCredit(399, 100)).toEqual({
      charge: 299,
      creditApplied: 100,
      covered: false,
    })
  })

  it('keeps the oldest admins in the seat cap, then the oldest other members', () => {
    const members = [
      { userId: 'prep', role: 'preparer', createdAt: new Date('2026-01-01') },
      { userId: 'admin-new', role: 'admin', createdAt: new Date('2026-03-01') },
      { userId: 'admin-old', role: 'admin', createdAt: new Date('2026-02-01') },
    ]
    expect([...seatedUserIds(members, 1)]).toEqual(['admin-old'])
    expect([...seatedUserIds(members, 2)].sort()).toEqual(['admin-new', 'admin-old'])
  })

  it('keeps the oldest bank accounts and the highest-priority rules', () => {
    const ids = seatedBankAccountIds(
      [
        { id: 'new', createdAt: new Date('2026-05-01') },
        { id: 'old', createdAt: new Date('2026-01-01') },
      ],
      1
    )
    expect([...(ids ?? [])]).toEqual(['old'])
    expect(seatedBankAccountIds([], -1)).toBeNull()
    expect(rulesWithinCap(['a', 'b', 'c'], 2)).toEqual(['a', 'b'])
    expect(rulesWithinCap(['a', 'b'], -1)).toEqual(['a', 'b'])
  })

  it('treats a lower self-serve plan as a downgrade and leaves Custom with sales', () => {
    expect(isSelfServeDowngrade('standard', 'basic')).toBe(true)
    expect(isSelfServeDowngrade('basic', 'standard')).toBe(false)
    expect(isSelfServeDowngrade('firm', 'basic')).toBe(false)
    expect(isSelfServeDowngrade('free', 'basic')).toBe(false)
  })
})
