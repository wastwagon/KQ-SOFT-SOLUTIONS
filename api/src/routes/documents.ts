import { Router } from 'express'
import { z } from 'zod'
import fs from 'fs'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { canMapDocuments, isProjectEditable, PROJECT_LOCKED_ERROR } from '../lib/permissions.js'
import { detectFileType } from '../services/parser.js'
import { parseDocumentFile } from '../services/documentParse.js'
import { detectGhanaBankFormat, type GhanaBankFormat } from '../services/ghanaBankParsers.js'
import { logAudit } from '../services/audit.js'
import { requireOrgSubscriptionForApp } from '../middleware/requireOrgSubscriptionForApp.js'
import { parseSheetIndexQuery } from '../lib/parseSheetIndexQuery.js'
import { getMappingConfidence } from '../services/suggestedMapping.js'
import { getMappingDiagnostics } from '../services/mappingDiagnostics.js'
import { applyDocumentMapping, sanitizeMapping, validateMapping } from '../services/applyDocumentMapping.js'
import { buildSuggestedMappingForDocument } from '../services/autoMapDocument.js'

const router = Router()
router.use(authMiddleware)
router.use(requireOrgSubscriptionForApp)

const CANONICAL_CASH_BOOK = ['s_no', 'date', 'name', 'details', 'doc_ref', 'chq_no', 'accode', 'amt_received', 'amt_paid']
const CANONICAL_BANK = ['transaction_date', 'description', 'credit', 'debit']

router.get('/:id/preview', async (req: AuthRequest, res) => {
  const { id } = req.params
  const orgId = req.auth!.orgId
  const doc = await prisma.document.findFirst({
    where: { id },
    include: { project: true },
  })
  if (!doc || doc.project.organizationId !== orgId) {
    return res.status(404).json({ error: 'Document not found' })
  }
  if (!fs.existsSync(doc.filepath)) {
    return res.status(404).json({ error: 'File not found' })
  }
  try {
    const type = detectFileType(doc.filepath)
    let result: Awaited<ReturnType<typeof parseDocumentFile>>
    let excelPreviewSheetIndex: number | undefined
    if (type === 'excel') {
      const requested = parseSheetIndexQuery(req.query.sheetIndex)
      result = await parseDocumentFile(doc.filepath, doc.type, requested)
      const names = result.sheetNames ?? []
      const active = result.activeSheet
      if (names.length && active) {
        const idx = names.indexOf(active)
        excelPreviewSheetIndex = idx >= 0 ? idx : requested
      } else {
        excelPreviewSheetIndex = requested
      }
    } else {
      result = await parseDocumentFile(doc.filepath, doc.type, 0)
    }
    const sample = result.rows.slice(0, 20)
    let detectedBankFormat: GhanaBankFormat = null
    if (!doc.type.startsWith('cash_book_')) {
      detectedBankFormat = detectGhanaBankFormat(result.headers, sample)
    }
    const suggestedMapping = buildSuggestedMappingForDocument(doc.type, result.headers, detectedBankFormat)
    const mappingConfidence = getMappingConfidence(result.headers, suggestedMapping)
    const mappingDiagnostics = getMappingDiagnostics(doc.type, result.headers, suggestedMapping)
    res.json({
      documentId: doc.id,
      filename: doc.filename,
      headers: result.headers,
      rows: sample,
      totalRows: result.rows.length,
      sheetNames: result.sheetNames,
      sheetIndex: excelPreviewSheetIndex,
      canonicalFields: doc.type.startsWith('cash_book_') ? CANONICAL_CASH_BOOK : CANONICAL_BANK,
      detectedBankFormat: detectedBankFormat ?? undefined,
      suggestedMapping,
      mappingConfidence,
      mappingDiagnostics,
      parseMethod: result.parseMethod,
      pdfTruncated: result.pdfTruncated,
      pdfPagesProcessed: result.pdfPagesProcessed,
      pdfTotalPages: result.pdfTotalPages,
    })
  } catch (e) {
    const msg = (e as Error).message || 'Parse failed'
    const fileType = detectFileType(doc.filepath)
    const hint =
      fileType === 'pdf'
        ? ' PDF may be scanned—ensure it contains extractable text.'
        : fileType === 'image'
          ? ' Image may be low quality or contains non-Latin text.'
          : ''
    res.status(400).json({ error: msg + hint })
  }
})

const mapSchema = z.object({
  mapping: z.record(z.string(), z.union([z.number(), z.string()])),
  sheetIndex: z.number().optional(),
})

router.post('/:id/map', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canMapDocuments(role)) {
    return res.status(403).json({ error: 'Insufficient permission to map documents' })
  }
  const { id } = req.params
  const orgId = req.auth!.orgId
  const doc = await prisma.document.findFirst({
    where: { id },
    include: { project: true },
  })
  if (!doc || doc.project.organizationId !== orgId) {
    return res.status(404).json({ error: 'Document not found' })
  }
  if (!isProjectEditable((doc.project as { status?: string }).status)) {
    return res.status(403).json({ error: PROJECT_LOCKED_ERROR })
  }
  if (!fs.existsSync(doc.filepath)) {
    return res.status(404).json({ error: 'File not found' })
  }
  const org = await prisma.organization.findFirst({
    where: { id: doc.project.organizationId },
  })
  if (!org) return res.status(404).json({ error: 'Organization not found' })
  try {
    const body = mapSchema.parse(req.body)
    const result = await parseDocumentFile(doc.filepath, doc.type, body.sheetIndex ?? 0)
    const mapping = sanitizeMapping(body.mapping as Record<string, number | string>, result.headers.length)
    const err = validateMapping(doc.type, mapping, result.headers.length)
    if (err) return res.status(400).json({ error: err })

    const previousTxCount = await prisma.transaction.count({ where: { documentId: id } })
    const applied = await applyDocumentMapping(
      id,
      doc.type,
      result,
      mapping,
      doc.project.organizationId,
      doc.projectId,
      org.plan
    )
    await logAudit({
      organizationId: doc.project.organizationId,
      userId: req.auth!.userId,
      projectId: doc.projectId,
      action: 'document_mapped',
      details: {
        documentId: id,
        documentType: doc.type,
        transactionCount: applied.count,
        signWarnings: applied.signWarningsCount,
        skippedDuplicateRows: applied.skippedDuplicateRows > 0 ? applied.skippedDuplicateRows : undefined,
        parseMethod: result.parseMethod,
      },
    })
    res.json({
      count: applied.count,
      importStats: {
        sourceRowCount: applied.sourceRowCount,
        importedCount: applied.count,
        skippedDuplicateRows: applied.skippedDuplicateRows,
        skippedZeroAmountRows: applied.skippedZeroAmountRows,
        previousMappedCount: previousTxCount,
      },
      signFilterSummary: applied.signFilterSummary,
      signWarningsCount: applied.signWarningsCount,
      signWarningsPreview: applied.signWarningsPreview,
      skippedDuplicateRows: applied.skippedDuplicateRows > 0 ? applied.skippedDuplicateRows : undefined,
      parseMethod: result.parseMethod,
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message ?? 'Invalid mapping' })
    }
    const msg = (e as Error).message
    if (msg.includes('column') || msg.includes('required') || msg.includes('mapping') || msg.includes('limit')) {
      return res.status(400).json({ error: msg })
    }
    res.status(500).json({ error: msg || 'Mapping failed. Check that column mapping is correct.' })
  }
})

router.get('/:id/transactions', async (req: AuthRequest, res) => {
  const { id } = req.params
  const orgId = req.auth!.orgId
  const doc = await prisma.document.findFirst({
    where: { id },
    include: { project: true },
  })
  if (!doc || doc.project.organizationId !== orgId) {
    return res.status(404).json({ error: 'Document not found' })
  }
  const transactions = await prisma.transaction.findMany({
    where: { documentId: id },
    orderBy: { rowIndex: 'asc' },
  })
  res.json(transactions)
})

export default router
