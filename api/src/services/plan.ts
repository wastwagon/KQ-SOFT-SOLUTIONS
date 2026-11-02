import { prisma } from '../lib/prisma.js'
import {
  getLimits as getConfigLimits,
  PLAN_DISPLAY_NAMES,
  PLAN_PRICES,
  resolvePlanPrices,
  TIER_LIMITS,
} from '../config/subscription.js'
import {
  mergePlanFeatures,
  replacePlanRuntimeEntitlements,
  replacePlanSlugRanks,
  USER_LIMIT_BY_PLAN,
  type PlanFeature,
  type PlanRuntimeEntitlements,
} from '../config/planFeatures.js'
import {
  applyFeatureFlagsToMarketingMatrix,
  applyQuotaToMarketingMatrix,
  parseStoredMarketing,
  syncMarketingQuotaProse,
  type PlanMarketing,
} from '../lib/planMarketing.js'

export interface PlanLimits {
  projectsPerMonth: number
  transactionsPerMonth: number
}

export interface PlanPrices {
  monthlyGhs: number
  yearlyGhs: number
  quarterlyGhs: number
}

export interface PlanData extends PlanLimits, PlanPrices {
  slug: string
  name: string
  bankAccounts: number
  cleanExportsPerMonth: number
  usersLimit: number
  features: Record<string, boolean>
  marketing: PlanMarketing
  sortOrder: number
  showOnPublic: boolean
  active: boolean
}

function resolveMarketing(
  slug: string,
  stored: unknown,
  quotas: {
    bankAccounts: number
    projectsPerMonth: number
    transactionsPerMonth: number
    usersLimit: number
  },
  features: Record<string, boolean>
): PlanMarketing {
  let marketing = parseStoredMarketing(stored, slug)
  marketing = applyQuotaToMarketingMatrix(marketing, quotas)
  marketing = syncMarketingQuotaProse(marketing, quotas)
  marketing = applyFeatureFlagsToMarketingMatrix(marketing, features)
  return marketing
}

let planCache: Map<string, PlanData> = new Map()
let cacheTs = 0
const CACHE_TTL_MS = 60_000 // 1 min

/** Trust Plan rows from the CMS. Legacy 500/2000/10000 txn caps are healed only in seed-plans. */
function resolveLimits(db: { projectsPerMonth: number; transactionsPerMonth: number }): PlanLimits {
  return {
    projectsPerMonth: db.projectsPerMonth,
    transactionsPerMonth: db.transactionsPerMonth,
  }
}

function publishRuntimeEntitlements(plans: Map<string, PlanData>) {
  const all: Record<string, PlanRuntimeEntitlements> = {}
  for (const [slug, p] of plans) {
    all[slug] = {
      features: p.features,
      usersLimit: p.usersLimit,
      bankAccounts: p.bankAccounts,
      cleanExportsPerMonth: p.cleanExportsPerMonth,
    }
  }
  replacePlanRuntimeEntitlements(all)
  const sorted = [...plans.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug)
  )
  const ranks: Record<string, number> = {}
  sorted.forEach((p, index) => {
    ranks[p.slug] = index
  })
  replacePlanSlugRanks(ranks)
}

async function loadPlansFromDb(): Promise<Map<string, PlanData>> {
  const plans = await prisma.plan.findMany({ orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }] })
  const m = new Map<string, PlanData>()
  for (const p of plans) {
    const prices = resolvePlanPrices(p.slug, p)
    const limits = resolveLimits(p)
    const catalogue = TIER_LIMITS[p.slug] ?? TIER_LIMITS.basic
    const bankAccounts = typeof p.bankAccounts === 'number' ? p.bankAccounts : catalogue.bankAccounts
    const cleanExportsPerMonth =
      typeof p.cleanExportsPerMonth === 'number' ? p.cleanExportsPerMonth : catalogue.cleanExportsPerMonth
    const usersLimit = typeof p.usersLimit === 'number' ? p.usersLimit : (USER_LIMIT_BY_PLAN[p.slug] ?? 1)
    const features = mergePlanFeatures(p.slug, p.features)
    const quotas = {
      bankAccounts,
      projectsPerMonth: limits.projectsPerMonth,
      transactionsPerMonth: limits.transactionsPerMonth,
      usersLimit,
    }
    m.set(p.slug, {
      slug: p.slug,
      name: p.slug === 'firm' ? (p.name || 'Custom') : p.name,
      projectsPerMonth: limits.projectsPerMonth,
      transactionsPerMonth: limits.transactionsPerMonth,
      monthlyGhs: prices.monthlyGhs,
      yearlyGhs: prices.yearlyGhs,
      quarterlyGhs: prices.quarterlyGhs,
      bankAccounts,
      cleanExportsPerMonth,
      usersLimit,
      features,
      marketing: resolveMarketing(p.slug, p.marketing, quotas, features),
      sortOrder: typeof p.sortOrder === 'number' ? p.sortOrder : 0,
      showOnPublic: p.showOnPublic !== false,
      active: p.active !== false,
    })
  }
  publishRuntimeEntitlements(m)
  return m
}

export async function refreshPlanCache(): Promise<void> {
  planCache = await loadPlansFromDb()
  cacheTs = Date.now()
}

export const CANONICAL_PLAN_SLUGS = ['free', 'basic', 'standard', 'premium', 'firm'] as const

async function ensureCache(): Promise<void> {
  if (cacheTs === 0 || planCache.size === 0 || Date.now() - cacheTs > CACHE_TTL_MS) {
    await refreshPlanCache()
  }
}

export async function listPlans(options?: { publicSite?: boolean }): Promise<PlanData[]> {
  await ensureCache()
  let out = [...planCache.values()]
  if (options?.publicSite) {
    out = out.filter((p) => p.showOnPublic !== false)
  }
  out.sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug))
  const seen = new Set(out.map((p) => p.slug))
  for (const slug of CANONICAL_PLAN_SLUGS) {
    if (seen.has(slug)) continue
    const p = await getPlanBySlug(slug)
    if (p) {
      out.push(p)
      seen.add(slug)
    }
  }
  out.sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug))
  return out
}

export function isSelfServePlan(p: PlanData): boolean {
  if (!p.active) return false
  if (p.slug === 'firm') return false
  return p.monthlyGhs > 0 || p.yearlyGhs > 0 || p.quarterlyGhs > 0
}

/** Contract / sales-led billing — subscribers cannot change this plan via Paystack self-serve. */
export function isContractBillingPlan(p: PlanData): boolean {
  if (p.slug === 'firm') return true
  if (p.slug === 'free') return false
  return !isSelfServePlan(p)
}

export function isContractBillingPlanSlug(slug: string): boolean {
  if (slug === 'firm') return true
  const cached = planCache.get(slug)
  if (!cached) return false
  return isContractBillingPlan(cached)
}

export async function listSelfServePlans(): Promise<PlanData[]> {
  return (await listPlans()).filter(isSelfServePlan)
}

export async function getPlanBySlug(slug: string): Promise<PlanData | null> {
  await ensureCache()
  const fromDb = planCache.get(slug)
  if (fromDb) return fromDb
  const limits = getConfigLimits(slug)
  const prices = PLAN_PRICES[slug]
  if (!prices) return null
  const usersLimit = USER_LIMIT_BY_PLAN[slug] ?? 1
  const features = mergePlanFeatures(slug, null)
  const quotas = {
    bankAccounts: limits.bankAccounts,
    projectsPerMonth: limits.projectsPerMonth,
    transactionsPerMonth: limits.transactionsPerMonth,
    usersLimit,
  }
  return {
    slug,
    name: PLAN_DISPLAY_NAMES[slug] ?? slug,
    projectsPerMonth: limits.projectsPerMonth,
    transactionsPerMonth: limits.transactionsPerMonth,
    monthlyGhs: prices.monthlyGhs,
    yearlyGhs: prices.yearlyGhs,
    quarterlyGhs: prices.quarterlyGhs,
    bankAccounts: limits.bankAccounts,
    cleanExportsPerMonth: limits.cleanExportsPerMonth,
    usersLimit,
    features,
    marketing: resolveMarketing(slug, null, quotas, features),
    sortOrder: CANONICAL_PLAN_SLUGS.indexOf(slug as (typeof CANONICAL_PLAN_SLUGS)[number]) * 10,
    showOnPublic: true,
    active: true,
  }
}

export function invalidatePlanCache() {
  cacheTs = 0
}
