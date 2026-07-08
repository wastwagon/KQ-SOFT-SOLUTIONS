/**
 * GCB Bank Ghana corporate/current account statement PDF layout.
 * Columns are concatenated in native PDF text (DateDescriptionRef / Chq No.Value Date DebitCreditBalance).
 */

import { parseImportedAmount } from './amountParser.js'
import type { ParseResult } from './parser.js'

const GCB_DATE = /\d{2}-[A-Za-z]{3}-\d{4}/

/** Native GCB PDF text (FOP-style export with merged column headers). */
export function looksLikeGcbStatementText(text: string): boolean {
  const flat = text.replace(/\s+/g, ' ')
  if (/DateDescriptionRef\s*\/\s*Chq\s*No\.?Value\s*Date\s*DebitCreditBalance/i.test(flat)) {
    return true
  }
  if (
    /ghana\s+commercial\s+bank|\bgcb\s+bank\b/i.test(flat) &&
    /Statement\s+Period/i.test(flat) &&
    GCB_DATE.test(flat) &&
    (/DebitCreditBalance/i.test(flat) || /Opening\s+Balance/i.test(flat))
  ) {
    return true
  }
  return false
}

/** True when generic line-split PDF parse should be replaced by GCB block parser. */
export function shouldUseGcbPdfParser(result: { headers: string[]; rows: unknown[][] }): boolean {
  const h = result.headers.map((x) => (x || '').toLowerCase()).join(' ')
  if (/\bdebit\b/.test(h) && /\bcredit\b/.test(h) && result.rows.length < 200) return false
  return (
    result.headers.length < 5 ||
    /opening/.test(h) ||
    result.rows.length > 200 ||
    (result.rows.length > 0 && (result.rows[0] as unknown[])?.length <= 2)
  )
}

const PERIOD_LINE = /^\d{2}-[A-Za-z]{3}-\d{4}\s+-\s+\d{2}-[A-Za-z]{3}-\d{4}$/

/** New transaction block: date-only line, or date immediately followed by narrative text. */
function isNewGcbBlockStart(line: string): boolean {
  if (PERIOD_LINE.test(line)) return false
  if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(line)) return true
  if (/^\d{2}-[A-Za-z]{3}-\d{4}[A-Za-z]/.test(line)) return true
  return false
}

function stripPageFooters(text: string): string {
  return text
    .replace(/Page\s*\r?\n\s*\d+\s*\r?\n\s*of\s*\r?\n\s*\d+/gi, '\n')
    .replace(/Page\s+\d+\s+of\s+\d+/gi, '\n')
    .replace(/\s+\d+\s+of\s+\d+\s*/g, ' ')
}

const TAIL_WITH_REF =
  /(\d[A-Z0-9]{5,})(\d{2}-[A-Za-z]{3}-\d{4})(-?[\d,]+\.\d{2})(-?[\d,]+\.\d{2})$/i
const TAIL_NO_REF = /(\d{2}-[A-Za-z]{3}-\d{4})(-?[\d,]+\.\d{2})(-?[\d,]+\.\d{2})$/i
const TAIL_ONE_AMOUNT = /(\d{2}-[A-Za-z]{3}-\d{4})(-?[\d,]+\.\d{2})$/i

function parseGcbTail(rest: string): {
  description: string
  reference: string
  valueDate: string
  txnAmount: number
  balance: number | null
} | null {
  const s = rest.replace(/\s+\d+\s+of\s+\d+\s*/gi, ' ').trim()
  if (!s) return null

  let m = s.match(TAIL_WITH_REF)
  if (m) {
    const before = s.slice(0, m.index).trim()
    return {
      description: before,
      reference: m[1]!,
      valueDate: m[2]!,
      txnAmount: parseImportedAmount(m[3]),
      balance: parseImportedAmount(m[4]),
    }
  }

  m = s.match(TAIL_NO_REF)
  if (m) {
    const before = s.slice(0, m.index).trim()
    return {
      description: before,
      reference: '',
      valueDate: m[1]!,
      txnAmount: parseImportedAmount(m[2]),
      balance: parseImportedAmount(m[3]),
    }
  }

  m = s.match(TAIL_ONE_AMOUNT)
  if (m) {
    const before = s.slice(0, m.index).trim()
    const refMatch = before.match(/(\d[A-Z0-9]{5,})$/i)
    const reference = refMatch?.[1] ?? ''
    const description = refMatch ? before.slice(0, refMatch.index).trim() : before
    return {
      description,
      reference,
      valueDate: m[1]!,
      txnAmount: parseImportedAmount(m[2]),
      balance: null,
    }
  }

  return null
}

function classifyGcbAmount(
  description: string,
  txnAmount: number,
  balance: number | null,
  previousBalance: number
): { debit: number; credit: number; nextBalance: number } {
  if (balance == null) {
    return { debit: txnAmount, credit: 0, nextBalance: previousBalance - txnAmount }
  }

  const delta = Math.round((balance - previousBalance) * 100) / 100
  const amt = Math.round(txnAmount * 100) / 100

  if (Math.abs(delta - amt) < 0.02) {
    return { debit: 0, credit: amt, nextBalance: balance }
  }
  if (Math.abs(delta + amt) < 0.02) {
    return { debit: amt, credit: 0, nextBalance: balance }
  }

  const creditHints =
    /\b(deposit|chq\s*-|inward|credit|lodg|received|trfd\s+from|reversal|zexa)\b/i
  const debitHints =
    /\b(withdrawal|chg|charge|procu|sweep|trfr|ach\s*:|payment|debit|indi|inwc|paid)\b/i

  if (creditHints.test(description) && !debitHints.test(description)) {
    return { debit: 0, credit: amt, nextBalance: balance }
  }
  if (debitHints.test(description) && !creditHints.test(description)) {
    return { debit: amt, credit: 0, nextBalance: balance }
  }

  if (delta > 0.01) return { debit: 0, credit: amt, nextBalance: balance }
  return { debit: amt, credit: 0, nextBalance: balance }
}

function extractOpeningBalance(text: string): number {
  const m = text.match(/Opening\s+Balance\s*(-?[\d,]+\.\d{2})/i)
  return m ? parseImportedAmount(m[1]) : 0
}

function extractChqNo(blob: string): string | null {
  const m = blob.match(/\/Chq_No\s*-\s*(\d{3,10})/i)
  return m?.[1] ?? null
}

function cleanDescription(raw: string): string {
  return raw
    .replace(/\/Chq_No\s*-\s*\d+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function transactionSectionLines(text: string): string[] {
  const marker = text.search(/DateDescriptionRef\s*\/\s*Chq\s*No/i)
  const section = stripPageFooters(marker >= 0 ? text.slice(marker) : text)
  return section
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false
      if (/^DateDescription/i.test(l)) return false
      if (/^Page\s*$/i.test(l)) return false
      if (/^\d+\s+of\s*$/i.test(l)) return false
      if (/^\d+\s+of\s+\d+$/i.test(l)) return false
      if (/^of\s*$/i.test(l)) return false
      if (/^=+$/.test(l)) return false
      if (/^\d{1,3}$/.test(l)) return false
      if (/^No\.\s+of\s+(?:DEBITS|CREDITS)/i.test(l)) return false
      if (/^Please\s+review\s+your\s+statement/i.test(l)) return false
      if (/^Visit\s+the\s+nearest\s+branch/i.test(l)) return false
      if (/^Give\s+our\s+customer\s+service/i.test(l)) return false
      if (/^GCB,Your\s+Bank/i.test(l)) return false
      if (/^\*{2,}\s*End\s+Of\s+Statement/i.test(l)) return false
      if (/^otherwise\s+the\s+entries/i.test(l)) return false
      return true
    })
}

/** Parse GCB corporate/current account PDF text into a standard transaction table. */
export function parseGcbPdfText(text: string): ParseResult {
  const headers = [
    'Transaction Date',
    'Description',
    'Reference Number',
    'Value Date',
    'Debit',
    'Credit',
    'Balance',
    'Chq No',
  ]
  const rows: unknown[][] = []
  const lines = transactionSectionLines(text)
  let previousBalance = extractOpeningBalance(text)

  let block: string[] = []
  const flush = () => {
    if (block.length === 0) return
    const blob = stripPageFooters(block.join(' ').replace(/\s+/g, ' ').trim())
    const start = blob.match(/^(\d{2}-[A-Za-z]{3}-\d{4})(.*)$/i)
    if (!start) {
      block = []
      return
    }

    const txDate = start[1]!
    const tail = parseGcbTail(start[2] ?? '')
    if (!tail) {
      block = []
      return
    }

    const description = cleanDescription(tail.description)
    const chqNo = extractChqNo(blob)
    const { debit, credit, nextBalance } = classifyGcbAmount(
      description,
      tail.txnAmount,
      tail.balance,
      previousBalance
    )
    previousBalance = nextBalance

    if (debit === 0 && credit === 0) {
      block = []
      return
    }

    rows.push([
      txDate,
      description,
      tail.reference || null,
      tail.valueDate,
      debit > 0 ? debit : null,
      credit > 0 ? credit : null,
      tail.balance,
      chqNo,
    ])
    block = []
  }

  for (const line of lines) {
    if (isNewGcbBlockStart(line)) {
      flush()
      block = [line]
    } else if (block.length > 0) {
      block.push(line)
    }
  }
  flush()

  return { headers, rows }
}
