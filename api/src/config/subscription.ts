/**
 * Subscription tier limits — Sep 2026 catalogue (Solo / Team / Firm / Custom).
 * Slugs stay basic / standard / premium / firm so existing subscriptions resolve.
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
    /** Full Tools clean Excel/PDF exports per month (-1 = unlimited). Sample downloads free. */
    cleanExportsPerMonth: number
  }
> = {
  basic: {
    projectsPerMonth: 12,
    transactionsPerMonth: TIER_TRANSACTION_LIMITS.basic,
    bankAccounts: 3,
    cleanExportsPerMonth: 5,
  },
  standard: {
    projectsPerMonth: 40,
    transactionsPerMonth: TIER_TRANSACTION_LIMITS.standard,
    bankAccounts: 10,
    cleanExportsPerMonth: 20,
  },
  premium: {
    projectsPerMonth: 100,
    transactionsPerMonth: TIER_TRANSACTION_LIMITS.premium,
    bankAccounts: 30,
    cleanExportsPerMonth: 60,
  },
  firm: {
    projectsPerMonth: -1,
    transactionsPerMonth: TIER_TRANSACTION_LIMITS.firm,
    bankAccounts: -1,
    cleanExportsPerMonth: -1,
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
  basic: { monthlyGhs: 199, yearlyGhs: 1990, quarterlyGhs: 567 },
  standard: { monthlyGhs: 399, yearlyGhs: 3990, quarterlyGhs: 1137 },
  premium: { monthlyGhs: 990, yearlyGhs: 9900, quarterlyGhs: 2822 },
  firm: { monthlyGhs: 0, yearlyGhs: 0, quarterlyGhs: 0 }, // custom contract, from GHS 1,800
}

/** Public names. Slugs are unchanged. */
export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  basic: 'Solo',
  standard: 'Team',
  premium: 'Firm',
  firm: 'Custom',
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
  basic: new Set([0, 150, 300]),
  standard: new Set([50, 400, 900]),
  premium: new Set([100, 900, 1500]),
}

export function isLegacyMonthlyPrice(slug: string, monthlyGhs: number): boolean {
  const set = LEGACY_MONTHLY_GHS[slug]
  if (!set) return false
  return set.has(monthlyGhs)
}

/**
 * Resolve checkout / public prices.
 * Admin CMS values win. Catalogue fills missing quarterly (0) and empty rows.
 * Legacy monthly amounts are healed only by `seed-plans.ts`, not at read time —
 * otherwise an admin setting Premium to 900 GHS would be silently overwritten.
 */
export function resolvePlanPrices(
  slug: string,
  db: { monthlyGhs: number; yearlyGhs: number; quarterlyGhs?: number } | null | undefined
): { monthlyGhs: number; yearlyGhs: number; quarterlyGhs: number } {
  const catalogue = PLAN_PRICES[slug] ?? PLAN_PRICES.basic
  if (!db) return { ...catalogue }
  const quarterly =
    typeof db.quarterlyGhs === 'number' && db.quarterlyGhs > 0
      ? db.quarterlyGhs
      : catalogue.quarterlyGhs
  return {
    monthlyGhs: db.monthlyGhs,
    yearlyGhs: db.yearlyGhs,
    quarterlyGhs: quarterly,
  }
}
