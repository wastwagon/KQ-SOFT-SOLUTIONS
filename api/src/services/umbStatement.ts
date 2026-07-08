/**
 * Universal Merchant Bank (UMB) Ghana account statement PDF.
 * Layout matches NIB-style booking-date blocks with glued transfer lines.
 */

import { parseImportedAmount } from './amountParser.js'
import type { ParseResult } from './parser.js'

const UMB_BOOKING = /^(\d{2} [A-Z]{3} \d{2})/
const UMB_BOOKING_COMPACT = /^(\d{2}[A-Z]{3}\d{2})/i
const UMB_HEAD_FT =
  /^(\d{2}[A-Z]{3}\d{2})((?:FT|TT)\d{5,}[A-Z0-9\\]+)(.*)$/i
const UMB_HEAD_ACCT = /^(\d{2}[A-Z]{3}\d{2})(\d{10,}[-\w]*)(.*)$/i
const UMB_VALUE_DATE_AMOUNT = /(\d{2}[A-Z]{3}\d{2})([\d,]+\.\d{2})$/i
const UMB_GLUED_TXN =
  /(Transfer\s*(?:Out|Credit)|Commission\s*Paid|Ebundle\s*Charge[^\d]*)(\d{2}[A-Z]{3}\d{2})([\d,]+\.\d{2})$/i

export function looksLikeUmbStatementText(text: string): boolean {
  const flat = text.replace(/\s+/g, ' ')
  if (
    /universal\s+merchant\s+b\s*ank|\bumb\b/i.test(flat) &&
    /booking\s*date/i.test(flat) &&
    /closing\s*balance/i.test(flat)
  ) {
    return true
  }
  if (/1110005147028/.test(flat) && /booking\s*date/i.test(flat) && /\d{2} [A-Z]{3} \d{2}/i.test(flat)) {
    return true
  }
  return false
}

export function shouldUseUmbPdfParser(result: { headers: string[]; rows: unknown[][] }): boolean {
  const h = result.headers.map((x) => (x || '').toLowerCase()).join(' ')
  if (/\bdebit\b/.test(h) && /\bcredit\b/.test(h) && result.rows.length < 8) return false
  return (
    /booking.*date.*reference|datereferencedescription/i.test(h) ||
    (result.headers.length < 5 && result.rows.length > 1)
  )
}

function isNoiseLine(line: string): boolean {
  return (
    /^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/.test(line) ||
    /^\d{2}:\d{2}:\d{2}$/.test(line) ||
    /^account\s*:/i.test(line) ||
    /^account\s+name\s*:/i.test(line) ||
    /^currency\s*:/i.test(line) ||
    /^printed\s+by\s*:/i.test(line) ||
    /^date\s*:/i.test(line) ||
    /^page\s+\d+\s+of\s+\d+/i.test(line) ||
    /^total\s+debit/i.test(line) ||
    /^total\s+credit/i.test(line) ||
    /^available\s+balance/i.test(line) ||
    /^closing\s+balance/i.test(line) ||
    /^uncleared\s+effects/i.test(line) ||
    /^balance\s+at\s+period/i.test(line) ||
    /^:?\s*chq\s+no\s*-/i.test(line) ||
    /^debit\s+cheque/i.test(line) ||
    /^chq\s+\d+/i.test(line) ||
    /^ac-\d+/i.test(line) ||
    /^high\s+value\s+trf/i.test(line)
  )
}

export function formatUmbDate(value: string): string {
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

export function isUmbAmountLine(line: string): boolean {
  const s = line.trim().replace(/\s+/g, '')
  if (/^-?[\d,]+\.\d{2}$/.test(s)) return true
  if (/^[\d,]+\.\d{2}[\d,]+\.\d{2}$/.test(s)) return true
  return UMB_VALUE_DATE_AMOUNT.test(s) || UMB_GLUED_TXN.test(s.replace(/\s+/g, ''))
}

export function parseUmbAmountLine(line: string): { txn: number; balance: number | null } | null {
  const compact = line.trim().replace(/\s+/g, '')
  const gluedTxn = compact.match(UMB_GLUED_TXN)
  if (gluedTxn) {
    return {
      txn: parseImportedAmount(gluedTxn[3]),
      balance: null,
    }
  }
  const vdAmt = compact.match(UMB_VALUE_DATE_AMOUNT)
  if (vdAmt) {
    return { txn: parseImportedAmount(vdAmt[2]), balance: null }
  }
  const two = compact.match(/^([\d,]+\.\d{2})([\d,]+\.\d{2})$/)
  if (two) {
    return {
      txn: parseImportedAmount(two[1]),
      balance: parseImportedAmount(two[2]),
    }
  }
  const one = compact.match(/^(-?[\d,]+\.\d{2})$/)
  if (one) {
    const n = parseImportedAmount(one[1])
    return { txn: 0, balance: n }
  }
  return null
}

function compactUmbLine(line: string): string {
  return line.replace(/\s+/g, '')
}

function spacedUmbDate(compactDate: string): string {
  const m = compactDate.match(/^(\d{2})([A-Z]{3})(\d{2})$/i)
  if (!m) return compactDate
  return `${m[1]} ${m[2]!.toUpperCase()} ${m[3]}`
}

function mergeUmbLines(lines: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!.trim()
    if (!line) continue

    if (
      /^\d{2} [A-Z]{3} \d{2}FT/i.test(line) &&
      !/BNK$/i.test(compactUmbLine(line)) &&
      i + 1 < lines.length &&
      /^[A-Z\\]/i.test(lines[i + 1]!.trim())
    ) {
      line = compactUmbLine(line) + compactUmbLine(lines[i + 1]!)
      i++
    }

    if (
      /^-\d[\d,]*$/.test(line.replace(/\s+/g, '')) &&
      i + 1 < lines.length &&
      /^\d+\.\d{2}$/.test(lines[i + 1]!.trim().replace(/\s+/g, ''))
    ) {
      line = line.replace(/\s+/g, '') + lines[i + 1]!.trim()
      i++
    }

    if (
      /\d$/.test(line.replace(/\s+/g, '')) &&
      i + 1 < lines.length &&
      /^[\d]+-[\w-]+$/.test(lines[i + 1]!.trim().replace(/\s+/g, ''))
    ) {
      line = line.replace(/\s+/g, '') + lines[i + 1]!.trim().replace(/\s+/g, '')
      i++
    }

    out.push(line)
  }
  return out
}

function parseUmbHeadLine(line: string): {
  bookingDate: string
  reference: string
  description: string
  valueDate: string
  headAmount: number
} | null {
  const compact = compactUmbLine(line)
  const ft = compact.match(UMB_HEAD_FT)
  if (ft) {
    return {
      bookingDate: spacedUmbDate(ft[1]!),
      reference: ft[2]!,
      description: (ft[3] ?? '').replace(/\\/g, '').trim(),
      valueDate: spacedUmbDate(ft[1]!),
      headAmount: 0,
    }
  }
  const acct = compact.match(UMB_HEAD_ACCT)
  if (acct) {
    return {
      bookingDate: spacedUmbDate(acct[1]!),
      reference: acct[2]!,
      description: (acct[3] ?? '').replace(/\\/g, '').trim(),
      valueDate: spacedUmbDate(acct[1]!),
      headAmount: 0,
    }
  }
  return null
}

function isUmbBlockStart(line: string): boolean {
  const compact = compactUmbLine(line)
  return UMB_HEAD_FT.test(compact) || UMB_HEAD_ACCT.test(compact)
}

function parseUmbBlockAmounts(block: string[]): {
  txn: number
  balance: number
  valueDate: string
} | null {
  let txn = 0
  let balance = 0
  let valueDate = ''
  let hasBalance = false

  for (const line of block) {
    const compact = line.replace(/\s+/g, '')
    const glued = compact.match(UMB_GLUED_TXN)
    if (glued) {
      txn = parseImportedAmount(glued[3])
      valueDate = spacedUmbDate(glued[2]!)
      continue
    }
    const parsed = parseUmbAmountLine(line)
    if (!parsed) continue
    if (parsed.txn > 0 && parsed.balance != null) {
      return { txn: parsed.txn, balance: parsed.balance, valueDate: valueDate || '' }
    }
    if (parsed.txn > 0) txn = parsed.txn
    if (parsed.balance != null) {
      balance = parsed.balance
      hasBalance = true
    }
    const vdAmt = compact.match(UMB_VALUE_DATE_AMOUNT)
    if (vdAmt) {
      valueDate = spacedUmbDate(vdAmt[1]!)
      txn = parseImportedAmount(vdAmt[2])
    }
  }

  if (txn > 0 && hasBalance) {
    return { txn, balance, valueDate }
  }
  return null
}

function extractOpeningBalance(text: string): number {
  const m = text.match(/Balance at Period[\s\S]{0,40}?([\d,]+\.\d{2})/i)
  return m ? parseImportedAmount(m[1]) : 0
}

function classifyUmbAmount(
  description: string,
  txn: number,
  balance: number,
  previousBalance: number
): { debit: number; credit: number } {
  const amt = Math.round(txn * 100) / 100
  const bal = Math.round(balance * 100) / 100
  const prev = Math.round(previousBalance * 100) / 100
  const delta = Math.round((bal - prev) * 100) / 100

  if (amt > 0 && Math.abs(delta - amt) < 0.02) return { debit: 0, credit: amt }
  if (amt > 0 && Math.abs(delta + amt) < 0.02) return { debit: amt, credit: 0 }

  if (/\btransfer\s*credit\b/i.test(description)) return { debit: 0, credit: amt }
  if (/\b(transfer\s*out|inward\s*cheque|commission|ebundle|charge)\b/i.test(description)) {
    return { debit: amt, credit: 0 }
  }

  if (delta > 0.01) return { debit: 0, credit: amt }
  return { debit: amt, credit: 0 }
}

function transactionSectionLines(text: string): string[] {
  const marker = text.search(/Booking\s*Date\s*Reference|Balance at Period/i)
  let section = marker >= 0 ? text.slice(marker) : text
  const footerIdx = section.search(/Total\s+Debits/i)
  if (footerIdx >= 0) section = section.slice(0, footerIdx)
  return mergeUmbLines(
    section
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !isNoiseLine(l))
  )
}

/** Parse UMB Ghana PDF text into a standard transaction table. */
export function parseUmbPdfText(text: string): ParseResult {
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

    const headLine = block.find((l) => isUmbBlockStart(l)) ?? block[0]!
    const head = parseUmbHeadLine(headLine)
    if (!head) {
      block = []
      return
    }

    const amounts = parseUmbBlockAmounts(block)
    if (!amounts || amounts.txn <= 0) {
      block = []
      return
    }

    const usedLines = new Set<string>()
    for (const line of block) {
      if (isUmbBlockStart(line) || isUmbAmountLine(line)) usedLines.add(line)
      if (UMB_GLUED_TXN.test(line.replace(/\s+/g, ''))) usedLines.add(line)
    }

    const extra = block
      .filter((l) => !usedLines.has(l) && l !== headLine)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    const description = [head.description, extra].filter(Boolean).join(' ').trim()
    const valueDate = amounts.valueDate || head.valueDate
    const { debit, credit } = classifyUmbAmount(
      description,
      amounts.txn,
      amounts.balance,
      previousBalance
    )
    previousBalance = amounts.balance

    if (debit === 0 && credit === 0) {
      block = []
      return
    }

    rows.push([
      formatUmbDate(head.bookingDate),
      head.reference,
      description,
      formatUmbDate(valueDate),
      debit > 0 ? debit : null,
      credit > 0 ? credit : null,
      amounts.balance,
    ])
    block = []
  }

  for (const line of lines) {
    if (/^[\d,]+\.\d{2}$/.test(line.replace(/\s+/g, '')) && block.length === 0) continue
    if (isUmbBlockStart(line)) {
      flush()
      block = [line]
    } else if (block.length > 0) {
      block.push(line)
    }
  }
  flush()

  return { headers, rows }
}
