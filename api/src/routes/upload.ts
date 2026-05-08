import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { sanitizeFilename } from '../lib/sanitizeFilename.js'
import { canUploadDocuments, isProjectEditable } from '../lib/permissions.js'
import { prisma } from '../lib/prisma.js'
import { resolveProjectId } from '../lib/project-resolve.js'
import { logAudit } from '../services/audit.js'

const router = Router()
const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}
const brandingDir = path.join(uploadDir, 'branding')
if (!fs.existsSync(brandingDir)) {
  fs.mkdirSync(brandingDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin'
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  },
})

const MAX_DOCUMENT_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10', 10) * 1024 * 1024
const ALLOWED_DOCUMENT_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp']

const upload = multer({
  storage,
  limits: { fileSize: MAX_DOCUMENT_SIZE },
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ALLOWED_DOCUMENT_EXTENSIONS.includes(ext)) cb(null, true)
    else cb(new Error(`File type not allowed. Use: ${ALLOWED_DOCUMENT_EXTENSIONS.join(', ')}`))
  },
})

const logoStorage = multer.diskStorage({
  destination: (_, __, cb) => {
    cb(null, brandingDir)
  },
  filename: (req, file, cb) => {
    const orgId = (req as AuthRequest).auth?.orgId ?? 'default'
    const ext = path.extname(file.originalname).toLowerCase() || '.png'
    cb(null, `${orgId}-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  },
})

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB for logos
  fileFilter: (_, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error('Logo must be PNG or JPG'))
  },
})

router.use(authMiddleware)

router.post('/cash-book/:projectId', upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const role = req.auth!.role
  if (!canUploadDocuments(role)) {
    return res.status(403).json({ error: 'Insufficient permission to upload documents' })
  }
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.params.projectId, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
  })
  if (!project) return res.status(404).json({ error: 'Project not found' })
  if (!isProjectEditable(project.status)) {
    return res.status(403).json({ error: 'Project is locked (submitted for review or approved). Reopen to edit.' })
  }
  const type = req.body.type === 'payments' ? 'cash_book_payments' : 'cash_book_receipts'
  const safeFilename = sanitizeFilename(req.file.originalname)
  const doc = await prisma.document.create({
    data: {
      projectId,
      type,
      filename: safeFilename,
      filepath: req.file.path,
      mimeType: req.file.mimetype,
    },
  })
  await logAudit({
    organizationId: orgId,
    userId: req.auth!.userId,
    projectId,
    action: 'document_uploaded',
    details: { documentId: doc.id, documentType: type, filename: safeFilename },
  })
  res.status(201).json(doc)
})

router.post('/bank-statement/:projectId', upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const role = req.auth!.role
  if (!canUploadDocuments(role)) {
    return res.status(403).json({ error: 'Insufficient permission to upload documents' })
  }
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.params.projectId, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
  })
  if (!project) return res.status(404).json({ error: 'Project not found' })
  if (!isProjectEditable(project.status)) {
    return res.status(403).json({ error: 'Project is locked (submitted for review or approved). Reopen to edit.' })
  }
  const type = req.body.type === 'debits' ? 'bank_debits' : 'bank_credits'
  let bankAccountId: string | undefined = req.body.bankAccountId
  const rawAccountNo = typeof req.body.accountNo === 'string' ? req.body.accountNo.trim() : ''
  const normalizedAccountNo = rawAccountNo ? rawAccountNo.slice(0, 50) : null
  if (!bankAccountId && req.body.accountName && typeof req.body.accountName === 'string' && req.body.accountName.trim()) {
    const normalizedName = String(req.body.accountName).trim().slice(0, 200)
    const existing = await prisma.bankAccount.findFirst({
      where: { projectId, name: normalizedName },
      select: { id: true, accountNo: true },
    })
    if (existing) {
      bankAccountId = existing.id
      if (normalizedAccountNo && !existing.accountNo) {
        await prisma.bankAccount.update({
          where: { id: existing.id },
          data: { accountNo: normalizedAccountNo },
        })
      }
    } else {
      const acct = await prisma.bankAccount.create({
        data: {
          projectId,
          name: normalizedName,
          accountNo: normalizedAccountNo,
        },
      })
      bankAccountId = acct.id
    }
  }
  const safeFilename = sanitizeFilename(req.file.originalname)
  const doc = await prisma.document.create({
    data: {
      projectId,
      bankAccountId: bankAccountId || undefined,
      type,
      filename: safeFilename,
      filepath: req.file.path,
      mimeType: req.file.mimetype,
    },
  })
  await logAudit({
    organizationId: orgId,
    userId: req.auth!.userId,
    projectId,
    action: 'document_uploaded',
    details: { documentId: doc.id, documentType: type, filename: safeFilename },
  })
  res.status(201).json(doc)
})

// Phase 7: Supporting documents (BrsAttachment) - Extended for Phase 3 Match Evidence
router.post('/attachments/:projectId', upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const role = req.auth!.role
  if (!canUploadDocuments(role)) {
    return res.status(403).json({ error: 'Insufficient permission to upload documents' })
  }
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.params.projectId, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
  })
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const matchId = (req.body.matchId as string) || undefined
  const type = (req.body.type as string) || 'other'
  const validTypes = ['bank_statement', 'approval', 'match_evidence', 'other']
  const attachmentType = validTypes.includes(type) ? type : 'other'
  const safeFilename = sanitizeFilename(req.file.originalname)

  const attachment = await prisma.brsAttachment.create({
    data: {
      projectId,
      matchId,
      type: attachmentType,
      filename: safeFilename,
      filepath: req.file.path,
      mimeType: req.file.mimetype,
      uploadedBy: req.auth!.userId,
    },
  })
  await logAudit({
    organizationId: orgId,
    userId: req.auth!.userId,
    projectId,
    action: 'attachment_uploaded',
    details: { attachmentId: attachment.id, type: attachmentType, filename: safeFilename, matchId },
  })
  res.status(201).json(attachment)
})

// Branding logo upload (org-level) — Premium+ (full_branding)
router.post('/branding-logo', logoUpload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const role = req.auth!.role
  const { canEditBranding } = await import('../lib/permissions.js')
  if (!canEditBranding(role)) {
    return res.status(403).json({ error: 'Insufficient permission to edit branding' })
  }
  const orgId = req.auth!.orgId
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  })
  const { hasPlanFeature } = await import('../config/planFeatures.js')
  if (!org || !hasPlanFeature(org.plan, 'full_branding')) {
    return res.status(403).json({ error: 'Logo upload requires Premium plan or higher.' })
  }
  const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 9001}`
  const logoUrl = `${baseUrl}/api/v1/uploads/branding/${path.basename(req.file.path)}`
  const orgWithBranding = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { branding: true },
  })
  const prev = (orgWithBranding?.branding as Record<string, unknown>) || {}
  const branding = { ...prev, logoUrl }
  await prisma.organization.update({
    where: { id: orgId },
    data: { branding: branding as object },
  })
  res.json({ logoUrl })
})

export default router
