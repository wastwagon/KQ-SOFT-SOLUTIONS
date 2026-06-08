import { prisma } from '../lib/prisma.js'
import type { SubscriptionOverrides, SubscriptionStatus } from './subscriptionState.js'

function parseSubscriptionOverrides(
  trialValue: unknown,
  statusValue: unknown
): SubscriptionOverrides {
  const trialEndsAtRaw = (trialValue as { trialEndsAt?: string } | null)?.trialEndsAt
  const trialEndsAt = trialEndsAtRaw ? new Date(trialEndsAtRaw) : null
  const status =
    (statusValue as { status?: SubscriptionStatus } | null)?.status ?? null
  return {
    trialEndsAt: trialEndsAt && !Number.isNaN(trialEndsAt.getTime()) ? trialEndsAt : null,
    status,
  }
}

/** Platform admin overrides for trial end and forced subscription status. */
export async function fetchSubscriptionOverrides(orgId: string): Promise<SubscriptionOverrides> {
  const [trialOverride, statusOverride] = await Promise.all([
    prisma.platformSettings.findUnique({ where: { key: `org_trial_override:${orgId}` }, select: { value: true } }),
    prisma.platformSettings.findUnique({
      where: { key: `org_subscription_status_override:${orgId}` },
      select: { value: true },
    }),
  ])
  return parseSubscriptionOverrides(trialOverride?.value, statusOverride?.value)
}

/** Batch-fetch overrides for org list endpoints (avoids N+1). */
export async function fetchSubscriptionOverridesBatch(
  orgIds: string[]
): Promise<Map<string, SubscriptionOverrides>> {
  const result = new Map<string, SubscriptionOverrides>()
  if (orgIds.length === 0) return result

  const keys = orgIds.flatMap((id) => [
    `org_trial_override:${id}`,
    `org_subscription_status_override:${id}`,
  ])
  const settings = await prisma.platformSettings.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  })
  const byKey = new Map(settings.map((s) => [s.key, s.value]))

  for (const orgId of orgIds) {
    result.set(
      orgId,
      parseSubscriptionOverrides(
        byKey.get(`org_trial_override:${orgId}`),
        byKey.get(`org_subscription_status_override:${orgId}`)
      )
    )
  }
  return result
}
