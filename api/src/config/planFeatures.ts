/**
 * Plan-based feature gating.
 *
 * Defaults live in FEATURE_MIN_PLAN / USER_LIMIT_BY_PLAN. Super-admin CMS
 * values (Plan.features JSON + usersLimit) override these at runtime via
 * `setPlanRuntimeEntitlements` after the plan cache loads.
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

export const PLAN_FEATURE_IDS: PlanFeature[] = [
  'bank_rules',
  'bulk_match',
  'ai_suggestions',
  'audit_trail',
  'discrepancy_report',
  'missing_cheques_report',
  'one_to_many',
  'many_to_many',
  'roll_forward',
  'threshold_approval',
  'full_branding',
  'firm_dashboard',
  'api_access',
  'multi_client',
]

export const PLAN_FEATURE_CATALOG: { id: PlanFeature; label: string; hint: string }[] = [
  { id: 'bulk_match', label: 'Bulk match', hint: 'Confirm many suggestions at once' },
  { id: 'ai_suggestions', label: 'AI match ranking', hint: 'Rank suggestions from confirmed pairs' },
  { id: 'bank_rules', label: 'Bank rules', hint: 'Auto-suggest/flag from description rules' },
  { id: 'audit_trail', label: 'Audit trail', hint: 'Workspace activity log' },
  { id: 'discrepancy_report', label: 'Discrepancy report', hint: 'Date/amount variance report' },
  { id: 'missing_cheques_report', label: 'Missing cheques report', hint: 'Unpresented cheques listing' },
  { id: 'one_to_many', label: 'One-to-many matches', hint: 'Split payments' },
  { id: 'many_to_many', label: 'Many-to-many matches', hint: 'Grouped matches' },
  { id: 'roll_forward', label: 'Roll forward', hint: 'Carry unpresented items to the next period' },
  { id: 'threshold_approval', label: 'Threshold approval', hint: 'Require review above an amount' },
  { id: 'full_branding', label: 'Full branding', hint: 'Logo, colours, custom footer on reports' },
  { id: 'firm_dashboard', label: 'Firm dashboard', hint: 'Practice overview on the home dashboard' },
  { id: 'api_access', label: 'REST API keys', hint: 'Programmatic access' },
  { id: 'multi_client', label: 'Multi-client workspace', hint: 'Clients module' },
]

const PLAN_ORDER = ['basic', 'standard', 'premium', 'firm'] as const

/** Minimum plan required for each feature (code defaults when CMS has no override). */
const FEATURE_MIN_PLAN: Record<PlanFeature, (typeof PLAN_ORDER)[number]> = {
  bank_rules: 'standard',
  bulk_match: 'basic',
  ai_suggestions: 'basic',
  audit_trail: 'standard',
  discrepancy_report: 'standard',
  missing_cheques_report: 'standard',
  one_to_many: 'premium',
  many_to_many: 'premium',
  roll_forward: 'premium',
  threshold_approval: 'premium',
  full_branding: 'standard',
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

/** Bulk / phased auto-match max pairs per request (all tiers). */
export const BULK_MATCH_LIMIT = 50

export type PlanRuntimeEntitlements = {
  features: Partial<Record<PlanFeature, boolean>>
  usersLimit?: number
  bankAccounts?: number
  cleanExportsPerMonth?: number
}

const runtimeBySlug = new Map<string, PlanRuntimeEntitlements>()

export function setPlanRuntimeEntitlements(
  slug: string,
  entitlements: PlanRuntimeEntitlements | null
): void {
  if (!entitlements) runtimeBySlug.delete(slug)
  else runtimeBySlug.set(slug, entitlements)
}

export function replacePlanRuntimeEntitlements(
  all: Record<string, PlanRuntimeEntitlements>
): void {
  runtimeBySlug.clear()
  for (const [slug, ent] of Object.entries(all)) runtimeBySlug.set(slug, ent)
}

export function clearPlanRuntimeEntitlements(): void {
  runtimeBySlug.clear()
}

export function peekPlanRuntimeEntitlements(slug: string): PlanRuntimeEntitlements | undefined {
  return runtimeBySlug.get(slug)
}

export function planRank(plan: string): number {
  const idx = PLAN_ORDER.indexOf(plan as (typeof PLAN_ORDER)[number])
  return idx >= 0 ? idx : -1
}

export function defaultHasPlanFeature(plan: string, feature: PlanFeature): boolean {
  const minPlan = FEATURE_MIN_PLAN[feature]
  const minRank = planRank(minPlan)
  const planRankVal = planRank(plan)
  if (planRankVal < 0) return false
  return planRankVal >= minRank
}

export function defaultFeaturesForPlan(plan: string): Record<PlanFeature, boolean> {
  return Object.fromEntries(
    PLAN_FEATURE_IDS.map((f) => [f, defaultHasPlanFeature(plan, f)])
  ) as Record<PlanFeature, boolean>
}

export function parseStoredFeatures(raw: unknown): Partial<Record<PlanFeature, boolean>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Partial<Record<PlanFeature, boolean>> = {}
  for (const id of PLAN_FEATURE_IDS) {
    const v = (raw as Record<string, unknown>)[id]
    if (typeof v === 'boolean') out[id] = v
  }
  return out
}

/** True when the CMS JSON is null, missing, or has no recognised feature flags. */
export function isStoredFeaturesEmpty(raw: unknown): boolean {
  return Object.keys(parseStoredFeatures(raw)).length === 0
}

export function mergePlanFeatures(
  plan: string,
  stored: unknown
): Record<PlanFeature, boolean> {
  return {
    ...defaultFeaturesForPlan(plan),
    ...parseStoredFeatures(stored),
  }
}

export function hasPlanFeature(plan: string, feature: PlanFeature): boolean {
  const runtime = runtimeBySlug.get(plan)?.features?.[feature]
  if (typeof runtime === 'boolean') return runtime
  return defaultHasPlanFeature(plan, feature)
}

export function getUserLimit(plan: string): number {
  const runtime = runtimeBySlug.get(plan)?.usersLimit
  if (typeof runtime === 'number' && Number.isFinite(runtime)) {
    return runtime < 0 ? -1 : runtime
  }
  const limit = USER_LIMIT_BY_PLAN[plan] ?? USER_LIMIT_BY_PLAN.basic
  return limit < 0 ? -1 : limit
}
