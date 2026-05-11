import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { requireOrgSubscriptionForApp } from '../middleware/requireOrgSubscriptionForApp.js'
import { hasPlanFeature } from '../config/planFeatures.js'

const router = Router()
router.use(authMiddleware)
router.use(requireOrgSubscriptionForApp)

const ACTION_LABELS: Record<string, string> = {
  document_uploaded: 'Document uploaded',
  document_mapped: 'Document mapped',
  match_created: 'Match created',
  match_deleted: 'Match removed',
  match_bulk: 'Bulk match',
  report_generated: 'Report generated',
  report_exported: 'Report exported',
  project_reopened: 'Project reopened',
  project_submitted: 'Submitted for review',
  project_approved: 'Project approved',
  attachment_uploaded: 'Attachment uploaded',
  attachment_deleted: 'Attachment deleted',
  reconciliation_undone: 'Reconciliation undone',
}

router.get('/', async (req: AuthRequest, res) => {
  const orgId = req.auth!.orgId
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  })
  if (!org || !hasPlanFeature(org.plan, 'audit_trail')) {
    return res.status(403).json({ error: 'Audit trail requires Standard plan or higher.' })
  }
  const projectId = req.query.projectId as string | undefined
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)

  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId: orgId,
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  res.json({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      actionLabel: ACTION_LABELS[l.action] || l.action,
      projectId: l.projectId,
      userId: l.userId,
      details: l.details,
      createdAt: l.createdAt,
    })),
  })
})

router.get('/export', async (req: AuthRequest, res) => {
  const orgId = req.auth!.orgId
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  })
  if (!org || !hasPlanFeature(org.plan, 'audit_trail')) {
    return res.status(403).json({ error: 'Audit trail requires Standard plan or higher.' })
  }
  const projectId = req.query.projectId as string | undefined
  const format = (req.query.format as string)?.toLowerCase() || 'csv'
  const limit = Math.min(parseInt(req.query.limit as string) || 500, 2000)

  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId: orgId,
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  if (format === 'csv') {
    const header = 'Date,Action,Project ID,User ID,Details'
    const rows = logs.map((l) => {
      const date = l.createdAt.toISOString()
      const action = ACTION_LABELS[l.action] || l.action
      const details = (l.details as object) ? JSON.stringify(l.details).replace(/"/g, '""') : ''
      return `"${date}","${action}","${l.projectId || ''}","${l.userId || ''}","${details}"`
    })
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`)
    res.send([header, ...rows].join('\n'))
    return
  }
  res.status(400).json({ error: 'Format must be csv' })
})

export default router
