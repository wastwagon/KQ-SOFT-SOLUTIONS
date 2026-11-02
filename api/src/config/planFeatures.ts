/**
 * Plan-based feature gating.
 *
 * Defaults live in FEATURE_MIN_PLAN / USER_LIMIT_BY_PLAN. Super-admin CMS
 * values (Plan.features JSON + usersLimit + sortOrder) override these at runtime via
 * `replacePlanRuntimeEntitlements` / `replacePlanSlugRanks` after the plan cache loads.
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
  { id: 'ai_suggestions', label: 'AI match ranking', hint: 'Rank suggestions; ⌘K natural-language workspace search' },
  { id: 'bank_rules', label: 'Bank rules', hint: 'Auto-suggest/flag from description rules' },
  { id: 'audit_trail', label: 'Audit trail', hint: 'Workspace activity log' },
  { id: 'discrepancy_report', label: 'Discrepancy report', hint: 'Date/amount variance report' },
  { id: 'missing_cheques_report', label: 'Missing cheques report', hint: 'Unpresented cheques listing' },
  { id: 'one_to_many', label: 'One-to-many matches', hint: 'Split payments (Solo and above)' },
  { id: 'many_to_many', label: 'Many-to-many matches', hint: 'Grouped matches (Solo and above)' },
  { id: 'roll_forward', label: 'Roll forward', hint: 'Carry unpresented items to the next period (Solo and above)' },
  { id: 'threshold_approval', label: 'Threshold approval', hint: 'Require review above an amount' },
  { id: 'full_branding', label: 'Full branding', hint: 'Logo, colours, custom footer on reports' },
  { id: 'firm_dashboard', label: 'Firm dashboard', hint: 'Practice overview on the home dashboard' },
  { id: 'api_access', label: 'REST API keys', hint: 'Programmatic access' },
  { id: 'multi_client', label: 'Multi-client workspace', hint: 'Clients module' },
]

const PLAN_ORDER = ['free', 'basic', 'standard', 'premium', 'firm'] as const

export type FeatureDepth = 'none' | 'partial' | 'full'

/**
 * Full access. A lower tier may still receive a partial version via FEATURE_PARTIAL_FROM.
 * Raising a minimum removes access — do not do that for a feature a tier already has.
 */
const FEATURE_FULL_FROM: Record<PlanFeature, (typeof PLAN_ORDER)[number]> = {
  bank_rules: 'standard',
  bulk_match: 'basic',
  ai_suggestions: 'basic',
  audit_trail: 'standard',
  discrepancy_report: 'basic',
  missing_cheques_report: 'basic',
  one_to_many: 'basic',
  many_to_many: 'basic',
  roll_forward: 'basic',
  threshold_approval: 'premium',
  full_branding: 'standard',
  firm_dashboard: 'premium',
  api_access: 'firm',
  multi_client: 'firm',
}

/** First plan that receives a capped version. Omitted features jump straight to full. */
const FEATURE_PARTIAL_FROM: Partial<Record<PlanFeature, (typeof PLAN_ORDER)[number]>> = {
  bulk_match: 'free',
  bank_rules: 'basic',
  audit_trail: 'free',
  discrepancy_report: 'free',
  missing_cheques_report: 'free',
  threshold_approval: 'standard',
}

const PARTIAL_BULK_PAIRS = 10
const FULL_BULK_PAIRS = 50
const FIRM_BULK_PAIRS = 100
/** Safety cap for one confirm on Custom. There is no monthly bulk cap. */
const CUSTOM_BULK_PAIRS = 500
const PARTIAL_BANK_RULES = 5
const FREE_AUDIT_ROWS = 25
const SOLO_AUDIT_ROWS = 100
const FULL_AUDIT_ROWS = 200
const PARTIAL_DISCREPANCY_ROWS = 5
const PARTIAL_CHEQUE_ROWS = 10
const FREE_AUDIT_DAYS = 14

export function catalogueFeatureDepth(plan: string, feature: PlanFeature): FeatureDepth {
  const rank = planRank(plan)
  if (rank < 0) return 'none'
  const fullAt = planRank(FEATURE_FULL_FROM[feature])
  const partialSlug = FEATURE_PARTIAL_FROM[feature]
  const partialAt = partialSlug ? planRank(partialSlug) : fullAt
  if (rank >= fullAt) return 'full'
  if (rank >= partialAt) return 'partial'
  return 'none'
}

/** User limit per plan (-1 = unlimited) */
export const USER_LIMIT_BY_PLAN: Record<string, number> = {
  free: 1,
  basic: 1,
  standard: 5,
  premium: 10,
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

/** CMS plan order (index by sortOrder) for feature-depth comparisons on custom slugs. */
let slugRank = new Map<string, number>()

export function replacePlanSlugRanks(ranks: Record<string, number>): void {
  slugRank = new Map(Object.entries(ranks))
}

export function clearPlanRuntimeEntitlements(): void {
  runtimeBySlug.clear()
  slugRank.clear()
}

export function peekPlanRuntimeEntitlements(slug: string): PlanRuntimeEntitlements | undefined {
  return runtimeBySlug.get(slug)
}

export function planRank(plan: string): number {
  const fromCms = slugRank.get(plan)
  if (fromCms != null) return fromCms
  const idx = PLAN_ORDER.indexOf(plan as (typeof PLAN_ORDER)[number])
  return idx >= 0 ? idx : -1
}

export function defaultHasPlanFeature(plan: string, feature: PlanFeature): boolean {
  return catalogueFeatureDepth(plan, feature) !== 'none'
}

/**
 * none / partial / full after CMS overrides.
 * A stored `false` turns the feature off. A stored `true` on a plan that
 * has no catalogue access grants full access. Otherwise the catalogue depth stands.
 */
export function featureDepth(plan: string, feature: PlanFeature): FeatureDepth {
  const runtime = runtimeBySlug.get(plan)?.features?.[feature]
  const catalogue = catalogueFeatureDepth(plan, feature)
  if (typeof runtime === 'boolean') {
    if (!runtime) return 'none'
    return catalogue === 'none' ? 'full' : catalogue
  }
  return catalogue
}

/** Pairs allowed in one bulk confirm. 0 = feature off. */
export function bulkMatchLimit(plan: string): number {
  const depth = featureDepth(plan, 'bulk_match')
  if (depth === 'none') return 0
  if (depth === 'partial') return PARTIAL_BULK_PAIRS
  const r = planRank(plan)
  if (r < 0) return FULL_BULK_PAIRS
  const firmR = planRank('firm')
  const premiumR = planRank('premium')
  if (firmR >= 0 && r >= firmR) return CUSTOM_BULK_PAIRS
  if (premiumR >= 0 && r >= premiumR) return FIRM_BULK_PAIRS
  return FULL_BULK_PAIRS
}

/** Bank rules an organisation may store. -1 = no cap. 0 = feature off. */
export function bankRuleLimit(plan: string): number {
  const depth = featureDepth(plan, 'bank_rules')
  if (depth === 'none') return 0
  if (depth === 'partial') return PARTIAL_BANK_RULES
  return -1
}

/** Audit rows returned by one request. */
export function auditListLimit(plan: string): number {
  const depth = featureDepth(plan, 'audit_trail')
  if (depth === 'none') return 0
  const r = planRank(plan)
  const freeR = planRank('free')
  const basicR = planRank('basic')
  if (freeR >= 0 && r === freeR) return FREE_AUDIT_ROWS
  if (basicR >= 0 && r === basicR) return SOLO_AUDIT_ROWS
  return FULL_AUDIT_ROWS
}

export function auditExportAllowed(plan: string): boolean {
  return featureDepth(plan, 'audit_trail') === 'full'
}

/** Free activity log only includes this many recent days. Higher plans are uncapped by date. */
export function auditHistoryDays(plan: string): number | null {
  if (featureDepth(plan, 'audit_trail') === 'none') return 0
  const r = planRank(plan)
  const freeR = planRank('free')
  if (freeR >= 0 && r === freeR) return FREE_AUDIT_DAYS
  return null
}

export function discrepancyRowCap(plan: string): number {
  const depth = featureDepth(plan, 'discrepancy_report')
  if (depth === 'none') return 0
  if (depth === 'partial') return PARTIAL_DISCREPANCY_ROWS
  return -1
}

export function missingChequeRowCap(plan: string): number {
  const depth = featureDepth(plan, 'missing_cheques_report')
  if (depth === 'none') return 0
  if (depth === 'partial') return PARTIAL_CHEQUE_ROWS
  return -1
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
): Record<string, boolean> {
  const merged: Record<string, boolean> = { ...defaultFeaturesForPlan(plan) }
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return merged
  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    if (typeof value === 'boolean') merged[key] = value
  }
  return merged
}

export function hasPlanFeature(plan: string, feature: PlanFeature): boolean {
  return featureDepth(plan, feature) !== 'none'
}

export function getUserLimit(plan: string): number {
  const runtime = runtimeBySlug.get(plan)?.usersLimit
  if (typeof runtime === 'number' && Number.isFinite(runtime)) {
    return runtime < 0 ? -1 : runtime
  }
  const limit = USER_LIMIT_BY_PLAN[plan] ?? USER_LIMIT_BY_PLAN.basic
  return limit < 0 ? -1 : limit
}
