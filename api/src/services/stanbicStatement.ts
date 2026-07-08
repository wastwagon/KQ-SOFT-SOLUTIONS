/**
 * Stanbic Bank Ghana statement Excel export.
 * Sheet layout: letterhead rows, header row with Transaction Date / Debits / Credits,
 * then transactions with optional description continuation lines.
 */

import { parseImportedAmount } from './amountParser.js'
import type { ParseResult } from './parser.js'

function norm(h: string): string {
  return (h || '').toLowerCase().replace(/[\s_]+/g, ' ').trim()
}

export function isStanbicStatementLayout(headers: string[], rows: unknown[][]): boolean {
  const h = headers.map(norm).join(' ')
  if (
    /transaction date/.test(h) &&
    /value date/.test(h) &&
    (/transaction description/.test(h) || /\bdescription\b/.test(h)) &&
    /\bdebit/.test(h) &&
    /\bcredit/.test(h)
  ) {
    return true
  }
  const joined = rows.slice(0, 10).flat().map((c) => String(c ?? '')).join(' ').toLowerCase()
  return /stanbic|standard bank/.test(joined) && /transaction date/.test(joined)
}

function isStanbicHeaderRow(row: unknown[]): boolean {
  const cells = row.map((c) => norm(String(c ?? '')))
  const hasTxDate = cells.some((c) => c === 'transaction date')
  const hasValueDate = cells.some((c) => c === 'value date')
  const hasDebit = cells.some((c) => c === 'debits' || c === 'debit')
  const hasCredit = cells.some((c) => c === 'credits' || c === 'credit')
  return hasTxDate && hasValueDate && hasDebit && hasCredit
}

export function findStanbicTransactionHeaderRow(data: unknown[][]): number {
  for (let i = 0; i < Math.min(50, data.length); i++) {
    if (isStanbicHeaderRow(data[i] || [])) return i
  }
  return -1
}

function colIndex(headers: string[], patterns: RegExp[]): number {
  const normHeaders = headers.map(norm)
  return normHeaders.findIndex((h) => patterns.some((p) => p.test(h)))
}

function isStanbicDateValue(value: unknown): boolean {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return true
  const s = String(value ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return true
  if (/^\d{2}-[A-Za-z]{3}-\d{4}$/i.test(s)) return true
  return false
}

function formatStanbicDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const d = value.getUTCDate().toString().padStart(2, '0')
    const m = (value.getUTCMonth() + 1).toString().padStart(2, '0')
    const y = value.getUTCFullYear()
    return `${d}/${m}/${y}`
  }
  const s = String(value ?? '').trim()
  const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (dmy) return `${dmy[1]}/${dmy[2]}/${dmy[3]}`
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  return s
}

function isNoiseRow(row: unknown[], descIdx: number): boolean {
  const desc = descIdx >= 0 ? String(row[descIdx] ?? '').trim() : ''
  if (!desc && !isStanbicDateValue(row[0])) return true
  if (/^statement opening balance/i.test(desc)) return true
  if (/^balance brought forward/i.test(desc)) return true
  if (/^balance as at/i.test(desc)) return true
  if (/^transaction details/i.test(desc)) return true
  if (/^please verify all transactions/i.test(desc)) return true
  if (/^overdraft/i.test(desc)) return true
  if (/^#/i.test(desc)) return true
  if (/^branch name/i.test(desc)) return true
  if (/^bank statement/i.test(desc)) return true
  if (/^credits$/i.test(desc) || /^debits$/i.test(desc)) return true
  if (/^fee summary/i.test(desc)) return true
  if (/^\d{12,}$/.test(String(row[0] ?? '').trim()) && !isStanbicDateValue(row[0])) return true
  return false
}

/** Normalize Stanbic Excel export to a clean transaction table. */
export function normalizeStanbicExcelTable(result: ParseResult): ParseResult {
  const matrix = [result.headers, ...result.rows]
  const headerRow = findStanbicTransactionHeaderRow(matrix)
  if (headerRow < 0) return result

  const headerCells = (matrix[headerRow] || []).map((c) => String(c ?? '').trim())
  const headers = headerCells.map((c, i) => c || `Col_${i}`)

  const txIdx = colIndex(headers, [/^transaction date$/])
  const valueIdx = colIndex(headers, [/^value date$/])
  const descIdx = colIndex(headers, [/^transaction description$/])
  const debitIdx = colIndex(headers, [/^debits?$/, /^debit$/])
  const creditIdx = colIndex(headers, [/^credits?$/, /^credit$/])
  const balanceIdx = colIndex(headers, [/^balance$/])

  const outHeaders = [
    'Transaction Date',
    'Value Date',
    'Description',
    'Fee',
    'Debit',
    'Credit',
    'Balance',
  ]
  const rows: unknown[][] = []

  let pending: {
    txDate: unknown
    valueDate: unknown
    description: string
    debit: number
    credit: number
    balance: number | null
  } | null = null

  const flush = () => {
    if (!pending) return
    if (pending.debit === 0 && pending.credit === 0) {
      pending = null
      return
    }
    rows.push([
      formatStanbicDate(pending.txDate),
      formatStanbicDate(pending.valueDate),
      pending.description,
      null,
      pending.debit > 0 ? pending.debit : null,
      pending.credit > 0 ? pending.credit : null,
      pending.balance,
    ])
    pending = null
  }

  for (const row of matrix.slice(headerRow + 1)) {
    if (isStanbicHeaderRow(row)) continue
    if (isNoiseRow(row, descIdx)) {
      if (isStanbicDateValue(row[txIdx])) flush()
      continue
    }

    if (isStanbicDateValue(row[txIdx])) {
      flush()
      const debit = debitIdx >= 0 ? parseImportedAmount(row[debitIdx]) : 0
      const credit = creditIdx >= 0 ? parseImportedAmount(row[creditIdx]) : 0
      const balance =
        balanceIdx >= 0 && row[balanceIdx] != null && String(row[balanceIdx]).trim() !== ''
          ? parseImportedAmount(row[balanceIdx])
          : null
      pending = {
        txDate: row[txIdx],
        valueDate: valueIdx >= 0 ? row[valueIdx] : row[txIdx],
        description: String(descIdx >= 0 ? row[descIdx] ?? '' : '').trim(),
        debit,
        credit,
        balance,
      }
      continue
    }

    if (pending) {
      const extra = String(descIdx >= 0 ? row[descIdx] ?? '' : '').trim()
      if (extra) {
        pending.description = [pending.description, extra].filter(Boolean).join(' ').trim()
      }
    }
  }
  flush()

  return { ...result, headers: outHeaders, rows }
}
