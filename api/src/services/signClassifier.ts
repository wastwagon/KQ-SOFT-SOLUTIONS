export type SourceDocumentType =
  | 'cash_book_receipts'
  | 'cash_book_payments'
  | 'bank_debits'
  | 'bank_credits'

export type SignBucket = 'primary' | 'cross_reference' | 'zero' | 'empty'

export interface SignClassification {
  source: SourceDocumentType
  amount: number | null
  bucket: SignBucket
  note: string
}

/**
 * Applies the source-document sign matrix from the BRS rulebook.
 * - primary: expected sign for the source stream
 * - cross_reference: opposite sign, should be reviewed against paired source
 * - zero: amount is exactly 0, route to separate review report
 * - empty: null/NaN amount
 */
export function classifyBySourceSign(source: SourceDocumentType, amount: unknown): SignClassification {
  const parsed = typeof amount === 'number' ? amount : Number(amount)
  if (!Number.isFinite(parsed)) {
    return { source, amount: null, bucket: 'empty', note: 'Amount missing or invalid' }
  }
  if (parsed === 0) {
    return { source, amount: 0, bucket: 'zero', note: 'Zero amount; send to separate review report' }
  }

  const isPositive = parsed > 0
  if (isPositive) {
    return { source, amount: parsed, bucket: 'primary', note: 'Expected sign for source document' }
  }

  const crossNotes: Record<SourceDocumentType, string> = {
    cash_book_receipts: 'Negative receipt; review against bank credits',
    cash_book_payments: 'Negative payment; review against bank debits',
    bank_debits: 'Negative bank debit; review against cash book payments',
    bank_credits: 'Negative bank credit; review against cash book receipts',
  }
  return { source, amount: parsed, bucket: 'cross_reference', note: crossNotes[source] }
}

export function summarizeSignBuckets(source: SourceDocumentType, amounts: number[]): Record<SignBucket, number> {
  const summary: Record<SignBucket, number> = {
    primary: 0,
    cross_reference: 0,
    zero: 0,
    empty: 0,
  }
  for (const amount of amounts) {
    const classification = classifyBySourceSign(source, amount)
    summary[classification.bucket] += 1
  }
  return summary
}
