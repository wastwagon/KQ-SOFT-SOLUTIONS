import fs from 'fs'
import * as XLSX from 'xlsx'
import { buildSuggestedMappingForDocument } from './autoMapDocument.js'
import { parseExcel, type ParseResult } from './parser.js'
import type { DocumentType } from '@prisma/client'

function norm(cell: string): string {
  return cell.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Row with DATE plus receipt/payment amount columns (Grace Baptist / LIB layouts). */
export function findCashBookTransactionHeaderRow(data: unknown[][]): number {
  for (let i = 0; i < Math.min(45, data.length); i++) {
    const row = data[i] || []
    const cells = row.map((c) => norm(String(c ?? '')))
    const hasDate = cells.some(
      (c) => /^date$/.test(c) || /^transaction\s*date$/.test(c) || c === 'txn date'
    )
    const hasReceipt = cells.some((c) =>
      /^(amt\s*)?(received|rec)$/.test(c) || /^amount\s*received$/.test(c)
    )
    const hasPayment = cells.some((c) =>
      /^(amt\s*)?(paid)$/.test(c) || /^amount\s*paid$/.test(c)
    )
    if (hasDate && (hasReceipt || hasPayment)) return i
  }
  return -1
}

/** Prefer detail sheets over monthly summary tabs (e.g. acct002 Sheet1 vs Sheet2). */
export function scoreExcelSheetForDocument(
  parsed: ParseResult,
  docType: DocumentType
): number {
  const isCashBook = docType.startsWith('cash_book_')
  const headers = parsed.headers || []
  const rows = parsed.rows || []
  let score = 0

  const suggested = buildSuggestedMappingForDocument(docType, headers, null)
  const dateField = isCashBook ? 'date' : 'transaction_date'
  const amountField =
    docType === 'cash_book_receipts'
      ? 'amt_received'
      : docType === 'cash_book_payments'
        ? 'amt_paid'
        : docType === 'bank_credits'
          ? 'credit'
          : 'debit'

  if (suggested[dateField] != null) score += 40
  else score -= 100
  if (suggested[amountField] != null) score += 30
  else score -= 40
  score += Math.min(rows.length, 80)

  const joined = headers.join(' ').toLowerCase()
  if (isCashBook && /received/.test(joined) && /paid/.test(joined) && !/date/.test(joined)) {
    score -= 50
  }
  if (rows.length < 3) score -= 30

  return score
}

export function pickBestExcelSheetIndex(filepath: string, docType: DocumentType): number {
  const ext = filepath.toLowerCase()
  if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) return 0
  if (!fs.existsSync(filepath)) return 0

  const buf = fs.readFileSync(filepath)
  const wb = XLSX.read(buf, { type: 'buffer' })
  if (wb.SheetNames.length <= 1) return 0

  let best = 0
  let bestScore = Number.NEGATIVE_INFINITY
  let bestRows = -1
  for (let si = 0; si < wb.SheetNames.length; si++) {
    const parsed = parseExcel(filepath, si)
    const score = scoreExcelSheetForDocument(parsed, docType)
    if (score > bestScore || (score === bestScore && parsed.rows.length > bestRows)) {
      bestScore = score
      bestRows = parsed.rows.length
      best = si
    }
  }
  return best
}
