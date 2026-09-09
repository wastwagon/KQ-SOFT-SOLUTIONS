import { describe, expect, it } from 'vitest'
import { canAutoMap, buildSuggestedMappingForDocument } from './autoMapDocument.js'
import {
  isTrustedAutoMapSource,
  isUnknownPdfParse,
  resolveAutoMapSkipReason,
  autoMapSkipMessage,
  checksumShouldBlockOnFailure,
} from './ingestSafety.js'

describe('ingest safety auto-map policy', () => {
  const headers = ['Transaction Date', 'Description', 'Credit', 'Debit']
  const suggested = buildSuggestedMappingForDocument('bank_credits', headers, 'ecobank')

  it('keeps medium-confidence auto-map for recognised Ghana banks', () => {
    expect(
      canAutoMap('bank_credits', headers, suggested, [], {
        detectedBankFormat: 'ecobank',
        parseMethod: 'ecobank_pdf',
      })
    ).toBe(true)
  })

  it('never auto-maps an unknown PDF/OCR layout', () => {
    expect(isUnknownPdfParse('ocr', null)).toBe(true)
    expect(
      canAutoMap('bank_credits', headers, suggested, [], {
        detectedBankFormat: null,
        parseMethod: 'ocr',
      })
    ).toBe(false)
    expect(
      resolveAutoMapSkipReason(false, { detectedBankFormat: null, parseMethod: 'ocr' })
    ).toBe('unknown_pdf')
    expect(autoMapSkipMessage('unknown_pdf')).toMatch(/OFX, MT940, or CAMT/)
  })

  it('treats OFX as a trusted structured source', () => {
    expect(isTrustedAutoMapSource({ parseMethod: 'ofx', detectedBankFormat: null })).toBe(true)
    expect(
      canAutoMap('bank_credits', headers, suggested, [], {
        detectedBankFormat: null,
        parseMethod: 'ofx',
      })
    ).toBe(true)
  })

  it('treats MT940 and CAMT as trusted structured sources', () => {
    expect(isTrustedAutoMapSource({ parseMethod: 'mt940', detectedBankFormat: null })).toBe(true)
    expect(isTrustedAutoMapSource({ parseMethod: 'camt', detectedBankFormat: null })).toBe(true)
    expect(
      canAutoMap('bank_credits', headers, suggested, [], {
        detectedBankFormat: null,
        parseMethod: 'mt940',
      })
    ).toBe(true)
    expect(
      canAutoMap('bank_credits', headers, suggested, [], {
        detectedBankFormat: null,
        parseMethod: 'camt',
      })
    ).toBe(true)
  })

  it('does not change cash-book auto-map when policy would flag a PDF', () => {
    const cbHeaders = ['Date', 'Name', 'Amt Received', 'Amt Paid']
    const cb = buildSuggestedMappingForDocument('cash_book_receipts', cbHeaders, null)
    expect(
      canAutoMap('cash_book_receipts', cbHeaders, cb, [], {
        detectedBankFormat: null,
        parseMethod: 'ocr',
      })
    ).toBe(true)
  })

  it('does not block reconcile checksum on Ghana banks or structured files', () => {
    expect(checksumShouldBlockOnFailure('ecobank', 'excel')).toBe(false)
    expect(checksumShouldBlockOnFailure(null, 'ofx')).toBe(false)
    expect(checksumShouldBlockOnFailure(null, 'mt940')).toBe(false)
    expect(checksumShouldBlockOnFailure(null, 'camt')).toBe(false)
    expect(checksumShouldBlockOnFailure(null, 'excel')).toBe(true)
    expect(checksumShouldBlockOnFailure(null, 'ocr')).toBe(true)
  })
})
