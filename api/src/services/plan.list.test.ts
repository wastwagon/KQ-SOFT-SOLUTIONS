import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    plan: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { isSelfServePlan, type PlanData } from './plan.js'

function stub(over: Partial<PlanData>): PlanData {
  return {
    slug: 'basic',
    name: 'Basic',
    projectsPerMonth: 10,
    transactionsPerMonth: 1000,
    monthlyGhs: 300,
    yearlyGhs: 3000,
    quarterlyGhs: 855,
    bankAccounts: 5,
    cleanExportsPerMonth: 5,
    usersLimit: 1,
    features: {} as PlanData['features'],
    active: true,
    ...over,
  }
}

describe('isSelfServePlan', () => {
  it('lists active paid self-serve tiers', () => {
    expect(isSelfServePlan(stub({ slug: 'basic' }))).toBe(true)
    expect(isSelfServePlan(stub({ slug: 'standard', monthlyGhs: 900 }))).toBe(true)
  })

  it('hides firm, inactive, and zero-price packages from checkout', () => {
    expect(isSelfServePlan(stub({ slug: 'firm', monthlyGhs: 0, yearlyGhs: 0, quarterlyGhs: 0 }))).toBe(false)
    expect(isSelfServePlan(stub({ slug: 'basic', active: false }))).toBe(false)
    expect(isSelfServePlan(stub({ monthlyGhs: 0, yearlyGhs: 0, quarterlyGhs: 0 }))).toBe(false)
  })
})
