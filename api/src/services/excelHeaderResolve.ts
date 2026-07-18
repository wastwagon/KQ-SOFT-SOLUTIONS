/**
 * Multi-row / merged Excel–CSV header resolution for unknown layouts.
 * Handles parent category rows (e.g. Amount spanning Debit|Credit) and
 * stacked labels that sheet_to_json leaves as null in merged cells.
 */

const HEADER_WORD =
  /\b(date|time|description|details|narration|narrative|particulars|reference|ref|cheque|check|amount|debit|credit|withdrawal|deposit|payment|receipt|balance|currency|rate|value|money\s*in|money\s*out|txn|trans(?:action)?|posting)\b/i

const DATE_LIKE =
  /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$|^\d{1,2}[-\s][A-Za-z]{3}[-\s]\d{2,4}$/i
const AMOUNT_LIKE = /^[-+()0-9,.\s]+$/

function cellText(c: unknown): string {
  return c == null ? '' : String(c).trim()
}

function nonEmptyCount(row: unknown[]): number {
  return (row || []).filter((c) => cellText(c) !== '').length
}

function padRow(row: unknown[] | undefined, width: number): unknown[] {
  const out = [...(row || [])]
  while (out.length < width) out.push(null)
  return out.slice(0, width)
}

function maxWidth(data: unknown[][]): number {
  return data.reduce((m, r) => Math.max(m, (r || []).length), 0)
}

function keywordHits(row: unknown[]): number {
  return (row || []).filter((c) => {
    const t = cellText(c)
    // Ignore long prose cells that happen to contain a keyword (metadata blocks).
    if (t.length > 40) return false
    return HEADER_WORD.test(t)
  }).length
}

function looksLikeDataRow(row: unknown[]): boolean {
  const cells = (row || []).map(cellText).filter(Boolean)
  if (cells.length < 2) return false
  const dateHits = cells.filter((s) => DATE_LIKE.test(s)).length
  const amountHits = cells.filter((s) => AMOUNT_LIKE.test(s) && /\d/.test(s)).length
  return dateHits >= 1 || (amountHits >= 2 && dateHits + amountHits >= 2)
}

/**
 * Forward-fill interior gaps in sparse category rows so merged "Amount | null"
 * becomes "Amount | Amount" before combining with the sub-header row.
 * Does not extend labels past the last non-empty cell (avoids polluting Date cols).
 */
export function forwardFillSparseHeaderRow(row: unknown[]): unknown[] {
  const out = [...row]
  let first = -1
  let last = -1
  for (let i = 0; i < out.length; i++) {
    if (cellText(out[i])) {
      if (first < 0) first = i
      last = i
    }
  }
  if (first < 0) return out
  const span = last - first + 1
  const filled = nonEmptyCount(out.slice(first, last + 1))
  if (filled / Math.max(span, 1) > 0.85) return out

  let lastVal = ''
  for (let i = first; i <= last; i++) {
    const t = cellText(out[i])
    if (t) lastVal = t
    else if (lastVal) out[i] = lastVal
  }
  return out
}

function looksLikeSubHeaderRow(
  candidate: unknown[] | undefined,
  main: unknown[],
  following: unknown[] | undefined,
  width: number
): boolean {
  if (!candidate) return false
  const row = padRow(candidate, width)
  const cells = row.map(cellText).filter(Boolean)
  if (cells.length < 1) return false
  if (looksLikeDataRow(row)) return false

  const hits = keywordHits(row)
  if (hits < 1) return false

  const alphaShort = cells.filter((s) => /[A-Za-z]/.test(s) && s.length <= 24).length

  // Prefer cases where the next row looks like transactions.
  if (following && looksLikeDataRow(padRow(following, width))) {
    return hits >= 1 && (hits + alphaShort >= 2)
  }

  // Without a clear data row after, require strong header keywords so we do not
  // swallow the first data row (e.g. Ref / Note then R1 / Second tab).
  if (hits < 2) return false

  const mainPad = padRow(main, width)
  let complementary = 0
  for (let i = 0; i < width; i++) {
    const a = cellText(mainPad[i])
    const b = cellText(row[i])
    if (!a && b && HEADER_WORD.test(b)) complementary++
    if (a && b && a.toLowerCase() !== b.toLowerCase() && HEADER_WORD.test(b)) complementary++
  }
  return complementary >= 1
}

function looksLikeParentHeaderRow(
  candidate: unknown[] | undefined,
  main: unknown[],
  width: number
): boolean {
  if (!candidate) return false
  const row = padRow(candidate, width)
  if (looksLikeDataRow(row)) return false
  const parentFilled = nonEmptyCount(row)
  const mainFilled = nonEmptyCount(main)
  if (parentFilled < 1) return false
  // Parent is typically sparser (merged category labels).
  if (parentFilled >= mainFilled && parentFilled > 2) return false

  const joined = row.map(cellText).join(' ')
  // Reject title / account-summary blocks mistaken for category headers.
  if (joined.length > 60) return false
  if (
    /statement\s+(for|of)|account\s*(name|number)|customer|branch|address|opening\s+balance|closing\s+balance|available|currency/i.test(
      joined
    )
  ) {
    return false
  }

  const hits = keywordHits(row)
  if (hits < 1 && !/(amount|withdrawal|deposit|transaction|particular)/i.test(joined)) {
    return false
  }
  return true
}

function combineColumnLabels(parts: string[]): string {
  const unique: string[] = []
  for (const p of parts) {
    const t = p.trim()
    if (!t) continue
    if (unique.some((u) => u.toLowerCase() === t.toLowerCase())) continue
    // Skip if already contained in a longer label
    if (unique.some((u) => u.toLowerCase().includes(t.toLowerCase()))) continue
    // Replace shorter label that is a prefix/subset of the new one
    const idx = unique.findIndex((u) => t.toLowerCase().includes(u.toLowerCase()))
    if (idx >= 0) unique[idx] = t
    else unique.push(t)
  }
  return unique.join(' ').trim()
}

export type ResolvedHeaders = {
  headers: string[]
  dataStart: number
  /** Number of physical rows consumed as the header band (1–3). */
  headerBandRows: number
}

/**
 * Given a scored header row index, optionally absorb a parent category row
 * above and/or a sub-header row below, then emit combined column titles.
 */
export function resolveMultiRowHeaders(
  data: unknown[][],
  headerRow: number
): ResolvedHeaders {
  if (!data.length) return { headers: [], dataStart: 0, headerBandRows: 0 }

  const width = Math.max(2, maxWidth(data.slice(Math.max(0, headerRow - 1), headerRow + 4)))
  const main = padRow(data[headerRow], width)

  let start = headerRow
  let end = headerRow

  if (looksLikeParentHeaderRow(data[headerRow - 1], main, width)) {
    start = headerRow - 1
  }
  if (looksLikeSubHeaderRow(data[headerRow + 1], main, data[headerRow + 2], width)) {
    end = headerRow + 1
  }
  // Parent + main + sub (three-row band)
  if (
    start < headerRow &&
    end === headerRow &&
    looksLikeSubHeaderRow(data[headerRow + 1], main, data[headerRow + 2], width)
  ) {
    end = headerRow + 1
  }

  const bandRows: unknown[][] = []
  for (let r = start; r <= end; r++) {
    const padded = padRow(data[r], width)
    const sparse = nonEmptyCount(padded) / width <= 0.65
    bandRows.push(sparse ? forwardFillSparseHeaderRow(padded) : padded)
  }

  const headers: string[] = []
  for (let c = 0; c < width; c++) {
    const parts = bandRows.map((row) => cellText(row[c])).filter(Boolean)
    headers.push(combineColumnLabels(parts) || `Col_${c}`)
  }

  // Trim trailing placeholder-only columns
  let lastUseful = headers.length - 1
  while (lastUseful > 0 && /^Col_\d+$/.test(headers[lastUseful]!)) lastUseful--
  const trimmed = headers.slice(0, lastUseful + 1)

  return {
    headers: trimmed,
    dataStart: end + 1,
    headerBandRows: end - start + 1,
  }
}
