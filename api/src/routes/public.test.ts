import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  planFindMany: vi.fn(),
}))

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    plan: { findMany: mocks.planFindMany },
  },
}))

import { invalidatePlanCache } from '../services/plan.js'
import { buildPublicPlans, PLAN_DISPLAY_ORDER } from './public.js'

describe('buildPublicPlans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidatePlanCache()
  })

  it('returns all four canonical tiers when DB is empty (config fallback)', async () => {
    mocks.planFindMany.mockResolvedValue([])
    const plans = await buildPublicPlans()

    expect(plans.map((p) => p.id)).toEqual([...PLAN_DISPLAY_ORDER])

    const basic = plans.find((p) => p.id === 'basic')
    expect(basic).toMatchObject({
      monthlyGhs: 300,
      yearlyGhs: 3000,
      quarterlyGhs: 855,
      projectsPerMonth: 10,
      transactionsPerMonth: 1000,
      bankAccounts: 5,
    })

    const firm = plans.find((p) => p.id === 'firm')
    expect(firm?.projectsPerMonth).toBe(-1)
    expect(firm?.transactionsPerMonth).toBe(-1)
    expect(firm?.bankAccounts).toBe(-1)
    expect(firm?.monthlyGhs).toBe(0)
    expect(firm?.yearlyGhs).toBe(0)
    expect(firm?.name).toBe('Custom')
  })

  it('uses DB values when plans table is populated (admin can override pricing)', async () => {
    mocks.planFindMany.mockResolvedValue([
      { slug: 'basic', name: 'Basic', projectsPerMonth: 5, transactionsPerMonth: 500, monthlyGhs: 200, yearlyGhs: 2000, active: true },
      { slug: 'standard', name: 'Standard', projectsPerMonth: 25, transactionsPerMonth: 2500, monthlyGhs: 450, yearlyGhs: 4500, active: true },
      { slug: 'premium', name: 'Premium', projectsPerMonth: 120, transactionsPerMonth: 12000, monthlyGhs: 1000, yearlyGhs: 10000, active: true },
      { slug: 'firm', name: 'Firm', projectsPerMonth: -1, transactionsPerMonth: -1, monthlyGhs: 0, yearlyGhs: 0, active: true },
    ])
    const plans = await buildPublicPlans()

    expect(plans).toHaveLength(4)
    const basic = plans.find((p) => p.id === 'basic')
    // 200 is a deliberate admin override (not a known legacy amount).
    expect(basic?.monthlyGhs).toBe(200)
    expect(basic?.yearlyGhs).toBe(2000)
    // Legacy txn cap 500 is healed to catalogue 1000.
    expect(basic?.transactionsPerMonth).toBe(1000)
    expect(basic?.projectsPerMonth).toBe(10)

    const standard = plans.find((p) => p.id === 'standard')
    expect(standard?.projectsPerMonth).toBe(25)
    expect(standard?.transactionsPerMonth).toBe(2500)
    expect(standard?.monthlyGhs).toBe(450)
  })

  it('heals known legacy Jul-pre catalogue prices to the current catalogue', async () => {
    mocks.planFindMany.mockResolvedValue([
      { slug: 'basic', name: 'Basic', projectsPerMonth: 5, transactionsPerMonth: 500, monthlyGhs: 150, yearlyGhs: 1500, active: true },
      { slug: 'standard', name: 'Standard', projectsPerMonth: 20, transactionsPerMonth: 2000, monthlyGhs: 400, yearlyGhs: 4000, active: true },
      { slug: 'premium', name: 'Premium', projectsPerMonth: 100, transactionsPerMonth: 10000, monthlyGhs: 900, yearlyGhs: 9000, active: true },
      { slug: 'firm', name: 'Firm', projectsPerMonth: -1, transactionsPerMonth: -1, monthlyGhs: 0, yearlyGhs: 0, active: true },
    ])
    const plans = await buildPublicPlans()
    expect(plans.find((p) => p.id === 'basic')).toMatchObject({
      monthlyGhs: 300,
      yearlyGhs: 3000,
      quarterlyGhs: 855,
      transactionsPerMonth: 1000,
      projectsPerMonth: 10,
    })
    expect(plans.find((p) => p.id === 'standard')).toMatchObject({
      monthlyGhs: 900,
      yearlyGhs: 9000,
      quarterlyGhs: 2565,
    })
    expect(plans.find((p) => p.id === 'premium')).toMatchObject({
      monthlyGhs: 1500,
      yearlyGhs: 15000,
      quarterlyGhs: 4275,
    })
  })

  it('uses inactive DB rows for pricing (admin can mark a tier inactive without losing its prices)', async () => {
    mocks.planFindMany.mockResolvedValue([
      { slug: 'basic', name: 'Basic', projectsPerMonth: 5, transactionsPerMonth: 500, monthlyGhs: 0, yearlyGhs: 0, active: false },
      { slug: 'standard', name: 'Standard', projectsPerMonth: 20, transactionsPerMonth: 2000, monthlyGhs: 50, yearlyGhs: 550, active: true },
      { slug: 'premium', name: 'Premium', projectsPerMonth: 100, transactionsPerMonth: 10000, monthlyGhs: 100, yearlyGhs: 1100, active: true },
      { slug: 'firm', name: 'Firm', projectsPerMonth: -1, transactionsPerMonth: -1, monthlyGhs: 0, yearlyGhs: 0, active: true },
    ])
    const plans = await buildPublicPlans()
    const basic = plans.find((p) => p.id === 'basic')
    // Legacy 0 monthly on basic → catalogue
    expect(basic?.monthlyGhs).toBe(300)
    expect(basic?.yearlyGhs).toBe(3000)
    expect(plans.find((p) => p.id === 'standard')?.monthlyGhs).toBe(900)
    expect(plans.find((p) => p.id === 'premium')?.monthlyGhs).toBe(1500)
  })

  it('always orders plans basic → standard → premium → firm regardless of DB ordering', async () => {
    mocks.planFindMany.mockResolvedValue([
      { slug: 'firm', name: 'Firm', projectsPerMonth: -1, transactionsPerMonth: -1, monthlyGhs: 0, yearlyGhs: 0, active: true },
      { slug: 'premium', name: 'Premium', projectsPerMonth: 100, transactionsPerMonth: 10000, monthlyGhs: 900, yearlyGhs: 9000, active: true },
      { slug: 'basic', name: 'Basic', projectsPerMonth: 5, transactionsPerMonth: 500, monthlyGhs: 150, yearlyGhs: 1500, active: true },
      { slug: 'standard', name: 'Standard', projectsPerMonth: 20, transactionsPerMonth: 2000, monthlyGhs: 400, yearlyGhs: 4000, active: true },
    ])

    const plans = await buildPublicPlans()
    expect(plans.map((p) => p.id)).toEqual(['basic', 'standard', 'premium', 'firm'])
  })

  it('back-fills missing tiers from the DB by using config defaults', async () => {
    // Only `basic` and `standard` in DB — `premium` and `firm` should still come back.
    mocks.planFindMany.mockResolvedValue([
      { slug: 'basic', name: 'Basic', projectsPerMonth: 5, transactionsPerMonth: 500, monthlyGhs: 150, yearlyGhs: 1500, active: true },
      { slug: 'standard', name: 'Standard', projectsPerMonth: 20, transactionsPerMonth: 2000, monthlyGhs: 400, yearlyGhs: 4000, active: true },
    ])

    const plans = await buildPublicPlans()
    expect(plans).toHaveLength(4)
    const premium = plans.find((p) => p.id === 'premium')
    expect(premium).toMatchObject({ monthlyGhs: 1500, yearlyGhs: 15000, projectsPerMonth: 100, bankAccounts: 30 })
    const firm = plans.find((p) => p.id === 'firm')
    expect(firm).toMatchObject({ monthlyGhs: 0, yearlyGhs: 0, projectsPerMonth: -1, bankAccounts: -1 })
  })
})
