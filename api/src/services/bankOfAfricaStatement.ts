/**
 * Bank of Africa Ghana Excel export (.xlsm template).
 * Sheet "Template": metadata rows 0–1, headers row 2, transactions from row 3.
 */

import { parseImportedAmount } from './amountParser.js'
import type { ParseResult } from './parser.js'

function norm(h: string): string {
  return (h || '').toLowerCase().replace(/[\s_]+/g, ' ').trim()
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

/** Drop padding rows and zero-amount lines from the BOA template export. */
export function normalizeBankOfAfricaExcelTable(result: ParseResult): ParseResult {
  const matrix = [result.headers, ...result.rows]
  const headerRow = findBankOfAfricaTransactionHeaderRow(matrix)
  if (headerRow < 0) return result

  const headerCells = (matrix[headerRow] || []).map((c) => String(c ?? '').trim())
  const headers = headerCells.map((c, i) => c || `Col_${i}`)

  const debitIdx = colIndex(headers, [/^debit$/])
  const creditIdx = colIndex(headers, [/^credit$/])
  const descIdx = colIndex(headers, [/^description$/])

  const rows = matrix.slice(headerRow + 1).filter((row) => {
    const debit = debitIdx >= 0 ? parseImportedAmount(row[debitIdx]) : 0
    const credit = creditIdx >= 0 ? parseImportedAmount(row[creditIdx]) : 0
    const desc = descIdx >= 0 ? String(row[descIdx] ?? '').trim() : ''
    if (debit > 0 || credit > 0) return true
    return desc.length > 0 && (debit !== 0 || credit !== 0)
  })

  return { ...result, headers, rows }
}
