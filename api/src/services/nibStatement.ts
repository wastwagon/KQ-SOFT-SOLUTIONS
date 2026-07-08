/**
 * National Investment Bank (NIB) Ghana account statement PDF.
 * Native text merges columns and uses multi-line blocks:
 *   BookingDate+Reference+Description+ValueDate [+Debit]
 *   Amount+Closing Balance (or balance-only line)
 */

import { parseImportedAmount } from './amountParser.js'
import type { ParseResult } from './parser.js'

const NIB_BOOKING = /^(\d{2} [A-Z]{3} \d{2})/
const NIB_HEAD =
  /^(\d{2} [A-Z]{3} \d{2})((?:FT|TT)\d{5,6}[A-Z0-9]+?)(?=[A-Z][a-z]|[^A-Z0-9]|$)(.*)$/
const NIB_VALUE_DATE_AMOUNT = /(\d{2} [A-Z]{3} \d{2})([\d,]+\.\d{2})$/

export function looksLikeNibStatementText(text: string): boolean {
  const flat = text.replace(/\s+/g, ' ')
  if (
    /booking\s*date\s*reference\s*description\s*value\s*date\s*debit\s*credit\s*closing\s*balance/i.test(
      flat
    )
  ) {
    return true
  }
  if (
    /\bnib\b|national investment bank/i.test(flat) &&
    /account\s+statement/i.test(flat) &&
    NIB_BOOKING.test(flat)
  ) {
    return true
  }
  return false
}

export function shouldUseNibPdfParser(result: { headers: string[]; rows: unknown[][] }): boolean {
  const h = result.headers.map((x) => (x || '').toLowerCase()).join(' ')
  if (/\bdebit\b/.test(h) && /\bcredit\b/.test(h) && result.rows.length < 20) return false
  return (
    /booking.*date.*reference|datereferencedescription/i.test(h) ||
    (result.headers.length < 5 && result.rows.length > 10)
  )
}

function isNoiseLine(line: string): boolean {
  return (
    /^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/.test(line) ||
    /^\d{2}:\d{2}:\d{2}$/.test(line) ||
    /^account\s+statement$/i.test(line) ||
    /^branch\s*:/i.test(line) ||
    /^account\s*:/i.test(line) ||
    /^customer\s*:/i.test(line) ||
    /^currency\s*:/i.test(line) ||
    /^page\s+\d+\s+of\s+\d+/i.test(line) ||
    /^balance\s+at\s+period/i.test(line) ||
    /^tart$/i.test(line) ||
    /^nd$/i.test(line) ||
    /^ordering\s+cust/i.test(line) ||
    /^acct\s+maint/i.test(line) ||
    /^ge\s+as\s+at/i.test(line) ||
    /^retrenc$/i.test(line)
  )
}

export function formatNibDate(value: string): string {
  const m = value.trim().match(/^(\d{2})\s+([A-Z]{3})\s+(\d{2})$/i)
  if (!m) return value.trim()
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }
  const mm = months[m[2]!.toLowerCase()] ?? '01'
  const yy = Number(m[3]!) < 50 ? `20${m[3]}` : `19${m[3]}`
  return `${m[1]}/${mm}/${yy}`
}

export function isNibAmountLine(line: string): boolean {
  const s = line.trim()
  return /^[\d,]+\.\d{2}([\d,]+\.\d{2})?$/.test(s)
}

export function parseNibAmountLine(line: string): { txn: number; balance: number } | null {
  const s = line.trim()
  const two = s.match(/^([\d,]+\.\d{2})([\d,]+\.\d{2})$/)
  if (two) {
    return {
      txn: parseImportedAmount(two[1]),
      balance: parseImportedAmount(two[2]),
    }
  }
  const one = s.match(/^([\d,]+\.\d{2})$/)
  if (one) {
    return { txn: 0, balance: parseImportedAmount(one[1]) }
  }
  return null
}

function parseNibHeadLine(line: string): {
  bookingDate: string
  reference: string
  description: string
  valueDate: string
  headAmount: number
} | null {
  const m = line.match(NIB_HEAD)
  if (!m) return null

  let tail = (m[3] ?? '').trim()
  let headAmount = 0
  let valueDate = ''

  const vdAmt = tail.match(NIB_VALUE_DATE_AMOUNT)
  if (vdAmt) {
    valueDate = vdAmt[1]!
    headAmount = parseImportedAmount(vdAmt[2])
    tail = tail.slice(0, -vdAmt[0]!.length).trim()
  } else {
    const amt = tail.match(/([\d,]+\.\d{2})$/)
    if (amt) {
      headAmount = parseImportedAmount(amt[1])
      tail = tail.slice(0, -amt[1]!.length).trim()
    }
    const vd = tail.match(/(\d{2} [A-Z]{3} \d{2})$/)
    if (vd) {
      valueDate = vd[1]!
      tail = tail.slice(0, -vd[1]!.length).trim()
    }
  }

  return {
    bookingDate: m[1]!,
    reference: m[2]!,
    description: tail.replace(/\\/g, '').trim(),
    valueDate: valueDate || m[1]!,
    headAmount,
  }
}

function parseNibBlockAmounts(block: string[]): {
  txn: number
  balance: number
  amountLine: string
  balanceLine: string
} | null {
  let txn = 0
  let balance = 0
  let amountLine = ''
  let balanceLine = ''

  for (const line of block) {
    if (isNibAmountLine(line)) {
      const parsed = parseNibAmountLine(line)
      if (!parsed) continue
      if (parsed.txn > 0 && parsed.balance > 0) {
        return { txn: parsed.txn, balance: parsed.balance, amountLine: line, balanceLine: line }
      }
      if (parsed.txn > 0) {
        txn = parsed.txn
        amountLine = line
      } else if (parsed.balance > 0) {
        balance = parsed.balance
        balanceLine = line
      }
      continue
    }
    const vdAmt = line.match(NIB_VALUE_DATE_AMOUNT)
    if (vdAmt) {
      txn = parseImportedAmount(vdAmt[2])
      amountLine = line
    }
  }

  if (txn > 0 && balance > 0) {
    return { txn, balance, amountLine, balanceLine }
  }
  return null
}

function isNibBlockStart(line: string): boolean {
  return NIB_HEAD.test(line.trim())
}

function extractOpeningBalance(text: string): number {
  const m = text.match(/Balance at Period[\s\S]{0,30}?([\d,]+\.\d{2})/i)
  return m ? parseImportedAmount(m[1]) : 0
}

function classifyNibAmount(
  description: string,
  txn: number,
  balance: number,
  previousBalance: number
): { debit: number; credit: number; nextBalance: number } {
  const delta = Math.round((balance - previousBalance) * 100) / 100
  const amt = Math.round(txn * 100) / 100

  if (amt > 0 && Math.abs(delta - amt) < 0.02) {
    return { debit: 0, credit: amt, nextBalance: balance }
  }
  if (amt > 0 && Math.abs(delta + amt) < 0.02) {
    return { debit: amt, credit: 0, nextBalance: balance }
  }

  const creditHints = /\b(deposit|telex|credit|inward)\b/i
  const debitHints = /\b(withdrawal|cheque|dr|charges?|char)\b/i

  if (creditHints.test(description) && !debitHints.test(description)) {
    return { debit: 0, credit: amt, nextBalance: balance }
  }
  if (debitHints.test(description)) {
    return { debit: amt, credit: 0, nextBalance: balance }
  }

  if (delta > 0.01) return { debit: 0, credit: amt, nextBalance: balance }
  return { debit: amt, credit: 0, nextBalance: balance }
}

function transactionSectionLines(text: string): string[] {
  const marker = text.search(/Booking\s*Date\s*Reference|Balance at Period/i)
  const section = marker >= 0 ? text.slice(marker) : text
  return section
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !isNoiseLine(l))
}

/** Parse NIB Ghana PDF text into a standard transaction table. */
export function parseNibPdfText(text: string): ParseResult {
  const headers = [
    'Booking Date',
    'Reference',
    'Description',
    'Value Date',
    'Debit',
    'Credit',
    'Balance',
  ]
  const rows: unknown[][] = []
  const lines = transactionSectionLines(text)
  let previousBalance = extractOpeningBalance(text)

  let block: string[] = []

  const flush = () => {
    if (block.length === 0) return

    const headLine = block.find((l) => isNibBlockStart(l)) ?? block[0]!
    const head = parseNibHeadLine(headLine)
    if (!head) {
      block = []
      return
    }

    const amountLine = block.find((l) => isNibAmountLine(l)) ?? ''
    const blockAmounts = parseNibBlockAmounts(block)
    const parsedAmt = amountLine ? parseNibAmountLine(amountLine) : null

    let txn = head.headAmount
    let balance = previousBalance

    if (blockAmounts) {
      if (txn === 0) txn = blockAmounts.txn
      balance = blockAmounts.balance
    } else if (parsedAmt) {
      if (txn === 0) txn = parsedAmt.txn
      balance = parsedAmt.balance
    }

    const usedAmountLine = blockAmounts?.amountLine || amountLine
    const usedBalanceLine = blockAmounts?.balanceLine || amountLine

    const extra = block
      .filter((l) => l !== headLine && l !== usedAmountLine && l !== usedBalanceLine)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    const description = [head.description, extra].filter(Boolean).join(' ').trim()
    const { debit, credit, nextBalance } = classifyNibAmount(
      description,
      txn,
      balance,
      previousBalance
    )
    previousBalance = nextBalance

    if (debit === 0 && credit === 0) {
      block = []
      return
    }

    rows.push([
      formatNibDate(head.bookingDate),
      head.reference,
      description,
      formatNibDate(head.valueDate),
      debit > 0 ? debit : null,
      credit > 0 ? credit : null,
      balance,
    ])
    block = []
  }

  for (const line of lines) {
    if (/^[\d,]+\.\d{2}$/.test(line) && block.length === 0) continue
    if (isNibBlockStart(line)) {
      flush()
      block = [line]
    } else if (block.length > 0) {
      block.push(line)
      if (isNibAmountLine(line)) flush()
    }
  }
  flush()

  return { headers, rows }
}
