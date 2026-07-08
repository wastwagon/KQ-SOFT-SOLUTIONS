/**
 * Absa Bank Ghana interim statement PDF layout.
 * Native/OCR text merges columns: DateValue DateDescriptionSerial NoDebitCreditBalance
 * Example: 08/12/2022EBOX170,000,000.00170,000,000.00
 */

import { parseImportedAmount } from './amountParser.js'
import type { ParseResult } from './parser.js'

const ABSA_TX_DATE = /^\d{2}\/\d{2}\/\d{4}/

/** Absa interim/current PDF — merged headers or bank letterhead. */
export function looksLikeAbsaStatementText(text: string): boolean {
  const flat = text.replace(/\s+/g, ' ')
  if (/DateValue\s*DateDescriptionSerial\s*NoDebitCreditBalance/i.test(flat)) {
    return true
  }
  if (
    /absa\s+bank\s+ghana|barclays\s+bank\s+ghana/i.test(flat) &&
    /INTERIM\s+STATEMENT/i.test(flat) &&
    ABSA_TX_DATE.test(flat)
  ) {
    return true
  }
  const gluedTx = text.match(/\d{2}\/\d{2}\/\d{4}[A-Za-z][^\n]*?[\d,]+\.\d{2}/g) ?? []
  if (gluedTx.length >= 3 && /ebox|absa|barclays|investment\s+bank/i.test(flat)) {
    return true
  }
  return false
}

/** True when generic line-split PDF parse should be replaced by Absa block parser. */
export function shouldUseAbsaPdfParser(result: { headers: string[]; rows: unknown[][] }): boolean {
  const h = result.headers.map((x) => (x || '').toLowerCase()).join(' ')
  if (/\bdebit\b/.test(h) && /\bcredit\b/.test(h) && result.rows.length < 40) return false
  return (
    /datevalue|dateserial|serial\s*no/i.test(h) ||
    (result.headers.length < 5 && result.rows.length > 0)
  )
}

function isNoiseLine(line: string): boolean {
  return (
    /^\d{2}\/\d{2}\/\d{4}$/.test(line) ||
    /^DIRECT\s*CREDIT$/i.test(line) ||
    /^048[/-]\d+$/i.test(line) ||
    /^Page\s*:/i.test(line) ||
    /^Disclaimer:/i.test(line) ||
    /^TO READ OUR/i.test(line) ||
    /^PRIVACY-STATEMENT/i.test(line) ||
    /^THE ABSA BANK/i.test(line) ||
    /^DEPOSITORS,/i.test(line) ||
    /^GHANA CEDIS/i.test(line) ||
    /^NON-VISA/i.test(line) ||
    /^DP FIXED/i.test(line) ||
    /^TRSF PER$/i.test(line) ||
    /^DCE\/FA/i.test(line)
  )
}

/** New block: date immediately followed by narrative (letter). Skip date-only OCR artifacts. */
function isNewAbsaBlockStart(line: string): boolean {
  if (/^\d{2}\/\d{2}\/\d{4}[A-Za-z]/.test(line)) return true
  return false
}

const ABSA_AMOUNT = '-?\\d{1,3}(?:,\\d{3})*\\.\\d{2}'
const ABSA_TAIL_TWO = new RegExp(`(${ABSA_AMOUNT})(${ABSA_AMOUNT})$`)
const ABSA_TAIL_ONE = new RegExp(`(${ABSA_AMOUNT})$`)

function parseAbsaFirstLineTail(rest: string): {
  description: string
  serial: string
  txnAmount: number
  balance: number | null
} | null {
  const s = rest.trim()
  if (!s) return null

  let txnRaw: string | undefined
  let balanceRaw: string | undefined
  let before = s

  const two = s.match(ABSA_TAIL_TWO)
  if (two) {
    txnRaw = two[1]
    balanceRaw = two[2]
    before = s.slice(0, two.index).trim()
  } else {
    const one = s.match(ABSA_TAIL_ONE)
    if (!one) return null
    txnRaw = one[1]
    before = s.slice(0, one.index).trim()
  }

  const { description, serial } = splitSerialFromDescription(before)
  if (!description) return null

  return {
    description,
    serial,
    txnAmount: parseImportedAmount(txnRaw!),
    balance: balanceRaw != null ? parseImportedAmount(balanceRaw) : null,
  }
}

function splitSerialFromDescription(raw: string): { description: string; serial: string } {
  const s = raw.trim()
  const m = s.match(/^(.+?)(\d{4,8})$/)
  if (m && m[1]!.trim().length >= 2) {
    return { description: m[1]!.trim(), serial: m[2]! }
  }
  return { description: s, serial: '' }
}

function classifyAbsaAmount(
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

  const creditHints = /\b(ebox|deposit|credit|received|investment\s+bank)\b/i
  const debitHints = /\b(commission|charge|fee|debit)\b/i

  if (creditHints.test(description) && !debitHints.test(description)) {
    return { debit: 0, credit: amt, nextBalance: balance }
  }
  if (debitHints.test(description)) {
    return { debit: amt, credit: 0, nextBalance: balance }
  }

  if (delta > 0.01) return { debit: 0, credit: amt, nextBalance: balance }
  return { debit: amt, credit: 0, nextBalance: balance }
}

function extractOpeningBalance(text: string): number {
  const m = text.match(/Opening\s+Available\s+Balance:\s*(-?[\d,]+\.\d{2})/i)
  if (m) return parseImportedAmount(m[1])
  const split = text.match(
    /Opening\s+Available[\s\S]{0,80}?Balance:\s*\r?\n?\s*(-?[\d,]+\.\d{2})/i
  )
  if (split) return parseImportedAmount(split[1])
  const avail = text.match(/Available\s+Balance:\s*(-?[\d,]+\.\d{2})/i)
  if (avail) return parseImportedAmount(avail[1])
  const m2 = text.match(/Opening\s+Available[^\d]*(-?[\d,]+\.\d{2})/i)
  return m2 ? parseImportedAmount(m2[1]) : 0
}

function transactionSectionLines(text: string): string[] {
  const marker = text.search(/DateValue\s*DateDescriptionSerial|Date\s*Value\s*Date\s*Description/i)
  const section = marker >= 0 ? text.slice(marker) : text
  return section
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false
      if (/^DateValue/i.test(l)) return false
      if (/^Absa Bank/i.test(l)) return false
      if (/^INTERIM STATEMENT/i.test(l)) return false
      if (/^Account Number:/i.test(l)) return false
      if (/^Opening Available/i.test(l)) return false
      if (/^Earmarks:/i.test(l)) return false
      if (/^Total Money/i.test(l)) return false
      if (/^Pricing Plan:/i.test(l)) return false
      if (isNoiseLine(l)) return false
      return true
    })
}

/** Parse Absa interim statement PDF/OCR text into a standard transaction table. */
export function parseAbsaPdfText(text: string): ParseResult {
  const headers = [
    'Transaction Date',
    'Description',
    'Serial No',
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

    const first = block.find((l) => ABSA_TX_DATE.test(l)) ?? block[0]!
    const start = first.match(/^(\d{2}\/\d{2}\/\d{4})(.*)$/)
    if (!start) {
      block = []
      return
    }

    const txDate = start[1]!
    const tail = parseAbsaFirstLineTail(start[2] ?? '')
    if (!tail) {
      block = []
      return
    }

    const extraDesc = block
      .slice(1)
      .filter((l) => !ABSA_TX_DATE.test(l) || l === first)
      .filter((l) => l !== first)
      .filter((l) => !isNoiseLine(l))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    const description = [tail.description, extraDesc].filter(Boolean).join(' ').trim()
    const { debit, credit, nextBalance } = classifyAbsaAmount(
      tail.description,
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
      tail.serial || null,
      null,
      debit > 0 ? debit : null,
      credit > 0 ? credit : null,
      tail.balance,
    ])
    block = []
  }

  for (const line of lines) {
    if (isNewAbsaBlockStart(line)) {
      flush()
      block = [line]
    } else if (block.length > 0) {
      block.push(line)
    }
  }
  flush()

  return { headers, rows }
}
