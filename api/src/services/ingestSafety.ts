/**
 * Safe ingest policy: Ghana dedicated parsers keep today’s auto-map behaviour.
 * Unknown PDFs never auto-map. Unrecognised Excel/CSV needs high confidence.
 */
import type { GhanaBankFormat } from './ghanaBankParsers.js'
import type { MappingConfidence } from './suggestedMapping.js'

export const DEDICATED_BANK_PARSE_METHODS = new Set([
  'ecobank_pdf',
  'gcb_pdf',
  'absa_pdf',
  'prudential_pdf',
  'uba_pdf',
  'nib_pdf',
  'adb_pdf',
  'umb_pdf',
  'scb_pdf',
  'ecobank_excel',
])

/** Structured interchange — treat like a known bank for auto-map. */
export const STRUCTURED_PARSE_METHODS = new Set(['ofx', 'mt940', 'camt'])

export function isStructuredParseMethod(method?: string): boolean {
  return Boolean(method && STRUCTURED_PARSE_METHODS.has(method))
}

/** Unrecognised layouts fail closed; Ghana banks and OFX/MT940/CAMT do not block. */
export function checksumShouldBlockOnFailure(
  detectedBankFormat: GhanaBankFormat | null | undefined,
  parseMethod?: string
): boolean {
  return !isKnownBankFormat(detectedBankFormat) && !isStructuredParseMethod(parseMethod)
}

export const UNKNOWN_PDF_PARSE_METHODS = new Set([
  'native_text',
  'ocr',
  'ocr_geometry',
  'image',
])

export type AutoMapSkipReason =
  | 'disabled'
  | 'low_confidence'
  | 'unknown_pdf'
  | 'unknown_requires_high'

export type AutoMapPolicy = {
  detectedBankFormat?: GhanaBankFormat | null
  parseMethod?: string
}

export function isKnownBankFormat(format: GhanaBankFormat | null | undefined): boolean {
  return Boolean(format)
}

export function isTrustedAutoMapSource(policy?: AutoMapPolicy | null): boolean {
  if (!policy) return true
  if (isKnownBankFormat(policy.detectedBankFormat)) return true
  const method = policy.parseMethod || ''
  return DEDICATED_BANK_PARSE_METHODS.has(method) || STRUCTURED_PARSE_METHODS.has(method)
}

export function isUnknownPdfParse(
  parseMethod?: string,
  detectedBankFormat?: GhanaBankFormat | null
): boolean {
  if (isKnownBankFormat(detectedBankFormat)) return false
  if (!parseMethod) return false
  return UNKNOWN_PDF_PARSE_METHODS.has(parseMethod)
}

export function fieldConfidenceAllowsAutoMap(
  confidence: MappingConfidence | undefined,
  requireHigh: boolean
): boolean {
  if (requireHigh) return confidence === 'high'
  return confidence === 'high' || confidence === 'medium'
}

export function autoMapSkipMessage(reason: AutoMapSkipReason): string {
  switch (reason) {
    case 'unknown_pdf':
      return 'This PDF is not a recognised Ghana bank layout. Export Excel, CSV, OFX, MT940, or CAMT.053 from internet banking, or map the columns on this page.'
    case 'unknown_requires_high':
      return 'Date and amount columns are not certain for this bank format. Map them on this page so figures are confirmed before reconciling.'
    case 'low_confidence':
      return 'Date or amount columns are not certain — map them on this page.'
    case 'disabled':
      return 'Automatic mapping is turned off — map columns on this page.'
  }
}

export function resolveAutoMapSkipReason(
  mappedOk: boolean,
  policy?: AutoMapPolicy | null
): AutoMapSkipReason | null {
  if (policy && isUnknownPdfParse(policy.parseMethod, policy.detectedBankFormat)) {
    return 'unknown_pdf'
  }
  if (mappedOk) return null
  return isTrustedAutoMapSource(policy) ? 'low_confidence' : 'unknown_requires_high'
}
