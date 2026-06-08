/** Yearly savings vs paying monthly × 12. Returns null when not applicable. */
export function yearlyDiscountPercent(monthlyGhs: number, yearlyGhs: number): number | null {
  if (monthlyGhs <= 0 || yearlyGhs <= 0) return null
  const fullYear = monthlyGhs * 12
  if (yearlyGhs >= fullYear) return null
  return Math.round(((fullYear - yearlyGhs) / fullYear) * 100)
}

export function formatYearlyDiscountLabel(monthlyGhs: number, yearlyGhs: number): string {
  const pct = yearlyDiscountPercent(monthlyGhs, yearlyGhs)
  return pct != null && pct > 0 ? `${pct}% off` : 'annual billing'
}

/** Highest yearly discount across paid tiers (for landing-page copy). */
export function maxYearlyDiscountPercent(
  plans: { monthlyGhs: number; yearlyGhs: number }[]
): number | null {
  let max: number | null = null
  for (const p of plans) {
    const pct = yearlyDiscountPercent(p.monthlyGhs, p.yearlyGhs)
    if (pct != null && (max == null || pct > max)) max = pct
  }
  return max
}
