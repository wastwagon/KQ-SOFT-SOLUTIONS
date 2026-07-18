import { describe, expect, it } from 'vitest'
import {
  applyLearnedFieldMapping,
  fieldMappingFromIndices,
  fingerprintHeaders,
  mergeLearnedMapping,
  pickBestLayoutCandidate,
  scoreHeaderSimilarity,
} from './documentLayoutMemory.js'

describe('documentLayoutMemory', () => {
  it('fingerprints headers stably', () => {
    expect(fingerprintHeaders(['Txn Date', 'Narration', 'Credit'])).toBe(
      'txn date|narration|credit'
    )
    expect(fingerprintHeaders(['Txn  Date', 'NARRATION', 'Credit'])).toBe(
      fingerprintHeaders(['txn date', 'narration', 'credit'])
    )
  })

  it('scores similar header sets highly', () => {
    const a = ['Date', 'Particulars', 'Debit', 'Credit', 'Balance']
    const b = ['Date', 'Particulars', 'Debit Amt', 'Credit Amt', 'Balance']
    expect(scoreHeaderSimilarity(a, b)).toBeGreaterThan(0.7)
    expect(scoreHeaderSimilarity(a, ['Foo', 'Bar', 'Baz'])).toBeLessThan(0.3)
  })

  it('round-trips field mapping via header names', () => {
    const headers = ['Posting Date', 'Details', 'Money In', 'Money Out']
    const mapping = { date: 0, details: 1, amt_received: 2, amt_paid: 3 }
    const byName = fieldMappingFromIndices(headers, mapping)
    expect(byName).toEqual({
      date: 'Posting Date',
      details: 'Details',
      amt_received: 'Money In',
      amt_paid: 'Money Out',
    })
    // Same layout, columns reordered
    const reordered = ['Money Out', 'Posting Date', 'Money In', 'Details']
    const applied = applyLearnedFieldMapping(reordered, byName)
    expect(applied.date).toBe(1)
    expect(applied.details).toBe(3)
    expect(applied.amt_received).toBe(2)
    expect(applied.amt_paid).toBe(0)
  })

  it('soft-merge fills missing fields only; exact overwrites conflicts', () => {
    const soft = mergeLearnedMapping(
      { date: 0, amt_received: 2 },
      { date: 1, details: 3 }
    )
    expect(soft.mapping.date).toBe(0)
    expect(soft.mapping.amt_received).toBe(2)
    expect(soft.mapping.details).toBe(3)
    expect(soft.appliedFields).toEqual(['details'])

    const exact = mergeLearnedMapping(
      { date: 0, amt_received: 2 },
      { date: 1, details: 3 },
      { overwriteConflicts: true }
    )
    expect(exact.mapping.date).toBe(1)
    expect(exact.mapping.details).toBe(3)
    expect(exact.appliedFields).toEqual(expect.arrayContaining(['date', 'details']))
  })

  it('picks exact fingerprint over soft match', () => {
    const headers = ['Date', 'Narration', 'Credit']
    const fp = fingerprintHeaders(headers)
    const best = pickBestLayoutCandidate(headers, [
      {
        id: 'soft',
        headerFingerprint: 'date|details|credit',
        headerSignature: ['Date', 'Details', 'Credit'],
        fieldMapping: { transaction_date: 'Date' },
        useCount: 99,
      },
      {
        id: 'exact',
        headerFingerprint: fp,
        headerSignature: headers,
        fieldMapping: { transaction_date: 'Date', credit: 'Credit' },
        useCount: 1,
      },
    ])
    expect(best?.id).toBe('exact')
    expect(best?.exact).toBe(true)
  })

  it('soft-matches when headers overlap enough', () => {
    const headers = ['Txn Date', 'Narrative Text', 'Credit Amount', 'Debit Amount']
    const best = pickBestLayoutCandidate(headers, [
      {
        id: 'mem',
        headerFingerprint: 'txn date|narrative|credit amount|debit amount',
        headerSignature: ['Txn Date', 'Narrative', 'Credit Amount', 'Debit Amount'],
        fieldMapping: {
          transaction_date: 'Txn Date',
          description: 'Narrative',
          credit: 'Credit Amount',
          debit: 'Debit Amount',
        },
        useCount: 3,
      },
    ])
    expect(best?.id).toBe('mem')
    expect(best?.exact).toBe(false)
    expect(best!.similarity).toBeGreaterThanOrEqual(0.72)
  })
})
