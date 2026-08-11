import { describe, expect, it } from 'vitest'
import { buildCountMatchDiagnostic, type CountAmountRow } from './countMatchDiagnostic.js'
import type { Tx } from './matching.js'

function tx(id: string, amount: number): Tx {
  return { id, date: null, name: null, details: null, amount }
}

function keys(rows: CountAmountRow[]): string[] {
  return rows.map((r) => r.amountKey)
}

describe('buildCountMatchDiagnostic', () => {
  it('classifies only-CB, only-bank, open surplus, and batch cancel', () => {
    const out = buildCountMatchDiagnostic({
      receipts: [tx('r1', 100), tx('r2', 100), tx('r3', 50), tx('r4', 25)],
      payments: [tx('p1', 80), tx('p2', 80), tx('p3', 80)],
      receiptBank: [tx('c1', 100), tx('c2', 75)],
      paymentBank: [tx('d1', 80), tx('d2', 80), tx('d3', 80), tx('d4', 40)],
      scope: 'all',
    })

    expect(keys(out.brsDetails.onlyCashBookReceived)).toContain('50.00')
    expect(keys(out.brsDetails.onlyCashBookReceived)).toContain('25.00')
    expect(keys(out.brsDetails.onlyBankLodgments)).toContain('75.00')

    // 100: CB×2 vs bank×1 → CB surplus
    const open100 = out.brsDetails.openReceiptsVsCreditsCbSurplus.find((r) => r.amountKey === '100.00')
    expect(open100?.cashBookCount).toBe(2)
    expect(open100?.bankCount).toBe(1)
    expect(open100?.difference).toBe(1)

    // payments 80×3 vs debits 80×3 → cancel; 40 only bank
    expect(keys(out.cancelSchedule.paymentsEqualsDebits)).toContain('80.00')
    expect(keys(out.brsDetails.onlyBankDebits)).toContain('40.00')
    expect(out.paymentsDebits.summary.batchCancel).toBe(1)
  })

  it('defaults to unmatched scope and excludes matched ids', () => {
    const out = buildCountMatchDiagnostic({
      receipts: [tx('r1', 100), tx('r2', 100)],
      payments: [],
      receiptBank: [tx('c1', 100), tx('c2', 100)],
      paymentBank: [],
      matchedCbIds: new Set(['r1']),
      matchedBankIds: new Set(['c1']),
      scope: 'unmatched',
    })

    const cancel = out.cancelSchedule.receiptsEqualsCredits.find((r) => r.amountKey === '100.00')
    expect(cancel?.cashBookCount).toBe(1)
    expect(cancel?.bankCount).toBe(1)
    expect(cancel?.cashBookTxIds).toEqual(['r2'])
    expect(cancel?.bankTxIds).toEqual(['c2'])
  })

  it('ignores non-positive amounts', () => {
    const out = buildCountMatchDiagnostic({
      receipts: [tx('r0', 0), tx('rNeg', -10), tx('r1', 20)],
      payments: [],
      receiptBank: [tx('c1', 20)],
      paymentBank: [],
      scope: 'all',
    })
    expect(out.receiptsCredits.rows).toHaveLength(1)
    expect(out.receiptsCredits.rows[0]!.amountKey).toBe('20.00')
    expect(out.cancelSchedule.receiptsEqualsCredits).toHaveLength(1)
  })

  it('records invertedSides flag for UI', () => {
    const out = buildCountMatchDiagnostic({
      receipts: [tx('r1', 10)],
      payments: [],
      receiptBank: [tx('d1', 10)],
      paymentBank: [],
      invertedSides: true,
      scope: 'all',
    })
    expect(out.invertedSides).toBe(true)
    expect(out.cancelSchedule.receiptsEqualsCredits).toHaveLength(1)
  })
})
