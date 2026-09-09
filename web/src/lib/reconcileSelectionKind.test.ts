import { describe, expect, it } from 'vitest'
import { reconcileSelectionKind } from './reconcileSelectionKind'

const ids = {
  receipts: new Set(['r1', 'r2']),
  payments: new Set(['p1']),
  credits: new Set(['c1']),
  debits: new Set(['d1']),
}

describe('reconcileSelectionKind', () => {
  it('returns receipts for receipt × credit selections', () => {
    expect(reconcileSelectionKind(['r1', 'r2'], ['c1'], ids)).toBe('receipts')
  })

  it('returns payments for payment × debit selections', () => {
    expect(reconcileSelectionKind(['p1'], ['d1'], ids)).toBe('payments')
  })

  it('returns null when sides are mixed or empty', () => {
    expect(reconcileSelectionKind(['r1'], ['d1'], ids)).toBeNull()
    expect(reconcileSelectionKind(['r1', 'p1'], ['c1'], ids)).toBeNull()
    expect(reconcileSelectionKind([], ['c1'], ids)).toBeNull()
  })
})
