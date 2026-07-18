import fs from 'fs'
import * as XLSX from 'xlsx'
import { buildSuggestedMappingForDocument } from './autoMapDocument.js'
import { parseImportedAmount } from './amountParser.js'
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

    const hasDescription = cells.some((c) => /^description$/.test(c))
    const hasAmount = cells.some((c) => /^amount$/.test(c))
    const hasTglCode = cells.some((c) => /tgl\s*account\s*code/.test(c))
    if (hasDate && hasDescription && hasAmount && hasTglCode) return i
  }
  return -1
}

/** Ghana Cocoa Board / ERP G/L Transactions Listing (GLPTLS1) cash book export. */
export function findErpGlCashBookHeaderRow(data: unknown[][]): number {
  for (let i = 0; i < Math.min(50, data.length); i++) {
    const row = data[i] || []
    const cells = row.map((c) => norm(String(c ?? '')))
    const hasSource = cells.some((c) => c === 'source')
    const hasDocDate = cells.some((c) => /doc\.?\s*date/.test(c))
    const hasDebits = cells.some((c) => /^debits$/.test(c))
    const hasCredits = cells.some((c) => /^credits$/.test(c))
    const hasReference = cells.some((c) => /^reference/.test(c))
    if (hasSource && hasDocDate && hasDebits && hasCredits && hasReference) return i
  }
  return -1
}

export function isErpGlCashBookLayout(headers: string[]): boolean {
  const joined = headers.map(norm).join(' ')
  return (
    /\bsource\b/.test(joined) &&
    /doc\.?\s*date/.test(joined) &&
    /\bdebits\b/.test(joined) &&
    /\bcredits\b/.test(joined)
  )
}

const ERP_GL_ACCOUNT_REF = /^\d{3}-\d{3}-\d{3}$/

export function normalizeErpGlCashBookTable(result: ParseResult): ParseResult {
  const normHeaders = result.headers.map((h) => norm(String(h ?? '')))
  const idx = (patterns: RegExp[]) =>
    normHeaders.findIndex((h) => patterns.some((p) => p.test(h)))
  const sourceIdx = idx([/^source$/])
  const dateIdx = idx([/^doc\.?\s*date$/])
  const refIdx = idx([/^reference/])
  const seqIdx = idx([/^seq\.?$/])
  const batchIdx = idx([/^batch-entry$/])
  const debitIdx = idx([/^debits$/])
  const creditIdx = idx([/^credits$/])

  const outHeaders = [
    'Transaction Date',
    'Description',
    'Doc Ref',
    'Seq',
    'AMT RECEIVED',
    'AMT PAID',
  ]
  const outRows: unknown[][] = []

  for (const row of result.rows) {
    const get = (i: number) => (i >= 0 && i < row.length ? row[i] : null)
    const source = String(get(sourceIdx) ?? '').trim()
    if (!source) continue
    const desc = String(get(refIdx) ?? '').trim()
    if (!desc || ERP_GL_ACCOUNT_REF.test(desc)) continue
    const debit = debitIdx >= 0 ? parseImportedAmount(get(debitIdx)) : 0
    const credit = creditIdx >= 0 ? parseImportedAmount(get(creditIdx)) : 0
    if (debit === 0 && credit === 0) continue
    outRows.push([
      get(dateIdx),
      desc,
      batchIdx >= 0 ? get(batchIdx) : null,
      seqIdx >= 0 ? get(seqIdx) : null,
      credit > 0 ? credit : null,
      debit > 0 ? debit : null,
    ])
  }

  return { ...result, headers: outHeaders, rows: outRows }
}

/** TGL / IBIS ERP cash book export: signed Amount (+ = payment, − = receipt). */
export function isTglErpCashBookLayout(headers: string[]): boolean {
  const joined = headers.map(norm).join(' ')
  return (
    /tgl\s*account\s*code/.test(joined) &&
    /transaction\s*date/.test(joined) &&
    /\bdescription\b/.test(joined) &&
    /\bamount\b/.test(joined)
  )
}

/**
 * Normalize TGL ERP cash books into receipt/payment columns.
 * Preserves foreign-currency columns (euro/USD) so EUR projects can map
 * FC AMT RECEIVED / FC AMT PAID instead of the GHS Amount equivalent.
 */
export function normalizeTglErpCashBookTable(result: ParseResult): ParseResult {
  const normHeaders = result.headers.map(norm)
  const idx = (patterns: RegExp[]) =>
    normHeaders.findIndex((h) => patterns.some((p) => p.test(h)))
  const dateIdx = idx([/^transaction\s*date$/, /^date$/])
  const descIdx = idx([/^description$/])
  const amtIdx = idx([/^amount$/])
  const refIdx = idx([/^transaction\s*reference$/, /^doc\s*ref/])
  const chqIdx = idx([/^cheque\s*no$/, /chq\s*no/])
  const accodeIdx = idx([/^tgl\s*account\s*code$/, /^account\s*code$/])
  const currencyIdx = idx([/^currency\s*code$/, /^currency$/])
  const exchIdx = idx([/^exch(?:ange)?\s*rate$/, /^exch\s*rate$/])
  const fcAmtIdx = idx([/^foreign\s*currency\s*amount$/, /^fc\s*amount$/, /^foreign\s*amount$/])

  const outHeaders = [
    'Transaction Date',
    'Description',
    'Doc Ref',
    'Chq No',
    'Accode',
    'AMT RECEIVED',
    'AMT PAID',
    'Currency Code',
    'Exch Rate',
    'Foreign Currency Amount',
    'FC AMT RECEIVED',
    'FC AMT PAID',
  ]
  const outRows: unknown[][] = []

  for (const row of result.rows) {
    const get = (i: number) => (i >= 0 && i < row.length ? row[i] : null)
    const desc = String(get(descIdx) ?? '').trim()
    if (/^total\s+(debit|credit)/i.test(desc)) continue
    const amt = amtIdx >= 0 ? parseImportedAmount(get(amtIdx)) : 0
    const fcAmt = fcAmtIdx >= 0 ? parseImportedAmount(get(fcAmtIdx)) : 0
    if (amt === 0 && fcAmt === 0) continue
    const received = amt < 0 ? Math.abs(amt) : null
    const paid = amt > 0 ? amt : null
    // Same sign convention as Amount: negative = receipt, positive = payment
    const fcReceived = fcAmt < 0 ? Math.abs(fcAmt) : null
    const fcPaid = fcAmt > 0 ? fcAmt : null
    outRows.push([
      get(dateIdx),
      desc,
      refIdx >= 0 ? get(refIdx) : null,
      chqIdx >= 0 ? get(chqIdx) : null,
      accodeIdx >= 0 ? get(accodeIdx) : null,
      received,
      paid,
      currencyIdx >= 0 ? get(currencyIdx) : null,
      exchIdx >= 0 ? get(exchIdx) : null,
      fcAmt !== 0 ? fcAmt : null,
      fcReceived,
      fcPaid,
    ])
  }

  return { ...result, headers: outHeaders, rows: outRows }
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

  const cleanRows = rows.filter(
    (r) => !r.some((c) => typeof c === 'string' && (c.includes('\r\n') || c.includes('\n')))
  )
  score += Math.min(cleanRows.length, 80)
  score -= (rows.length - cleanRows.length) * 8

  const joined = headers.join(' ').toLowerCase()
  if (isCashBook && /received/.test(joined) && /paid/.test(joined) && !/date/.test(joined)) {
    score -= 50
  }
  if (rows.length < 3) score -= 30

  return score
}

export function pickBestExcelSheetIndex(filepath: string, docType: DocumentType): number {
  const ext = filepath.toLowerCase()
  if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls') && !ext.endsWith('.xlsm')) return 0
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
