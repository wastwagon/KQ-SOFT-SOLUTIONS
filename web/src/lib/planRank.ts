const PLAN_ORDER = ['free', 'basic', 'standard', 'premium', 'firm'] as const

export function planRank(slug: string | null | undefined): number {
  if (!slug) return -1
  const idx = PLAN_ORDER.indexOf(slug as (typeof PLAN_ORDER)[number])
  return idx >= 0 ? idx : -1
}

export function isLowerPlan(current: string | undefined, target: string): boolean {
  const c = planRank(current)
  const t = planRank(target)
  if (c < 0 || t < 0) return false
  return t < c && current !== 'firm'
}
