import { describe, it, expect, vi, beforeEach } from 'vitest'

const cfg = vi.hoisted(() => ({
  paywallEnabled: true,
  orgStatus: 'trial' as string,
  userEmail: 'member@example.com',
}))

vi.mock('../services/orgSubscriptionAccess.js', () => ({
  isSubscriptionPaywallEnabled: () => cfg.paywallEnabled,
  getOrgSubscriptionStatus: vi.fn(async () => cfg.orgStatus),
  subscriptionStatusBlocksAppAccess: (status: string) => status === 'free' || status === 'expired',
}))

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async () => ({ email: cfg.userEmail })),
    },
  },
}))

vi.mock('../lib/platformAdmin.js', () => ({
  isPlatformAdmin: (email: string) => email === 'boss@example.com',
}))

import { getOrgSubscriptionStatus } from '../services/orgSubscriptionAccess.js'
import { requireOrgSubscriptionForApp } from './requireOrgSubscriptionForApp.js'

function createRes() {
  let statusCode = 200
  let jsonBody: unknown
  return {
    status(code: number) {
      statusCode = code
      return this
    },
    json(payload: unknown) {
      jsonBody = payload
      return this
    },
    getStatusCode: () => statusCode,
    getJson: () => jsonBody,
  }
}

describe('requireOrgSubscriptionForApp', () => {
  beforeEach(async () => {
    cfg.paywallEnabled = true
    cfg.orgStatus = 'trial'
    cfg.userEmail = 'member@example.com'
    vi.clearAllMocks()
    const { prisma } = await import('../lib/prisma.js')
    vi.mocked(prisma.user.findUnique).mockImplementation(
      (() => Promise.resolve({ email: cfg.userEmail })) as unknown as typeof prisma.user.findUnique
    )
  })

  it('calls next when subscription paywall is disabled', async () => {
    cfg.paywallEnabled = false
    const next = vi.fn()
    const res = createRes()
    await requireOrgSubscriptionForApp(
      { auth: { userId: 'u1', orgId: 'o1' } } as any,
      res as any,
      next
    )
    expect(next).toHaveBeenCalled()
    expect(res.getStatusCode()).toBe(200)
  })

  it('calls next when org subscription is active (trial)', async () => {
    cfg.paywallEnabled = true
    cfg.orgStatus = 'trial'
    const next = vi.fn()
    const res = createRes()
    await requireOrgSubscriptionForApp(
      { auth: { userId: 'u1', orgId: 'o1' } } as any,
      res as any,
      next
    )
    expect(next).toHaveBeenCalled()
    expect(getOrgSubscriptionStatus).toHaveBeenCalledWith('o1')
  })

  it('calls next when org subscription is active (paid period)', async () => {
    cfg.paywallEnabled = true
    cfg.orgStatus = 'active'
    const next = vi.fn()
    const res = createRes()
    await requireOrgSubscriptionForApp(
      { auth: { userId: 'u1', orgId: 'o1' } } as any,
      res as any,
      next
    )
    expect(next).toHaveBeenCalled()
  })

  it('calls next when req.auth is missing', async () => {
    cfg.paywallEnabled = true
    cfg.orgStatus = 'free'
    const next = vi.fn()
    const res = createRes()
    await requireOrgSubscriptionForApp({} as any, res as any, next)
    expect(next).toHaveBeenCalled()
    expect(getOrgSubscriptionStatus).not.toHaveBeenCalled()
  })

  it('returns 403 when subscription is free', async () => {
    cfg.paywallEnabled = true
    cfg.orgStatus = 'free'
    const next = vi.fn()
    const res = createRes()
    await requireOrgSubscriptionForApp(
      { auth: { userId: 'u1', orgId: 'o1' } } as any,
      res as any,
      next
    )
    expect(next).not.toHaveBeenCalled()
    expect(res.getStatusCode()).toBe(403)
    const body = res.getJson() as { code?: string; subscriptionStatus?: string }
    expect(body.code).toBe('SUBSCRIPTION_INACTIVE')
    expect(body.subscriptionStatus).toBe('free')
  })

  it('bypasses check for platform admin email even when org status is free', async () => {
    cfg.paywallEnabled = true
    cfg.orgStatus = 'free'
    cfg.userEmail = 'boss@example.com'
    const next = vi.fn()
    const res = createRes()
    await requireOrgSubscriptionForApp(
      { auth: { userId: 'u1', orgId: 'o1' } } as any,
      res as any,
      next
    )
    expect(next).toHaveBeenCalled()
    expect(getOrgSubscriptionStatus).not.toHaveBeenCalled()
  })

  it('does not look up user for API key auth and still evaluates subscription', async () => {
    cfg.paywallEnabled = true
    cfg.orgStatus = 'expired'
    const { prisma } = await import('../lib/prisma.js')
    vi.mocked(prisma.user.findUnique).mockClear()
    const next = vi.fn()
    const res = createRes()
    await requireOrgSubscriptionForApp(
      { auth: { userId: 'apikey:key1', orgId: 'o1' } } as any,
      res as any,
      next
    )
    expect(vi.mocked(prisma.user.findUnique)).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
    expect(res.getStatusCode()).toBe(403)
  })
})
