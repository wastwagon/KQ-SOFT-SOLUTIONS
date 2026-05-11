import { prisma } from '../lib/prisma.js'
import { getSubscriptionSnapshot, type SubscriptionStatus } from './subscriptionState.js'
import { fetchSubscriptionOverrides } from './subscriptionOverrides.js'

export function isSubscriptionPaywallEnabled(): boolean {
  return process.env.SUBSCRIPTION_PAYWALL === 'true'
}

/** True when this status should block core app routes (not subscription/settings). */
export function subscriptionStatusBlocksAppAccess(status: SubscriptionStatus): boolean {
  return status === 'expired' || status === 'free'
}

export async function getOrgSubscriptionStatus(orgId: string): Promise<SubscriptionStatus> {
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
  return getSubscriptionSnapshot(org, latestPayment, overrides).status
}
