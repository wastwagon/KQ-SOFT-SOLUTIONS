import { parseImportedAmount } from './amountParser.js'

export interface OcrTableParseResult {
  headers: string[]
  rows: unknown[][]
}

function looksNumericToken(t: string): boolean {
  return /^(?:[-+]?[\d,]+(?:\.\d+)?(?:-)?|\([\d,]+(?:\.\d+)?\))$/.test(t.trim())
}

function splitMoneyTail(tail: string): { narrative: string; amount: string } | null {
  const tokens = tail.trim().split(/\s+/).filter(Boolean)
  if (tokens.length < 2) return null

  let best: { narrative: string; amount: string; score: number } | null = null
  const end = tokens.length - 1
  for (let start = end; start >= 0; start--) {
    const amtRaw = tokens.slice(start, end + 1).join(' ')
    const amt = parseImportedAmount(amtRaw)
    if (amt === 0 && !/[0-9]/.test(amtRaw)) continue
    const narrative = tokens.slice(0, start).join(' ').trim()
    if (!narrative) continue
    const score =
      narrative.length * 1000 +
      amtRaw.length * 10 +
      (Math.abs(amt) > 0 ? 5 : 0)
    if (!best || score > best.score) best = { narrative, amount: amtRaw.trim(), score }
  }
  return best ? { narrative: best.narrative, amount: best.amount } : null
}

/**
 * Peel the shortest valid monetary suffix from the end (right column first).
 * Tries 1..maxLen tokens so "500 100" yields 100 then 500, not one blob.
 */
function peelAmountSuffixFromEnd(tokens: string[], maxLen = 4): { rest: string[]; amount: string } | null {
  const n = tokens.length
  if (n < 2) return null
  const cap = Math.min(maxLen, n - 1)
  for (let len = 1; len <= cap; len++) {
    const amtRaw = tokens.slice(n - len, n).join(' ')
    const amt = parseImportedAmount(amtRaw)
    if (amt === 0 && !/[0-9]/.test(amtRaw)) continue
    const rest = tokens.slice(0, n - len)
    if (rest.length === 0) continue
    return { rest, amount: amtRaw.trim() }
  }
  return null
}

/** Two trailing money columns (debit/credit style) after description. */
function splitMoneyTailDual(tail: string): { narrative: string; amounts: string[] } | null {
  const tokens = tail.trim().split(/\s+/).filter(Boolean)
  if (tokens.length < 3) return null

  const first = peelAmountSuffixFromEnd(tokens)
  if (!first) return null

  const second = peelAmountSuffixFromEnd(first.rest)
  if (!second) {
    return { narrative: first.rest.join(' ').trim(), amounts: [first.amount] }
  }

  const narrative = second.rest.join(' ').trim()
  if (!narrative) return { narrative: first.rest.join(' ').trim(), amounts: [first.amount] }

  // Prefer dual only when both tails look like real money tokens (reduces invoice-number false splits).
  const a1Ok = looksNumericToken(second.amount) || /[.,]/.test(second.amount)
  const a2Ok = looksNumericToken(first.amount) || /[.,]/.test(first.amount)
  if (!a1Ok || !a2Ok) {
    return { narrative: first.rest.join(' ').trim(), amounts: [first.amount] }
  }

  return { narrative, amounts: [second.amount, first.amount] }
}

function splitLeadingDateAndRest(s: string): { dateCell: string; rest: string } | null {
  const withTime =
    /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/.exec(s)
  if (withTime) {
    return { dateCell: `${withTime[1]} ${withTime[2]}`, rest: withTime[3]!.trim() }
  }
  const dateOnly = /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+)$/.exec(s)
  if (!dateOnly) return null
  return { dateCell: dateOnly[1]!, rest: dateOnly[2]!.trim() }
}

/**
 * Split a single OCR line into table cells.
 * - Prefer explicit separators: tab, pipe, 2+ spaces.
 * - Fallback for bank-like rows: leading DD/MM/YYYY (optional time) + trailing monetary amount.
 */
export function splitOcrTableLine(line: string): string[] {
  const s = line.trim()
  if (!s) return []

  if (s.includes('\t')) {
    return s.split('\t').map((c) => c.trim()).filter((c) => c.length > 0)
  }
  if (s.includes('|')) {
    return s.split('|').map((c) => c.trim()).filter((c) => c.length > 0)
  }

  const spaced = s.split(/\s{2,}/).map((c) => c.trim()).filter((c) => c.length > 0)
  if (spaced.length >= 2) {
    if (
      spaced.length === 2 &&
      /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(spaced[0] || '') &&
      looksNumericToken(spaced[1] || '')
    ) {
      const inner = splitOcrTableLine(spaced[0] || '')
      if (inner.length >= 2) return [...inner.slice(0, -1), `${inner[inner.length - 1]} ${spaced[1]}`.trim()]
    }
    return spaced
  }

  const looksLikeHeaderLine =
    !/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(s) &&
    /^(?:[A-Za-z]{3,}\s+){1,}[A-Za-z]{3,}$/.test(s) &&
    /(date|txn|posting|value|description|details|narrative|particulars|amount|debit|credit|balance|ref)/i.test(s)
  if (looksLikeHeaderLine) {
    const parts = s.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return parts
  }

  const dr = splitLeadingDateAndRest(s)
  if (dr) {
    const dual = splitMoneyTailDual(dr.rest)
    if (dual && dual.amounts.length === 2) {
      return [dr.dateCell, dual.narrative, dual.amounts[0]!, dual.amounts[1]!]
    }
    const money = splitMoneyTail(dr.rest)
    if (money) return [dr.dateCell, money.narrative, money.amount]
    return [dr.dateCell, dr.rest]
  }

  return spaced.length ? spaced : [s]
}

export function textToTableFromOcrText(text: string): OcrTableParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return { headers: [], rows: [] }

  const rows = lines.map((line) => splitOcrTableLine(line))

  const isProbableHeaderRow = (cells: string[]): boolean => {
    const joined = cells.join(' ').toLowerCase()
    return /(date|txn|posting|value|description|details|narrative|particulars|amount|debit|credit|balance|ref)/.test(
      joined
    )
  }

  let headerIdx = -1
  for (let i = 0; i < Math.min(25, rows.length); i++) {
    const r = rows[i] || []
    if (r.length >= 2 && isProbableHeaderRow(r.map(String))) {
      headerIdx = i
      break
    }
  }

  if (headerIdx >= 0) {
    const headers = (rows[headerIdx] || []).map((c, i) => String(c ?? '').trim() || `Col_${i}`)
    const dataRows = rows.slice(headerIdx + 1).filter((r) => r.some((c) => c && String(c).trim() !== ''))
    return { headers, rows: dataRows }
  }

  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0)
  const headers = Array.from({ length: Math.max(maxCols, 0) }, (_, i) => `Col_${i}`)
  const dataRows = rows.filter((r) => r.some((c) => c && String(c).trim() !== ''))
  return { headers, rows: dataRows }
}
