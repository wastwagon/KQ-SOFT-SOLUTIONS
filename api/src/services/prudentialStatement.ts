/**
 * Prudential Bank Ghana current account statement PDF.
 * Native text uses multi-line blocks:
 *   Description → Trans Date → Value Date → Amount+Balance → Reference/narrative
 * Example amount line: 50,000,000.0049,999,735.00 or 3,412,351.223,411,866.22DR
 */

import { parseImportedAmount } from './amountParser.js'
import type { ParseResult } from './parser.js'

const PRU_DATE = /^\d{2}-[A-Z]{3}-\d{2}$/i

export function looksLikePrudentialStatementText(text: string): boolean {
  const flat = text.replace(/\s+/g, ' ')
  if (
    /transaction\s*details\s*ref\.?\s*no\.?\s*value\s*date\s*debit\s*credit\s*balance\s*trans\.?\s*date/i.test(
      flat
    )
  ) {
    return true
  }
  if (/prudential\s+bank/i.test(flat) && /current\s+account\s+statement/i.test(flat)) {
    return true
  }
  if (/ring\s+road\s+central\s+branch/i.test(flat) && PRU_DATE.test(flat)) {
    return true
  }
  return false
}

export function shouldUsePrudentialPdfParser(result: { headers: string[]; rows: unknown[][] }): boolean {
  const h = result.headers.map((x) => (x || '').toLowerCase()).join(' ')
  if (/\bdebit\b/.test(h) && /\bcredit\b/.test(h) && result.rows.length < 80) return false
  return (
    /opening.*balance|balancesclosing/i.test(h) ||
    (result.headers.length < 5 && result.rows.length > 80)
  )
}

function isNoiseLine(line: string): boolean {
  return (
    /^transaction\s*details/i.test(line) ||
    /^period:/i.test(line) ||
    /^page\s+\d+\s+of\s+\d+/i.test(line) ||
    /^ghana\s+cocoa\s+board/i.test(line) ||
    /^the\s+chief\s+executive/i.test(line) ||
    /^p\.?o\.?\s*box/i.test(line) ||
    /^accra$/i.test(line) ||
    /^copy\s+as\s+of/i.test(line) ||
    /^account\s+no/i.test(line) ||
    /^009190018\d+/i.test(line) ||
    /^ring\s+road/i.test(line) ||
    /^current\s+account\s+statement/i.test(line) ||
    /^opening\s+balances/i.test(line) ||
    /^balance\s+brought\s+fwd/i.test(line) ||
    /^opening\s+bal\./i.test(line) ||
    /^\d{2}-[A-Z]{3}-\d{2}[\d,]+\.\d{2}DR$/i.test(line) ||
    /^closing\s+balances/i.test(line) ||
    /^current\s+bal/i.test(line) ||
    /^avail\.\s*bal/i.test(line) ||
    /^total\s+(credits?|debits?)/i.test(line) ||
    /^0\.00(?:amt|uncoll)/i.test(line) ||
    /^customers\s+are\s+advised/i.test(line) ||
    /^ghs$/i.test(line) ||
    /^per\s+statement/i.test(line) ||
    /^dr\d/i.test(line) ||
    /^\d+,\d{3},\d{3},\d{2}\.\d{2}$/.test(line)
  )
}

function formatPruDate(value: string): string {
  const m = value.trim().match(/^(\d{2})-([A-Z]{3})-(\d{2})$/i)
  if (!m) return value.trim()
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }
  const mm = months[m[2]!.toLowerCase()] ?? '01'
  const yy = Number(m[3]!) < 50 ? `20${m[3]}` : `19${m[3]}`
  return `${m[1]}/${mm}/${yy}`
}

/** Peel txn amount and balance from glued amount line. */
export function parsePruAmountLine(line: string): { amount: number; balance: number } | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 90) return null
  const isDr = /DR$/i.test(trimmed)
  const core = trimmed.replace(/DR$/i, '').trim()
  const amounts = core.match(/[\d,]+\.\d{2}/g)
  if (!amounts || amounts.length < 2) return null
  const balance = parseImportedAmount(amounts[amounts.length - 1]!)
  const amount = parseImportedAmount(amounts[amounts.length - 2]!)
  if (amount <= 0 && balance === 0) return null
  return { amount, balance: isDr ? -Math.abs(balance) : balance }
}

function isPruDateLine(line: string): boolean {
  return PRU_DATE.test(line.trim())
}

/** Value date lines often prefix ref digits: 19034915-SEP-23 → 15-SEP-23 */
export function extractPruDateFromLine(line: string): string | null {
  const trimmed = line.trim()
  if (isPruDateLine(trimmed)) return trimmed
  const m = trimmed.match(/(\d{2}-[A-Z]{3}-\d{2})\s*$/i)
  return m?.[1] ?? null
}

function pickPruDateLine(line: string): string | null {
  return extractPruDateFromLine(line)
}

function isDescriptionLine(line: string): boolean {
  const s = line.trim()
  if (!s || s.length < 3) return false
  if (isNoiseLine(s)) return false
  if (isPruDateLine(s)) return false
  if (extractPruDateFromLine(s)) return false
  if (parsePruAmountLine(s)) return false
  if (/^:\s/.test(s)) return false
  if (/^\/[\w]/.test(s)) return false
  if (/^\d{2}-[A-Z]{3}-\d{2}[\d,.]/i.test(s)) return false
  if (/^\d{6,}/.test(s) && s.includes('-SEP-')) return false
  return /[A-Za-z]/.test(s)
}

function extractOpeningBalance(text: string): number {
  const glued = text.match(/01-SEP-23\s*([\d,]+\.\d{2})\s*DR/i)
  if (glued) return -parseImportedAmount(glued[1])
  const brought = text.match(/BALANCE BROUGHT FWD[\s\S]{0,40}?([\d,]+\.\d{2})\s*DR/i)
  if (brought) return -parseImportedAmount(brought[1])
  const plain = text.match(/opening\s+bal[^\d]*([\d,]+\.\d{2})/i)
  return plain ? parseImportedAmount(plain[1]) : 0
}

function classifyPruAmount(
  description: string,
  amount: number,
  balance: number,
  previousBalance: number
): { debit: number; credit: number; nextBalance: number } {
  const delta = Math.round((balance - previousBalance) * 100) / 100
  const amt = Math.round(amount * 100) / 100
  const head = description.trim()

  if (/inward|principal\s+payment|\binterest\b/i.test(head)) {
    return { debit: 0, credit: amt, nextBalance: balance }
  }
  if (/call\s+transactions\s*-\s*dr|nrt\s+ach\s+out|exp\s*:/i.test(head)) {
    return { debit: amt, credit: 0, nextBalance: balance }
  }

  if (Math.abs(delta - amt) < 0.02) {
    return { debit: 0, credit: amt, nextBalance: balance }
  }
  if (Math.abs(delta + amt) < 0.02) {
    return { debit: amt, credit: 0, nextBalance: balance }
  }

  const creditHints =
    /\b(cr|credit|incoming|inward|principal\s+payment|interest|deposit|received|repo)\b/i
  const debitHints =
    /\b(dr|debit|withdrawal|outgoing|commission|comm|charges?|swift\s+charges?|transfer)\b/i

  if (creditHints.test(description) && !debitHints.test(description)) {
    return { debit: 0, credit: amt, nextBalance: balance }
  }
  if (debitHints.test(description) && !creditHints.test(description)) {
    return { debit: amt, credit: 0, nextBalance: balance }
  }

  if (delta > 0.01) return { debit: 0, credit: amt, nextBalance: balance }
  return { debit: amt, credit: 0, nextBalance: balance }
}

function transactionSectionLines(text: string): string[] {
  const marker = text.search(/BALANCE BROUGHT FWD|PRINCIPAL PAYMENT|CALL TRANSACTIONS/i)
  const section = marker >= 0 ? text.slice(marker) : text
  return section
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !isNoiseLine(l))
}

type PendingBlock = {
  description: string
  transDate: string
  valueDate: string
  amountLine: string
  extra: string[]
}

/** Parse Prudential Bank Ghana PDF text into a standard transaction table. */
export function parsePrudentialPdfText(text: string): ParseResult {
  const headers = [
    'Transaction Date',
    'Description',
    'Reference',
    'Value Date',
    'Debit',
    'Credit',
    'Balance',
  ]
  const rows: unknown[][] = []
  const lines = transactionSectionLines(text)
  let previousBalance = extractOpeningBalance(text)

  let pending: PendingBlock | null = null

  const flush = () => {
    if (!pending) return
    const parsed = parsePruAmountLine(pending.amountLine)
    if (!parsed) {
      pending = null
      return
    }

    const extra = pending.extra.join(' ').replace(/\s+/g, ' ').trim()
    const refMatch = extra.match(/(\/[\w]+)/)
    const reference = refMatch?.[1] ?? ''
    const description = [pending.description, extra.replace(/\/[\w]+/g, '').trim()]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240)

    if (!description || /^\/[\w]/.test(description)) {
      pending = null
      return
    }

    const { debit, credit, nextBalance } = classifyPruAmount(
      pending.description,
      parsed.amount,
      parsed.balance,
      previousBalance
    )

    if (
      parsed.amount <= 10 &&
      Math.abs(parsed.balance) > 50_000 &&
      /commission|\bcomm\b/i.test(`${pending.description} ${description}`)
    ) {
      pending = null
      return
    }

    // Skip glued commission noise (e.g. 4.508,487,580.18DR) when balance delta does not match tiny amount
    if (
      parsed.amount > 0 &&
      parsed.amount <= 10 &&
      Math.abs(Math.abs(parsed.balance) - Math.abs(previousBalance)) > 1000 &&
      Math.abs(parsed.amount - Math.abs(Math.abs(parsed.balance) - Math.abs(previousBalance))) > 1000
    ) {
      pending = null
      return
    }

    previousBalance = nextBalance

    if (debit === 0 && credit === 0) {
      pending = null
      return
    }

    rows.push([
      formatPruDate(pending.transDate),
      description,
      reference || null,
      formatPruDate(pending.valueDate),
      debit > 0 ? debit : null,
      credit > 0 ? credit : null,
      parsed.balance,
    ])
    pending = null
  }

  for (const line of lines) {
    if (isDescriptionLine(line) && !pending) {
      pending = {
        description: line,
        transDate: '',
        valueDate: '',
        amountLine: '',
        extra: [],
      }
      continue
    }

    if (!pending) continue

    // Multi-line bank descriptions (NRT ACH OUT … then LTD:…) before dates
    if (!pending.transDate && !pending.amountLine) {
      if (isDescriptionLine(line)) {
        pending = {
          description: line,
          transDate: '',
          valueDate: '',
          amountLine: '',
          extra: [],
        }
        continue
      }
      if (!pickPruDateLine(line) && !parsePruAmountLine(line)) {
        pending.extra.push(line)
        continue
      }
    }

    if (!pending.transDate) {
      const d = pickPruDateLine(line)
      if (d) {
        pending.transDate = d
        continue
      }
    }

    if (pending.transDate && !pending.valueDate) {
      const d = pickPruDateLine(line)
      if (d) {
        pending.valueDate = d
        continue
      }
      const amt = parsePruAmountLine(line)
      if (amt) {
        pending.valueDate = pending.transDate
        pending.amountLine = line
        continue
      }
    }

    if (pending.transDate && pending.valueDate && !pending.amountLine) {
      const amt = parsePruAmountLine(line)
      if (amt) {
        pending.amountLine = line
        continue
      }
    }

    if (pending.amountLine) {
      if (isDescriptionLine(line)) {
        flush()
        pending = {
          description: line,
          transDate: '',
          valueDate: '',
          amountLine: '',
          extra: [],
        }
        continue
      }
      pending.extra.push(line)
      continue
    }

    if (pending.transDate && pending.valueDate && !pending.amountLine && isDescriptionLine(line)) {
      flush()
      pending = {
        description: line,
        transDate: '',
        valueDate: '',
        amountLine: '',
        extra: [],
      }
    }
  }
  flush()

  return { headers, rows }
}
