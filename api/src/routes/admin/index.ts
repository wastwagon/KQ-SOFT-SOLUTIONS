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

const router = Router()
router.use(authMiddleware)
router.use(requirePlatformAdmin)

// Health check — verifies admin access
router.get('/', (_req, res) => {
  res.json({ ok: true, message: 'Admin API' })
})

router.use('/settings', settingsRouter)
router.use('/plans', plansRouter)
router.use('/users', usersRouter)
router.use('/organizations', organizationsRouter)
router.use('/payments', paymentsRouter)
router.use('/analytics', analyticsRouter)

router.get('/overview', async (_req, res) => {
  const [usersCount, orgsCount, plansCount] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.plan.count(),
  ])
  res.json({ usersCount, orgsCount, plansCount })
})

export default router
