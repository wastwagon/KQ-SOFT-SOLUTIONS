/**
 * Subscription tier limits - matches PLANNING_DATA.json / Jul 2026 pricing
 * -1 = unlimited
 *
 * Primary commercial quotas: org-wide bank accounts + monthly transactions.
 * `bankAccounts` is enforced across the organisation (not per project).
 */
import { TIER_TRANSACTION_LIMITS } from './importLimits.js'

export const TIER_LIMITS: Record<
  string,
  {
    projectsPerMonth: number
    transactionsPerMonth: number
    /** Org-wide bank account seats (-1 = unlimited). */
    bankAccounts: number
  }
> = {
  basic: {
    projectsPerMonth: 10,
    transactionsPerMonth: TIER_TRANSACTION_LIMITS.basic,
    bankAccounts: 5,
  },
  standard: {
    projectsPerMonth: 30,
    transactionsPerMonth: TIER_TRANSACTION_LIMITS.standard,
    bankAccounts: 10,
  },
  premium: {
    projectsPerMonth: 100,
    transactionsPerMonth: TIER_TRANSACTION_LIMITS.premium,
    bankAccounts: 30,
  },
  firm: {
    projectsPerMonth: -1,
    transactionsPerMonth: TIER_TRANSACTION_LIMITS.firm,
    bankAccounts: -1,
  },
}

/**
 * Plan prices in GHS — fallback when no DB row; keep aligned with seed + admin defaults.
 * Annual ≈ 10× monthly (~17% off). Quarterly ≈ 2.85× monthly (~5% off).
 */
export const PLAN_PRICES: Record<
  string,
  { monthlyGhs: number; yearlyGhs: number; quarterlyGhs: number }
> = {
  basic: { monthlyGhs: 300, yearlyGhs: 3000, quarterlyGhs: 855 },
  standard: { monthlyGhs: 900, yearlyGhs: 9000, quarterlyGhs: 2565 },
  premium: { monthlyGhs: 1500, yearlyGhs: 15000, quarterlyGhs: 4275 },
  firm: { monthlyGhs: 0, yearlyGhs: 0, quarterlyGhs: 0 }, // custom contract
}

/** Intro: 50% off first N paid periods (self-serve tiers). */
export const INTRO_OFFER_DISCOUNT = 0.5
export const INTRO_OFFER_MONTHS = 2

export function getLimits(plan: string) {
  return TIER_LIMITS[plan] ?? TIER_LIMITS.basic
}

export function isUnlimited(limit: number) {
  return limit < 0
}

export function planAmountForPeriod(
  prices: { monthlyGhs: number; yearlyGhs: number; quarterlyGhs?: number },
  period: 'monthly' | 'quarterly' | 'yearly'
): number {
  if (period === 'yearly') return prices.yearlyGhs
  if (period === 'quarterly') return prices.quarterlyGhs ?? Math.round(prices.monthlyGhs * 2.85)
  return prices.monthlyGhs
}

/**
 * Pre–Jul 2026 catalogue amounts (and inverted live experiments).
 * Used to auto-heal public/billing prices until FORCE_PLAN_RESET is run.
 */
const LEGACY_MONTHLY_GHS: Record<string, ReadonlySet<number>> = {
  basic: new Set([0, 150]),
  standard: new Set([50, 400]),
  premium: new Set([100, 900]),
}

export function isLegacyMonthlyPrice(slug: string, monthlyGhs: number): boolean {
  const set = LEGACY_MONTHLY_GHS[slug]
  if (!set) return false
  return set.has(monthlyGhs)
}

/** Prefer catalogue prices when the DB row still has a known legacy monthly amount. */
export function resolvePlanPrices(
  slug: string,
  db: { monthlyGhs: number; yearlyGhs: number } | null | undefined
): { monthlyGhs: number; yearlyGhs: number; quarterlyGhs: number } {
  const catalogue = PLAN_PRICES[slug] ?? PLAN_PRICES.basic
  if (!db || isLegacyMonthlyPrice(slug, db.monthlyGhs)) {
    return { ...catalogue }
  }
  return {
    monthlyGhs: db.monthlyGhs,
    yearlyGhs: db.yearlyGhs,
    quarterlyGhs: catalogue.quarterlyGhs,
  }
}
