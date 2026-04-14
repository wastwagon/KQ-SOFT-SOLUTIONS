/**
 * Subscription tier limits - matches PLANNING_DATA.json
 * -1 = unlimited
 */
export const TIER_LIMITS: Record<string, { projectsPerMonth: number; transactionsPerMonth: number }> = {
  basic: { projectsPerMonth: 5, transactionsPerMonth: 500 },
  standard: { projectsPerMonth: 20, transactionsPerMonth: 2000 },
  premium: { projectsPerMonth: 100, transactionsPerMonth: 10000 },
  firm: { projectsPerMonth: -1, transactionsPerMonth: -1 },
}

/** Plan prices in GHS (matches PLANNING_DATA.json) — amount in pesewas = GHS * 100 */
export const PLAN_PRICES: Record<string, { monthlyGhs: number; yearlyGhs: number }> = {
  basic: { monthlyGhs: 150, yearlyGhs: 1500 },
  standard: { monthlyGhs: 400, yearlyGhs: 4000 },
  premium: { monthlyGhs: 900, yearlyGhs: 9000 },
  firm: { monthlyGhs: 0, yearlyGhs: 0 }, // custom
}

export function getLimits(plan: string) {
  const limits = TIER_LIMITS[plan] ?? TIER_LIMITS.basic
  return limits
}

export function isUnlimited(limit: number) {
  return limit < 0
}
