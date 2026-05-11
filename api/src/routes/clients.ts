import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { requireOrgSubscriptionForApp } from '../middleware/requireOrgSubscriptionForApp.js'

const router = Router()
router.use(authMiddleware)
router.use(requireOrgSubscriptionForApp)

const createSchema = z.object({
  name: z.string().min(1).max(200),
})

router.get('/', async (req: AuthRequest, res) => {
  const orgId = req.auth!.orgId
  const clients = await prisma.client.findMany({
    where: { organizationId: orgId },
    include: { _count: { select: { projects: true } } },
    orderBy: { name: 'asc' },
  })
  res.json(clients)
})

router.post('/', async (req: AuthRequest, res) => {
  try {
    const body = createSchema.parse(req.body)
    const orgId = req.auth!.orgId
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
