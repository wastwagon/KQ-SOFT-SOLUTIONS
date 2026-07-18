import { describe, expect, it } from 'vitest'
import {
  inferDocumentFamily,
  remapDocumentTypeToFamily,
} from './documentTypeInference.js'

describe('documentTypeInference', () => {
  it('classifies TGL-style cash book headers as cash book', () => {
    const result = inferDocumentFamily([
      'DATE',
      'NAME',
      'DETAILS',
      'DOC REF',
      'CHQ NO',
      'ACCODE',
      'AMT RECEIVED',
      'AMT PAID',
    ])
    expect(result.family).toBe('cash_book')
    expect(result.confidence).toBe('high')
    expect(result.cashBookScore).toBeGreaterThan(result.bankScore)
  })

  it('classifies debit/credit/balance headers as bank statement', () => {
    const result = inferDocumentFamily([
      'ENTRY DATE',
      'VALUE DATE',
      'DESCRIPTION',
      'DEBITS',
      'CREDITS',
      'BALANCE',
    ])
    expect(result.family).toBe('bank_statement')
    expect(result.confidence).toBe('high')
    expect(result.bankScore).toBeGreaterThan(result.cashBookScore)
  })

  it('stays unknown for generic date/description/amount only', () => {
    const result = inferDocumentFamily(['Date', 'Description', 'Amount'])
    expect(result.family).toBe('unknown')
    expect(result.confidence).toBe('low')
  })

  it('uses parse method as a strong bank signal', () => {
    const result = inferDocumentFamily(['Col_0', 'Col_1', 'Col_2'], {
      parseMethod: 'ecobank_pdf',
    })
    expect(result.family).toBe('bank_statement')
    expect(result.confidence).toMatch(/high|medium/)
  })

  it('remaps type while preserving receipt/payment side', () => {
    expect(remapDocumentTypeToFamily('cash_book_receipts', 'bank_statement')).toBe('bank_credits')
    expect(remapDocumentTypeToFamily('cash_book_payments', 'bank_statement')).toBe('bank_debits')
    expect(remapDocumentTypeToFamily('bank_credits', 'cash_book')).toBe('cash_book_receipts')
    expect(remapDocumentTypeToFamily('bank_debits', 'cash_book')).toBe('cash_book_payments')
  })
})
