import { describe, expect, it } from 'vitest'
import {
  computeGtBankEurBankOnlyDebitsTotal,
  computeGtBankEurTimingSchedule,
  isGtBankEurScope,
} from './gtBankEurWorkbookSchedule.js'

const tx = (
  id: string,
  amount: number,
  details: string,
  date = '2018-12-31'
) => ({ id, amount, details, name: null, date, chqNo: null, docRef: null })

describe('isGtBankEurScope', () => {
  it('activates for EUR projects with GT Bank accounts', () => {
    expect(
      isGtBankEurScope({ currency: 'EUR' }, [{ bankName: 'GT Bank', name: 'EUR 430' }]).active
    ).toBe(true)
    expect(isGtBankEurScope({ currency: 'GHS' }, [{ bankName: 'GT Bank' }]).active).toBe(false)
  })
  it('activates from bank statement text when bank account name is missing', () => {
    expect(
      isGtBankEurScope(
        { currency: 'EUR' },
        [],
        'FUND TRANSFER - OWN ACCOUNTS OWN AC TGRF\nSWIFT TRANSFER TRSF IFO'
      ).active
    ).toBe(true)
  })
})

describe('computeGtBankEurTimingSchedule', () => {
  it('routes CANBNKCHG to uncredited and BANKCHRG to unpresented (acct430 manual)', () => {
    const result = computeGtBankEurTimingSchedule({
      unmatchedReceipts: [
        tx('r1', 2475.16, 'AFRICA MOVE - RELOCATION COST OF GM FOR IBIS'),
        tx('r2', 65, 'BANKCHRG-$65-AUG18/BOOKIN(AUG GTB-320 )'),
        tx('r3', 38.99, 'BANKCH-€38.99-AUG18/KHALD(AUG GTB-420 )'),
        tx('r4', 2529.8, 'PYT-JN3747€2529.8/SOFITEL(BT/2018/01/02 )', '2018-01-02'),
      ],
      unmatchedPayments: [
        tx('p1', 7790.17, 'TRANSFER FROM A/C 230'),
        tx('p2', 65, 'CANBNKCHG-65-MAR18/BOOK(CANMAR-GTB-230 )'),
        tx('p3', 100, 'OTHER PAYMENT NOT ON BANK'),
      ],
      unmatchedDebits: [tx('d1', 2529.8, 'SWIFT TRSF IFO HOTEL', '2018-01-02')],
      unmatchedCredits: [],
      allBankDebits: [tx('d1', 2529.8, 'SWIFT TRSF IFO HOTEL', '2018-01-02')],
      allBankCredits: [],
      broughtForwardReceiptLodgmentsTotal: 0,
      broughtForwardUnpresentedTotal: 0,
    })
    expect(result.uncreditedLodgmentsTimingTotal).toBeCloseTo(7790.17 + 65, 2)
    expect(result.unpresentedChequesTotal).toBeCloseTo(2475.16 + 65 + 38.99 + 100, 2)
  })
})

describe('computeGtBankEurBankOnlyDebitsTotal', () => {
  it('excludes bank debits paired to cash-book receipts at same amount', () => {
    const total = computeGtBankEurBankOnlyDebitsTotal({
      unmatchedDebits: [
        tx('d1', 2529.8, 'SWIFT TRSF IFO HOTEL DUGOLF', '2018-01-02'),
        tx('d2', 1581.99, 'SWIFT TRANSFER TRSF IFO QUADRIGA', '2018-01-05'),
      ],
      unmatchedCredits: [],
      payments: [],
      receipts: [tx('r1', 2529.8, 'PYT-JN3747€2529.8/SOFITEL(BT/2018/01/02 )', '2018-01-02')],
    })
    expect(total).toBeCloseTo(1581.99, 2)
  })
})
