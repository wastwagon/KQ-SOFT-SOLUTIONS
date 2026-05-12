import { prisma } from '../lib/prisma.js'
import { getLimits as getConfigLimits, PLAN_PRICES } from '../config/subscription.js'

export interface PlanLimits {
  projectsPerMonth: number
  transactionsPerMonth: number
}

export interface PlanPrices {
  monthlyGhs: number
  yearlyGhs: number
}

export interface PlanData extends PlanLimits, PlanPrices {
  slug: string
  name: string
}

let planCache: Map<string, PlanData> = new Map()
let cacheTs = 0
const CACHE_TTL_MS = 60_000 // 1 min

async function loadPlansFromDb(): Promise<Map<string, PlanData>> {
  // Include inactive rows so public pricing + admin stay aligned (inactive tiers
  // were previously invisible here and fell back to PLAN_PRICES / stale amounts).
  const plans = await prisma.plan.findMany({ orderBy: { slug: 'asc' } })
  const m = new Map<string, PlanData>()
  for (const p of plans) {
    m.set(p.slug, {
      slug: p.slug,
      name: p.name,
      projectsPerMonth: p.projectsPerMonth,
      transactionsPerMonth: p.transactionsPerMonth,
      monthlyGhs: p.monthlyGhs,
      yearlyGhs: p.yearlyGhs,
    })
  }
  return m
}

export async function getPlanBySlug(slug: string): Promise<PlanData | null> {
  if (Date.now() - cacheTs > CACHE_TTL_MS) {
    planCache = await loadPlansFromDb()
    cacheTs = Date.now()
  }
  const fromDb = planCache.get(slug)
  if (fromDb) return fromDb
  // Fallback to config
  const limits = getConfigLimits(slug)
  const prices = PLAN_PRICES[slug]
  if (!prices) return null
  return {
    slug,
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    projectsPerMonth: limits.projectsPerMonth,
    transactionsPerMonth: limits.transactionsPerMonth,
    monthlyGhs: prices.monthlyGhs,
    yearlyGhs: prices.yearlyGhs,
  }
}

export function invalidatePlanCache() {
  cacheTs = 0
}
