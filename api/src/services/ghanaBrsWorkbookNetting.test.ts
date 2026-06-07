import { describe, it, expect } from 'vitest'
import {
  computeWorkbookNettedUnpresented,
  unpresentedWithOptionalWorkbookNetting,
} from './ghanaBrsWorkbookNetting.js'
import type { ClearingTxLike } from './ecobankClearingMatcher.js'

const tx = (partial: Partial<ClearingTxLike> & Pick<ClearingTxLike, 'id' | 'amount'>): ClearingTxLike => ({
  chqNo: null,
  details: null,
  name: null,
  date: null,
  ...partial,
})

describe('computeWorkbookNettedUnpresented', () => {
  it('partitions unmatched payments: section A only when chq absent from bank text', () => {
    const payments = [
      tx({ id: 'a1', amount: 2000, chqNo: '925928' }),
      tx({ id: 'b1', amount: 5000, chqNo: '925976', name: 'Philip' }),
      tx({ id: 'r2p1', amount: 3000, chqNo: '925945', name: 'Alex' }),
    ]
    const debits = [
      tx({ id: 'c1', amount: 5000, details: 'WITHDRAWAL- EGH CHQ NO 925976 PD TO ROYAL' }),
      tx({ id: 'd1', amount: 3000, details: 'WITHDRAWAL- EGH CHQ 925945 PAID TO ALEX' }),
    ]
    const result = computeWorkbookNettedUnpresented(payments, debits, [], debits, [], 0)
    expect(result.sectionATotal).toBe(2000)
    expect(result.sectionBTotal).toBe(8000)
    expect(result.unpresentedChequeRows).toHaveLength(1)
  })

  it('preserves section-A unpresented when netted total falls below (Account902 guard)', () => {
    const sectionA = [
      tx({ id: 'u1', amount: 1327.31, chqNo: '002066' }),
      tx({ id: 'u2', amount: 1295.87, chqNo: '002112' }),
    ]
    const sectionB = [
      tx({ id: 't1', amount: 7605, chqNo: '002065', name: 'Fred-Leon' }),
      tx({ id: 't2', amount: 9978.21, chqNo: '002059', name: 'Cocobod' }),
    ]
    const unmatchedPayments = [...sectionA, ...sectionB]
    const clearingCredits = [
      tx({
        id: 'bk1',
        amount: 7605,
        details: 'CHEQUE DEPOSIT - HSE CHEQUE DEPOSIT - HSE CHQ 002065',
      }),
      tx({
        id: 'bk2',
        amount: 9978.21,
        details: 'CHEQUE CLEARING - INWARD LCY ECOBANK CHQ NO 002059 received from Clearing',
      }),
    ]
    const round2Debits = Array.from({ length: 12 }, (_, i) =>
      tx({ id: `w${i}`, amount: 3000, details: `CHEQUE WITHDRAWAL CHQ 00208${i}` })
    )
    const unmatchedDebits = round2Debits
    const unmatchedCredits = clearingCredits

    const legacy = { total: 2623.18, rows: sectionA }
    const withNetting = unpresentedWithOptionalWorkbookNetting(true, legacy, {
      unmatchedPayments,
      unmatchedDebits,
      unmatchedCredits,
      allBankDebits: unmatchedDebits,
      allBankCredits: unmatchedCredits,
      broughtForwardUnpresentedTotal: 0,
    })

    expect(withNetting.total).toBeCloseTo(2623.18, 2)
    expect(withNetting.rows).toHaveLength(2)
  })

  it('adds balanced B₁ and block C for matched timing withdrawal pairs', () => {
    const unmatchedPayments = [tx({ id: 'a1', amount: 2000, chqNo: '925928' })]
    const matchedPayment = tx({
      id: 'm1',
      amount: 5000,
      chqNo: '925976',
      name: 'Philip',
      details: 'Part payment of ED fuel for Jan 26',
    })
    const withdrawal = tx({
      id: 'w1',
      amount: 5000,
      details: 'WITHDRAWAL- EGH CHQ NO 925976 PD TO ROYAL',
    })
    const allPayments = [...unmatchedPayments, matchedPayment]
    const debits = [withdrawal]
    const without = computeWorkbookNettedUnpresented(
      unmatchedPayments,
      [],
      [],
      debits,
      [],
      0,
      0.01,
      allPayments,
      []
    )
    const withMatched = computeWorkbookNettedUnpresented(
      unmatchedPayments,
      [],
      [],
      debits,
      [],
      0,
      0.01,
      allPayments,
      [{ payment: matchedPayment, bankDebit: withdrawal }]
    )
    expect(withMatched.sectionCOffsetTotal).toBe(without.sectionCOffsetTotal + 5000)
    expect(withMatched.group2Net).toBeCloseTo(without.group2Net, 2)
    expect(withMatched.round1MatchedPairs).toHaveLength(1)
  })

  it('returns legacy totals when workbook netting is disabled', () => {
    const legacy = { total: 1234.56, rows: [tx({ id: 'x', amount: 1234.56 })] }
    const result = unpresentedWithOptionalWorkbookNetting(false, legacy, {
      unmatchedPayments: legacy.rows,
      unmatchedDebits: [],
      unmatchedCredits: [],
      allBankDebits: [],
      allBankCredits: [],
      broughtForwardUnpresentedTotal: 0,
    })
    expect(result.total).toBe(1234.56)
    expect(result.workbook).toBeUndefined()
  })
})
