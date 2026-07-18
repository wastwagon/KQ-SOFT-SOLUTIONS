import { describe, expect, it } from 'vitest'
import { remapDocumentTypeToFamily } from './documentTypeInference.js'

/**
 * changeDocumentType persistence is covered via API + Map UI.
 * Keep the remapping contract locked here so side preservation cannot regress.
 */
describe('changeDocumentType remapping contract', () => {
  it('preserves receipt/credit and payment/debit sides across families', () => {
    expect(remapDocumentTypeToFamily('cash_book_receipts', 'bank_statement')).toBe('bank_credits')
    expect(remapDocumentTypeToFamily('cash_book_payments', 'bank_statement')).toBe('bank_debits')
    expect(remapDocumentTypeToFamily('bank_credits', 'cash_book')).toBe('cash_book_receipts')
    expect(remapDocumentTypeToFamily('bank_debits', 'cash_book')).toBe('cash_book_payments')
  })
})
