import { prisma } from '../lib/prisma.js'
import {
  getLimits as getConfigLimits,
  PLAN_PRICES,
  resolvePlanPrices,
  TIER_LIMITS,
} from '../config/subscription.js'
import {
  mergePlanFeatures,
  replacePlanRuntimeEntitlements,
  type PlanFeature,
  type PlanRuntimeEntitlements,
} from '../config/planFeatures.js'

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
  features: Record<PlanFeature, boolean>
  active: boolean
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
}

async function loadPlansFromDb(): Promise<Map<string, PlanData>> {
  const plans = await prisma.plan.findMany({ orderBy: { slug: 'asc' } })
  const m = new Map<string, PlanData>()
  for (const p of plans) {
    const prices = resolvePlanPrices(p.slug, p)
    const limits = resolveLimits(p)
    const catalogue = TIER_LIMITS[p.slug] ?? TIER_LIMITS.basic
    m.set(p.slug, {
      slug: p.slug,
      name: p.slug === 'firm' ? (p.name || 'Custom') : p.name,
      projectsPerMonth: limits.projectsPerMonth,
      transactionsPerMonth: limits.transactionsPerMonth,
      monthlyGhs: prices.monthlyGhs,
      yearlyGhs: prices.yearlyGhs,
      quarterlyGhs: prices.quarterlyGhs,
      bankAccounts: typeof p.bankAccounts === 'number' ? p.bankAccounts : catalogue.bankAccounts,
      cleanExportsPerMonth:
        typeof p.cleanExportsPerMonth === 'number' ? p.cleanExportsPerMonth : catalogue.cleanExportsPerMonth,
      usersLimit: typeof p.usersLimit === 'number' ? p.usersLimit : p.slug === 'firm' ? -1 : p.slug === 'premium' ? 5 : p.slug === 'standard' ? 3 : 1,
      features: mergePlanFeatures(p.slug, p.features),
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

export const CANONICAL_PLAN_SLUGS = ['basic', 'standard', 'premium', 'firm'] as const

async function ensureCache(): Promise<void> {
  if (cacheTs === 0 || planCache.size === 0 || Date.now() - cacheTs > CACHE_TTL_MS) {
    await refreshPlanCache()
  }
}

export async function listPlans(): Promise<PlanData[]> {
  const out: PlanData[] = []
  for (const slug of CANONICAL_PLAN_SLUGS) {
    const p = await getPlanBySlug(slug)
    if (p) out.push(p)
  }
  return out
}

export function isSelfServePlan(p: PlanData): boolean {
  if (p.slug === 'firm') return false
  if (!p.active) return false
  return p.monthlyGhs > 0 || p.yearlyGhs > 0 || p.quarterlyGhs > 0
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
  return {
    slug,
    name: slug === 'firm' ? 'Custom' : slug.charAt(0).toUpperCase() + slug.slice(1),
    projectsPerMonth: limits.projectsPerMonth,
    transactionsPerMonth: limits.transactionsPerMonth,
    monthlyGhs: prices.monthlyGhs,
    yearlyGhs: prices.yearlyGhs,
    quarterlyGhs: prices.quarterlyGhs,
    bankAccounts: limits.bankAccounts,
    cleanExportsPerMonth: limits.cleanExportsPerMonth,
    usersLimit: slug === 'firm' ? -1 : slug === 'premium' ? 5 : slug === 'standard' ? 3 : 1,
    features: mergePlanFeatures(slug, null),
    active: true,
  }
}

export function invalidatePlanCache() {
  cacheTs = 0
}
