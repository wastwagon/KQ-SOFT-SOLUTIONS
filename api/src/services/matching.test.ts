import { describe, it, expect } from 'vitest'
import { suggestMatches, type Tx } from './matching.js'

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
})
