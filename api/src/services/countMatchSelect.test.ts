import { describe, expect, it } from 'vitest'
import { COUNT_MATCH_SELECT_CAP, countMatchSelection, leftoverOnlyListKey } from './countMatchSelect.js'

describe('countMatchSelection', () => {
  it('overlap on an open row selects min(CB, bank) on each side and reports leftovers', () => {
    const cb = ['c1', 'c2', 'c3', 'c4', 'c5']
    const bank = ['b1', 'b2', 'b3']
    const out = countMatchSelection(cb, bank, 'overlap')
    expect(out.cashBookTxIds).toEqual(['c1', 'c2', 'c3'])
    expect(out.bankTxIds).toEqual(['b1', 'b2', 'b3'])
    expect(out.overlap).toBe(3)
    expect(out.leftoverCb).toBe(2)
    expect(out.leftoverBank).toBe(0)
    expect(out.capped).toBe(false)
  })

  it('all on an open row keeps the surplus lines', () => {
    const out = countMatchSelection(['c1', 'c2', 'c3'], ['b1'], 'all')
    expect(out.cashBookTxIds).toEqual(['c1', 'c2', 'c3'])
    expect(out.bankTxIds).toEqual(['b1'])
    expect(out.overlap).toBe(1)
    expect(out.leftoverCb).toBe(2)
  })

  it('overlap on a cancel row equals all lines', () => {
    const ids = ['a', 'b', 'c']
    const out = countMatchSelection(ids, [...ids], 'overlap')
    expect(out.cashBookTxIds).toEqual(ids)
    expect(out.bankTxIds).toEqual(ids)
    expect(out.leftoverCb).toBe(0)
    expect(out.leftoverBank).toBe(0)
  })

  it('overlap on an only-CB row selects nothing on either side', () => {
    const out = countMatchSelection(['c1', 'c2'], [], 'overlap')
    expect(out.cashBookTxIds).toEqual([])
    expect(out.bankTxIds).toEqual([])
    expect(out.overlap).toBe(0)
    expect(out.leftoverCb).toBe(2)
  })

  it('caps each side at the bulk-match limit', () => {
    const cb = Array.from({ length: COUNT_MATCH_SELECT_CAP + 4 }, (_, i) => `c${i}`)
    const bank = Array.from({ length: COUNT_MATCH_SELECT_CAP + 2 }, (_, i) => `b${i}`)
    const overlap = countMatchSelection(cb, bank, 'overlap')
    expect(overlap.cashBookTxIds).toHaveLength(COUNT_MATCH_SELECT_CAP)
    expect(overlap.bankTxIds).toHaveLength(COUNT_MATCH_SELECT_CAP)
    expect(overlap.capped).toBe(true)
    const all = countMatchSelection(cb, bank, 'all')
    expect(all.cashBookTxIds).toHaveLength(COUNT_MATCH_SELECT_CAP)
    expect(all.bankTxIds).toHaveLength(COUNT_MATCH_SELECT_CAP)
    expect(all.capped).toBe(true)
  })
})

describe('leftoverOnlyListKey', () => {
  it('sends CB surplus leftovers to Only CB on that lane', () => {
    expect(leftoverOnlyListKey('open_recv_cb', 2, 0)).toBe('only_cb_received')
    expect(leftoverOnlyListKey('open_pay_cb', 1, 0)).toBe('only_cb_payment')
  })

  it('sends bank surplus leftovers to Only bank on that lane', () => {
    expect(leftoverOnlyListKey('open_recv_bank', 0, 2)).toBe('only_bank_lodgment')
    expect(leftoverOnlyListKey('open_pay_bank', 0, 4)).toBe('only_bank_debits')
  })

  it('returns null when there is no leftover or the list is not Open', () => {
    expect(leftoverOnlyListKey('open_recv_cb', 0, 0)).toBeNull()
    expect(leftoverOnlyListKey('cancel_recv', 2, 0)).toBeNull()
  })
})
