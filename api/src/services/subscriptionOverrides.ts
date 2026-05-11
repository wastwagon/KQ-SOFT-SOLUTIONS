import { prisma } from '../lib/prisma.js'
import type { SubscriptionOverrides } from './subscriptionState.js'

/** Platform admin overrides for trial end and forced subscription status. */
export async function fetchSubscriptionOverrides(orgId: string): Promise<SubscriptionOverrides> {
  const [trialOverride, statusOverride] = await Promise.all([
    prisma.platformSettings.findUnique({ where: { key: `org_trial_override:${orgId}` }, select: { value: true } }),
    prisma.platformSettings.findUnique({
      where: { key: `org_subscription_status_override:${orgId}` },
      select: { value: true },
    }),
  ])
  const trialEndsAtRaw = (trialOverride?.value as { trialEndsAt?: string } | null)?.trialEndsAt
  const trialEndsAt = trialEndsAtRaw ? new Date(trialEndsAtRaw) : null
  const status =
    (statusOverride?.value as { status?: 'trial' | 'active' | 'expired' | 'free' } | null)?.status ?? null
  return {
    trialEndsAt: trialEndsAt && !Number.isNaN(trialEndsAt.getTime()) ? trialEndsAt : null,
    status,
  }
}
