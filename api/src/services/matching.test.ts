import { describe, it, expect } from 'vitest'
import {
  suggestMatches,
  suggestSplitMatches,
  descriptionSimilarity,
  findSummingSubsets,
  type Tx,
} from './matching.js'

function tx(
  id: string,
  amount: number,
  date?: string,
  details?: string,
  chqNo?: string
): Tx {
  return {
    id,
    date: date ? new Date(date) : null,
    name: null,
    details: details ?? null,
    amount,
    chqNo: chqNo ?? null,
  }
}

describe('suggestMatches', () => {
  it('matches on amount and date', () => {
    const cb = [tx('cb1', 1000, '2025-01-15', 'Payment to supplier')]
    const bank = [tx('bk1', 1000, '2025-01-16', 'Payment received')]
    const result = suggestMatches(cb, bank, new Set(), new Set())
    expect(result).toHaveLength(1)
    expect(result[0].confidence).toBeGreaterThanOrEqual(0.89)
    expect(result[0].reason).toContain('date')
  })

  it('matches on amount only when date outside window', () => {
    const cb = [tx('cb1', 500, '2025-01-01', 'Receipt')]
    const bank = [tx('bk1', 500, '2025-01-15', 'Deposit')]
    const result = suggestMatches(cb, bank, new Set(), new Set())
    expect(result).toHaveLength(1)
    expect(result[0].confidence).toBe(0.6)
    expect(result[0].reason).toBe('Amount match')
  })

  it('enforces amount+date when requireDateMatch is enabled', () => {
    const cb = [tx('cb1', 500, '2025-01-01', 'Receipt')]
    const bank = [tx('bk1', 500, '2025-01-15', 'Deposit')]
    const result = suggestMatches(cb, bank, new Set(), new Set(), { requireDateMatch: true })
    expect(result).toHaveLength(0)
  })

  it('boosts confidence when chqNo matches', () => {
    const cb = [tx('cb1', 640, '2025-01-09', 'Philip Akuffo', '002038')]
    const bank = [tx('bk1', 640, '2025-01-09', 'CHEQUE WITHDRAWAL CHQ NO 002038 PAID TO AKUFFO')]
    const result = suggestMatches(cb, bank, new Set(), new Set())
    expect(result).toHaveLength(1)
    expect(result[0].confidence).toBe(1)
    expect(result[0].reason).toContain('chq/ref')
  })

  it('matches truncated cheque references (suffix match)', () => {
    const cb = [tx('cb1', 1000, '2025-01-15', 'Supplier payment', '122347')]
    const bank = [tx('bk1', 1000, '2025-01-15', 'john chq no. 347')]
    const result = suggestMatches(cb, bank, new Set(), new Set())
    expect(result).toHaveLength(1)
    expect(result[0].reason).toContain('chq/ref')
  })

  it('excludes already matched transactions', () => {
    const cb = [tx('cb1', 1000, '2025-01-15'), tx('cb2', 2000, '2025-01-15')]
    const bank = [tx('bk1', 1000, '2025-01-15'), tx('bk2', 2000, '2025-01-15')]
    const result = suggestMatches(cb, bank, new Set(['cb1']), new Set(['bk1']))
    expect(result).toHaveLength(1)
    expect(result[0].cashBookTx.id).toBe('cb2')
    expect(result[0].bankTx.id).toBe('bk2')
  })

  it('does not match when amount differs beyond tolerance', () => {
    const cb = [tx('cb1', 1000)]
    const bank = [tx('bk1', 1005)]
    const result = suggestMatches(cb, bank, new Set(), new Set())
    expect(result).toHaveLength(0)
  })

  it('flags duplicateWarning when multiple bank txns match same cash book', () => {
    const cb = [tx('cb1', 1000, '2025-01-15', 'Payment')]
    const bank = [
      tx('bk1', 1000, '2025-01-15', 'Payment A'),
      tx('bk2', 1000, '2025-01-15', 'Payment B'),
    ]
    const result = suggestMatches(cb, bank, new Set(), new Set())
    expect(result).toHaveLength(2)
    expect(result.every((s) => s.duplicateWarning === true)).toBe(true)
  })

  it('does not flag duplicateWarning when only one bank txn matches', () => {
    const cb = [tx('cb1', 1000, '2025-01-15', 'Payment')]
    const bank = [tx('bk1', 1000, '2025-01-15', 'Payment A')]
    const result = suggestMatches(cb, bank, new Set(), new Set())
    expect(result).toHaveLength(1)
    expect(result[0].duplicateWarning).toBeUndefined()
  })

  it('blocks ambiguous duplicate cash-book candidates for one bank txn', () => {
    const cb = [
      tx('cb1', 1000, '2025-01-15', 'Payment Alpha'),
      tx('cb2', 1000, '2025-01-15', 'Payment Beta'),
    ]
    const bank = [tx('bk1', 1000, '2025-01-15', 'Generic payment')]
    const result = suggestMatches(cb, bank, new Set(), new Set())
    expect(result).toHaveLength(0)
  })

  it('keeps unique ref/chq tie-break candidate when duplicates exist', () => {
    const cb = [
      tx('cb1', 1000, '2025-01-15', 'Supplier payment', '12345'),
      tx('cb2', 1000, '2025-01-15', 'Supplier payment', '67890'),
    ]
    const bank = [tx('bk1', 1000, '2025-01-15', 'CHQ 12345 supplier payment')]
    const result = suggestMatches(cb, bank, new Set(), new Set())
    expect(result).toHaveLength(1)
    expect(result[0].cashBookTx.id).toBe('cb1')
  })

  it('keeps unique date-window tie-break candidate when duplicates exist', () => {
    const cb = [
      tx('cb1', 1000, '2025-01-15', 'Transfer A'),
      tx('cb2', 1000, '2025-02-20', 'Transfer B'),
    ]
    const bank = [tx('bk1', 1000, '2025-01-15', 'Transfer')]
    const result = suggestMatches(cb, bank, new Set(), new Set())
    expect(result).toHaveLength(1)
    expect(result[0].cashBookTx.id).toBe('cb1')
  })

  it('matches amounts within tolerance when date corroborates', () => {
    const cb = [tx('cb1', 500.0, '2025-01-15', 'Vendor payment')]
    const bank = [tx('bk1', 500.05, '2025-01-15', 'Vendor payment')]
    const result = suggestMatches(cb, bank, new Set(), new Set(), { amountTolerance: 0.1 })
    expect(result).toHaveLength(1)
    expect(result[0].reason).toContain('within tolerance')
    expect(result[0].reason).toContain('0.05')
  })

  it('matches one-cent difference at the default tolerance', () => {
    const cb = [tx('cb1', 1000.0, '2025-01-15', 'Supplier')]
    const bank = [tx('bk1', 1000.01, '2025-01-15', 'Supplier')]
    const result = suggestMatches(cb, bank, new Set(), new Set())
    expect(result).toHaveLength(1)
  })

  it('rejects within-tolerance amounts without date or ref corroboration', () => {
    const cb = [tx('cb1', 500.0, '2025-01-01', 'Receipt')]
    const bank = [tx('bk1', 500.05, '2025-03-15', 'Deposit')]
    const result = suggestMatches(cb, bank, new Set(), new Set(), { amountTolerance: 0.1 })
    expect(result).toHaveLength(0)
  })

  it('matches reordered narrations via fuzzy description scoring', () => {
    const cb = [tx('cb1', 750, '2025-01-10', 'Transfer to Kofi Mensah')]
    const bank = [tx('bk1', 750, '2025-01-11', 'KOFI MENSAH TRF')]
    const result = suggestMatches(cb, bank, new Set(), new Set())
    expect(result).toHaveLength(1)
    expect(result[0].reason).toContain('description')
    expect(result[0].confidence).toBeGreaterThan(0.9)
  })

  it('tie-breaks ambiguous candidates using narration similarity', () => {
    const cb = [
      tx('cb1', 1000, '2025-01-15', 'Salary Ama Owusu'),
      tx('cb2', 1000, '2025-01-15', 'Rent office premises'),
    ]
    const bank = [tx('bk1', 1000, '2025-01-15', 'AMA OWUSU SALARY CREDIT')]
    const result = suggestMatches(cb, bank, new Set(), new Set())
    expect(result).toHaveLength(1)
    expect(result[0].cashBookTx.id).toBe('cb1')
  })
})

describe('descriptionSimilarity', () => {
  it('scores identical narrations at 1', () => {
    expect(descriptionSimilarity('Kofi Mensah salary', 'Kofi Mensah salary')).toBe(1)
  })

  it('ignores word order and noise words', () => {
    const score = descriptionSimilarity('TRANSFER TO KOFI MENSAH', 'KOFI MENSAH TRF')
    expect(score).toBe(1)
  })

  it('scores unrelated narrations at 0', () => {
    expect(descriptionSimilarity('Fuel purchase', 'Salary credit')).toBe(0)
  })

  it('returns 0 when either side is empty or noise-only', () => {
    expect(descriptionSimilarity('', 'Kofi Mensah')).toBe(0)
    expect(descriptionSimilarity('TRF PAYMENT', 'Kofi Mensah')).toBe(0)
  })

  it('scores partial containment above the description threshold', () => {
    const score = descriptionSimilarity('Kofi Mensah', 'CHQ 002038 PAID TO KOFI MENSAH ACCRA BRANCH')
    expect(score).toBeGreaterThanOrEqual(0.5)
  })
})

describe('findSummingSubsets', () => {
  it('finds non-adjacent combinations that sum to the target', () => {
    const items = [
      tx('a', 100, '2025-01-15'),
      tx('b', 50, '2025-01-15'),
      tx('c', 200, '2025-01-15'),
    ]
    const subsets = findSummingSubsets(items, 300, 0.01)
    expect(subsets.length).toBeGreaterThanOrEqual(1)
    const ids = subsets[0]!.map((t) => t.id).sort()
    expect(ids).toEqual(['a', 'c'])
  })

  it('returns empty when no combination reaches the target', () => {
    const items = [tx('a', 10), tx('b', 20), tx('c', 30)]
    expect(findSummingSubsets(items, 1000, 0.01)).toEqual([])
  })
})

describe('suggestSplitMatches', () => {
  it('suggests one-to-many for a deposit covering non-adjacent bank credits', () => {
    const cb = [tx('cb1', 300, '2025-01-15', 'Customer deposit')]
    const bank = [
      tx('bk1', 100, '2025-01-15', 'Partial clear 1'),
      tx('bk2', 50, '2025-01-15', 'Unrelated fee'),
      tx('bk3', 200, '2025-01-16', 'Partial clear 2'),
    ]
    const result = suggestSplitMatches(cb, bank, new Set(), new Set())
    expect(result.length).toBeGreaterThanOrEqual(1)
    const hit = result.find((s) => s.cashBookTxs[0]?.id === 'cb1')
    expect(hit).toBeTruthy()
    expect(hit!.bankTxs.map((t) => t.id).sort()).toEqual(['bk1', 'bk3'])
    expect(hit!.reason).toContain('One-to-many')
  })

  it('suggests many-to-one for cheques cleared as one bulk debit', () => {
    const cb = [
      tx('cb1', 400, '2025-01-10', 'Supplier A', '1001'),
      tx('cb2', 250, '2025-01-11', 'Supplier B', '1002'),
      tx('cb3', 100, '2025-01-12', 'Office supplies'),
    ]
    const bank = [tx('bk1', 650, '2025-01-12', 'CHQ 1001 1002 BULK CLEARING')]
    const result = suggestSplitMatches(cb, bank, new Set(), new Set())
    expect(result.length).toBeGreaterThanOrEqual(1)
    const hit = result.find((s) => s.bankTxs[0]?.id === 'bk1')
    expect(hit).toBeTruthy()
    expect(hit!.cashBookTxs.map((t) => t.id).sort()).toEqual(['cb1', 'cb2'])
    expect(hit!.reason).toContain('Many-to-one')
    expect(hit!.confidence).toBeGreaterThan(0.82)
    expect(hit!.reason).toMatch(/chq\/ref/)
  })

  it('does not reuse the same transaction across overlapping split suggestions', () => {
    const cb = [
      tx('cb1', 300, '2025-01-15'),
      tx('cb2', 300, '2025-01-15'),
    ]
    const bank = [
      tx('bk1', 100, '2025-01-15'),
      tx('bk2', 200, '2025-01-15'),
    ]
    const result = suggestSplitMatches(cb, bank, new Set(), new Set())
    const used = new Set<string>()
    for (const s of result) {
      for (const t of [...s.cashBookTxs, ...s.bankTxs]) {
        expect(used.has(t.id)).toBe(false)
        used.add(t.id)
      }
    }
  })

  it('respects already-matched ids', () => {
    const cb = [tx('cb1', 300, '2025-01-15')]
    const bank = [
      tx('bk1', 100, '2025-01-15'),
      tx('bk2', 200, '2025-01-15'),
    ]
    const result = suggestSplitMatches(cb, bank, new Set(['cb1']), new Set())
    expect(result).toHaveLength(0)
  })
})
