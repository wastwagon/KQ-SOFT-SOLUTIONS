/**
 * Plan-based feature gating - matches PLANNING_DATA.json
 * basic < standard < premium < firm
 */
export type PlanFeature =
  | 'bank_rules'
  | 'bulk_match'
  | 'ai_suggestions'
  | 'audit_trail'
  | 'discrepancy_report'
  | 'missing_cheques_report'
  | 'one_to_many'
  | 'many_to_many'
  | 'roll_forward'
  | 'threshold_approval'
  | 'full_branding'
  | 'firm_dashboard'
  | 'api_access'
  | 'multi_client'

const PLAN_ORDER = ['basic', 'standard', 'premium', 'firm'] as const

/** Minimum plan required for each feature */
const FEATURE_MIN_PLAN: Record<PlanFeature, (typeof PLAN_ORDER)[number]> = {
  bank_rules: 'standard',
  bulk_match: 'standard',
  ai_suggestions: 'standard',
  audit_trail: 'standard',
  discrepancy_report: 'standard',
  missing_cheques_report: 'standard',
  one_to_many: 'premium',
  many_to_many: 'premium',
  roll_forward: 'premium',
  threshold_approval: 'premium',
  full_branding: 'premium',
  firm_dashboard: 'premium',
  api_access: 'firm',
  multi_client: 'firm',
}

/** User limit per plan (-1 = unlimited) */
export const USER_LIMIT_BY_PLAN: Record<string, number> = {
  basic: 1,
  standard: 3,
  premium: 5,
  firm: -1,
}

/** Bulk match max transactions for Standard+ (Basic = 0, no bulk) */
export const BULK_MATCH_LIMIT = 50

export function planRank(plan: string): number {
  const idx = PLAN_ORDER.indexOf(plan as (typeof PLAN_ORDER)[number])
  return idx >= 0 ? idx : -1
}

export function hasPlanFeature(plan: string, feature: PlanFeature): boolean {
  const minPlan = FEATURE_MIN_PLAN[feature]
  const minRank = planRank(minPlan)
  const planRankVal = planRank(plan)
  if (planRankVal < 0) return false
  return planRankVal >= minRank
}

export function getUserLimit(plan: string): number {
  const limit = USER_LIMIT_BY_PLAN[plan] ?? USER_LIMIT_BY_PLAN.basic
  return limit < 0 ? -1 : limit
}
