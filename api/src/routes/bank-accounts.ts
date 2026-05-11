import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { resolveProjectId } from '../lib/project-resolve.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { canUploadDocuments } from '../lib/permissions.js'
import { requireOrgSubscriptionForApp } from '../middleware/requireOrgSubscriptionForApp.js'

const router = Router()
router.use(authMiddleware)
router.use(requireOrgSubscriptionForApp)

const createSchema = z.object({
  name: z.string().min(1).max(200),
  bankName: z.string().max(100).optional(),
  accountNo: z.string().max(50).optional(),
})

// List bank accounts for a project
router.get('/project/:projectId', async (req: AuthRequest, res) => {
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.params.projectId, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
  })
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const accounts = await prisma.bankAccount.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { documents: true } },
    },
  })
  res.json(accounts.map((a) => ({
    id: a.id,
    projectId: a.projectId,
    name: a.name,
    bankName: a.bankName,
    accountNo: a.accountNo,
    createdAt: a.createdAt,
    documentCount: a._count.documents,
  })))
})

// Create bank account for a project
router.post('/project/:projectId', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canUploadDocuments(role)) {
    return res.status(403).json({ error: 'Insufficient permission' })
  }
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.params.projectId, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
  })
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message })

  const account = await prisma.bankAccount.create({
    data: {
      projectId,
      name: parsed.data.name,
      bankName: parsed.data.bankName ?? null,
      accountNo: parsed.data.accountNo ?? null,
    },
  })
  res.status(201).json(account)
})

export default router
