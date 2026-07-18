/**
 * Ghana bank-specific parsers for Ecobank, GCB, Access Bank, Stanbic, Fidelity, UBA, Absa.
 * Detects format from headers/content and provides auto-mapping.
 * Extracts chqNo from bank descriptions (e.g. "CHQ NO 1925", "CHQ# 002038").
 */

import { looksLikeGcbStatementText } from './gcbStatement.js'
import { looksLikeNibStatementText } from './nibStatement.js'
import { looksLikeAdbStatementText } from './adbStatement.js'
import { looksLikeEcobankStatementText } from './ecobankStatement.js'
import { looksLikeUmbStatementText } from './umbStatement.js'
import { looksLikeUbaStatementText } from './ubaStatement.js'

export type GhanaBankFormat =
  | 'ecobank'
  | 'gcb'
  | 'access'
  | 'stanbic'
  | 'fidelity'
  | 'uba'
  | 'absa'
  | 'boa'
  | 'bog'
  | 'prudential'
  | 'nib'
  | 'adb'
  | 'umb'
  | 'scb'
  | null

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

/** Bank of Africa: value/operation date, description, debit, credit. */
const BOA_HEADERS = [/value\s*date|operation\s*date|date/i, /description/i, /debit|credit/i]

/** Bank of Ghana: post date, description, debit, credit. */
const BOG_HEADERS = [/post\s*date|value\s*date|date/i, /description/i, /debit|credit/i]

/** Prudential Bank: transaction date, description, debit, credit. */
const PRUDENTIAL_HEADERS = [/trans(?:action)?\s*date|post\s*date|value\s*date|date/i, /description/i, /debit|credit/i]

/** NIB: booking date, reference, description, value date, debit, credit. */
const NIB_HEADERS = [/booking\s*date|value\s*date|date/i, /description/i, /debit|credit/i]

/** ADB: date, branch, description, reference, value date, debit, credit. */
const ADB_HEADERS = [/value\s*date|date/i, /description/i, /debit|credit/i]

function norm(h: string): string {
  return (h || '').toLowerCase().replace(/[\s_]+/g, ' ').trim()
}

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
/** GCB PDF: Value Date, Particulars, Credit/Debit columns in merged native text. */
export function detectGhanaBankFormat(
  headers: string[],
  sampleRows: unknown[][],
  sourceText?: string
): GhanaBankFormat {
  const headerStr = headers.join(' ').toLowerCase()
  if (sourceText && looksLikeGcbStatementText(sourceText)) return 'gcb'
  if (sourceText && looksLikeEcobankStatementText(sourceText)) return 'ecobank'
  if (sourceText && looksLikeUmbStatementText(sourceText)) return 'nib'
  if (sourceText && looksLikeNibStatementText(sourceText)) return 'nib'
  if (sourceText && looksLikeAdbStatementText(sourceText)) return 'adb'
  if (sourceText && looksLikeUbaStatementText(sourceText)) return 'uba'

  const normalizedHeaderStr = headers.map((h) => norm(h)).join(' ')

  // GCB normalized PDF (Chq No + Value Date — before Ecobank PDF column heuristic)
  if (
    headers.some((h) => norm(h) === 'chq no') &&
    headers.some((h) => norm(h) === 'value date') &&
    headers.some((h) => /^transaction date$/i.test(norm(h))) &&
    headers.some((h) => /^debit$/i.test(norm(h))) &&
    headers.some((h) => /^credit$/i.test(norm(h)))
  ) {
    return 'gcb'
  }

  const hasEcobankPdfColumns =
    headers.some((h) => /reference\s*number/i.test(norm(h))) &&
    headers.some((h) => /^transaction date$/i.test(norm(h))) &&
    headers.some((h) => /^debit$/i.test(norm(h))) &&
    headers.some((h) => /^credit$/i.test(norm(h)))
  if (hasEcobankPdfColumns) return 'ecobank'

  const rowStr = (r: unknown[]) => String(r.join(' ')).toLowerCase()
  const allContent = headerStr + ' ' + sampleRows.slice(0, 5).map((r) => rowStr(r as unknown[])).join(' ')

  // SCB / UMB Excel: ENTRY DATE + DEBITS + CREDITS (UMB PDF uses nib via sourceText above)
  if (
    /entry date/.test(normalizedHeaderStr) &&
    /\bdebits?\b/.test(normalizedHeaderStr) &&
    /\bcredits?\b/.test(normalizedHeaderStr)
  ) {
    if (/united merchant bank|\bumb\b/i.test(allContent)) return 'umb'
    return 'scb'
  }

  // Normalized PDF parser outputs (distinct column sets — before generic Transaction Date heuristics)
  if (
    /transaction date/.test(normalizedHeaderStr) &&
    /cheque no/.test(normalizedHeaderStr) &&
    /\bdebit\b/.test(normalizedHeaderStr) &&
    /\bcredit\b/.test(normalizedHeaderStr)
  ) {
    return 'uba'
  }

  if (/fidelity/i.test(allContent)) {
    const s = FIDELITY_HEADERS.filter((re) => headers.some((h) => re.test(h))).length
    if (s >= 2) return 'fidelity'
  }
  if (/\buba\b|united bank for africa/i.test(allContent)) {
    const s = UBA_HEADERS.filter((re) => headers.some((h) => re.test(h))).length
    if (s >= 2) return 'uba'
  }
  if (/stanbic|standard bank/i.test(allContent)) {
    const s = STANBIC_HEADERS.filter((re) => headers.some((h) => re.test(h))).length
    if (s >= 2) return 'stanbic'
  }
  if (/absa|barclays/i.test(allContent)) {
    const s = ABSA_HEADERS.filter((re) => headers.some((h) => re.test(h))).length
    if (s >= 2) return 'absa'
  }
  // Stanbic-specific column name — not shared with UBA/Prudential normalized PDF output
  if (
    /transaction description/.test(normalizedHeaderStr) &&
    /\bdebit/.test(normalizedHeaderStr) &&
    /\bcredit/.test(normalizedHeaderStr)
  ) {
    return 'stanbic'
  }
  // Stanbic Excel export includes a Fee column between description and amounts
  if (
    /transaction date/.test(normalizedHeaderStr) &&
    /\bfee\b/.test(normalizedHeaderStr) &&
    /\bdebit/.test(normalizedHeaderStr) &&
    /\bcredit/.test(normalizedHeaderStr)
  ) {
    return 'stanbic'
  }

  const boaHeaderStr = headers.map((h) => norm(h)).join(' ')
  if (
    /our reference/.test(boaHeaderStr) &&
    /\bdebit\b/.test(boaHeaderStr) &&
    /\bcredit\b/.test(boaHeaderStr) &&
    /value date/.test(boaHeaderStr)
  ) {
    return 'boa'
  }
  if (/bank of africa|\bboa\b/.test(allContent)) {
    const s = BOA_HEADERS.filter((re) => headers.some((h) => re.test(h))).length
    if (s >= 2) return 'boa'
  }

  const bogHeaderStr = headers.map((h) => norm(h)).join(' ')
  if (/post date/.test(bogHeaderStr) && /\bdebit\b/.test(bogHeaderStr) && /\bcredit\b/.test(bogHeaderStr)) {
    return 'bog'
  }
  if (/bank of ghana|\bbog\b/.test(allContent)) {
    const s = BOG_HEADERS.filter((re) => headers.some((h) => re.test(h))).length
    if (s >= 2) return 'bog'
  }

  const hasAdbColumns =
    headers.some((h) => /^branch$/i.test(norm(h))) &&
    headers.some((h) => /^reference$/i.test(norm(h))) &&
    headers.some((h) => /^debit$/i.test(norm(h))) &&
    headers.some((h) => /^credit$/i.test(norm(h)))
  if (hasAdbColumns) return 'adb'
  if (/\badb\b|agricultural development bank|not for visa/i.test(allContent)) {
    const s = ADB_HEADERS.filter((re) => headers.some((h) => re.test(h))).length
    if (s >= 2) return 'adb'
  }

  const nibHeaderStr = headers.map((h) => norm(h)).join(' ')
  if (
    /booking date/.test(nibHeaderStr) &&
    /\bdescription\b/.test(nibHeaderStr) &&
    /\bdebit\b/.test(nibHeaderStr) &&
    /\bcredit\b/.test(nibHeaderStr)
  ) {
    return 'nib'
  }
  if (/\bnib\b|national investment bank/i.test(allContent)) {
    const s = NIB_HEADERS.filter((re) => headers.some((h) => re.test(h))).length
    if (s >= 2) return 'nib'
  }

  const pruHeaderStr = headers.map((h) => norm(h)).join(' ')
  if (
    /transaction date/.test(pruHeaderStr) &&
    headers.some((h) => norm(h) === 'reference') &&
    !headers.some((h) => norm(h) === 'cheque no') &&
    /\bdebit\b/.test(pruHeaderStr) &&
    /\bcredit\b/.test(pruHeaderStr)
  ) {
    return 'prudential'
  }
  if (/prudential\s+bank|ring\s+road\s+central/i.test(allContent)) {
    const s = PRUDENTIAL_HEADERS.filter((re) => headers.some((h) => re.test(h))).length
    if (s >= 2) return 'prudential'
  }

  const hasEcobankColumns = headers.some((h) => /payments?/i.test(h)) && headers.some((h) => /deposits?/i.test(h))
  if (hasEcobankColumns && headers.some((h) => /transaction[\s_-]?date/i.test(h))) {
    return 'ecobank'
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

/** Bank format implied by dedicated PDF parser (upload auto-map must follow the parser, not heuristics alone). */
export function bankFormatFromParseMethod(parseMethod?: string): GhanaBankFormat {
  switch (parseMethod) {
    case 'prudential_pdf':
      return 'prudential'
    case 'uba_pdf':
      return 'uba'
    case 'nib_pdf':
      return 'nib'
    case 'adb_pdf':
      return 'adb'
    case 'umb_pdf':
      return 'umb'
    case 'absa_pdf':
      return 'absa'
    case 'gcb_pdf':
      return 'gcb'
    case 'ecobank_pdf':
      return 'ecobank'
    default:
      return null
  }
}

/** Prefer parseMethod when a dedicated bank PDF parser ran; else infer from headers/sample rows. */
export function resolveDetectedBankFormat(
  headers: string[],
  sampleRows: unknown[][],
  parseMethod?: string
): GhanaBankFormat {
  const fromParser = bankFormatFromParseMethod(parseMethod)
  if (fromParser) return fromParser
  return detectGhanaBankFormat(headers, sampleRows)
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

  if (bankFormat === 'boa') {
    const valueDateIdx = findCol([/^value\s*date$/i])
    const opDateIdx = findCol([/^operation\s*date$/i])
    const descIdx = findCol([/^description$/i])
    const creditIdx = type === 'credits' ? findCol([/^credit$/i]) : -1
    const debitIdx = type === 'debits' ? findCol([/^debit$/i]) : -1
    if (valueDateIdx >= 0) mapping.transaction_date = valueDateIdx
    else if (opDateIdx >= 0) mapping.transaction_date = opDateIdx
    if (descIdx >= 0) mapping.description = descIdx
    if (creditIdx >= 0) mapping.credit = creditIdx
    if (debitIdx >= 0) mapping.debit = debitIdx
    return mapping
  }

  if (bankFormat === 'bog') {
    const postDateIdx = findCol([/^post date$/i])
    const valueDateIdx = findCol([/^value date$/i])
    const descIdx = findCol([/^description$/i])
    const creditIdx = type === 'credits' ? findCol([/^credit$/i]) : -1
    const debitIdx = type === 'debits' ? findCol([/^debit$/i]) : -1
    if (postDateIdx >= 0) mapping.transaction_date = postDateIdx
    else if (valueDateIdx >= 0) mapping.transaction_date = valueDateIdx
    if (descIdx >= 0) mapping.description = descIdx
    if (creditIdx >= 0) mapping.credit = creditIdx
    if (debitIdx >= 0) mapping.debit = debitIdx
    return mapping
  }

  if (bankFormat === 'adb') {
    const dateIdx = findCol([/^date$/i])
    const valueDateIdx = findCol([/^value date$/i])
    const descIdx = findCol([/^description$/i])
    const creditIdx = type === 'credits' ? findCol([/^credit$/i, /^credits$/i]) : -1
    const debitIdx = type === 'debits' ? findCol([/^debit$/i, /^debits$/i]) : -1
    if (dateIdx >= 0) mapping.transaction_date = dateIdx
    else if (valueDateIdx >= 0) mapping.transaction_date = valueDateIdx
    if (descIdx >= 0) mapping.description = descIdx
    if (creditIdx >= 0) mapping.credit = creditIdx
    if (debitIdx >= 0) mapping.debit = debitIdx
    return mapping
  }

  if (bankFormat === 'nib') {
    const bookingDateIdx = findCol([/^booking date$/i])
    const valueDateIdx = findCol([/^value date$/i])
    const descIdx = findCol([/^description$/i])
    const creditIdx = type === 'credits' ? findCol([/^credit$/i]) : -1
    const debitIdx = type === 'debits' ? findCol([/^debit$/i]) : -1
    if (bookingDateIdx >= 0) mapping.transaction_date = bookingDateIdx
    else if (valueDateIdx >= 0) mapping.transaction_date = valueDateIdx
    if (descIdx >= 0) mapping.description = descIdx
    if (creditIdx >= 0) mapping.credit = creditIdx
    if (debitIdx >= 0) mapping.debit = debitIdx
    return mapping
  }

  if (bankFormat === 'prudential') {
    const txDateIdx = findCol([/^transaction date$/i, /^post date$/i])
    const valueDateIdx = findCol([/^value date$/i])
    const descIdx = findCol([/^description$/i])
    const creditIdx = type === 'credits' ? findCol([/^credit$/i]) : -1
    const debitIdx = type === 'debits' ? findCol([/^debit$/i]) : -1
    if (txDateIdx >= 0) mapping.transaction_date = txDateIdx
    else if (valueDateIdx >= 0) mapping.transaction_date = valueDateIdx
    if (descIdx >= 0) mapping.description = descIdx
    if (creditIdx >= 0) mapping.credit = creditIdx
    if (debitIdx >= 0) mapping.debit = debitIdx
    return mapping
  }

  if (bankFormat === 'stanbic') {
    const txDateIdx = findCol([/^transaction date$/i])
    const valueDateIdx = findCol([/^value date$/i])
    const descIdx = findCol([/^description$/i, /^transaction description$/i])
    const creditIdx = type === 'credits' ? findCol([/^credits?$/, /^credit$/i]) : -1
    const debitIdx = type === 'debits' ? findCol([/^debits?$/, /^debit$/i]) : -1
    if (txDateIdx >= 0) mapping.transaction_date = txDateIdx
    else if (valueDateIdx >= 0) mapping.transaction_date = valueDateIdx
    if (descIdx >= 0) mapping.description = descIdx
    if (creditIdx >= 0) mapping.credit = creditIdx
    if (debitIdx >= 0) mapping.debit = debitIdx
    return mapping
  }

  if (bankFormat === 'uba') {
    const txDateIdx = findCol([/^transaction date$/i])
    const valueDateIdx = findCol([/^value date$/i])
    const descIdx = findCol([/^description$/i, /^narration$/i])
    const creditIdx = type === 'credits' ? findCol([/^credit$/i]) : -1
    const debitIdx = type === 'debits' ? findCol([/^debit$/i]) : -1
    if (txDateIdx >= 0) mapping.transaction_date = txDateIdx
    else if (valueDateIdx >= 0) mapping.transaction_date = valueDateIdx
    if (descIdx >= 0) mapping.description = descIdx
    if (creditIdx >= 0) mapping.credit = creditIdx
    if (debitIdx >= 0) mapping.debit = debitIdx
    return mapping
  }

  if (bankFormat === 'scb') {
    const valueDateIdx = findCol([/^value date$/i])
    const entryDateIdx = findCol([/^entry date$/i])
    const descIdx = findCol([/^description$/i])
    const creditIdx = type === 'credits' ? findCol([/^credits$/i, /^credit$/i]) : -1
    const debitIdx = type === 'debits' ? findCol([/^debits$/i, /^debit$/i]) : -1
    if (valueDateIdx >= 0) mapping.transaction_date = valueDateIdx
    else if (entryDateIdx >= 0) mapping.transaction_date = entryDateIdx
    if (descIdx >= 0) mapping.description = descIdx
    if (creditIdx >= 0) mapping.credit = creditIdx
    if (debitIdx >= 0) mapping.debit = debitIdx
    return mapping
  }

  const dateIdx = findCol([/transaction[\s_-]?date/i, /value\s*date/i, /entry\s*date/i, /post\s*date/i, /date/i])
  const descIdx = findCol([/description/i, /particulars/i, /narrative/i])
  const creditIdx = type === 'credits'
    ? findCol([/^credit$/i, /deposits?/i, /deposit/i, /credit/i, /amount/i])
    : -1
  const debitIdx = type === 'debits'
    ? findCol([/^debit$/i, /payments?/i, /payment/i, /debit/i, /withdrawal/i, /amount/i])
    : -1

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
