import { describe, it, expect } from 'vitest'
import { pickBankRuleCashBookMatch, getMatchingRule, type BankRule } from './bankRules.js'
import type { Tx } from './matching.js'

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

describe('pickBankRuleCashBookMatch', () => {
  it('rejects amount-only pairs with no corroboration', () => {
    const pick = pickBankRuleCashBookMatch(
      tx('bk1', 1000, '2025-01-15', 'Bank fee XYZ'),
      [tx('cb1', 1000, '2025-03-01', 'Unrelated rent')],
      new Set(),
      { amountTolerance: 0.01 }
    )
    expect(pick).toBeNull()
  })

  it('accepts amount + date within window', () => {
    const pick = pickBankRuleCashBookMatch(
      tx('bk1', 1000, '2025-01-15', 'Service charge'),
      [tx('cb1', 1000, '2025-01-16', 'Monthly fee')],
      new Set(),
      { amountTolerance: 0.01 }
    )
    expect(pick).not.toBeNull()
    expect(pick!.corroboration).toBe('date')
    expect(pick!.confidence).toBe(0.85)
  })

  it('accepts amount + shared cheque ref', () => {
    const pick = pickBankRuleCashBookMatch(
      tx('bk1', 640, '2025-03-01', 'CHQ NO 002038 PAID'),
      [tx('cb1', 640, '2025-01-01', 'Supplier', '002038')],
      new Set(),
      { amountTolerance: 0.01 }
    )
    expect(pick).not.toBeNull()
    expect(pick!.corroboration).toBe('ref')
  })

  it('accepts amount + narration similarity', () => {
    const pick = pickBankRuleCashBookMatch(
      tx('bk1', 750, '2025-03-01', 'KOFI MENSAH SALARY'),
      [tx('cb1', 750, '2025-01-01', 'Salary Kofi Mensah')],
      new Set(),
      { amountTolerance: 0.01 }
    )
    expect(pick).not.toBeNull()
    expect(pick!.corroboration).toBe('description')
    expect(pick!.confidence).toBe(0.8)
  })

  it('returns null when two equally corroborated candidates exist', () => {
    const pick = pickBankRuleCashBookMatch(
      tx('bk1', 1000, '2025-01-15', 'Generic'),
      [
        tx('cb1', 1000, '2025-01-15', 'Alpha'),
        tx('cb2', 1000, '2025-01-16', 'Beta'),
      ],
      new Set(),
      { amountTolerance: 0.01 }
    )
    expect(pick).toBeNull()
  })
})

describe('getMatchingRule', () => {
  it('returns highest-priority matching rule', () => {
    const rules: BankRule[] = [
      {
        id: 'r2',
        name: 'Fees',
        priority: 2,
        conditions: [{ field: 'details', operator: 'contains', value: 'fee' }],
        action: 'suggest_match',
      },
      {
        id: 'r1',
        name: 'Bank charge',
        priority: 1,
        conditions: [{ field: 'details', operator: 'contains', value: 'charge' }],
        action: 'flag_for_review',
      },
    ]
    const rule = getMatchingRule(tx('bk1', 10, undefined, 'Service charge fee'), rules)
    expect(rule?.id).toBe('r1')
  })
})
