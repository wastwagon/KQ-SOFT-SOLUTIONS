/**
 * Public, unauthenticated marketing endpoints.
 * Mounted *before* any auth-bearing routers in `index.ts`.
 *
 * Keep this surface minimal — only data that is safe to expose to the
 * public landing page (plan list, etc.). Never include user/org data here.
 *
 * Important: this endpoint must always return *all four* tiers (basic,
 * standard, premium, firm) so the landing-page comparison table is complete.
 * The `firm` tier is custom-priced — its monthlyGhs/yearlyGhs are 0 and the
 * UI renders that as "Custom".
 */
import { Router } from 'express'
import { PLAN_PRICES, getLimits } from '../config/subscription.js'
import { getPlanBySlug } from '../services/plan.js'

const router = Router()

export const PLAN_DISPLAY_ORDER = ['basic', 'standard', 'premium', 'firm'] as const

export interface PublicPlanResponse {
  id: string
  name: string
  monthlyGhs: number
  yearlyGhs: number
  projectsPerMonth: number
  transactionsPerMonth: number
}

/**
 * Build the canonical 4-tier plan list, falling back to config when a tier
 * has no DB row. Exported so it can be unit-tested directly without spinning
 * up an HTTP server.
 */
export async function buildPublicPlans(): Promise<PublicPlanResponse[]> {
  return Promise.all(
    PLAN_DISPLAY_ORDER.map(async (planId): Promise<PublicPlanResponse> => {
      const p = await getPlanBySlug(planId)
      if (p) {
        return {
          id: p.slug,
          name: p.name,
          monthlyGhs: p.monthlyGhs,
          yearlyGhs: p.yearlyGhs,
          projectsPerMonth: p.projectsPerMonth,
          transactionsPerMonth: p.transactionsPerMonth,
        }
      }
      const prices = PLAN_PRICES[planId]
      const limits = getLimits(planId)
      return {
        id: planId,
        name: planId.charAt(0).toUpperCase() + planId.slice(1),
        monthlyGhs: prices?.monthlyGhs ?? 0,
        yearlyGhs: prices?.yearlyGhs ?? 0,
        projectsPerMonth: limits.projectsPerMonth,
        transactionsPerMonth: limits.transactionsPerMonth,
      }
    })
  )
}

router.get('/plans', async (_req, res) => {
  const plans = await buildPublicPlans()
  // Light cache — plan data changes rarely, browsers/CDNs can cache for 5 min.
  res.set('Cache-Control', 'public, max-age=300, s-maxage=300')
  res.json({ plans })
})

export default router
