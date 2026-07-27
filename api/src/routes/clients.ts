import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { requireOrgSubscriptionForApp } from '../middleware/requireOrgSubscriptionForApp.js'
import { orgHasPlanFeature } from '../lib/planGate.js'

const router = Router()
router.use(authMiddleware)
router.use(requireOrgSubscriptionForApp)

const createSchema = z.object({
  name: z.string().min(1).max(200),
})

/**
 * Firm multi-client directory.
 * Project counts are only projects with `clientId` set. Orgs often have
 * projects created without a client tag — those appear as `unassignedProjectCount`.
 */
router.get('/', async (req: AuthRequest, res) => {
  const orgId = req.auth!.orgId
  const multiClient = await orgHasPlanFeature(orgId, 'multi_client')
  if (!multiClient) {
    return res.json({
      clients: [],
      unassignedProjectCount: 0,
      totalProjectCount: 0,
    })
  }

  const [clients, unassignedProjectCount, totalProjectCount] = await Promise.all([
    prisma.client.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { projects: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.project.count({
      where: { organizationId: orgId, clientId: null },
    }),
    prisma.project.count({
      where: { organizationId: orgId },
    }),
  ])

  res.json({
    clients,
    unassignedProjectCount,
    totalProjectCount,
  })
})

router.post('/', async (req: AuthRequest, res) => {
  try {
    const orgId = req.auth!.orgId
    const multiClient = await orgHasPlanFeature(orgId, 'multi_client')
    if (!multiClient) {
      return res.status(403).json({
        error: 'Multi-client workspace requires Firm plan.',
        code: 'PLAN_FEATURE_REQUIRED',
        feature: 'multi_client',
      })
    }
    const body = createSchema.parse(req.body)
    const client = await prisma.client.upsert({
      where: {
        organizationId_name: { organizationId: orgId, name: body.name.trim() },
      },
      create: { organizationId: orgId, name: body.name.trim() },
      update: {},
    })
    res.status(201).json(client)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message })
    }
    res.status(500).json({ error: 'Failed to create client' })
  }
})

export default router
