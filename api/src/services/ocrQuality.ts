/**
 * Score parse / OCR quality so the upload pipeline can retry weak scans
 * and prefer the better of two extraction attempts.
 */
import { parseImportedAmount } from './amountParser.js'
import { parseImportedDate } from './dateParser.js'

export interface ParseQualityInput {
  headers: string[]
  rows: unknown[][]
  /** Raw OCR or native text when available (junk-character checks). */
  sourceText?: string
  parseMethod?: string | null
}

export interface ParseQualityScore {
  /** 0–100 composite quality score. */
  score: number
  /** True when a higher-resolution / alternate OCR retry is worthwhile. */
  shouldRetry: boolean
  reasons: string[]
  metrics: {
    rowCount: number
    headerCount: number
    dateHitRate: number
    amountHitRate: number
    headerKeywordHits: number
    columnConsistency: number
    junkCharRate: number
  }
}

const HEADER_KEYWORDS =
  /\b(date|description|details|narration|narrative|particulars|debit|credit|amount|balance|ref|cheque|payment|deposit|withdrawal)\b/i

const JUNK_CHAR = /[^\w\s.,:;/\-()%€£$₵+#@'"*=\[\]{}|\\<>?!&]/g

function present(value: unknown): boolean {
  return value != null && String(value).trim() !== ''
}

function isDateLike(value: unknown): boolean {
  if (!present(value)) return false
  if (value instanceof Date) return !Number.isNaN(value.getTime())
  const raw = String(value).trim()
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(raw) || /^\d{1,2}-[A-Za-z]{3}-\d{2,4}$/i.test(raw)) {
    return parseImportedDate(value) != null
  }
  if (/^\d{5}$/.test(raw)) {
    const n = Number(raw)
    return n >= 20_000 && n <= 80_000
  }
  return parseImportedDate(value) != null
}

function isAmountLike(value: unknown): boolean {
  if (!present(value)) return false
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0
  const raw = String(value).trim()
  if (!/\d/.test(raw)) return false
  const n = parseImportedAmount(raw)
  return n !== 0 || /[0-9]/.test(raw)
}

function headerKeywordHits(headers: string[]): number {
  return headers.filter((h) => HEADER_KEYWORDS.test(String(h || ''))).length
}

function columnConsistency(rows: unknown[][], headerCount: number): number {
  if (!rows.length || headerCount <= 0) return 0
  const sample = rows.slice(0, 80)
  let matching = 0
  for (const row of sample) {
    const width = (row || []).filter((c) => present(c)).length
    if (width >= Math.max(2, Math.floor(headerCount * 0.6)) && width <= headerCount + 2) {
      matching++
    }
  }
  return matching / sample.length
}

function junkCharRate(text: string): number {
  if (!text) return 0
  const sample = text.slice(0, 8_000)
  if (!sample.length) return 0
  const junk = sample.match(JUNK_CHAR)?.length ?? 0
  return junk / sample.length
}

function dateHitRate(rows: unknown[][], headers: string[]): number {
  if (!rows.length) return 0
  const dateCol = headers.findIndex((h) => /date/i.test(String(h || '')))
  const sample = rows.slice(0, 60)
  let hits = 0
  let checked = 0
  for (const row of sample) {
    if (dateCol >= 0) {
      checked++
      if (isDateLike(row[dateCol])) hits++
      continue
    }
    // Unknown headers: any cell in the row looking like a date counts.
    checked++
    if ((row || []).some((c) => isDateLike(c))) hits++
  }
  return checked ? hits / checked : 0
}

function amountHitRate(rows: unknown[][], headers: string[]): number {
  if (!rows.length) return 0
  const amountCols = headers
    .map((h, i) => (/debit|credit|amount|payment|deposit|withdrawal|money/i.test(String(h || '')) ? i : -1))
    .filter((i) => i >= 0)
  const sample = rows.slice(0, 60)
  let hits = 0
  let checked = 0
  for (const row of sample) {
    checked++
    if (amountCols.length) {
      if (amountCols.some((i) => isAmountLike(row[i]))) hits++
    } else if ((row || []).some((c) => isAmountLike(c))) {
      hits++
    }
  }
  return checked ? hits / checked : 0
}

/**
 * Score how usable a parsed table is for bank reconciliation mapping.
 * Dedicated bank parsers (ecobank_pdf, etc.) are treated as strong by default.
 */
export function scoreParseQuality(input: ParseQualityInput): ParseQualityScore {
  const reasons: string[] = []
  const headers = input.headers || []
  const rows = input.rows || []
  const method = (input.parseMethod || '').toLowerCase()

  if (/_pdf$|_excel$/.test(method) && method !== 'native_text' && rows.length >= 3) {
    return {
      score: 92,
      shouldRetry: false,
      reasons: [`Dedicated parser ${method} produced ${rows.length} rows`],
      metrics: {
        rowCount: rows.length,
        headerCount: headers.length,
        dateHitRate: 1,
        amountHitRate: 1,
        headerKeywordHits: headerKeywordHits(headers),
        columnConsistency: 1,
        junkCharRate: 0,
      },
    }
  }

  const dateRate = dateHitRate(rows, headers)
  const amountRate = amountHitRate(rows, headers)
  const keywords = headerKeywordHits(headers)
  const consistency = columnConsistency(rows, Math.max(headers.length, 1))
  const junk = junkCharRate(input.sourceText || '')

  let score = 0
  // Row volume (0–25)
  if (rows.length >= 20) score += 25
  else if (rows.length >= 8) score += 18
  else if (rows.length >= 3) score += 10
  else if (rows.length >= 1) score += 4
  else reasons.push('No transaction rows extracted')

  // Date evidence (0–20)
  score += Math.round(dateRate * 20)
  if (dateRate < 0.4) reasons.push('Few date-like values detected')

  // Amount evidence (0–20)
  score += Math.round(amountRate * 20)
  if (amountRate < 0.4) reasons.push('Few amount-like values detected')

  // Header keywords (0–15)
  score += Math.min(15, keywords * 5)
  if (keywords === 0) reasons.push('No recognizable table headers')

  // Column shape consistency (0–15)
  score += Math.round(consistency * 15)
  if (consistency < 0.5) reasons.push('Column widths are inconsistent across rows')

  // Junk penalty (0–15)
  const junkPenalty = Math.min(15, Math.round(junk * 40))
  score -= junkPenalty
  if (junk >= 0.08) reasons.push('High proportion of OCR junk characters')

  score = Math.max(0, Math.min(100, score))

  // Retry when the table looks unusable for mapping, but not when empty PDF truly has nothing.
  const shouldRetry =
    score < 55 &&
    (rows.length < 5 || dateRate < 0.45 || amountRate < 0.45 || keywords === 0 || junk >= 0.08)

  if (shouldRetry) reasons.push('Quality below retry threshold')

  return {
    score,
    shouldRetry,
    reasons,
    metrics: {
      rowCount: rows.length,
      headerCount: headers.length,
      dateHitRate: dateRate,
      amountHitRate: amountRate,
      headerKeywordHits: keywords,
      columnConsistency: consistency,
      junkCharRate: junk,
    },
  }
}

/** Prefer the higher-scoring parse; ties keep the first (usually faster) attempt. */
export function pickBetterParse<T extends ParseQualityInput>(
  a: T,
  b: T
): { winner: T; aScore: ParseQualityScore; bScore: ParseQualityScore } {
  const aScore = scoreParseQuality(a)
  const bScore = scoreParseQuality(b)
  return {
    winner: bScore.score > aScore.score + 3 ? b : a,
    aScore,
    bScore,
  }
}
