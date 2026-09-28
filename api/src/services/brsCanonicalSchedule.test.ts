import { describe, expect, it } from 'vitest'
import { resolveCanonicalTimingSchedule } from './brsCanonicalSchedule.js'

const tx = (
  id: string,
  amount: number,
  details: string,
  date = '2018-12-31'
) => ({ id, amount, details, name: null, date, chqNo: null, docRef: null })

describe('resolveCanonicalTimingSchedule', () => {
  it('generic: face totals equal supporting row sums plus brought-forward', () => {
    const result = resolveCanonicalTimingSchedule({
      unmatchedReceipts: [tx('r1', 100, 'lodgment')],
      unmatchedPayments: [tx('p1', 40, 'open cheque')],
      unmatchedDebits: [],
      unmatchedCredits: [],
      allBankDebits: [],
      allBankCredits: [],
      broughtForwardReceiptLodgmentsTotal: 5,
      broughtForwardUnpresentedTotal: 7,
      gtBankEur: false,
      ecobank: false,
    })
    expect(result.uncreditedRows.map((r) => r.id)).toEqual(['r1'])
    expect(result.unpresentedRows.map((r) => r.id)).toEqual(['p1'])
    expect(result.uncreditedLodgmentsTimingTotal).toBeCloseTo(105, 2)
    expect(result.unpresentedChequesTotal).toBeCloseTo(47, 2)
  })

  it('GT Bank cedis: a same-amount bank debit does not remove an unmatched cheque', () => {
    const result = resolveCanonicalTimingSchedule({
      unmatchedReceipts: [],
      unmatchedPayments: [tx('p373', 375.62, 'GRA', '2016-12-12')],
      unmatchedDebits: [],
      unmatchedCredits: [],
      allBankDebits: [tx('d369', 375.62, 'CLEARING WITHDRAWAL CHQ#369', '2016-12-13')],
      allBankCredits: [],
      broughtForwardReceiptLodgmentsTotal: 0,
      broughtForwardUnpresentedTotal: 0,
      gtBankEur: false,
      ecobank: false,
      rawUnmatchedTiming: true,
    })
    expect(result.unpresentedRows.map((r) => r.id)).toEqual(['p373'])
    expect(result.unpresentedChequesTotal).toBeCloseTo(375.62, 2)
  })

  it('GT EUR: CANBNK receipts land on uncredited, not unpresented, and lists sum to the face', () => {
    const result = resolveCanonicalTimingSchedule({
      unmatchedReceipts: [
        tx('r1', 2475.16, 'AFRICA MOVE - RELOCATION COST OF GM FOR IBIS'),
        tx('r2', 65, 'CANBNKCHG-65-MAR18/BOOK(CANMAR-GTB-230 )'),
        tx('r3', 40, 'CANBNKCHG-$40-MAR18/MACAI(CANMAR-GTB-230 )'),
        tx('r4', 40, 'CANBNKCHG-$40-MAR18/PEGAS(CANMAR-GTB-230 )'),
        tx('r5', 85.66, 'CANBNKCHG-$85.66-MAR18/EL(CANMAR-GTB-230 )'),
      ],
      unmatchedPayments: [tx('p1', 7790.17, 'TRANSFER FROM A/C 230')],
      unmatchedDebits: [],
      unmatchedCredits: [],
      allBankDebits: [],
      allBankCredits: [],
      broughtForwardReceiptLodgmentsTotal: 0,
      broughtForwardUnpresentedTotal: 0,
      gtBankEur: true,
      ecobank: false,
    })
    const uncreditedIds = result.uncreditedRows.map((r) => r.id).sort()
    expect(uncreditedIds).toEqual(['p1', 'r2', 'r3', 'r4', 'r5'])
    expect(result.unpresentedRows.map((r) => r.id)).toEqual(['r1'])
    const listUncredited = result.uncreditedRows.reduce((s, t) => s + t.amount, 0)
    const listUnpresented = result.unpresentedRows.reduce((s, t) => s + t.amount, 0)
    expect(listUncredited).toBeCloseTo(7790.17 + 230.66, 2)
    expect(listUnpresented).toBeCloseTo(2475.16, 2)
    expect(result.uncreditedLodgmentsTimingTotal).toBeCloseTo(listUncredited, 2)
    expect(result.unpresentedChequesTotal).toBeCloseTo(listUnpresented, 2)
  })

  it('GT EUR: nets CANBNK against same-period BANKCHRG so neither remains on the face', () => {
    const result = resolveCanonicalTimingSchedule({
      unmatchedReceipts: [
        tx('r1', 2475.16, 'AFRICA MOVE - RELOCATION COST OF GM FOR IBIS'),
        tx('r-mar', 65, 'BANKCHRG-$65-MAR18/BOOKIN(MARCH GTB-230 )'),
        tx('r-aug', 65, 'BANKCHRG-$65-AUG18/BOOKIN(AUG GTB-320 )'),
      ],
      unmatchedPayments: [
        tx('p1', 7790.17, 'TRANSFER FROM A/C 230'),
        tx('p-can', 65, 'CANBNKCHG-65-MAR18/BOOK(CANMAR-GTB-230 )'),
      ],
      unmatchedDebits: [],
      unmatchedCredits: [],
      allBankDebits: [],
      allBankCredits: [],
      broughtForwardReceiptLodgmentsTotal: 0,
      broughtForwardUnpresentedTotal: 0,
      gtBankEur: true,
      ecobank: false,
    })
    expect(result.uncreditedRows.map((r) => r.id)).toEqual(['p1'])
    expect(result.unpresentedRows.map((r) => r.id).sort()).toEqual(['r-aug', 'r1'])
    expect(result.uncreditedLodgmentsTimingTotal).toBeCloseTo(7790.17, 2)
    expect(result.unpresentedChequesTotal).toBeCloseTo(2475.16 + 65, 2)
  })

  it('Ecobank: keeps netting rows and does not double-count brought-forward on unpresented', () => {
    const result = resolveCanonicalTimingSchedule({
      unmatchedReceipts: [tx('r1', 50, 'open lodgment')],
      unmatchedPayments: [tx('p1', 999, 'should not replace netting row')],
      unmatchedDebits: [],
      unmatchedCredits: [],
      allBankDebits: [],
      allBankCredits: [],
      broughtForwardReceiptLodgmentsTotal: 10,
      broughtForwardUnpresentedTotal: 20,
      gtBankEur: false,
      ecobank: true,
      ecobankUnpresentedRows: [tx('a1', 80, 'section A')],
      ecobankUnpresentedTotal: 100,
    })
    expect(result.uncreditedLodgmentsTimingTotal).toBeCloseTo(60, 2)
    expect(result.unpresentedChequesTotal).toBeCloseTo(100, 2)
    expect(result.unpresentedRows.map((r) => r.id)).toEqual(['a1'])
  })
})
