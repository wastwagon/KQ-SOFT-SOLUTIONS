import { describe, expect, it } from 'vitest'
import {
  applyDuplicateWarnings,
  clearCorroboratedDuplicateWarnings,
  suggestionClearingRef,
} from './suggestionDuplicateFlags.js'
import type { SuggestedMatch, Tx } from './matching.js'

const tx = (partial: Partial<Tx> & Pick<Tx, 'id' | 'amount'>): Tx => ({
  date: null,
  name: null,
  details: null,
  docRef: null,
  chqNo: null,
  ...partial,
})

const sug = (
  cb: Tx,
  bk: Tx,
  confidence = 0.91,
  duplicateWarning?: boolean
): SuggestedMatch => ({
  cashBookTx: cb,
  bankTx: bk,
  confidence,
  reason: 'test',
  duplicateWarning,
})

describe('suggestionClearingRef', () => {
  it('extracts CHQ # with space before hash', () => {
    expect(
      suggestionClearingRef(
        tx({ id: '1', amount: 1, details: 'CHQ # 484623 INWARD CLEARING INW 0 .' })
      )
    ).toBe('484623')
  })

  it('extracts OT REF', () => {
    expect(
      suggestionClearingRef(
        tx({ id: '1', amount: 1, details: 'OT REF OT00201908090041 TGL PROPERTIES LTD' })
      )
    ).toBe('OT00201908090041')
  })
})

describe('applyDuplicateWarnings', () => {
  it('flags when one cash book matches two bank lines', () => {
    const cb = tx({ id: 'cb1', amount: 100 })
    const list = [sug(cb, tx({ id: 'b1', amount: 100 })), sug(cb, tx({ id: 'b2', amount: 100 }))]
    applyDuplicateWarnings(list)
    expect(list.every((s) => s.duplicateWarning)).toBe(true)
  })
})

describe('clearCorroboratedDuplicateWarnings', () => {
  it('clears duplicateWarning when refs match at high confidence', () => {
    const cb = tx({ id: 'cb1', amount: 2702.04, details: 'CHQ # 484623 INWARD CLEARING' })
    const bk = tx({ id: 'b1', amount: 2702.04, details: 'CHQ # 484623 INWARD CLEARING' })
    const list = [sug(cb, bk, 0.95, true)]
    clearCorroboratedDuplicateWarnings(list)
    expect(list[0]!.duplicateWarning).toBe(false)
  })
})
