import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getOrgSubscriptionStatus: vi.fn(),
  getPlanBySlug: vi.fn(),
  getPlanQuotaLimits: vi.fn(),
  countOrgBankAccounts: vi.fn(),
}))

vi.mock('./orgSubscriptionAccess.js', () => ({
  getOrgSubscriptionStatus: mocks.getOrgSubscriptionStatus,
}))

vi.mock('./plan.js', () => ({
  getPlanBySlug: mocks.getPlanBySlug,
}))

vi.mock('./planLimits.js', () => ({
  getPlanQuotaLimits: mocks.getPlanQuotaLimits,
  countOrgBankAccounts: mocks.countOrgBankAccounts,
}))

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    usageLog: {
      upsert: vi.fn().mockResolvedValue({
        projectsCount: 2,
        transactionsCount: 250,
        cleanExportsCount: 0,
      }),
      update: vi.fn(),
    },
  },
}))

import { getUsageWithLimits, resolveUsageQuotaPlanSlug } from './usage.js'

describe('resolveUsageQuotaPlanSlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses free caps for paid plan during admin trial', async () => {
    mocks.getOrgSubscriptionStatus.mockResolvedValue('trial')
    await expect(resolveUsageQuotaPlanSlug('org1', 'basic')).resolves.toBe('free')
  })

  it('keeps assigned plan when active with payment path', async () => {
    mocks.getOrgSubscriptionStatus.mockResolvedValue('active')
    await expect(resolveUsageQuotaPlanSlug('org1', 'basic')).resolves.toBe('basic')
  })
})

describe('getUsageWithLimits trial quotas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.countOrgBankAccounts.mockResolvedValue(1)
    mocks.getPlanQuotaLimits.mockResolvedValue({
      bankAccounts: 3,
      cleanExportsPerMonth: 5,
    })
    mocks.getOrgSubscriptionStatus.mockResolvedValue('trial')
  })

  it('loads project/transaction limits from free CMS during trial on paid slug', async () => {
    mocks.getPlanBySlug.mockImplementation(async (slug: string) => {
      if (slug === 'free') {
        return { projectsPerMonth: 5, transactionsPerMonth: 300 }
      }
      return { projectsPerMonth: 12, transactionsPerMonth: 3000 }
    })

    const usage = await getUsageWithLimits('org1', 'basic')
    expect(usage.quotaPlanSlug).toBe('free')
    expect(usage.transactionsLimit).toBe(300)
    expect(usage.projectsLimit).toBe(5)
    expect(usage.bankAccountsLimit).toBe(3)
  })
})
