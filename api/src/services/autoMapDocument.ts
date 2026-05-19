/**
 * After upload: auto-apply suggested mapping when confidence is high enough.
 */
import type { DocumentType } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { parseDocumentFile } from './documentParse.js'
import {
  detectGhanaBankFormat,
  getSuggestedBankMapping,
  type GhanaBankFormat,
} from './ghanaBankParsers.js'
import { buildSmartSuggestedMapping, getMappingConfidence, type MappingConfidence } from './suggestedMapping.js'
import { applyDocumentMapping, sanitizeMapping } from './applyDocumentMapping.js'

const AUTO_MAP = process.env.AUTO_MAP_ON_UPLOAD !== 'false'

function isHighOrMedium(c: MappingConfidence | undefined): boolean {
  return c === 'high' || c === 'medium'
}

export function buildSuggestedMappingForDocument(
  docType: DocumentType,
  headers: string[],
  detectedBankFormat: GhanaBankFormat | null
): Record<string, number> {
  const isCashBook = docType.startsWith('cash_book_')
  let base: Record<string, number> | undefined
  if (!isCashBook && detectedBankFormat) {
    const side = docType === 'bank_credits' ? 'credits' : 'debits'
    base = getSuggestedBankMapping(detectedBankFormat, headers, side)
  }
  const full = buildSmartSuggestedMapping(headers, isCashBook, base)
  if (isCashBook) {
    if (docType === 'cash_book_receipts') delete full.amt_paid
    if (docType === 'cash_book_payments') delete full.amt_received
  } else {
    if (docType === 'bank_credits') delete full.debit
    if (docType === 'bank_debits') delete full.credit
  }
  return full
}

export function canAutoMap(
  docType: DocumentType,
  headers: string[],
  suggested: Record<string, number>
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
  if (!isHighOrMedium(confidence[dateField]) || !isHighOrMedium(confidence[amountField])) {
    return false
  }
  return true
}

export type AutoMapOutcome =
  | { status: 'skipped'; reason: string }
  | { status: 'mapped'; transactionCount: number; parseMethod?: string }
  | { status: 'failed'; error: string }

/** Parse file, apply suggested mapping when safe. Does not throw — for use after upload. */
export async function tryAutoMapDocument(documentId: string): Promise<AutoMapOutcome> {
  if (!AUTO_MAP) {
    return { status: 'skipped', reason: 'AUTO_MAP_ON_UPLOAD disabled' }
  }

  const doc = await prisma.document.findFirst({
    where: { id: documentId },
    include: { project: { include: { organization: true } } },
  })
  if (!doc?.project?.organization) {
    return { status: 'skipped', reason: 'document not found' }
  }

  try {
    const parsed = await parseDocumentFile(doc.filepath, doc.type, 0)
    const sample = parsed.rows.slice(0, 20)
    let detectedBankFormat: GhanaBankFormat = null
    if (!doc.type.startsWith('cash_book_')) {
      detectedBankFormat = detectGhanaBankFormat(parsed.headers, sample)
    }
    const suggested = buildSuggestedMappingForDocument(doc.type, parsed.headers, detectedBankFormat)
    const mapping = sanitizeMapping(suggested, parsed.headers.length)
    if (!canAutoMap(doc.type, parsed.headers, mapping)) {
      return { status: 'skipped', reason: 'mapping confidence too low — map manually' }
    }
    const result = await applyDocumentMapping(
      documentId,
      doc.type,
      parsed,
      mapping,
      doc.project.organizationId,
      doc.projectId,
      doc.project.organization.plan
    )
    return {
      status: 'mapped',
      transactionCount: result.count,
      parseMethod: parsed.parseMethod,
    }
  } catch (e) {
    return { status: 'failed', error: (e as Error).message }
  }
}
