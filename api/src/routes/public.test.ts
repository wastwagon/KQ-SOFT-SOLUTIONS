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
      monthlyGhs: 199,
      yearlyGhs: 1990,
      quarterlyGhs: 567,
      projectsPerMonth: 12,
      transactionsPerMonth: 3000,
      bankAccounts: 3,
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
    expect(basic?.transactionsPerMonth).toBe(500)
    expect(basic?.projectsPerMonth).toBe(5)

    const standard = plans.find((p) => p.id === 'standard')
    expect(standard?.projectsPerMonth).toBe(25)
    expect(standard?.transactionsPerMonth).toBe(2500)
    expect(standard?.monthlyGhs).toBe(450)
  })

  it('keeps super-admin prices even when they match a former catalogue amount', async () => {
    mocks.planFindMany.mockResolvedValue([
      { slug: 'basic', name: 'Basic', projectsPerMonth: 10, transactionsPerMonth: 1000, monthlyGhs: 150, yearlyGhs: 1500, quarterlyGhs: 428, active: true },
      { slug: 'standard', name: 'Standard', projectsPerMonth: 30, transactionsPerMonth: 5000, monthlyGhs: 400, yearlyGhs: 4000, quarterlyGhs: 1140, active: true },
      { slug: 'premium', name: 'Premium', projectsPerMonth: 100, transactionsPerMonth: 20000, monthlyGhs: 900, yearlyGhs: 9000, quarterlyGhs: 2565, active: true },
      { slug: 'firm', name: 'Custom', projectsPerMonth: -1, transactionsPerMonth: -1, monthlyGhs: 0, yearlyGhs: 0, quarterlyGhs: 0, active: true },
    ])
    const plans = await buildPublicPlans()
    expect(plans.find((p) => p.id === 'basic')?.monthlyGhs).toBe(150)
    expect(plans.find((p) => p.id === 'standard')?.monthlyGhs).toBe(400)
    expect(plans.find((p) => p.id === 'premium')?.monthlyGhs).toBe(900)
    expect(plans.find((p) => p.id === 'premium')?.quarterlyGhs).toBe(2565)
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
    expect(premium).toMatchObject({ monthlyGhs: 990, yearlyGhs: 9900, projectsPerMonth: 100, bankAccounts: 30 })
    const firm = plans.find((p) => p.id === 'firm')
    expect(firm).toMatchObject({ monthlyGhs: 0, yearlyGhs: 0, projectsPerMonth: -1, bankAccounts: -1 })
  })

  it('keeps inactive packages on the public list with active: false', async () => {
    mocks.planFindMany.mockResolvedValue([
      { slug: 'basic', name: 'Basic', projectsPerMonth: 10, transactionsPerMonth: 1000, monthlyGhs: 300, yearlyGhs: 3000, active: false },
      { slug: 'standard', name: 'Standard', projectsPerMonth: 30, transactionsPerMonth: 5000, monthlyGhs: 900, yearlyGhs: 9000, active: true },
      { slug: 'premium', name: 'Premium', projectsPerMonth: 100, transactionsPerMonth: 20000, monthlyGhs: 1500, yearlyGhs: 15000, active: true },
      { slug: 'firm', name: 'Custom', projectsPerMonth: -1, transactionsPerMonth: -1, monthlyGhs: 0, yearlyGhs: 0, active: true },
    ])
    const plans = await buildPublicPlans()
    expect(plans.find((p) => p.id === 'basic')).toMatchObject({ monthlyGhs: 300, active: false })
    expect(plans.find((p) => p.id === 'standard')?.active).toBe(true)
  })
})
