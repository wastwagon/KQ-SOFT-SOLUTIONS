import { describe, expect, it, beforeEach, vi } from 'vitest'

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    organization: { findUnique: vi.fn() },
    payment: { findFirst: vi.fn() },
  },
}))

vi.mock('./subscriptionOverrides.js', () => ({
  fetchSubscriptionOverrides: vi.fn(async () => ({})),
}))

vi.mock('./subscriptionState.js', () => ({
  getSubscriptionSnapshot: vi.fn(() => ({ status: 'active' })),
}))

import { prisma } from '../lib/prisma.js'
import {
  getOrgSubscriptionStatus,
  invalidateOrgSubscriptionCache,
} from './orgSubscriptionAccess.js'

describe('orgSubscriptionAccess cache', () => {
  beforeEach(() => {
    invalidateOrgSubscriptionCache()
    vi.clearAllMocks()
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      createdAt: new Date('2026-01-01'),
    } as never)
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(null)
  })

  it('caches subscription status per org', async () => {
    await getOrgSubscriptionStatus('org-1')
    await getOrgSubscriptionStatus('org-1')
    expect(prisma.organization.findUnique).toHaveBeenCalledTimes(1)
  })

  it('invalidates cache for org', async () => {
    await getOrgSubscriptionStatus('org-1')
    invalidateOrgSubscriptionCache('org-1')
    await getOrgSubscriptionStatus('org-1')
    expect(prisma.organization.findUnique).toHaveBeenCalledTimes(2)
  })
})
