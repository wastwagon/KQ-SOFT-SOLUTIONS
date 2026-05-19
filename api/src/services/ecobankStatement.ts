/**
 * Ecobank Ghana account statement layout (Excel export + Apache FOP PDF).
 * Normalizes summary headers and Payments/Deposits columns into standard debit/credit fields.
 */

import { parseImportedAmount } from './amountParser.js'
import type { ParseResult } from './parser.js'

const DEPOSIT_HINT =
  /\b(DEPOSIT|INWARD|CREDIT|LODGMENT|LODGE|RECEIVED|TRANSFER\s*-\s*IN|FUNDS\s+TRANSFER\s*-\s*IN|FT\s+CONSOLIDATION)\b/i

function norm(h: string): string {
  return (h || '').toLowerCase().replace(/[\s_]+/g, ' ').trim()
}

export function looksLikeEcobankStatementText(text: string): boolean {
  const flat = text.replace(/\s+/g, ' ')
  return (
    /ecobank/i.test(flat) &&
    (/transaction\s*date/i.test(flat) || (/payments?/i.test(flat) && /deposits?/i.test(flat)))
  )
}

/** True when generic line-split PDF parse should be replaced by Ecobank block parser. */
export function shouldUseEcobankPdfParser(result: { headers: string[]; rows: unknown[][] }): boolean {
  const h = result.headers.map(norm).join(' ')
  if (/\bdebit\b/.test(h) && /\bcredit\b/.test(h)) return false
  if (result.headers.length >= 5 && result.headers.some((x) => /transaction\s*date/i.test(x))) return false
  return (
    result.headers.length < 5 ||
    /payments?/.test(h) ||
    result.rows.length > 150 ||
    (result.rows.length > 0 && (result.rows[0] as unknown[])?.length <= 2)
  )
}

export function isEcobankStatementLayout(headers: string[], rows: unknown[][]): boolean {
  const h = headers.map(norm).join(' ')
  if (/transaction\s*date/.test(h) && (/payments?/.test(h) || /deposits?/.test(h))) return true
  const joined = rows.slice(0, 15).flat().map((c) => String(c ?? '')).join(' ')
  return /ecobank/i.test(joined) && /transaction\s*date/i.test(joined)
}

/** Find row index of Ecobank transaction table header inside a sheet. */
export function findEcobankTransactionHeaderRow(data: unknown[][]): number {
  for (let i = 0; i < Math.min(35, data.length); i++) {
    const row = data[i] || []
    const cells = row.map((c) => norm(String(c ?? '')))
    const hasDate = cells.some((c) => /^transaction date$/.test(c) || c === 'date')
    const hasPay = cells.some((c) => /^payments?$/.test(c))
    const hasDep = cells.some((c) => /^deposits?$/.test(c))
    if (hasDate && (hasPay || hasDep)) return i
  }
  return -1
}

function classifyEcobankAmount(description: string, payments: number, deposits: number): { debit: number; credit: number } {
  let debit = payments
  let credit = deposits
  if (credit > 0 && debit > 0) return { debit, credit }
  if (credit > 0) return { debit: 0, credit }
  if (debit > 0 && DEPOSIT_HINT.test(description)) return { debit: 0, credit: debit }
  return { debit, credit: 0 }
}

/**
 * Slice Excel sheet to transaction table and map Payments/Deposits → Debit/Credit.
 */
export function normalizeEcobankExcelTable(result: ParseResult): ParseResult {
  const matrix = [result.headers, ...result.rows]
  const headerRow = findEcobankTransactionHeaderRow(matrix)
  if (headerRow < 0) return result

  const headerCells = (matrix[headerRow] || []).map((c) => String(c ?? '').trim())
  const headers = headerCells.map((c, i) => c || `Col_${i}`)
  const normHeaders = headers.map(norm)

  const idx = (patterns: RegExp[]) => normHeaders.findIndex((h) => patterns.some((p) => p.test(h)))
  const dateIdx = idx([/^transaction date$/, /^date$/])
  const descIdx = idx([/^description$/, /^particulars$/, /^narrative$/])
  const refIdx = idx([/^reference number$/, /^reference$/, /^ref$/])
  const valueDateIdx = idx([/^value date$/])
  const payIdx = idx([/^payments?$/])
  const depIdx = idx([/^deposits?$/])
  const balIdx = idx([/^balance$/])

  const outHeaders = [
    'Transaction Date',
    'Description',
    'Reference Number',
    'Value Date',
    'Debit',
    'Credit',
    'Balance',
  ]
  const outRows: unknown[][] = []

  for (let r = headerRow + 1; r < matrix.length; r++) {
    const row = matrix[r] as unknown[]
    if (!row?.some((c) => c != null && String(c).trim() !== '')) continue
    const get = (i: number) => (i >= 0 && i < row.length ? row[i] : null)
    const desc = String(get(descIdx) ?? '').trim()
    const payments = payIdx >= 0 ? parseImportedAmount(get(payIdx)) : 0
    const deposits = depIdx >= 0 ? parseImportedAmount(get(depIdx)) : 0
    const { debit, credit } = classifyEcobankAmount(desc, payments, deposits)
    if (debit === 0 && credit === 0) continue
    outRows.push([
      get(dateIdx),
      desc,
      refIdx >= 0 ? get(refIdx) : null,
      valueDateIdx >= 0 ? get(valueDateIdx) : null,
      debit > 0 ? debit : null,
      credit > 0 ? credit : null,
      balIdx >= 0 ? get(balIdx) : null,
    ])
  }

  return { ...result, headers: outHeaders, rows: outRows }
}

const GHS = /GHS\s*([\d,]+\.\d{2})/gi
const TX_START = /^(\d{2}-[A-Za-z]{3}-\d{4})\s*(.*)$/
const TAIL =
  /([A-Z0-9]{8,})\s*(\d{2}-[A-Za-z]{3}-\d{4})\s*((?:GHS\s*[\d,]+\.\d{2})\s*){1,2}\s*$/i

/** Parse Ecobank FOP PDF text into a transaction table. */
export function parseEcobankPdfText(text: string): ParseResult {
  const headers = [
    'Transaction Date',
    'Description',
    'Reference Number',
    'Value Date',
    'Debit',
    'Credit',
    'Balance',
  ]
  const rows: unknown[][] = []
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  let block: string[] = []
  const flush = () => {
    if (block.length === 0) return
    const blob = block.join('\n')
    const start = blob.match(/^(\d{2}-[A-Za-z]{3}-\d{4})\s*([\s\S]*)$/)
    if (!start) {
      block = []
      return
    }
    const txDate = start[1]!
    let rest = start[2]!
    const tail = rest.match(TAIL)
    if (!tail) {
      block = []
      return
    }
    const ref = tail[1]!
    const valueDate = tail[2]!
    const amounts = [...rest.matchAll(GHS)].map((m) => parseImportedAmount(m[0]))
    rest = rest.slice(0, tail.index).trim()
    const desc = rest.replace(/\s+/g, ' ').trim()
    let debit = 0
    let credit = 0
    let balance: number | null = null
    if (amounts.length >= 2) {
      balance = amounts[amounts.length - 1]!
      const txnAmt = amounts[amounts.length - 2]!
      const classified = classifyEcobankAmount(desc, txnAmt, 0)
      debit = classified.debit
      credit = classified.credit
    } else if (amounts.length === 1) {
      const classified = classifyEcobankAmount(desc, amounts[0]!, 0)
      debit = classified.debit
      credit = classified.credit
    }
    rows.push([
      txDate,
      desc,
      ref,
      valueDate,
      debit > 0 ? debit : null,
      credit > 0 ? credit : null,
      balance,
    ])
    block = []
  }

  for (const line of lines) {
    if (/^Transaction\s+Date/i.test(line)) continue
    if (/^\d+\s*$/.test(line)) continue
    if (/^\d{2}\s+[A-Za-z]{3}\s+\d{4}/.test(line) && line.length < 30) continue
    if (TX_START.test(line)) {
      flush()
      block = [line]
    } else if (block.length > 0) {
      block.push(line)
    }
  }
  flush()

  return { headers, rows }
}

