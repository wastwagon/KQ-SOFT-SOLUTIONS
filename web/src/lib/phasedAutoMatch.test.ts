import { describe, it, expect } from 'vitest'
import { collectPhasedBulkMatches } from './phasedAutoMatch'
import type { SuggestedMatch } from '../components/reconcile/types'

function sug(
  partial: Partial<SuggestedMatch> & {
    id: string
    confidence: number
    reason: string
  }
): SuggestedMatch {
  return {
    cashBookTx: {
      id: `cb-${partial.id}`,
      date: null,
      name: null,
      details: 'cb',
      amount: 100,
    },
    bankTx: {
      id: `bk-${partial.id}`,
      date: null,
      name: null,
      details: 'bk',
      amount: 100,
    },
    confidence: partial.confidence,
    reason: partial.reason,
    matchKind: partial.matchKind ?? 'payment',
    bankPattern: partial.bankPattern,
    ecobankPattern: partial.ecobankPattern,
    duplicateWarning: partial.duplicateWarning,
  }
}

describe('collectPhasedBulkMatches', () => {
  it('Phase A takes any non-duplicate suggestion at ≥0.90', () => {
    const pairs = collectPhasedBulkMatches(
      [
        sug({ id: '1', confidence: 0.91, reason: 'Amount match', matchKind: 'payment' }),
        sug({ id: '2', confidence: 0.89, reason: 'Amount match', matchKind: 'payment' }),
      ],
      'A'
    )
    expect(pairs).toHaveLength(1)
    expect(pairs[0]!.cashBookTransactionId).toBe('cb-1')
  })

  it('Phase B includes regional bankPattern receipts and payments', () => {
    const pairs = collectPhasedBulkMatches(
      [
        sug({
          id: 'gcb',
          confidence: 0.91,
          reason: 'GCB cash deposit: amount + payee',
          matchKind: 'receipt',
          bankPattern: true,
        }),
        sug({
          id: 'boa',
          confidence: 0.92,
          reason: 'BOA inward cheque: chq/ref + amount',
          matchKind: 'payment',
          bankPattern: true,
        }),
        sug({
          id: 'generic',
          confidence: 0.88,
          reason: 'Amount match',
          matchKind: 'payment',
        }),
      ],
      'B'
    )
    expect(pairs.map((p) => p.cashBookTransactionId).sort()).toEqual(['cb-boa', 'cb-gcb'])
  })

  it('Phase B excludes unique-amount tips below 0.85', () => {
    const pairs = collectPhasedBulkMatches(
      [
        sug({
          id: 'scb',
          confidence: 0.84,
          reason: 'SCB inward clearing: unique amount (ref shifted)',
          matchKind: 'payment',
          bankPattern: true,
        }),
      ],
      'B'
    )
    expect(pairs).toHaveLength(0)
  })

  it('skips duplicateWarning suggestions', () => {
    const pairs = collectPhasedBulkMatches(
      [
        sug({
          id: '1',
          confidence: 0.95,
          reason: 'Amount + date',
          duplicateWarning: true,
        }),
      ],
      'A'
    )
    expect(pairs).toHaveLength(0)
  })
})
