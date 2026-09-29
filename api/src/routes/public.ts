/**
 * Public, unauthenticated marketing endpoints.
 * Mounted *before* any auth-bearing routers in `index.ts`.
 *
 * Keep this surface minimal — only data that is safe to expose to the
 * public landing page (plan list, etc.). Never include user/org data here.
 *
 * Important: this endpoint must always return every catalogue tier (free, basic,
 * standard, premium, firm) so the landing-page comparison table is complete.
 * The `firm` tier is custom-priced — its monthlyGhs/yearlyGhs are 0 and the
 * UI renders that as "Custom".
 */
import { Router } from 'express'
import { INTRO_OFFER_MONTHS } from '../config/subscription.js'
import { isIntroOfferEnvEnabled } from '../services/introOffer.js'
import { CANONICAL_PLAN_SLUGS, listPlans } from '../services/plan.js'
import leadsPublicRouter from './leadsPublic.js'

const router = Router()

export const PLAN_DISPLAY_ORDER = CANONICAL_PLAN_SLUGS

export interface PublicPlanResponse {
  id: string
  name: string
  monthlyGhs: number
  yearlyGhs: number
  quarterlyGhs: number
  projectsPerMonth: number
  transactionsPerMonth: number
  bankAccounts: number
  cleanExportsPerMonth: number
  usersLimit: number
  features: Record<string, boolean>
  active: boolean
}

/**
 * Build the canonical plan list from the CMS cache, falling back to
 * catalogue config when a tier has no DB row. Inactive packages stay here so
 * the landing comparison table stays complete; checkout filters them out.
 */
export async function buildPublicPlans(): Promise<PublicPlanResponse[]> {
  const plans = await listPlans()
  return plans.map((p) => ({
    id: p.slug,
    name: p.name,
    monthlyGhs: p.monthlyGhs,
    yearlyGhs: p.yearlyGhs,
    quarterlyGhs: p.quarterlyGhs,
    projectsPerMonth: p.projectsPerMonth,
    transactionsPerMonth: p.transactionsPerMonth,
    bankAccounts: p.bankAccounts,
    cleanExportsPerMonth: p.cleanExportsPerMonth,
    usersLimit: p.usersLimit,
    features: p.features,
    active: p.active,
  }))
}

router.get('/plans', async (_req, res) => {
  const plans = await buildPublicPlans()
  // Light cache — plan data changes rarely; 60s so CMS price/feature edits show quickly.
  res.set('Cache-Control', 'public, max-age=60, s-maxage=60')
  res.json({
    plans,
    ...(isIntroOfferEnvEnabled()
      ? {
          introOffer: {
            discountPercent: 50,
            months: INTRO_OFFER_MONTHS,
            description: `50% off your first ${INTRO_OFFER_MONTHS} months`,
          },
        }
      : {}),
  })
})

router.use(leadsPublicRouter)

export default router
