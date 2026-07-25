import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { sanitizeFilename } from '../lib/sanitizeFilename.js'
import { canDeleteAttachment } from '../lib/permissions.js'
import { prisma } from '../lib/prisma.js'
import { resolveProjectId } from '../lib/project-resolve.js'
import { logAudit } from '../services/audit.js'
import { requireOrgSubscriptionForApp } from '../middleware/requireOrgSubscriptionForApp.js'
import { deleteStoredFile, isS3StorageKey, resolveReadablePath } from '../lib/storage.js'

const router = Router()
router.use(authMiddleware)
router.use(requireOrgSubscriptionForApp)

router.get('/', async (req: AuthRequest, res) => {
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.query.projectId as string, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
  })
  if (!project) return res.status(404).json({ error: 'Project not found' })
  const attachments = await prisma.brsAttachment.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, email: true } } },
  })
  res.json(attachments)
})

router.get('/:id/download', async (req: AuthRequest, res) => {
  const orgId = req.auth!.orgId
  const attachment = await prisma.brsAttachment.findFirst({
    where: { id: req.params.id },
    include: { project: true },
  })
  if (!attachment) return res.status(404).json({ error: 'Attachment not found' })
  if (attachment.project.organizationId !== orgId) {
    return res.status(404).json({ error: 'Attachment not found' })
  }
  let fullPath: string
  try {
    fullPath = await resolveReadablePath(attachment.filepath)
  } catch {
    return res.status(404).json({ error: 'File not found' })
  }
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'File not found' })
  }
  if (!isS3StorageKey(attachment.filepath)) {
    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
    const uploadDirResolved = path.resolve(uploadDir)
    if (!path.resolve(fullPath).startsWith(uploadDirResolved)) {
      return res.status(404).json({ error: 'File not found' })
    }
  }
  const safeFilename = sanitizeFilename(attachment.filename)
  res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
  res.sendFile(path.resolve(fullPath))
})

router.delete('/:id', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canDeleteAttachment(role)) {
    return res.status(403).json({ error: 'Insufficient permission to delete attachments' })
  }
  const orgId = req.auth!.orgId
  const attachment = await prisma.brsAttachment.findFirst({
    where: { id: req.params.id },
    include: { project: true },
  })
  if (!attachment) return res.status(404).json({ error: 'Attachment not found' })
  if (attachment.project.organizationId !== orgId) {
    return res.status(404).json({ error: 'Attachment not found' })
  }
  const projectId = attachment.projectId
  await prisma.brsAttachment.delete({ where: { id: attachment.id } })
  await deleteStoredFile(attachment.filepath)
  await logAudit({
    organizationId: orgId,
    userId: req.auth!.userId,
    projectId,
    action: 'attachment_deleted',
    details: { attachmentId: attachment.id },
  })
  res.json({ ok: true })
})

export default router
