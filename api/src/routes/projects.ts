import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { resolveProjectId } from '../lib/project-resolve.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { canCreateProject, incrementProjects } from '../services/usage.js'
import { canCreateProject as canCreateProjectPerm, canDeleteProject, canEditProject, canReopenProject, canSubmitForReview, canApprove, isProjectEditable, canExportReport } from '../lib/permissions.js'
import { logAudit } from '../services/audit.js'
import { hasPlanFeature } from '../config/planFeatures.js'
import { getProjectVariance } from '../lib/reconcile-variance.js'
import { requireOrgSubscriptionForApp } from '../middleware/requireOrgSubscriptionForApp.js'

const router = Router()

router.use(authMiddleware)
router.use(requireOrgSubscriptionForApp)

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'project'
}

const createSchema = z.object({
  name: z.string().min(1),
  clientId: z.string().optional(),
  reconciliationDate: z.string().datetime().optional(),
  rollForwardFromProjectId: z.string().optional(),
  currency: z.enum(['GHS', 'USD', 'EUR']).optional(),
  /** Optional primary bank — creates first BankAccount for BRS letterhead / workbook header */
  primaryBankName: z.string().max(100).optional(),
  primaryAccountNo: z.string().max(50).optional(),
})

router.get('/', async (req: AuthRequest, res) => {
  const orgId = req.auth!.orgId
  const clientId = req.query.clientId as string | undefined
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0)

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where: {
        organizationId: orgId,
        ...(clientId ? { clientId } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        reconciliationDate: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.project.count({
      where: {
        organizationId: orgId,
        ...(clientId ? { clientId } : {}),
      },
    }),
  ])
  res.json({ projects, total, limit, offset })
})

router.post('/', async (req: AuthRequest, res) => {
  try {
    const role = req.auth!.role
    if (!canCreateProjectPerm(role)) {
      return res.status(403).json({ error: 'Insufficient permission to create projects' })
    }
    const body = createSchema.parse(req.body)
    const orgId = req.auth!.orgId
    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    if (!org) return res.status(404).json({ error: 'Organization not found' })
    const limitCheck = await canCreateProject(orgId, org.plan)
    if (!limitCheck.ok) return res.status(403).json({ error: limitCheck.message })
    let rollForwardId: string | null = null
    if (body.rollForwardFromProjectId) {
      if (!hasPlanFeature(org.plan, 'roll_forward')) {
        return res.status(403).json({ error: 'Roll-forward requires Premium plan or higher.' })
      }
      rollForwardId = await resolveProjectId(body.rollForwardFromProjectId, orgId)
      const prev = rollForwardId ? await prisma.project.findFirst({
        where: { id: rollForwardId, organizationId: orgId },
      }) : null
      if (!prev || !rollForwardId) return res.status(400).json({ error: 'Previous project not found for roll-forward' })
      if (prev.status !== 'completed') return res.status(400).json({ error: 'Can only roll forward from a completed project' })
    }
    const baseSlug = slugFromName(body.name)
    let slug = baseSlug
    let suffix = 2
    while (await prisma.project.findFirst({ where: { organizationId: orgId, slug } })) {
      slug = `${baseSlug}-${suffix++}`
    }
    const project = await prisma.project.create({
      data: {
        organizationId: orgId,
        name: body.name,
        slug,
        clientId: body.clientId || null,
        rollForwardFromProjectId: rollForwardId,
        reconciliationDate: body.reconciliationDate ? new Date(body.reconciliationDate) : null,
        currency: body.currency || 'GHS',
      },
    })
    const pb = (body.primaryBankName ?? '').trim()
    const pa = (body.primaryAccountNo ?? '').trim()
    if (pb || pa) {
      const displayName = pb || (pa ? `Account ${pa}` : 'Primary bank account')
      await prisma.bankAccount.create({
        data: {
          projectId: project.id,
          name: displayName.slice(0, 200),
          bankName: pb || null,
          accountNo: pa || null,
        },
      })
    }
    await incrementProjects(orgId)
    res.status(201).json(project)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message })
    }
    res.status(500).json({ error: 'Failed to create project' })
  }
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  clientId: z.string().nullable().optional(),
  currency: z.enum(['GHS', 'USD', 'EUR']).optional(),
})

router.patch('/:id', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canEditProject(role)) {
    return res.status(403).json({ error: 'Insufficient permission to edit projects' })
  }
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.params.id, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return res.status(404).json({ error: 'Project not found' })
  if (!isProjectEditable(project.status)) {
    return res.status(403).json({ error: 'Project is locked (submitted for review or approved). Reopen to edit.' })
  }
  try {
    const body = updateSchema.parse(req.body)
    const data: { name?: string; clientId?: string | null; currency?: string } = {}
    if (body.name !== undefined) data.name = body.name
    if (body.clientId !== undefined) data.clientId = body.clientId
    if (body.currency !== undefined) data.currency = body.currency
    const updated = await prisma.project.update({
      where: { id: projectId },
      data,
      include: {
        documents: {
          include: {
            _count: { select: { transactions: true } },
          },
        },
        client: true,
        rollForwardFrom: { select: { id: true, name: true } },
      },
    })
    res.json(updated)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message })
    }
    res.status(500).json({ error: 'Update failed' })
  }
})

router.get('/:id', async (req: AuthRequest, res) => {
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.params.id, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
    include: {
      documents: {
        include: {
          _count: { select: { transactions: true } },
        },
      },
      client: true,
      rollForwardFrom: { select: { id: true, name: true } },
      preparedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
    },
  })
  if (!project) return res.status(404).json({ error: 'Project not found' })
  res.json(project)
})

const reportCommentsSchema = z.object({
  reportNarrative: z.string().max(2000).optional(),
  bankStatementClosingBalance: z.union([z.number(), z.string()]).optional().nullable(),
  preparerComment: z.string().max(1000).optional(),
  reviewerComment: z.string().max(1000).optional(),
})

router.patch('/:id/report-comments', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canExportReport(role)) {
    return res.status(403).json({ error: 'Insufficient permission to update report comments' })
  }
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.params.id, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  try {
    const body = reportCommentsSchema.parse(req.body)
    const data: { reportNarrative?: string | null; bankStatementClosingBalance?: number | null; preparerComment?: string | null; reviewerComment?: string | null } = {}
    if (body.reportNarrative !== undefined) data.reportNarrative = body.reportNarrative || null
    if (body.bankStatementClosingBalance !== undefined) data.bankStatementClosingBalance = body.bankStatementClosingBalance === '' || body.bankStatementClosingBalance == null ? null : Number(body.bankStatementClosingBalance)
    if (body.preparerComment !== undefined) data.preparerComment = body.preparerComment || null
    if (body.reviewerComment !== undefined) data.reviewerComment = body.reviewerComment || null
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No fields to update' })
    const updated = await prisma.project.update({
      where: { id: projectId },
      data,
      select: { id: true, reportNarrative: true, preparerComment: true, reviewerComment: true, bankStatementClosingBalance: true },
    })
    res.json(updated)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message })
    }
    res.status(500).json({ error: 'Update failed' })
  }
})

router.patch('/:id/submit', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canSubmitForReview(role)) {
    return res.status(403).json({ error: 'Insufficient permission to submit for review' })
  }
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.params.id, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
  })
  if (!project) return res.status(404).json({ error: 'Project not found' })
  if (project.status !== 'reconciling' && project.status !== 'mapping' && project.status !== 'draft') {
    return res.status(400).json({ error: 'Project must be in reconciling, mapping, or draft to submit for review' })
  }
  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: 'submitted_for_review',
      preparedById: req.auth!.userId,
      preparedAt: new Date(),
    },
  })
  await logAudit({
    organizationId: orgId,
    userId: req.auth!.userId,
    projectId,
    action: 'project_submitted',
  })
  res.json({ status: 'submitted_for_review' })
})

router.patch('/:id/approve', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canApprove(role)) {
    return res.status(403).json({ error: 'Insufficient permission to approve' })
  }
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.params.id, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
  })
  if (!project) return res.status(404).json({ error: 'Project not found' })
  if (project.status !== 'submitted_for_review') {
    return res.status(400).json({ error: 'Project must be submitted for review to approve' })
  }

  // Threshold approval (Premium+): reviewers cannot approve when discrepancy exceeds threshold
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true, branding: true },
  })
  const branding = (org?.branding as { approvalThresholdAmount?: number | null }) || {}
  const threshold = branding.approvalThresholdAmount
  if (
    org &&
    hasPlanFeature(org.plan, 'threshold_approval') &&
    threshold != null &&
    threshold > 0 &&
    role === 'reviewer'
  ) {
    const variance = await getProjectVariance(projectId, orgId)
    if (variance !== null && Math.abs(variance) > threshold) {
      return res.status(403).json({
        error: `This project's discrepancy (GH₵${Math.abs(variance).toFixed(2)}) exceeds your approval threshold (GH₵${threshold}). An admin must approve.`,
      })
    }
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: 'completed', // Final state: reconciliation approved and complete
      reviewedById: req.auth!.userId,
      reviewedAt: new Date(),
      approvedById: req.auth!.userId,
      approvedAt: new Date(),
    },
  })
  await logAudit({
    organizationId: orgId,
    userId: req.auth!.userId,
    projectId,
    action: 'project_approved',
  })
  res.json({ status: 'completed' })
})

router.delete('/:id', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canDeleteProject(role)) {
    return res.status(403).json({ error: 'Insufficient permission to delete projects' })
  }
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.params.id, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
  })
  if (!project) return res.status(404).json({ error: 'Project not found' })
  await prisma.project.delete({ where: { id: projectId } })
  res.json({ deleted: true })
})

router.patch('/:id/reopen', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canReopenProject(role)) {
    return res.status(403).json({ error: 'Insufficient permission to reopen projects' })
  }
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.params.id, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
  })
  if (!project) return res.status(404).json({ error: 'Project not found' })
  const reopenable = ['completed', 'approved', 'submitted_for_review']
  if (!reopenable.includes(project.status)) {
    return res.status(400).json({ error: 'Only completed, approved, or submitted-for-review projects can be reopened' })
  }
  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'reconciling' },
  })
  await logAudit({
    organizationId: orgId,
    userId: req.auth!.userId,
    projectId,
    action: 'project_reopened',
  })
  res.json({ status: 'reconciling' })
})

// Phase 8: Undo reconciliation — clear all matches, reset sign-off, reopen
router.patch('/:id/undo-reconciliation', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canReopenProject(role)) {
    return res.status(403).json({ error: 'Insufficient permission to undo reconciliation' })
  }
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.params.id, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
    include: { matches: { select: { id: true } } },
  })
  if (!project) return res.status(404).json({ error: 'Project not found' })
  const reopenable = ['completed', 'approved', 'submitted_for_review']
  if (!reopenable.includes(project.status)) {
    return res.status(400).json({ error: 'Only completed, approved, or submitted-for-review projects can be undone' })
  }
  const matchIds = project.matches.map((m) => m.id)
  const matchCount = matchIds.length

  await prisma.$transaction([
    prisma.match.deleteMany({ where: { projectId } }),
    prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'reconciling',
        preparedById: null,
        preparedAt: null,
        reviewedById: null,
        reviewedAt: null,
        approvedById: null,
        approvedAt: null,
      },
    }),
  ])

  const reason = (req.body as { reason?: string }).reason
  await logAudit({
    organizationId: orgId,
    userId: req.auth!.userId,
    projectId,
    action: 'reconciliation_undone',
    details: { matchIds, matchCount, reason: reason || null },
  })
  res.json({ status: 'reconciling', matchCount })
})

export default router
