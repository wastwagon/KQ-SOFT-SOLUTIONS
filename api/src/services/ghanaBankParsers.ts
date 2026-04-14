/**
 * Ghana bank-specific parsers for Ecobank, GCB, Access Bank, Stanbic, Fidelity, UBA, Absa.
 * Detects format from headers/content and provides auto-mapping.
 * Extracts chqNo from bank descriptions (e.g. "CHQ NO 1925", "CHQ# 002038").
 */

export type GhanaBankFormat = 'ecobank' | 'gcb' | 'access' | 'stanbic' | 'fidelity' | 'uba' | 'absa' | null

/** Ecobank: transaction_date, description, credit/debit. Sample patterns in description. */
const ECOBANK_HEADERS = [
  /transaction[\s_-]?date/i,
  /description|particulars|narrative/i,
  /credit|deposit|amount/i,
  /debit|withdrawal|amount/i,
]

/** GCB Bank: common column names. */
const GCB_HEADERS = [/value\s*date|transaction\s*date|date/i, /particulars|description|narrative/i, /credit|debit/i]

/** Access Bank: similar to Ecobank. */
const ACCESS_HEADERS = [/date/i, /description|particulars|narrative/i, /credit|debit|amount/i]

/** Stanbic Bank: value date, posting date, description, credit, debit. */
const STANBIC_HEADERS = [/value\s*date|posting\s*date|transaction\s*date|date/i, /description|particulars|narrative/i, /credit|debit|amount/i]

/** Fidelity Bank: similar structure. */
const FIDELITY_HEADERS = [/value\s*date|posting\s*date|date/i, /description|particulars|narrative/i, /credit|debit|amount/i]

/** UBA (United Bank for Africa): similar structure. */
const UBA_HEADERS = [/value\s*date|posting\s*date|date/i, /description|particulars|narrative/i, /credit|debit|amount/i]

/** Absa (formerly Barclays Bank Ghana): similar structure. */
const ABSA_HEADERS = [/value\s*date|posting\s*date|date/i, /description|particulars|narrative/i, /credit|debit|amount/i]

/** Ecobank description patterns (from REFERENCE_GHANA_DATA_STRUCTURES). */
const ECOBANK_DESC_PATTERNS = [
  /FUNDS TRANSFER - INWARD/i,
  /MOBILE TRANSFER RRN:/i,
  /TREASURY BILLS MATURED/i,
  /CHEQUE WITHDRAWAL CHQ NO/i,
  /CHEQUE CLEARING - OUTWARD LCY/i,
  /OTHER BANKS INWARD TRANSFER/i,
]

/**
 * Detect Ghana bank format from headers and sample rows.
 */
export function detectGhanaBankFormat(
  headers: string[],
  sampleRows: unknown[][]
): GhanaBankFormat {
  const headerStr = headers.join(' ').toLowerCase()

  // Check bank-specific content first (Stanbic, Fidelity, UBA, Absa) — before generic Ecobank
  const rowStr = (r: unknown[]) => String(r.join(' ')).toLowerCase()
  const allContent = headerStr + ' ' + sampleRows.slice(0, 5).map((r) => rowStr(r as unknown[])).join(' ')
  if (/stanbic|standard bank/i.test(allContent)) {
    const s = STANBIC_HEADERS.filter((re) => headers.some((h) => re.test(h))).length
    if (s >= 2) return 'stanbic'
  }
  if (/fidelity/i.test(allContent)) {
    const s = FIDELITY_HEADERS.filter((re) => headers.some((h) => re.test(h))).length
    if (s >= 2) return 'fidelity'
  }
  if (/\buba\b|united bank for africa/i.test(allContent)) {
    const s = UBA_HEADERS.filter((re) => headers.some((h) => re.test(h))).length
    if (s >= 2) return 'uba'
  }
  if (/absa|barclays/i.test(allContent)) {
    const s = ABSA_HEADERS.filter((re) => headers.some((h) => re.test(h))).length
    if (s >= 2) return 'absa'
  }

  // Check for Ecobank by header + description content
  const ecobankHeaderScore = ECOBANK_HEADERS.filter((re) => headers.some((h) => re.test(h))).length
  let ecobankContentScore = 0
  for (const row of sampleRows.slice(0, 5)) {
    const rowStr = (row as unknown[]).map((c) => String(c ?? '')).join(' ')
    if (ECOBANK_DESC_PATTERNS.some((re) => re.test(rowStr))) ecobankContentScore++
  }
  if (ecobankHeaderScore >= 2 && (ecobankContentScore >= 1 || ecobankHeaderScore >= 3)) {
    return 'ecobank'
  }

  // GCB: standard columns (value date, particulars, credit/debit)
  const gcbScore = GCB_HEADERS.filter((re) => headers.some((h) => re.test(h))).length
  if (gcbScore >= 2 && (headerStr.includes('gcb') || /value\s*date|particulars/i.test(headerStr))) {
    return 'gcb'
  }

  // Access Bank: standard columns
  const accessScore = ACCESS_HEADERS.filter((re) => headers.some((h) => re.test(h))).length
  if (accessScore >= 2 && headerStr.includes('access')) {
    return 'access'
  }

  return null
}

/**
 * Build suggested column mapping for detected bank format.
 */
export function getSuggestedBankMapping(
  bankFormat: GhanaBankFormat,
  headers: string[],
  type: 'credits' | 'debits'
): Record<string, number> {
  const mapping: Record<string, number> = {}
  const findCol = (patterns: RegExp[]): number => {
    const idx = headers.findIndex((h) => patterns.some((re) => re.test(h)))
    return idx >= 0 ? idx : -1
  }

  const dateIdx = findCol([/transaction[\s_-]?date/i, /value\s*date/i, /date/i])
  const descIdx = findCol([/description/i, /particulars/i, /narrative/i])
  const creditIdx = type === 'credits' ? findCol([/credit/i, /deposit/i, /amount/i]) : -1
  const debitIdx = type === 'debits' ? findCol([/debit/i, /withdrawal/i, /amount/i]) : -1

  if (dateIdx >= 0) mapping.transaction_date = dateIdx
  if (descIdx >= 0) mapping.description = descIdx
  if (creditIdx >= 0) mapping.credit = creditIdx
  if (debitIdx >= 0) mapping.debit = debitIdx

  return mapping
}

/**
 * Extract cheque number from bank statement description.
 * Handles: "CHQ NO 1925", "CHQ# 002038", "Cheque 12345", "CHQ 123456".
 */
export function extractChqNoFromDescription(description: string | null): string | null {
  if (!description || typeof description !== 'string') return null
  const trimmed = description.trim()
  if (!trimmed) return null

  // Explicit patterns: CHQ NO 1925, CHQ# 002038, Cheque No 12345
  const explicitRe = /\b(?:CHQ|Cheque)\s*(?:NO\.?|#|:)?\s*(\d{3,10})\b/i
  const m = description.match(explicitRe)
  if (m?.[1]) return m[1]

  return null
}
