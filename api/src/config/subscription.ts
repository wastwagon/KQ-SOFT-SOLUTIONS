/**
 * Subscription tier limits - matches PLANNING_DATA.json
 * -1 = unlimited
 */
import { TIER_TRANSACTION_LIMITS } from './importLimits.js'

export const TIER_LIMITS: Record<
  string,
  { projectsPerMonth: number; transactionsPerMonth: number; bankAccountsPerProject: number }
> = {
  basic: { projectsPerMonth: 5, transactionsPerMonth: TIER_TRANSACTION_LIMITS.basic, bankAccountsPerProject: 2 },
  standard: { projectsPerMonth: 20, transactionsPerMonth: TIER_TRANSACTION_LIMITS.standard, bankAccountsPerProject: -1 },
  premium: { projectsPerMonth: 100, transactionsPerMonth: TIER_TRANSACTION_LIMITS.premium, bankAccountsPerProject: -1 },
  firm: { projectsPerMonth: -1, transactionsPerMonth: TIER_TRANSACTION_LIMITS.firm, bankAccountsPerProject: -1 },
}

/** Plan prices in GHS — fallback when no DB row; keep aligned with seed + admin defaults */
export const PLAN_PRICES: Record<string, { monthlyGhs: number; yearlyGhs: number }> = {
  basic: { monthlyGhs: 150, yearlyGhs: 1500 },
  standard: { monthlyGhs: 50, yearlyGhs: 550 },
  premium: { monthlyGhs: 100, yearlyGhs: 1100 },
  firm: { monthlyGhs: 0, yearlyGhs: 0 }, // custom
}

export function getLimits(plan: string) {
  const limits = TIER_LIMITS[plan] ?? TIER_LIMITS.basic
  return limits
}

export function isUnlimited(limit: number) {
  return limit < 0
}
