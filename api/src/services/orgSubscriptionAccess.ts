import { prisma } from '../lib/prisma.js'
import { getSubscriptionSnapshot, type SubscriptionStatus } from './subscriptionState.js'
import { fetchSubscriptionOverrides } from './subscriptionOverrides.js'

const SUBSCRIPTION_CACHE_TTL_MS = 60_000
const subscriptionStatusCache = new Map<string, { status: SubscriptionStatus; expiresAt: number }>()

export function isSubscriptionPaywallEnabled(): boolean {
  return process.env.SUBSCRIPTION_PAYWALL === 'true'
}

/** True when this status should block core app routes (not subscription/settings). */
export function subscriptionStatusBlocksAppAccess(status: SubscriptionStatus): boolean {
  return status === 'expired' || status === 'free'
}

export function invalidateOrgSubscriptionCache(orgId?: string): void {
  if (orgId) subscriptionStatusCache.delete(orgId)
  else subscriptionStatusCache.clear()
}

export async function getOrgSubscriptionStatus(orgId: string): Promise<SubscriptionStatus> {
  const now = Date.now()
  const cached = subscriptionStatusCache.get(orgId)
  if (cached && now < cached.expiresAt) return cached.status

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { createdAt: true },
  })
  if (!org) return 'free'
  const [latestPayment, overrides] = await Promise.all([
    prisma.payment.findFirst({
      where: { organizationId: orgId, status: 'success' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, period: true, amount: true },
    }),
    fetchSubscriptionOverrides(orgId),
  ])
  const status = getSubscriptionSnapshot(org, latestPayment, overrides).status
  subscriptionStatusCache.set(orgId, { status, expiresAt: now + SUBSCRIPTION_CACHE_TTL_MS })
  return status
}
