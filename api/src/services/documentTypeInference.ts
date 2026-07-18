/**
 * Infer whether a parsed table looks like a cash book vs a bank statement.
 * Used to auto-correct misfiled uploads (wrong upload card) before mapping.
 */
import type { DocumentType } from '@prisma/client'
import { detectGhanaBankFormat } from './ghanaBankParsers.js'
import { normHeader } from './suggestedMapping.js'

export type DocumentFamily = 'cash_book' | 'bank_statement' | 'unknown'
export type InferenceConfidence = 'high' | 'medium' | 'low'

export type DocumentTypeInference = {
  family: DocumentFamily
  confidence: InferenceConfidence
  cashBookScore: number
  bankScore: number
  reasons: string[]
}

const CASH_HEADER =
  /\b(amt\s*received|amt\s*paid|amount\s*received|amount\s*paid|fc\s*amt\s*(received|paid)|accode|account\s*code|doc\s*ref|voucher|payee|money\s*in|money\s*out|cash\s*book|cashbook|tgl\s*account)\b/i

const BANK_HEADER =
  /\b(debit|credit|debits|credits|balance|value\s*date|entry\s*date|posting\s*date|trans(?:action)?\.?\s*date|statement|withdrawal|deposit)\b/i

function headerHits(headers: string[], re: RegExp): string[] {
  return headers.map((h) => String(h ?? '').trim()).filter((h) => h && re.test(normHeader(h) || h))
}

function hasPair(headers: string[], a: RegExp, b: RegExp): boolean {
  const norms = headers.map((h) => normHeader(String(h ?? '')))
  return norms.some((h) => a.test(h)) && norms.some((h) => b.test(h))
}

/**
 * Score headers (and light row/context signals) for cash-book vs bank-statement family.
 */
export function inferDocumentFamily(
  headers: string[],
  options: {
    sampleRows?: unknown[][]
    parseMethod?: string | null
    filename?: string | null
  } = {}
): DocumentTypeInference {
  const reasons: string[] = []
  let cash = 0
  let bank = 0

  const cashHits = headerHits(headers, CASH_HEADER)
  const bankHits = headerHits(headers, BANK_HEADER)
  cash += cashHits.length * 12
  bank += bankHits.length * 10
  if (cashHits.length) reasons.push(`cash headers: ${cashHits.slice(0, 4).join(', ')}`)
  if (bankHits.length) reasons.push(`bank headers: ${bankHits.slice(0, 4).join(', ')}`)

  // Strong cash-book column pairs
  if (hasPair(headers, /amt\s*received|amount\s*received|money\s*in|receipt/, /amt\s*paid|amount\s*paid|money\s*out|payment/)) {
    cash += 35
    reasons.push('receipt + payment amount columns')
  }
  if (headers.some((h) => /^(fc\s*)?amt\s*(received|paid)$/i.test(normHeader(String(h))))) {
    cash += 20
  }
  if (headers.some((h) => /^accode$|account\s*code|tgl\s*account/i.test(normHeader(String(h))))) {
    cash += 18
    reasons.push('account/TGL code column')
  }
  if (headers.some((h) => /^doc\s*ref$|^voucher/i.test(normHeader(String(h))))) {
    cash += 10
  }

  // Strong bank statement signals
  if (hasPair(headers, /^debits?$/, /^credits?$/)) {
    bank += 40
    reasons.push('debit + credit columns')
  }
  if (headers.some((h) => /^balance$/i.test(normHeader(String(h))))) {
    bank += 18
    reasons.push('running balance column')
  }
  if (headers.some((h) => /value\s*date|entry\s*date|posting\s*date/i.test(normHeader(String(h))))) {
    bank += 12
  }

  const bankFormat = detectGhanaBankFormat(headers, options.sampleRows || [])
  // detectGhanaBankFormat can false-positive on generic Date/Description layouts —
  // only trust it when headers already look bank-like.
  if (
    bankFormat &&
    (hasPair(headers, /debit/, /credit/) ||
      headers.some((h) => /^balance$/i.test(normHeader(String(h)))) ||
      bankHits.length >= 2)
  ) {
    bank += 45
    reasons.push(`detected bank format: ${bankFormat}`)
  }

  const method = (options.parseMethod || '').toLowerCase()
  if (/_pdf$/.test(method) && method !== 'native_text') {
    // Dedicated bank PDF parsers
    if (/ecobank|gcb|absa|prudential|uba|nib|adb|umb/.test(method)) {
      bank += 50
      reasons.push(`parse method ${method}`)
    }
  }

  const name = (options.filename || '').toLowerCase()
  if (/cash\s*b(oo)?k|cashbk|cashbook/.test(name)) {
    cash += 15
    reasons.push('filename suggests cash book')
  }
  if (/bank\s*statement|statement|stmt/.test(name) && !/cash/.test(name)) {
    bank += 12
    reasons.push('filename suggests bank statement')
  }

  // Generic date+description+amount alone is ambiguous — do not force a winner.
  const onlyGeneric =
    cash < 25 &&
    bank < 25 &&
    headers.some((h) => /^date|transaction/i.test(normHeader(String(h)))) &&
    headers.some((h) => /description|narration|particulars|details/i.test(normHeader(String(h))))

  let family: DocumentFamily = 'unknown'
  let confidence: InferenceConfidence = 'low'

  const margin = Math.abs(cash - bank)
  if (cash >= 30 || bank >= 30) {
    if (cash > bank + 12) {
      family = 'cash_book'
      confidence = cash >= 50 && margin >= 20 ? 'high' : cash >= 35 && margin >= 12 ? 'medium' : 'low'
    } else if (bank > cash + 12) {
      family = 'bank_statement'
      confidence = bank >= 50 && margin >= 20 ? 'high' : bank >= 35 && margin >= 12 ? 'medium' : 'low'
    }
  }

  if (onlyGeneric && family === 'unknown') {
    reasons.push('only generic date/description columns — family unclear')
  }

  return {
    family,
    confidence,
    cashBookScore: cash,
    bankScore: bank,
    reasons: reasons.slice(0, 6),
  }
}

/** Map receipts↔credits and payments↔debits when correcting family. */
export function remapDocumentTypeToFamily(
  current: DocumentType,
  family: 'cash_book' | 'bank_statement'
): DocumentType {
  const isReceiptSide =
    current === 'cash_book_receipts' || current === 'bank_credits'
  if (family === 'cash_book') {
    return isReceiptSide ? 'cash_book_receipts' : 'cash_book_payments'
  }
  return isReceiptSide ? 'bank_credits' : 'bank_debits'
}

export function documentFamilyOf(type: DocumentType): DocumentFamily {
  return type.startsWith('cash_book_') ? 'cash_book' : 'bank_statement'
}

export function familyLabel(family: DocumentFamily): string {
  if (family === 'cash_book') return 'cash book'
  if (family === 'bank_statement') return 'bank statement'
  return 'unknown'
}
