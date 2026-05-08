/**
 * Public, unauthenticated marketing endpoints.
 * Mounted *before* any auth-bearing routers in `index.ts`.
 *
 * Keep this surface minimal — only data that is safe to expose to the
 * public landing page (plan list, etc.). Never include user/org data here.
 */
import { Router } from 'express'
import { PLAN_PRICES, getLimits } from '../config/subscription.js'
import { getPlanBySlug } from '../services/plan.js'

const router = Router()

router.get('/plans', async (_req, res) => {
  const planEntries = Object.entries(PLAN_PRICES).filter(([k]) => k !== 'firm')
  const plans = await Promise.all(
    planEntries.map(async ([planId]) => {
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
        ...limits,
      }
    })
  )
  res.json({ plans })
})

export default router
