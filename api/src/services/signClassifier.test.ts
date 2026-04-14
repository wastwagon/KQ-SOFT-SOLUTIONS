import { describe, it, expect } from 'vitest'
import { classifyBySourceSign, summarizeSignBuckets } from './signClassifier.js'

describe('classifyBySourceSign', () => {
  it('classifies positive amounts as primary', () => {
    const c = classifyBySourceSign('cash_book_receipts', 1200)
    expect(c.bucket).toBe('primary')
  })

  it('classifies negative amounts as cross_reference with source-specific note', () => {
    const c = classifyBySourceSign('bank_credits', -45)
    expect(c.bucket).toBe('cross_reference')
    expect(c.note.toLowerCase()).toContain('cash book receipts')
  })

  it('classifies zero as zero bucket', () => {
    const c = classifyBySourceSign('cash_book_payments', 0)
    expect(c.bucket).toBe('zero')
  })

  it('classifies invalid amounts as empty bucket', () => {
    const c = classifyBySourceSign('bank_debits', Number.NaN)
    expect(c.bucket).toBe('empty')
  })
})

describe('summarizeSignBuckets', () => {
  it('summarizes buckets across values', () => {
    const s = summarizeSignBuckets('cash_book_receipts', [100, -10, 0])
    expect(s.primary).toBe(1)
    expect(s.cross_reference).toBe(1)
    expect(s.zero).toBe(1)
    expect(s.empty).toBe(0)
  })
})
