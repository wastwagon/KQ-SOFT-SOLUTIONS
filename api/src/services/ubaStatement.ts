/**
 * UBA Ghana account statement PDF.
 * Native text uses multi-line blocks:
 *   Trans+Value dates → Narration → Amount+Balance (glued)
 * Example: 01-Sep-2023 01-Sep-2023 / narration / 77,298,438.0977,321,885.34
 */

import { parseImportedAmount } from './amountParser.js'
import type { ParseResult } from './parser.js'

const UBA_DATE_PAIR = /^(\d{2}-[A-Za-z]{3}-\d{4})\s+(\d{2}-[A-Za-z]{3}-\d{4})(.*)$/

export function looksLikeUbaStatementText(text: string): boolean {
  const flat = text.replace(/\s+/g, ' ')
  if (
    /trans\s*date\s*value\s*date\s*narration/i.test(flat) &&
    /debit\s*credit\s*balance/i.test(flat)
  ) {
    return true
  }
  if (
    (/\buba\b|united bank for africa|africa'?s global bank/i.test(flat) &&
      /account\s+statement/i.test(flat) &&
      UBA_DATE_PAIR.test(flat))
  ) {
    return true
  }
  return false
}

export function shouldUseUbaPdfParser(result: { headers: string[]; rows: unknown[][] }): boolean {
  const h = result.headers.map((x) => (x || '').toLowerCase()).join(' ')
  if (/\bdebit\b/.test(h) && /\bcredit\b/.test(h) && result.rows.length < 30) return false
  return result.headers.length < 3 || /hello\s+ghana|opening\s+balance/i.test(h)
}

function isNoiseLine(line: string): boolean {
  return (
    /^hello\s+/i.test(line) ||
    /^p\.?o\.?\s*box/i.test(line) ||
    /^ghana\s+cocoa\s+board$/i.test(line) ||
    /^account\s+statement/i.test(line) ||
    /^africa'?s\s+global\s+bank/i.test(line) ||
    /^account\s+(no|type):/i.test(line) ||
    /^001\d+x+701503/i.test(line) ||
    /^currency:/i.test(line) ||
    /^current$/i.test(line) ||
    /^ghs$/i.test(line) ||
    /^opening\s+balance:/i.test(line) ||
    /^total\s+(debit|credit):/i.test(line) ||
    /^closing\s+balance:/i.test(line) ||
    /^trans$/i.test(line) ||
    /^date$/i.test(line) ||
    /^value$/i.test(line) ||
    /^narration$/i.test(line) ||
    /^chq\.?$/i.test(line) ||
    /^no$/i.test(line) ||
    /^debit\s*credit\s*balance$/i.test(line) ||
    /^opening\s+balance[\d,.]/i.test(line)
  )
}

export function formatUbaDate(value: string): string {
  const m = value.trim().match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/)
  if (!m) return value.trim()
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }
  const mm = months[m[2]!.toLowerCase()] ?? '01'
  return `${m[1]}/${mm}/${m[3]}`
}

/** Parse glued amount+balance tail, including negative balances. */
export function parseUbaAmountLine(line: string): { txn: number; balance: number } | null {
  const s = line.trim()
  if (!s || s.length > 60) return null

  const negBal = s.match(/^([\d,]+\.\d{2})-([\d,]+\.\d{2})$/)
  if (negBal) {
    return {
      txn: parseImportedAmount(negBal[1]),
      balance: -parseImportedAmount(negBal[2]),
    }
  }

  const twoPos = s.match(/^([\d,]+\.\d{2})([\d,]+\.\d{2})$/)
  if (twoPos) {
    return {
      txn: parseImportedAmount(twoPos[1]),
      balance: parseImportedAmount(twoPos[2]),
    }
  }

  return null
}

function isUbaDatePairLine(line: string): RegExpMatchArray | null {
  const m = line.match(UBA_DATE_PAIR)
  if (!m) return null
  const tail = (m[3] ?? '').trim()
  if (/^opening\s+balance/i.test(tail)) return null
  return m
}

function extractOpeningBalance(text: string): number {
  const m = text.match(/Opening\s+Balance:\s*([\d,]+\.\d{2})/i)
  return m ? parseImportedAmount(m[1]) : 0
}

function classifyUbaAmount(
  description: string,
  txn: number,
  balance: number,
  previousBalance: number
): { debit: number; credit: number; nextBalance: number } {
  const delta = Math.round((balance - previousBalance) * 100) / 100
  const amt = Math.round(txn * 100) / 100

  if (Math.abs(delta - amt) < 0.02) {
    return { debit: 0, credit: amt, nextBalance: balance }
  }
  if (Math.abs(delta + amt) < 0.02) {
    return { debit: amt, credit: 0, nextBalance: balance }
  }

  const creditHints =
    /\b(credit|closure|proceeds|interest|int\.?\s*pd|sweep\s+trf\s+from|deposit|received|incoming)\b/i
  const debitHints =
    /\b(debit|charge|cot|sweep|transfer|opening\s+tda|amckus|assembly|maintenance)\b/i

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
  const marker = text.search(/DEBIT\s*CREDIT\s*BALANCE|01-[A-Za-z]{3}-\d{4}\s+01-[A-Za-z]{3}-\d{4}/i)
  const section = marker >= 0 ? text.slice(marker) : text
  return section
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !isNoiseLine(l))
}

/** Parse UBA Ghana PDF text into a standard transaction table. */
export function parseUbaPdfText(text: string): ParseResult {
  const headers = [
    'Transaction Date',
    'Description',
    'Cheque No',
    'Value Date',
    'Debit',
    'Credit',
    'Balance',
  ]
  const rows: unknown[][] = []
  const lines = transactionSectionLines(text)
  let previousBalance = extractOpeningBalance(text)

  let block: string[] = []
  let transDate = ''
  let valueDate = ''

  const flush = () => {
    if (!transDate || block.length === 0) {
      block = []
      return
    }

    const amountLine = block.find((l) => parseUbaAmountLine(l)) ?? ''
    const parsed = parseUbaAmountLine(amountLine)
    if (!parsed) {
      block = []
      transDate = ''
      valueDate = ''
      return
    }

    const narration = block
      .filter((l) => l !== amountLine)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    const chqMatch = narration.match(/\b(\d{6})\b/)
    const { debit, credit, nextBalance } = classifyUbaAmount(
      narration,
      parsed.txn,
      parsed.balance,
      previousBalance
    )
    previousBalance = nextBalance

    if (debit === 0 && credit === 0) {
      block = []
      transDate = ''
      valueDate = ''
      return
    }

    rows.push([
      formatUbaDate(transDate),
      narration,
      chqMatch?.[1] ?? null,
      formatUbaDate(valueDate),
      debit > 0 ? debit : null,
      credit > 0 ? credit : null,
      parsed.balance,
    ])

    block = []
    transDate = ''
    valueDate = ''
  }

  for (const line of lines) {
    const datePair = isUbaDatePairLine(line)
    if (datePair) {
      flush()
      transDate = datePair[1]!
      valueDate = datePair[2]!
      const tail = (datePair[3] ?? '').trim()
      block = tail ? [tail] : []
      continue
    }

    if (transDate) block.push(line)
  }
  flush()

  return { headers, rows }
}
