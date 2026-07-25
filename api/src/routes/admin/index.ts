import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.js'
import { requirePlatformAdmin } from '../../middleware/requirePlatformAdmin.js'
import { prisma } from '../../lib/prisma.js'
import plansRouter from './plans.js'
import usersRouter from './users.js'
import organizationsRouter from './organizations.js'
import paymentsRouter from './payments.js'
import analyticsRouter from './analytics.js'
import settingsRouter from './settings.js'
import databaseRouter from './database.js'
import opsMetricsRouter from './opsMetrics.js'
import retentionRouter from './retention.js'
import leadsRouter from './leads.js'

const router = Router()
router.use(authMiddleware)
router.use(requirePlatformAdmin)

// Health check — verifies admin access
router.get('/', (_req, res) => {
  res.json({ ok: true, message: 'Admin API' })
})

router.use('/settings', settingsRouter)
router.use('/database', databaseRouter)
router.use('/ops-metrics', opsMetricsRouter)
router.use('/retention', retentionRouter)
router.use('/leads', leadsRouter)
router.use('/plans', plansRouter)
router.use('/users', usersRouter)
router.use('/organizations', organizationsRouter)
router.use('/payments', paymentsRouter)
router.use('/analytics', analyticsRouter)

router.get('/overview', async (_req, res) => {
  const [usersCount, orgsCount, plansCount, leadsCount] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.plan.count(),
    prisma.lead.count({ where: { contactedAt: null } }),
  ])
  res.json({ usersCount, orgsCount, plansCount, openLeadsCount: leadsCount })
})

export default router
