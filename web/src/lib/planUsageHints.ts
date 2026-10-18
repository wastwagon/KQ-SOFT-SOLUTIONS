/** Shared plan-quota messaging for dashboard and create flows. */

export type PlanUsageAlert = {
  tone: 'warning' | 'error'
  title: string
  body: string
}

type QuotaInput = {
  used: number
  limit: number
  unlimited?: boolean
  label: string
  atLimitBody: string
  nearLimitBody: string
}

const NEAR_RATIO = 0.8

function quotaAlert(input: QuotaInput): PlanUsageAlert | null {
  if (input.unlimited || input.limit < 0) return null
  // Free tier: 0 full clean exports is intentional — not an "at limit" error at 0/0.
  if (input.limit === 0 && input.used === 0) return null
  if (input.used >= input.limit) {
    return { tone: 'error', title: `${input.label} limit reached`, body: input.atLimitBody }
  }
  if (input.limit > 0 && input.used >= input.limit * NEAR_RATIO) {
    return { tone: 'warning', title: `Approaching ${input.label.toLowerCase()}`, body: input.nearLimitBody }
  }
  return null
}

export type SubscriptionUsageSlice = {
  projectsUsed?: number
  projectsLimit?: number
  projectsUnlimited?: boolean
  transactionsUsed?: number
  transactionsLimit?: number
  transactionsUnlimited?: boolean
  bankAccountsUsed?: number
  bankAccountsLimit?: number
  bankAccountsUnlimited?: boolean
  cleanExportsUsed?: number
  cleanExportsLimit?: number
  cleanExportsUnlimited?: boolean
  periodEndsAt?: string
}

export function planUsageAlerts(usage: SubscriptionUsageSlice | undefined): PlanUsageAlert[] {
  if (!usage) return []
  const reset = usage.periodEndsAt
    ? ` Usage resets ${new Date(usage.periodEndsAt).toLocaleDateString()}.`
    : ''

  const items: (PlanUsageAlert | null)[] = [
    quotaAlert({
      used: usage.projectsUsed ?? 0,
      limit: usage.projectsLimit ?? 0,
      unlimited: usage.projectsUnlimited,
      label: 'Monthly projects',
      atLimitBody: `You have used all ${usage.projectsLimit} projects on your plan this month. Upgrade in Settings → Billing to open more client periods.`,
      nearLimitBody: `${usage.projectsUsed} of ${usage.projectsLimit} projects used this month.${reset} Upgrade before you hit the cap.`,
    }),
    quotaAlert({
      used: usage.transactionsUsed ?? 0,
      limit: usage.transactionsLimit ?? 0,
      unlimited: usage.transactionsUnlimited,
      label: 'Monthly transactions',
      atLimitBody: `Imported volume reached your ${usage.transactionsLimit?.toLocaleString('en-GH')} line cap for this month. Upgrade or wait for the reset.${reset}`,
      nearLimitBody: `${(usage.transactionsUsed ?? 0).toLocaleString('en-GH')} of ${(usage.transactionsLimit ?? 0).toLocaleString('en-GH')} transaction lines this month.${reset}`,
    }),
    quotaAlert({
      used: usage.bankAccountsUsed ?? 0,
      limit: usage.bankAccountsLimit ?? 0,
      unlimited: usage.bankAccountsUnlimited,
      label: 'Bank accounts',
      atLimitBody: `All ${usage.bankAccountsLimit} org-wide bank account seats are in use. Archive an account or upgrade to add another.`,
      nearLimitBody: `${usage.bankAccountsUsed} of ${usage.bankAccountsLimit} bank account seats used across the firm.`,
    }),
    quotaAlert({
      used: usage.cleanExportsUsed ?? 0,
      limit: usage.cleanExportsLimit ?? 0,
      unlimited: usage.cleanExportsUnlimited,
      label: 'Full clean exports',
      atLimitBody: `You have used all ${usage.cleanExportsLimit} full Excel/PDF clean downloads this month. Sample exports stay free; upgrade for more full packs.${reset}`,
      nearLimitBody: `${usage.cleanExportsUsed} of ${usage.cleanExportsLimit} full clean exports used this month.${reset}`,
    }),
  ]
  return items.filter(Boolean) as PlanUsageAlert[]
}

export function isAtProjectLimit(usage: SubscriptionUsageSlice | undefined): boolean {
  if (!usage || usage.projectsUnlimited) return false
  const limit = usage.projectsLimit ?? 0
  if (limit < 0) return false
  return (usage.projectsUsed ?? 0) >= limit
}

export function usageMetricAccent(
  used: number,
  limit: number,
  unlimited?: boolean,
): 'amber' | 'none' {
  if (unlimited || limit < 0) return 'none'
  if (limit === 0 && used === 0) return 'none'
  if (used >= limit) return 'amber'
  if (limit > 0 && used >= limit * NEAR_RATIO) return 'amber'
  return 'none'
}
