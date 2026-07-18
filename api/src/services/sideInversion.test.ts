import { describe, expect, it } from 'vitest'
import { detectCashBookBankSideInversion, resolveMatchSides } from './sideInversion.js'
import type { Tx } from './matching.js'
import { buildSmartSuggestedMapping } from './suggestedMapping.js'

function tx(id: string, amount: number): Tx {
  return { id, date: null, name: null, details: null, amount }
}

describe('detectCashBookBankSideInversion', () => {
  it('detects inverted SCB/TGL-style cash books', () => {
    const receipts = [100, 200, 300, 400, 500, 600].map((a, i) => tx(`r${i}`, a))
    const payments = [10, 20, 30, 40, 50, 60].map((a, i) => tx(`p${i}`, a))
    const debits = [100, 200, 300, 400, 500, 600].map((a, i) => tx(`d${i}`, a))
    const credits = [10, 20, 30, 40, 50, 60].map((a, i) => tx(`c${i}`, a))
    const result = detectCashBookBankSideInversion({ receipts, payments, credits, debits })
    expect(result.inverted).toBe(true)
    expect(result.crossedOverlap).toBeGreaterThan(result.standardOverlap)
  })

  it('keeps standard pairing when normal overlap wins', () => {
    const receipts = [100, 200, 300, 400, 500].map((a, i) => tx(`r${i}`, a))
    const payments = [10, 20, 30, 40, 50].map((a, i) => tx(`p${i}`, a))
    const credits = [100, 200, 300, 400, 500].map((a, i) => tx(`c${i}`, a))
    const debits = [10, 20, 30, 40, 50].map((a, i) => tx(`d${i}`, a))
    const result = detectCashBookBankSideInversion({ receipts, payments, credits, debits })
    expect(result.inverted).toBe(false)
  })

  it('resolveMatchSides swaps bank pools when inverted', () => {
    const receipts = [100, 200, 300, 400, 500, 600].map((a, i) => tx(`r${i}`, a))
    const payments = [10, 20, 30, 40, 50, 60].map((a, i) => tx(`p${i}`, a))
    const debits = [100, 200, 300, 400, 500, 600].map((a, i) => tx(`d${i}`, a))
    const credits = [10, 20, 30, 40, 50, 60].map((a, i) => tx(`c${i}`, a))
    const resolved = resolveMatchSides({ receipts, payments, credits, debits })
    expect(resolved.inversion.inverted).toBe(true)
    expect(resolved.receiptBank).toBe(debits)
    expect(resolved.paymentBank).toBe(credits)
  })
})

describe('suggestedMapping Trans. Date / Remarks', () => {
  it('prefers Trans. Date over Value Date and Remarks over Referenc', () => {
    const headers = ['Trans. Date', 'Value Date', 'Referenc', 'Debits', 'Credits', 'Remarks']
    const map = buildSmartSuggestedMapping(headers, false)
    expect(map.transaction_date).toBe(0)
    expect(map.description).toBe(5)
  })
})
