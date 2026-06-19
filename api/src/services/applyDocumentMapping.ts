/**
 * Apply column mapping → Transaction rows (shared by map API and auto-map on upload).
 */
import type { DocumentType } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { parseImportedDate } from './dateParser.js'
import { parseImportedAmount } from './amountParser.js'
import { extractChqNoFromDescription } from './ghanaBankParsers.js'
import { shouldSkipBankStatementImportRow } from './bankStatementImport.js'
import { canAddTransactions, adjustTransactions } from './usage.js'
import { classifyBySourceSign, summarizeSignBuckets, type SourceDocumentType } from './signClassifier.js'
import { SIGN_WARNINGS_PREVIEW_MAX } from '../config/importLimits.js'
import type { ParseResult } from './parser.js'

export type MappingInput = Record<string, number>

export function sanitizeMapping(
  raw: Record<string, number | string>,
  headerCount: number
): MappingInput {
  const mapping: MappingInput = {}
  for (const [k, v] of Object.entries(raw)) {
    const idx = typeof v === 'string' ? parseInt(v, 10) : v
    if (typeof idx === 'number' && !isNaN(idx) && idx >= 0 && idx < headerCount) {
      mapping[k] = idx
    }
  }
  return mapping
}

export function defaultAmountField(docType: DocumentType): string {
  if (docType === 'cash_book_receipts') return 'amt_received'
  if (docType === 'cash_book_payments') return 'amt_paid'
  if (docType === 'bank_credits') return 'credit'
  return 'debit'
}

export function validateMapping(
  docType: DocumentType,
  mapping: MappingInput,
  headerCount: number
): string | null {
  const isCashBook = docType.startsWith('cash_book_')
  const dateField = isCashBook ? 'date' : 'transaction_date'
  if (mapping[dateField] == null) {
    return `${dateField === 'date' ? 'Date' : 'Transaction date'} column is required for mapping.`
  }
  const amountField = defaultAmountField(docType)
  if (mapping[amountField] == null) {
    return `${amountField} column is required for this document type.`
  }
  for (const [field, idx] of Object.entries(mapping)) {
    if (idx >= headerCount) {
      return `Column mapping for "${field}" (index ${idx}) is out of range. Document has ${headerCount} columns.`
    }
  }
  return null
}

export type ApplyMappingResult = {
  count: number
  sourceRowCount: number
  skippedDuplicateRows: number
  skippedZeroAmountRows: number
  signWarningsCount: number
  signWarningsPreview: { rowIndex: number; amount: number; bucket: string; note?: string }[]
  signFilterSummary: ReturnType<typeof summarizeSignBuckets>
}

export async function applyDocumentMapping(
  documentId: string,
  docType: DocumentType,
  result: ParseResult,
  mapping: MappingInput,
  organizationId: string,
  projectId: string,
  orgPlan: string
): Promise<ApplyMappingResult> {
  const err = validateMapping(docType, mapping, result.headers.length)
  if (err) throw new Error(err)

  const isCashBook = docType.startsWith('cash_book_')
  const dateField = isCashBook ? 'date' : 'transaction_date'
  const amountField = defaultAmountField(docType)
  const isCashMixedOneColumn =
    isCashBook &&
    mapping.amt_received != null &&
    mapping.amt_paid != null &&
    mapping.amt_received === mapping.amt_paid
  const isBankMixedOneColumn =
    !isCashBook &&
    mapping.credit != null &&
    mapping.debit != null &&
    mapping.credit === mapping.debit

  const transactions: {
    rowIndex: number
    date: Date | null
    name: string | null
    details: string | null
    docRef: string | null
    chqNo: string | null
    accode: number | null
    amount: number
  }[] = []
  const duplicateRowFingerprints = new Set<string>()
  let skippedDuplicateRows = 0
  let skippedZeroAmountRows = 0
  let skippedFooterRows = 0
  const sourceRowCount = result.rows.length
  const numCols = result.headers.length

  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows[i] as unknown[]
    const getVal = (field: string): unknown => {
      const col = mapping[field]
      if (col == null) return null
      if (col < 0 || col >= numCols) return null
      const v = row[col]
      return v != null && String(v).trim() !== '' ? v : null
    }
    const amount = parseImportedAmount(getVal(amountField))
    let normalizedAmount = amount
    let includeRow = Math.abs(amount) > 0
    if (includeRow && isCashMixedOneColumn) {
      if (docType === 'cash_book_receipts') includeRow = amount > 0
      else includeRow = amount < 0
      normalizedAmount = Math.abs(amount)
    } else if (includeRow && isBankMixedOneColumn) {
      if (docType === 'bank_credits') includeRow = amount > 0
      else includeRow = amount < 0
      normalizedAmount = Math.abs(amount)
    } else if (!includeRow) {
      skippedZeroAmountRows++
    }
    if (!includeRow) continue

    let details = getVal('details') != null ? String(getVal('details')) : null
    if (!details && getVal('description') != null) details = String(getVal('description'))
    if (!isCashBook && shouldSkipBankStatementImportRow(details, normalizedAmount)) {
      skippedFooterRows++
      continue
    }
    let chqNo = getVal('chq_no') != null ? String(getVal('chq_no')) : null
    if (!chqNo && !isCashBook && details) {
      const extracted = extractChqNoFromDescription(details)
      if (extracted) chqNo = extracted
    }
    const fp = `${parseImportedDate(getVal(dateField))?.toISOString() ?? 'null'}|${normalizedAmount}|${(getVal('name') ?? '').toString().trim()}|${(details ?? '').trim()}|${(getVal('doc_ref') ?? '').toString().trim()}|${(chqNo ?? '').trim()}`
    if (duplicateRowFingerprints.has(fp)) {
      skippedDuplicateRows++
      continue
    }
    duplicateRowFingerprints.add(fp)
    transactions.push({
      rowIndex: i + 1,
      date: parseImportedDate(getVal(dateField)),
      name: getVal('name') != null ? String(getVal('name')) : null,
      details,
      docRef: getVal('doc_ref') != null ? String(getVal('doc_ref')) : null,
      chqNo,
      accode:
        getVal('accode') != null
          ? typeof getVal('accode') === 'number'
            ? (getVal('accode') as number)
            : parseInt(String(getVal('accode')), 10)
          : null,
      amount: normalizedAmount,
    })
  }

  const previousTxCount = await prisma.transaction.count({ where: { documentId } })
  const usageDelta = transactions.length - previousTxCount
  if (usageDelta > 0) {
    const txLimitCheck = await canAddTransactions(organizationId, orgPlan, usageDelta)
    if (!txLimitCheck.ok) throw new Error(txLimitCheck.message)
  }

  await prisma.transaction.deleteMany({ where: { documentId } })
  if (transactions.length > 0) {
    await prisma.transaction.createMany({
      data: transactions.map((t) => ({ documentId, ...t })),
    })
  }
  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'mapping' },
  })
  await adjustTransactions(organizationId, usageDelta)

  const sourceType = docType as SourceDocumentType
  const signSummary = summarizeSignBuckets(
    sourceType,
    transactions.map((t) => t.amount)
  )
  const signWarnings = transactions
    .map((t) => {
      const c = classifyBySourceSign(sourceType, t.amount)
      return { rowIndex: t.rowIndex, amount: t.amount, bucket: c.bucket, note: c.note }
    })
    .filter((w) => w.bucket !== 'primary')

  return {
    count: transactions.length,
    sourceRowCount,
    skippedDuplicateRows,
    skippedZeroAmountRows,
    signWarningsCount: signWarnings.length,
    signWarningsPreview: signWarnings.slice(0, SIGN_WARNINGS_PREVIEW_MAX),
    signFilterSummary: signSummary,
  }
}
