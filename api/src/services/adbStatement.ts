/**
 * Agricultural Development Bank (ADB) Ghana statement PDF.
 * Native text uses multi-line blocks:
 *   Date+Branch (106)
 *   Description (optional continuation lines / account numbers)
 *   Reference+ValueDate+Debit+Credit+Balance (often glued on one line)
 */

import { parseImportedAmount } from './amountParser.js'
import type { ParseResult } from './parser.js'

const ADB_DATE = /^\d{2}-\d{2}-\d{4}$/
const ADB_BLOCK_HEAD = /^(\d{2}-\d{2}-\d{4})106(.*)$/
const ADB_AMOUNT_TAIL =
  /^(.*)(\d{2}-\d{2}-\d{4})([\d,]+\.\d{2})([\d,]+\.\d{2})(-?[\d,]+\.\d{2})\s*$/

export function looksLikeAdbStatementText(text: string): boolean {
  const flat = text.replace(/\s+/g, ' ')
  if (
    /statement\s*of\s*account/i.test(flat) &&
    /date\s*branch\s*description\s*reference\s*value\s*date\s*debits\s*credits\s*balance/i.test(
      flat
    )
  ) {
    return true
  }
  if (
    /not\s+for\s+visa/i.test(flat) &&
    /account\s*no\s*:\s*106/i.test(flat) &&
    /\d{2}-\d{2}-\d{4}106/.test(flat)
  ) {
    return true
  }
  return false
}

export function shouldUseAdbPdfParser(result: { headers: string[]; rows: unknown[][] }): boolean {
  const h = result.headers.map((x) => (x || '').toLowerCase()).join(' ')
  if (/\bdebit\b/.test(h) && /\bcredit\b/.test(h) && result.rows.length < 30) return false
  return (
    /datebranchdescription|opening\s+balance/i.test(h) ||
    (result.headers.length < 6 && result.rows.length > 20)
  )
}

function isNoiseLine(line: string): boolean {
  return (
    /^not\s+for\s+visa$/i.test(line) ||
    /^statement$/i.test(line) ||
    /^of$/i.test(line) ||
    /^account$/i.test(line) ||
    /^page$/i.test(line) ||
    /^\d+\s+of\d*$/i.test(line) ||
    /^period\s*from/i.test(line) ||
    /^to\s*:\s*\d{2}-\d{2}-\d{4}/i.test(line) ||
    /^account\s*no\s*:/i.test(line) ||
    /^product\s*name/i.test(line) ||
    /^currency\s*name/i.test(line) ||
    /^branch\s*code/i.test(line) ||
    /^branch\s*name/i.test(line) ||
    /^customer\s*(id|name|address|short)/i.test(line) ||
    /^account\s*title/i.test(line) ||
    /^date\s*branch\s*description/i.test(line) ||
    /^opening\s+balance/i.test(line) ||
    /^closing\s+balance/i.test(line) ||
    /^total\s+(debit|credit)\s+amt/i.test(line) ||
    /^\d{2}-\d{2}-\d{4}$/.test(line) && line.length === 10
  )
}

export function formatAdbDate(value: string): string {
  const m = value.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!m) return value.trim()
  return `${m[1]}/${m[2]}/${m[3]}`
}

function splitAdbPrefix(prefix: string): { description: string; reference: string } {
  if (!prefix) return { description: '', reference: '' }

  const branchRef = prefix.match(/^(.*?)(106[A-Z]{3,}\d+)$/)
  if (branchRef) {
    return { description: branchRef[1]!.trim(), reference: branchRef[2]! }
  }

  const numRef = prefix.match(/^(.*?)(\d{10,})$/)
  if (numRef && numRef[1]!.length > 0) {
    return { description: numRef[1]!.trim(), reference: numRef[2]! }
  }

  if (/^106[A-Z0-9]+$/.test(prefix)) {
    return { description: '', reference: prefix }
  }

  return { description: prefix, reference: '' }
}

export function parseAdbAmountTail(line: string): {
  prefix: string
  reference: string
  description: string
  valueDate: string
  debit: number
  credit: number
  balance: number
} | null {
  const m = line.trim().match(ADB_AMOUNT_TAIL)
  if (!m) return null

  const prefix = (m[1] ?? '').trim()
  const split = splitAdbPrefix(prefix)

  return {
    prefix,
    reference: split.reference,
    description: split.description,
    valueDate: m[2]!,
    debit: parseImportedAmount(m[3]),
    credit: parseImportedAmount(m[4]),
    balance: parseImportedAmount(m[5]),
  }
}

function isAdbAccountLine(line: string): boolean {
  return /^106\d{13}$/.test(line.trim())
}

function isAdbBlockStart(line: string): boolean {
  return ADB_BLOCK_HEAD.test(line.trim())
}

function parseAdbHeadLine(line: string): { date: string; inline: ReturnType<typeof parseAdbAmountTail> } | null {
  const m = line.trim().match(ADB_BLOCK_HEAD)
  if (!m) return null
  const tail = (m[2] ?? '').trim()
  const inline = tail ? parseAdbAmountTail(tail) : null
  return { date: m[1]!, inline }
}

function transactionSectionLines(text: string): string[] {
  const marker = text.search(/Date\s*Branch\s*Description|DateBranchDescription/i)
  const section = marker >= 0 ? text.slice(marker) : text
  return section
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !isNoiseLine(l))
}

/** Parse ADB Ghana PDF text into a standard transaction table. */
export function parseAdbPdfText(text: string): ParseResult {
  const headers = [
    'Date',
    'Branch',
    'Description',
    'Reference',
    'Value Date',
    'Debit',
    'Credit',
    'Balance',
  ]
  const rows: unknown[][] = []
  const lines = transactionSectionLines(text)
  let block: string[] = []

  const flush = () => {
    if (block.length === 0) return

    const headLine = block.find((l) => isAdbBlockStart(l)) ?? block[0]!
    const head = parseAdbHeadLine(headLine)
    if (!head) {
      block = []
      return
    }

    let parsed = head.inline
    if (!parsed) {
      const amountLine = block.find((l) => parseAdbAmountTail(l)) ?? ''
      parsed = amountLine ? parseAdbAmountTail(amountLine) : null
    }
    if (!parsed) {
      block = []
      return
    }

    const extra = block
      .filter((l) => l !== headLine && !parseAdbAmountTail(l))
      .filter((l) => !isAdbAccountLine(l))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    const description = [parsed.description, extra].filter(Boolean).join(' ').trim()
    const debit = parsed.debit > 0 ? parsed.debit : null
    const credit = parsed.credit > 0 ? parsed.credit : null

    if (!debit && !credit) {
      block = []
      return
    }

    rows.push([
      formatAdbDate(head.date),
      '106',
      description,
      parsed.reference,
      formatAdbDate(parsed.valueDate),
      debit,
      credit,
      parsed.balance,
    ])
    block = []
  }

  for (const line of lines) {
    if (isAdbBlockStart(line)) {
      flush()
      block = [line]
      if (parseAdbHeadLine(line)?.inline) flush()
    } else if (block.length > 0) {
      block.push(line)
      if (parseAdbAmountTail(line)) flush()
    } else if (parseAdbAmountTail(line) && ADB_DATE.test(line.slice(0, 10))) {
      // Rare orphan amount line — skip
      continue
    }
  }
  flush()

  return { headers, rows }
}
