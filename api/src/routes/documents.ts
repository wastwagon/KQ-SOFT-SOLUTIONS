import { Router } from 'express'
import { z } from 'zod'
import fs from 'fs'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { canMapDocuments, isProjectEditable, PROJECT_LOCKED_ERROR } from '../lib/permissions.js'
import { detectFileType } from '../services/parser.js'
import { parseDocumentFile } from '../services/documentParse.js'
import { resolveDetectedBankFormat, type GhanaBankFormat } from '../services/ghanaBankParsers.js'
import { parseImportedAmount } from '../services/amountParser.js'
import { logAudit } from '../services/audit.js'
import { requireOrgSubscriptionForApp } from '../middleware/requireOrgSubscriptionForApp.js'
import { parseSheetIndexQuery } from '../lib/parseSheetIndexQuery.js'
import { pickBestExcelSheetIndex } from '../services/cashBookExcel.js'
import { getMappingConfidence } from '../services/suggestedMapping.js'
import { getMappingDiagnostics } from '../services/mappingDiagnostics.js'
import { applyDocumentMapping, sanitizeMapping, validateMapping } from '../services/applyDocumentMapping.js'
import {
  buildSuggestedMappingForDocument,
  trimMappingForDocumentType,
} from '../services/autoMapDocument.js'
import { MAP_PREVIEW_ROW_SAMPLE } from '../config/importLimits.js'
import { inferAdaptiveMapping } from '../services/adaptiveColumnInference.js'
import {
  applyOrganisationLayoutMemory,
  boostLearnedConfidence,
  rememberDocumentLayout,
} from '../services/documentLayoutMemory.js'
import {
  documentFamilyOf,
  familyLabel,
  inferDocumentFamily,
} from '../services/documentTypeInference.js'
import { changeDocumentType } from '../services/changeDocumentType.js'
import { uploadParseRouteLimiter } from '../middleware/heavyRouteLimiter.js'
import { isOcrGateError } from '../lib/ocrGate.js'
import { markDocumentParseReady } from '../lib/documentParseJob.js'
import { incOpsMetric, observeParseQuality } from '../lib/opsMetrics.js'

const router = Router()
router.use(authMiddleware)
router.use(requireOrgSubscriptionForApp)
router.use(uploadParseRouteLimiter)

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
      const rawSheet = req.query.sheetIndex
      const hasSheetQuery =
        rawSheet !== undefined && rawSheet !== null && String(rawSheet).trim() !== ''
      const requested = hasSheetQuery ? parseSheetIndexQuery(rawSheet) : pickBestExcelSheetIndex(doc.filepath, doc.type)
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
    const sample = result.rows.slice(0, MAP_PREVIEW_ROW_SAMPLE)
    let detectedBankFormat: GhanaBankFormat = null
    if (!doc.type.startsWith('cash_book_')) {
      detectedBankFormat = resolveDetectedBankFormat(result.headers, sample, result.parseMethod)
    }
    let parseSummary: { rowCount: number; sumDebit?: number; sumCredit?: number } | undefined
    if (!doc.type.startsWith('cash_book_') && result.rows.length > 0) {
      const debitCol = result.headers.findIndex((h) => /^debit$/i.test(String(h)))
      const creditCol = result.headers.findIndex((h) => /^credit$/i.test(String(h)))
      parseSummary = {
        rowCount: result.rows.length,
        sumDebit:
          debitCol >= 0
            ? result.rows.reduce((s, r) => s + parseImportedAmount(r[debitCol]), 0)
            : undefined,
        sumCredit:
          creditCol >= 0
            ? result.rows.reduce((s, r) => s + parseImportedAmount(r[creditCol]), 0)
            : undefined,
      }
    }
    let suggestedMapping = buildSuggestedMappingForDocument(doc.type, result.headers, detectedBankFormat, {
      projectCurrency: doc.project.currency || 'GHS',
      sampleRows: result.rows.slice(0, 250),
    })
    const layout = await applyOrganisationLayoutMemory(
      orgId,
      doc.type,
      result.headers,
      suggestedMapping
    )
    if (layout.match && layout.appliedFields.length) {
      incOpsMetric('parse.layout_memory_hit', {
        labels: { exact: layout.match.exact ? 'true' : 'false' },
        detail: { documentId: id, fields: layout.appliedFields.length, source: 'preview' },
      })
    }
    if (result.parseQualityScore != null) {
      observeParseQuality(result.parseQualityScore, {
        documentId: id,
        parseMethod: result.parseMethod,
        source: 'preview',
      })
    }
    if (result.ocrRetried) {
      incOpsMetric('parse.ocr_retried', {
        detail: { documentId: id, parseMethod: result.parseMethod, source: 'preview' },
      })
    }
    suggestedMapping = trimMappingForDocumentType(doc.type, layout.mapping)
    let mappingConfidence = getMappingConfidence(result.headers, suggestedMapping)
    if (layout.appliedFields.length) {
      mappingConfidence = boostLearnedConfidence(mappingConfidence, layout.appliedFields)
    }
    const adaptive = inferAdaptiveMapping(
      doc.type,
      result.headers,
      result.rows.slice(0, 250)
    )
    for (const [field, index] of Object.entries(adaptive.mapping)) {
      if (
        suggestedMapping[field] === index &&
        adaptive.confidence[field] &&
        mappingConfidence[field] === 'low'
      ) {
        mappingConfidence[field] = adaptive.confidence[field]
      }
    }
    const mappingDiagnostics = getMappingDiagnostics(doc.type, result.headers, suggestedMapping)
    const adaptiveFields = Object.keys(adaptive.reasons).filter(
      (field) => suggestedMapping[field] === adaptive.mapping[field]
    )
    if (adaptiveFields.length) {
      mappingDiagnostics.push({
        severity: 'info',
        message: `Adaptive parser inferred ${adaptiveFields.join(', ')} from sample values.`,
        fix: adaptiveFields
          .map((field) => `${field}: ${adaptive.reasons[field]}`)
          .join('; '),
      })
    }
    if (layout.match && layout.appliedFields.length) {
      mappingDiagnostics.push({
        severity: 'info',
        message: layout.match.exact
          ? `Using your organisation’s saved column map for this layout (${layout.appliedFields.join(', ')}).`
          : `Using a similar saved column map from your organisation (${Math.round(layout.match.similarity * 100)}% header match; ${layout.appliedFields.join(', ')}).`,
        fix: 'Adjust any field if this upload differs, then save — the layout memory will update.',
      })
    }
    const typeInference = inferDocumentFamily(result.headers, {
      sampleRows: result.rows.slice(0, 40),
      parseMethod: result.parseMethod,
      filename: doc.filename,
    })
    const uploadedFamily = documentFamilyOf(doc.type)
    const typeMismatch =
      typeInference.family !== 'unknown' &&
      typeInference.family !== uploadedFamily &&
      (typeInference.confidence === 'high' || typeInference.confidence === 'medium')
    if (typeMismatch) {
      mappingDiagnostics.push({
        severity: typeInference.confidence === 'high' ? 'warning' : 'info',
        message: `This file looks like a ${familyLabel(typeInference.family)} (${typeInference.confidence} confidence), but it was uploaded as a ${familyLabel(uploadedFamily)}.`,
        fix:
          typeInference.family === 'bank_statement'
            ? 'Re-upload under Bank Statement (credits/debits), or delete and upload again on the correct card.'
            : 'Re-upload under Cash Book (receipts/payments), or delete and upload again on the correct card.',
      })
    }
    const hasForeignCurrencyColumns = result.headers.some((h) =>
      /^(fc\s*amt\s*(received|paid)|foreign\s*currency\s*amount|currency\s*code|exch\s*rate)$/i.test(
        String(h).trim()
      )
    )
    res.json({
      documentId: doc.id,
      filename: doc.filename,
      documentType: doc.type,
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
      typeInference: {
        family: typeInference.family,
        confidence: typeInference.confidence,
        cashBookScore: typeInference.cashBookScore,
        bankScore: typeInference.bankScore,
        reasons: typeInference.reasons,
        mismatch: typeMismatch || undefined,
      },
      layoutMemoryApplied: layout.match && layout.appliedFields.length
        ? {
            id: layout.match.id,
            exact: layout.match.exact,
            similarity: layout.match.similarity,
            fields: layout.appliedFields,
            useCount: layout.match.useCount,
          }
        : undefined,
      projectCurrency: doc.project.currency || 'GHS',
      hasForeignCurrencyColumns: hasForeignCurrencyColumns || undefined,
      parseMethod: result.parseMethod,
      parseSummary,
      pdfTruncated: result.pdfTruncated,
      pdfPagesProcessed: result.pdfPagesProcessed,
      pdfTotalPages: result.pdfTotalPages,
      parseQualityScore: result.parseQualityScore,
      ocrRetried: result.ocrRetried || undefined,
      parseQualityNotes: result.parseQualityNotes,
    })
  } catch (e) {
    if (isOcrGateError(e)) {
      return res.status(e.statusCode).json({ error: e.message, code: e.code })
    }
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
    await rememberDocumentLayout({
      organizationId: doc.project.organizationId,
      documentType: doc.type,
      headers: result.headers,
      mapping,
      parseMethodHint: result.parseMethod,
    }).catch(() => undefined)
    await markDocumentParseReady(id, `Mapped ${applied.count} transaction(s)`).catch(() => undefined)
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
    if (isOcrGateError(e)) {
      return res.status(e.statusCode).json({ error: e.message, code: e.code })
    }
    const msg = (e as Error).message
    if (msg.includes('column') || msg.includes('required') || msg.includes('mapping') || msg.includes('limit')) {
      return res.status(400).json({ error: msg })
    }
    res.status(500).json({ error: msg || 'Mapping failed. Check that column mapping is correct.' })
  }
})

router.get('/:id/parse-status', async (req: AuthRequest, res) => {
  const { id } = req.params
  const orgId = req.auth!.orgId
  const doc = await prisma.document.findFirst({
    where: { id },
    include: { project: { select: { organizationId: true } } },
  })
  if (!doc || doc.project.organizationId !== orgId) {
    return res.status(404).json({ error: 'Document not found' })
  }
  res.json({
    documentId: doc.id,
    parseStatus: doc.parseStatus,
    parseStatusMessage: doc.parseStatusMessage,
    parseStartedAt: doc.parseStartedAt,
    parseFinishedAt: doc.parseFinishedAt,
    type: doc.type,
    filename: doc.filename,
  })
})

const changeTypeSchema = z.object({
  family: z.enum(['cash_book', 'bank_statement']),
})

router.post('/:id/type', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canMapDocuments(role)) {
    return res.status(403).json({ error: 'Insufficient permission to change document type' })
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
  try {
    const body = changeTypeSchema.parse(req.body)
    const result = await changeDocumentType({
      documentId: id,
      organizationId: orgId,
      userId: req.auth!.userId,
      family: body.family,
    })
    res.json(result)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message ?? 'Invalid type' })
    }
    const err = e as Error & { status?: number }
    if (err.status === 404) return res.status(404).json({ error: err.message })
    if (err.status === 400) return res.status(400).json({ error: err.message })
    if (err.status === 409) return res.status(409).json({ error: err.message })
    res.status(500).json({ error: err.message || 'Failed to change document type' })
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
