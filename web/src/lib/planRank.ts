const PLAN_ORDER = ['free', 'basic', 'standard', 'premium', 'firm'] as const

export type PlanOrderRow = { slug: string; sortOrder: number; name?: string }

export function planRank(slug: string | null | undefined): number {
  if (!slug) return -1
  const idx = PLAN_ORDER.indexOf(slug as (typeof PLAN_ORDER)[number])
  return idx >= 0 ? idx : -1
}

function sortOrderForSlug(slug: string, order?: PlanOrderRow[]): number {
  const row = order?.find((p) => p.slug === slug)
  if (row != null) return row.sortOrder
  const legacy = planRank(slug)
  return legacy >= 0 ? legacy * 10 : 9999
}

export function isLowerPlan(
  current: string | undefined,
  target: string,
  planOrder?: PlanOrderRow[],
  options?: { contractBilling?: boolean }
): boolean {
  if (!current || current === target) return false
  if (options?.contractBilling) return false
  if (current === 'firm') return false
  const c = sortOrderForSlug(current, planOrder)
  const t = sortOrderForSlug(target, planOrder)
  return t < c
}

export function isSameOrHigherPlan(
  current: string | undefined,
  target: string,
  planOrder?: PlanOrderRow[]
): boolean {
  const c = sortOrderForSlug(current ?? 'free', planOrder)
  const t = sortOrderForSlug(target, planOrder)
  return t >= c
}
