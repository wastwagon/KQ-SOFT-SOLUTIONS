/**
 * After upload: auto-apply suggested mapping when confidence is high enough.
 */
import type { DocumentType } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { parseDocumentFile } from './documentParse.js'
import { detectFileType } from './parser.js'
import {
  resolveDetectedBankFormat,
  getSuggestedBankMapping,
  type GhanaBankFormat,
} from './ghanaBankParsers.js'
import { buildSmartSuggestedMapping, getMappingConfidence, type MappingConfidence } from './suggestedMapping.js'
import { applyDocumentMapping, sanitizeMapping } from './applyDocumentMapping.js'
import { pickBestExcelSheetIndex } from './cashBookExcel.js'
import { inferAdaptiveMapping } from './adaptiveColumnInference.js'
import {
  applyOrganisationLayoutMemory,
  touchLayoutMemoryUse,
} from './documentLayoutMemory.js'
import {
  documentFamilyOf,
  inferDocumentFamily,
  remapDocumentTypeToFamily,
  type DocumentTypeInference,
} from './documentTypeInference.js'
import {
  markDocumentParseFailed,
  markDocumentParseProcessing,
  markDocumentParseReady,
} from '../lib/documentParseJob.js'
import { incOpsMetric, observeParseQuality } from '../lib/opsMetrics.js'

const AUTO_MAP = process.env.AUTO_MAP_ON_UPLOAD !== 'false'
/** Opt-in: auto-correct misfiled cash-book ↔ bank uploads (clears bankAccountId when flipping to cash book). */
const AUTO_CORRECT_DOC_TYPE = process.env.AUTO_CORRECT_DOC_TYPE === 'true'

function isHighOrMedium(c: MappingConfidence | undefined): boolean {
  return c === 'high' || c === 'medium'
}

export function buildSuggestedMappingForDocument(
  docType: DocumentType,
  headers: string[],
  detectedBankFormat: GhanaBankFormat | null,
  options: {
    preferForeignCurrencyAmounts?: boolean
    projectCurrency?: string
    sampleRows?: unknown[][]
  } = {}
): Record<string, number> {
  const isCashBook = docType.startsWith('cash_book_')
  let base: Record<string, number> | undefined
  if (!isCashBook && detectedBankFormat) {
    const side = docType === 'bank_credits' ? 'credits' : 'debits'
    base = getSuggestedBankMapping(detectedBankFormat, headers, side)
  }
  const currency = (options.projectCurrency || 'GHS').toUpperCase()
  const preferForeign =
    options.preferForeignCurrencyAmounts ??
    (isCashBook &&
      currency !== 'GHS' &&
      headers.some((h) => /^fc\s*amt\s*(received|paid)$/i.test(String(h).trim())))
  let full = buildSmartSuggestedMapping(headers, isCashBook, base, {
    preferForeignCurrencyAmounts: preferForeign,
  })
  if (options.sampleRows?.length) {
    full = inferAdaptiveMapping(docType, headers, options.sampleRows, full).mapping
  }
  return trimMappingForDocumentType(docType, full)
}

/** Drop opposite-side amount fields unless both map to one signed column. */
export function trimMappingForDocumentType(
  docType: DocumentType,
  mapping: Record<string, number>
): Record<string, number> {
  const full = { ...mapping }
  const isCashBook = docType.startsWith('cash_book_')
  if (isCashBook) {
    // Preserve both fields when they intentionally point at one signed amount
    // column. applyDocumentMapping uses that equality to split signs safely.
    const signedOneColumn =
      full.amt_received != null &&
      full.amt_paid != null &&
      full.amt_received === full.amt_paid
    if (!signedOneColumn) {
      if (docType === 'cash_book_receipts') delete full.amt_paid
      if (docType === 'cash_book_payments') delete full.amt_received
    }
  } else {
    const signedOneColumn =
      full.credit != null && full.debit != null && full.credit === full.debit
    if (!signedOneColumn) {
      if (docType === 'bank_credits') delete full.debit
      if (docType === 'bank_debits') delete full.credit
    }
  }
  return full
}

export function canAutoMap(
  docType: DocumentType,
  headers: string[],
  suggested: Record<string, number>,
  sampleRows: unknown[][] = []
): boolean {
  if (headers.length < 2) return false
  const isCashBook = docType.startsWith('cash_book_')
  const dateField = isCashBook ? 'date' : 'transaction_date'
  const amountField =
    docType === 'cash_book_receipts'
      ? 'amt_received'
      : docType === 'cash_book_payments'
        ? 'amt_paid'
        : docType === 'bank_credits'
          ? 'credit'
          : 'debit'
  if (suggested[dateField] == null || suggested[amountField] == null) return false
  const confidence = getMappingConfidence(headers, suggested)
  const adaptive = sampleRows.length
    ? inferAdaptiveMapping(docType, headers, sampleRows)
    : null
  const adaptiveSupports = (field: string): boolean =>
    adaptive?.mapping[field] === suggested[field] &&
    isHighOrMedium(adaptive.confidence[field])
  if (
    (!isHighOrMedium(confidence[dateField]) && !adaptiveSupports(dateField)) ||
    (!isHighOrMedium(confidence[amountField]) && !adaptiveSupports(amountField))
  ) {
    return false
  }
  return true
}

export type AutoMapOutcome =
  | {
      status: 'skipped'
      reason: string
      typeCorrected?: { from: DocumentType; to: DocumentType }
      typeInference?: DocumentTypeInference
    }
  | {
      status: 'mapped'
      transactionCount: number
      parseMethod?: string
      typeCorrected?: { from: DocumentType; to: DocumentType }
      typeInference?: DocumentTypeInference
    }
  | { status: 'failed'; error: string }

/** Parse file, apply suggested mapping when safe. Does not throw — for use after upload. */
export async function tryAutoMapDocument(documentId: string): Promise<AutoMapOutcome> {
  if (!AUTO_MAP) {
    await markDocumentParseReady(documentId, 'Auto-map disabled — map manually').catch(() => undefined)
    incOpsMetric('parse.auto_map_skipped', {
      detail: { reason: 'disabled', documentId },
    })
    return { status: 'skipped', reason: 'AUTO_MAP_ON_UPLOAD disabled' }
  }

  const doc = await prisma.document.findFirst({
    where: { id: documentId },
    include: { project: { include: { organization: true } } },
  })
  if (!doc?.project?.organization) {
    return { status: 'skipped', reason: 'document not found' }
  }

  await markDocumentParseProcessing(documentId).catch(() => undefined)

  try {
    let docType = doc.type
    let typeCorrected: { from: DocumentType; to: DocumentType } | undefined
    let typeInference: DocumentTypeInference | undefined

    const ft = detectFileType(doc.filepath)
    let sheetIndex = ft === 'excel' ? pickBestExcelSheetIndex(doc.filepath, docType) : 0
    let parsed = await parseDocumentFile(doc.filepath, docType, sheetIndex)

    typeInference = inferDocumentFamily(parsed.headers, {
      sampleRows: parsed.rows.slice(0, 40),
      parseMethod: parsed.parseMethod,
      filename: doc.filename,
    })
    const currentFamily = documentFamilyOf(docType)
    if (
      AUTO_CORRECT_DOC_TYPE &&
      typeInference.confidence === 'high' &&
      typeInference.family !== 'unknown' &&
      typeInference.family !== currentFamily
    ) {
      const nextType = remapDocumentTypeToFamily(docType, typeInference.family)
      await prisma.document.update({
        where: { id: documentId },
        data: {
          type: nextType,
          ...(typeInference.family === 'cash_book' ? { bankAccountId: null } : {}),
        },
      })
      typeCorrected = { from: docType, to: nextType }
      docType = nextType
      sheetIndex = ft === 'excel' ? pickBestExcelSheetIndex(doc.filepath, docType) : 0
      parsed = await parseDocumentFile(doc.filepath, docType, sheetIndex)
      incOpsMetric('parse.type_corrected', {
        detail: { documentId, from: typeCorrected.from, to: typeCorrected.to },
      })
    }

    if (parsed.parseQualityScore != null) {
      observeParseQuality(parsed.parseQualityScore, {
        documentId,
        parseMethod: parsed.parseMethod,
      })
    }
    if (parsed.ocrRetried) {
      incOpsMetric('parse.ocr_retried', {
        detail: { documentId, parseMethod: parsed.parseMethod },
      })
    }
    if (parsed.parseMethod === 'ocr_geometry') {
      incOpsMetric('parse.ocr_geometry', { detail: { documentId } })
    }

    const sample = parsed.rows.slice(0, 20)
    let detectedBankFormat: GhanaBankFormat = null
    if (!docType.startsWith('cash_book_')) {
      detectedBankFormat = resolveDetectedBankFormat(parsed.headers, sample, parsed.parseMethod)
    }
    const suggested = buildSuggestedMappingForDocument(docType, parsed.headers, detectedBankFormat, {
      projectCurrency: doc.project.currency || 'GHS',
      sampleRows: parsed.rows.slice(0, 250),
    })
    const learned = await applyOrganisationLayoutMemory(
      doc.project.organizationId,
      docType,
      parsed.headers,
      suggested
    )
    if (learned.match && learned.appliedFields.length) {
      incOpsMetric('parse.layout_memory_hit', {
        labels: { exact: learned.match.exact ? 'true' : 'false' },
        detail: { documentId, fields: learned.appliedFields.length },
      })
      if (learned.match.exact) {
        incOpsMetric('parse.layout_memory_exact', { detail: { documentId }, log: false })
      }
    }
    const mapping = sanitizeMapping(
      trimMappingForDocumentType(docType, learned.mapping),
      parsed.headers.length
    )
    if (!canAutoMap(docType, parsed.headers, mapping, parsed.rows.slice(0, 250))) {
      await markDocumentParseReady(
        documentId,
        'Mapping confidence too low — map manually'
      ).catch(() => undefined)
      incOpsMetric('parse.auto_map_skipped', {
        detail: { reason: 'low_confidence', documentId },
      })
      return {
        status: 'skipped',
        reason: 'mapping confidence too low — map manually',
        typeCorrected,
        typeInference,
      }
    }
    const result = await applyDocumentMapping(
      documentId,
      docType,
      parsed,
      mapping,
      doc.project.organizationId,
      doc.projectId,
      doc.project.organization.plan
    )
    if (learned.match) {
      await touchLayoutMemoryUse(learned.match.id).catch(() => undefined)
    }
    await markDocumentParseReady(
      documentId,
      `Auto-mapped ${result.count} transaction(s)`
    ).catch(() => undefined)
    incOpsMetric('parse.auto_map_mapped', {
      detail: { documentId, transactionCount: result.count, parseMethod: parsed.parseMethod },
    })
    return {
      status: 'mapped',
      transactionCount: result.count,
      parseMethod: parsed.parseMethod,
      typeCorrected,
      typeInference,
    }
  } catch (e) {
    const error = (e as Error).message
    await markDocumentParseFailed(documentId, error).catch(() => undefined)
    incOpsMetric('parse.auto_map_failed', { detail: { documentId, error } })
    return { status: 'failed', error }
  }
}
