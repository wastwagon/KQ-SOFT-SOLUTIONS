import { describe, expect, it } from 'vitest'
import { collectScbResidualPairs } from './scbResidualMatcher.js'
import type { Tx } from './matching.js'

const tx = (partial: Partial<Tx> & Pick<Tx, 'id' | 'amount'>): Tx => ({
  date: null,
  name: null,
  details: null,
  docRef: null,
  chqNo: null,
  ...partial,
})

describe('collectScbResidualPairs', () => {
  it('pairs SWEEP lines on inverted sides (receipt ↔ debit)', () => {
    const receipts = [
      tx({
        id: 'r1',
        amount: 12767.87,
        date: new Date('2019-11-08'),
        details: 'SWEEP TO ghs 0100106024702',
      }),
    ]
    const debits = [
      tx({
        id: 'd1',
        amount: 12767.87,
        date: new Date('2019-03-29'),
        details: 'SWEEP FROM ghs 0100106024702',
      }),
    ]
    const pairs = collectScbResidualPairs({
      receipts,
      payments: [],
      credits: [],
      debits,
      matchedCbIds: new Set(),
      matchedBankIds: new Set(),
      sideInverted: true,
    })
    expect(pairs).toEqual([{ cashBookTransactionId: 'r1', bankTransactionId: 'd1' }])
  })

  it('pairs duplicate INW CLG rows by ref + amount', () => {
    const receipts = [
      tx({ id: 'r1', amount: 11314.6, details: 'CHQ # 259029 EXPRESS INWARD' }),
      tx({ id: 'r2', amount: 11314.6, details: 'CHQ# 259029 EXPRESS INWARD' }),
    ]
    const debits = [
      tx({ id: 'd1', amount: 11314.6, details: 'CHQ # 259029 EXPRESS INWARD' }),
      tx({ id: 'd2', amount: 11314.6, details: 'CHQ# 259029 EXPRESS INWARD' }),
    ]
    const pairs = collectScbResidualPairs({
      receipts,
      payments: [],
      credits: [],
      debits,
      matchedCbIds: new Set(),
      matchedBankIds: new Set(),
      sideInverted: true,
    })
    expect(pairs).toHaveLength(2)
  })
})
