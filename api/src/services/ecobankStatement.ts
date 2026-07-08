/**
 * Ecobank Ghana account statement layout (Excel export + Apache FOP PDF).
 * Normalizes summary headers and Payments/Deposits columns into standard debit/credit fields.
 */

import { parseImportedAmount } from './amountParser.js'
import type { ParseResult } from './parser.js'

const DEPOSIT_HINT =
  /\b(DEPOSIT|INWARD|CREDIT|LODGMENT|LODGE|RECEIVED|TRANSFER\s*-\s*IN|FUNDS\s+TRANSFER\s*-\s*IN|TREASURY\s+BILLS?\s+MATURED|JOURNAL\s+ENTRY|COMMISSION|FINDERS)\b/i

const GHS = /GHS\s*([\d,]+\.\d{1,2})/gi
const TX_START = /^(\d{2}-[A-Za-z]{3}-\d{4})\s*(.*)$/
const AMOUNT_WITH_REF =
  /([A-Z0-9]{8,})\s*(\d{2}-[A-Za-z]{3}-\d{4})\s*((?:GHS\s*[\d,]+\.\d{1,2})\s*){1,2}\s*$/i
const AMOUNT_NO_REF =
  /^(\d{2}-[A-Za-z]{3}-\d{4})((?:GHS\s*[\d,]+\.\d{1,2})\s*){1,2}\s*$/i

const DEBIT_HINT =
  /\b(WITHDRAWAL|OUTWARD|CONSOLIDATION|CHARGE|FEE|PAYMENT(?!\s*OVERRIDING)|COST\s+OF)\b/i

function extractOpeningBalance(text: string): number {
  const m = text.match(/Opening\s+Balance\s*GHS\s*([\d,]+\.\d{1,2})/i)
  return m ? parseImportedAmount(m[1]) : 0
}

function classifyEcobankByBalance(
  txnAmt: number,
  balance: number,
  previousBalance: number,
  description: string
): { debit: number; credit: number } {
  const amt = Math.round(txnAmt * 100) / 100
  const bal = Math.round(balance * 100) / 100
  const prev = Math.round(previousBalance * 100) / 100
  if (amt > 0 && Math.abs(bal - amt - prev) < 0.02) return { debit: 0, credit: amt }
  if (amt > 0 && Math.abs(bal + amt - prev) < 0.02) return { debit: amt, credit: 0 }
  if (DEPOSIT_HINT.test(description) && !DEBIT_HINT.test(description)) return { debit: 0, credit: amt }
  if (DEBIT_HINT.test(description) && !DEPOSIT_HINT.test(description)) return { debit: amt, credit: 0 }
  return classifyEcobankAmount(description, amt, 0)
}

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
  if (debit > 0) return { debit, credit: 0 }
  return { debit: 0, credit: 0 }
}

export function isEcobankAmountLine(line: string): boolean {
  const s = line.trim()
  return AMOUNT_WITH_REF.test(s) || AMOUNT_NO_REF.test(s)
}

export function parseEcobankAmountLine(line: string): {
  reference: string
  valueDate: string
  amounts: number[]
} | null {
  const s = line.trim()
  const withRef = s.match(AMOUNT_WITH_REF)
  if (withRef) {
    const amounts = [...withRef[0].matchAll(GHS)].map((m) => parseImportedAmount(m[0]))
    return { reference: withRef[1]!, valueDate: withRef[2]!, amounts }
  }
  const noRef = s.match(AMOUNT_NO_REF)
  if (noRef) {
    const amounts = [...noRef[0].matchAll(GHS)].map((m) => parseImportedAmount(m[0]))
    return { reference: '', valueDate: noRef[1]!, amounts }
  }
  return null
}

function isEcobankNoiseLine(line: string): boolean {
  return (
    /^Transaction\s+Date/i.test(line) ||
    /^\d+\s*$/.test(line) ||
    (/^\d{2}\s+[A-Za-z]{3}\s+\d{4}/.test(line) && line.length < 30) ||
    /^please examine this statement/i.test(line) ||
    /^name:|^address:|^account summary/i.test(line) ||
    /^account number|^account type|^currency|^branch|^customer|^statement from/i.test(line) ||
    /^total debit|^total credit|^opening balance|^closing balance/i.test(line) ||
    /^null$/i.test(line) ||
    /^ghana$/i.test(line) ||
    /^achimota/i.test(line) ||
    /^p o box/i.test(line)
  )
}

/** Join amount tails split across PDF line breaks (ref+date line ending with "-"). */
function mergeEcobankSplitAmountLines(lines: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const compact = lines[i]!.replace(/\s+/g, '')
    if (/[A-Z0-9]{8,}\d{2}-[A-Za-z]{3}-\d{4}-$/.test(compact)) {
      let merged = compact
      let j = i + 1
      while (j < lines.length && /^GHS[\d,]+\.\d{1,2}$/i.test(lines[j]!.trim().replace(/\s+/g, ''))) {
        merged += lines[j]!.trim().replace(/\s+/g, '')
        j++
      }
      if (j > i + 1) {
        out.push(merged.replace(/(\d{2}-[A-Za-z]{3}-\d{4})-$/, '$1'))
        i = j - 1
        continue
      }
    }
    out.push(lines[i]!)
  }
  return out
}

/** Drop page-break duplicates that repeat the same amount and balance on the same date. */
function dedupeEcobankPdfRows(rows: unknown[][]): unknown[][] {
  const seen = new Set<string>()
  const out: unknown[][] = []
  for (const row of rows) {
    const key = [row[0], row[4] ?? '', row[5] ?? '', row[6]].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
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
  const pending: Array<{
    txDate: string
    desc: string
    ref: string
    valueDate: string
    amounts: number[]
  }> = []
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const openingBalance = extractOpeningBalance(text)

  let block: string[] = []
  let carry: string[] = []
  const flush = () => {
    if (block.length === 0) return
    const normalized = mergeEcobankSplitAmountLines(block.map((l) => l.trim()).filter(Boolean))
    const head = normalized[0]
    const headMatch = head?.match(/^(\d{2}-[A-Za-z]{3}-\d{4})\s*([\s\S]*)$/)
    if (!headMatch) {
      block = []
      return
    }

    let amountIdx = -1
    for (let i = normalized.length - 1; i >= 0; i--) {
      if (isEcobankAmountLine(normalized[i]!)) {
        amountIdx = i
        break
      }
    }
    if (amountIdx < 0) {
      block = []
      return
    }

    const parsedAmt = parseEcobankAmountLine(normalized[amountIdx]!)
    if (!parsedAmt || parsedAmt.amounts.length < 2) {
      block = []
      return
    }

    const descParts: string[] = []
    if (headMatch[2]?.trim()) descParts.push(headMatch[2].trim())
    for (let i = 1; i < normalized.length; i++) {
      if (i === amountIdx) continue
      descParts.push(normalized[i]!)
    }
    const desc = descParts.join(' ').replace(/\s+/g, ' ').trim()

    pending.push({
      txDate: headMatch[1]!,
      desc,
      ref: parsedAmt.reference,
      valueDate: parsedAmt.valueDate,
      amounts: parsedAmt.amounts,
    })
    block = []
  }

  for (const line of lines) {
    if (isEcobankNoiseLine(line)) continue
    if (TX_START.test(line)) {
      flush()
      if (carry.length > 0 && pending.length > 0) {
        const last = pending[pending.length - 1]!
        last.desc = [last.desc, ...carry].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
        carry = []
      }
      block = [line]
    } else if (block.length > 0) {
      block.push(line)
    } else {
      carry.push(line)
    }
  }
  flush()
  if (carry.length > 0 && pending.length > 0) {
    const last = pending[pending.length - 1]!
    last.desc = [last.desc, ...carry].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  }

  const rows: unknown[][] = []
  for (let i = 0; i < pending.length; i++) {
    const item = pending[i]!
    let debit = 0
    let credit = 0
    let balance = 0
    if (item.amounts.length >= 3) {
      balance = item.amounts[item.amounts.length - 1]!
      const classified = classifyEcobankAmount(
        item.desc,
        item.amounts[item.amounts.length - 3]!,
        item.amounts[item.amounts.length - 2]!
      )
      debit = classified.debit
      credit = classified.credit
    } else if (item.amounts.length >= 2) {
      const txnAmt = item.amounts[item.amounts.length - 2]!
      balance = item.amounts[item.amounts.length - 1]!
      const previousBalance =
        i < pending.length - 1 ? pending[i + 1]!.amounts.at(-1)! : openingBalance
      const classified = classifyEcobankByBalance(txnAmt, balance, previousBalance, item.desc)
      debit = classified.debit
      credit = classified.credit
    }
    if (debit === 0 && credit === 0) continue
    rows.push([
      item.txDate,
      item.desc,
      item.ref,
      item.valueDate,
      debit > 0 ? debit : null,
      credit > 0 ? credit : null,
      balance,
    ])
  }

  return { headers, rows: dedupeEcobankPdfRows(rows) }
}

