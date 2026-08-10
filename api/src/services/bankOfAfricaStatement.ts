/**
 * Bank of Africa Ghana Excel export (.xlsm template).
 * Sheet "Template": metadata rows 0–1, headers row 2, transactions from row 3.
 */

import { parseImportedAmount } from './amountParser.js'
import type { ParseResult } from './parser.js'

function norm(h: string): string {
  return (h || '').toLowerCase().replace(/[\s_]+/g, ' ').trim()
}

function cellText(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const dd = String(value.getDate()).padStart(2, '0')
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const mon = months[value.getMonth()] ?? 'Jan'
    const yy = String(value.getFullYear()).slice(-2)
    return `${dd}-${mon}-${yy}`
  }
  return String(value).replace(/\s+/g, ' ').trim()
}

function isDashPlaceholder(value: unknown): boolean {
  const s = String(value ?? '').trim()
  return s === '' || /^-\s*$/.test(s) || /^-+$/.test(s)
}

export function isBankOfAfricaStatementLayout(headers: string[], rows: unknown[][]): boolean {
  const h = headers.map(norm).join(' ')
  if (/\bdebit\b/.test(h) && /\bcredit\b/.test(h) && /value date/.test(h) && /description/.test(h)) {
    if (/our reference|trxn code|operation date/.test(h)) return true
  }
  const joined = rows.slice(0, 10).flat().map((c) => String(c ?? '')).join(' ').toLowerCase()
  return /our reference/.test(joined) && /trxn code/.test(joined) && /\bdebit\b/.test(joined)
}

/** Find Bank of Africa transaction header row inside a sheet. */
export function findBankOfAfricaTransactionHeaderRow(data: unknown[][]): number {
  for (let i = 0; i < Math.min(45, data.length); i++) {
    const row = data[i] || []
    const cells = row.map((c) => norm(String(c ?? '')))
    const hasDebit = cells.some((c) => c === 'debit')
    const hasCredit = cells.some((c) => c === 'credit')
    const hasDesc = cells.some((c) => c === 'description')
    const hasDate = cells.some((c) => c === 'value date' || c === 'operation date')
    if (hasDebit && hasCredit && hasDesc && hasDate) return i
  }
  return -1
}

function colIndex(headers: string[], patterns: RegExp[]): number {
  const normHeaders = headers.map(norm)
  return normHeaders.findIndex((h) => patterns.some((p) => p.test(h)))
}

/**
 * Clean BOA template export:
 * - keep only real transaction columns (drop control / Col_* padding)
 * - trim text, turn "-" debit/credit placeholders into null
 * - emit numeric debit/credit/balance
 * - drop zero-amount padding rows
 */
export function normalizeBankOfAfricaExcelTable(result: ParseResult): ParseResult {
  const matrix = [result.headers, ...result.rows]
  const headerRow = findBankOfAfricaTransactionHeaderRow(matrix)
  if (headerRow < 0) return result

  const headerCells = (matrix[headerRow] || []).map((c) => String(c ?? '').trim())
  const headers = headerCells.map((c, i) => c || `Col_${i}`)

  const refIdx = colIndex(headers, [/^our reference$/])
  const trxnIdx = colIndex(headers, [/^trxn code$/])
  const acctIdx = colIndex(headers, [/^account number$/])
  const opDateIdx = colIndex(headers, [/^operation date$/])
  const valueDateIdx = colIndex(headers, [/^value date$/])
  const descIdx = colIndex(headers, [/^description$/])
  const debitIdx = colIndex(headers, [/^debit$/])
  const creditIdx = colIndex(headers, [/^credit$/])
  const chqIdx = colIndex(headers, [/^cheque number$/])
  const balIdx = colIndex(headers, [/^balance$/])

  const outHeaders = [
    'Our Reference',
    'Trxn Code',
    'Account Number',
    'Operation Date',
    'Value Date',
    'Description',
    'Debit',
    'Credit',
    'Cheque Number',
    'Balance',
  ]

  const rows: unknown[][] = []
  for (const row of matrix.slice(headerRow + 1)) {
    const get = (i: number) => (i >= 0 && i < row.length ? row[i] : null)
    const debitRaw = get(debitIdx)
    const creditRaw = get(creditIdx)
    const debit = debitIdx >= 0 && !isDashPlaceholder(debitRaw) ? parseImportedAmount(debitRaw) : 0
    const credit = creditIdx >= 0 && !isDashPlaceholder(creditRaw) ? parseImportedAmount(creditRaw) : 0
    const desc = cellText(get(descIdx))
    if (debit <= 0 && credit <= 0) continue

    const balanceRaw = get(balIdx)
    const balance =
      balIdx >= 0 && balanceRaw != null && String(balanceRaw).trim() !== ''
        ? parseImportedAmount(balanceRaw)
        : null

    rows.push([
      cellText(get(refIdx)) || null,
      cellText(get(trxnIdx)) || null,
      cellText(get(acctIdx)) || null,
      cellText(get(opDateIdx)) || null,
      cellText(get(valueDateIdx)) || null,
      desc || null,
      debit > 0 ? debit : null,
      credit > 0 ? credit : null,
      cellText(get(chqIdx)) || null,
      balance,
    ])
  }

  return { ...result, headers: outHeaders, rows }
}
