import { describe, expect, it } from 'vitest'
import {
  extractScbClearingRef,
  extractScbOtRef,
  resolveScbProfile,
  suggestScbCashWithdrawalMatches,
  suggestScbChqRefDebitMatches,
  suggestScbInwardClearingFooterAmountMatches,
  suggestScbInwardClearingAmountUniqueMatches,
  suggestScbInwardClearingCrossRefMatches,
  suggestScbWithdrawnToInwClgMatches,
  suggestScbInwardClearingAlternateDebitMatches,
  suggestScbInwardClearingDebitMatches,
  suggestScbOtRefMatches,
  suggestScbReturnedChequeCreditMatches,
  suggestScbSweepMatches,
  scbClearingRefsConflict,
} from './scbSweepMatcher.js'
import type { Tx } from './matching.js'

const tx = (partial: Partial<Tx> & Pick<Tx, 'id' | 'amount'>): Tx => ({
  date: null,
  name: null,
  details: null,
  docRef: null,
  chqNo: null,
  ...partial,
})

describe('resolveScbProfile', () => {
  it('activates for Standard Chartered bank accounts', () => {
    expect(
      resolveScbProfile({ bankAccounts: [{ bankName: 'Standard Chartered Bank' }] }).active
    ).toBe(true)
  })
})

describe('suggestScbSweepMatches', () => {
  it('matches SWEEP receipt to SWEEP credit by amount despite date gap', () => {
    const receipts = [
      tx({
        id: 'r1',
        amount: 12767.87,
        date: new Date('2019-11-08'),
        details: 'sweep to ghs 0100106024702',
      }),
    ]
    const credits = [
      tx({
        id: 'c1',
        amount: 12767.87,
        date: new Date('2019-07-11'),
        details: 'SWEEP FROM GHS 0100106024700',
      }),
    ]
    const out = suggestScbSweepMatches(receipts, credits, new Set(), new Set())
    expect(out).toHaveLength(1)
    expect(out[0]!.reason).toMatch(/SCB sweep/)
  })
})

describe('suggestScbReturnedChequeCreditMatches', () => {
  it('pairs FAB returned cheque receipt and credit by chq', () => {
    const receipts = [
      tx({
        id: 'r1',
        amount: 2702.04,
        details: 'FAB CHQ# 484623 DRAWERS CONF NOT RECEIVED RTNS 02',
      }),
    ]
    const credits = [
      tx({
        id: 'c1',
        amount: 2702.04,
        details: 'FAB CHQ# 484623 DRAWERS CONF NOT RECEIVED RTNS 02',
      }),
    ]
    const out = suggestScbReturnedChequeCreditMatches(receipts, credits, new Set(), new Set())
    expect(out).toHaveLength(1)
  })
})

describe('suggestScbInwardClearingDebitMatches', () => {
  it('disambiguates duplicate amounts using INW CLG reference', () => {
    const payments = [
      tx({
        id: 'p1',
        amount: 4800,
        details: 'INW CLG 680347',
      }),
    ]
    const debits = [
      tx({ id: 'd1', amount: 4800, details: 'INW CLG 680341' }),
      tx({ id: 'd2', amount: 4800, details: 'INW CLG 680347' }),
    ]
    const out = suggestScbInwardClearingDebitMatches(payments, debits, new Set(), new Set())
    expect(out).toHaveLength(1)
    expect(out[0]!.bankTx.id).toBe('d2')
  })

  it('ignores END OF STATEMENT noise debits', () => {
    const payments = [tx({ id: 'p1', amount: 2425.5, details: 'INW CLG 484648' })]
    const debits = [
      tx({ id: 'd1', amount: 2425.5, details: 'END OF STATEMENT' }),
      tx({ id: 'd2', amount: 2425.5, details: 'INW CLG 484648' }),
    ]
    const out = suggestScbInwardClearingDebitMatches(payments, debits, new Set(), new Set())
    expect(out).toHaveLength(1)
    expect(out[0]!.bankTx.id).toBe('d2')
  })
})

describe('suggestScbCashWithdrawalMatches', () => {
  it('matches withdrawal by chq despite date gap', () => {
    const payments = [
      tx({
        id: 'p1',
        amount: 1621.88,
        date: new Date('2019-11-11'),
        details: '0000726494 CASH WITHDRAWAL-JOSEPH F',
      }),
    ]
    const debits = [
      tx({
        id: 'd1',
        amount: 1621.88,
        date: new Date('2019-08-11'),
        details: '0000726494 CASH WITHDRAWAL-JOSEPH F',
      }),
    ]
    const out = suggestScbCashWithdrawalMatches(payments, debits, new Set(), new Set())
    expect(out).toHaveLength(1)
  })
})

describe('suggestScbChqRefDebitMatches', () => {
  it('matches SCB cheque lines by chq ref', () => {
    const payments = [
      tx({
        id: 'p1',
        amount: 8820,
        details: '0000484636 SCB,CHQ#484636,IFO MULTI',
      }),
    ]
    const debits = [
      tx({
        id: 'd1',
        amount: 8820,
        details: '0000484636 SCB,CHQ#484636,IFO MULTI',
      }),
    ]
    const out = suggestScbChqRefDebitMatches(payments, debits, new Set(), new Set())
    expect(out).toHaveLength(1)
  })
})

describe('suggestScbOtRefMatches', () => {
  it('matches OT REF transfers by reference token', () => {
    const payments = [
      tx({
        id: 'p1',
        amount: 150000,
        details: 'OT REF OT00201908090041 TGL PROPERTIES LTD',
      }),
    ]
    const debits = [
      tx({
        id: 'd1',
        amount: 150000,
        details: 'OT REF OT00201908090041 TGL PROPERTIES LTD',
      }),
    ]
    const out = suggestScbOtRefMatches(payments, debits, new Set(), new Set())
    expect(out).toHaveLength(1)
  })
})

describe('extractScbClearingRef', () => {
  it('reads INW CLG and CHQ # patterns', () => {
    expect(extractScbClearingRef(tx({ id: 'x', amount: 1, details: 'INW CLG 680347' }))).toBe(
      '680347'
    )
    expect(
      extractScbClearingRef(tx({ id: 'x', amount: 1, details: 'CHQ # 484623 INWARD CLEARING' }))
    ).toBe('484623')
  })
})

describe('suggestScbInwardClearingCrossRefMatches', () => {
  it('resolves a rotation cycle in one call', () => {
    const payments = [
      tx({ id: 'p1', amount: 4134.61, details: 'INW CLG 210647' }),
      tx({ id: 'p2', amount: 6370.19, details: 'INW CLG 210663' }),
    ]
    const debits = [
      tx({ id: 'd1', amount: 6370.19, details: 'INW CLG 210647' }),
      tx({ id: 'd2', amount: 4134.61, details: 'INW CLG 210657' }),
    ]
    const out = suggestScbInwardClearingCrossRefMatches(payments, debits, new Set(), new Set())
    expect(out).toHaveLength(2)
  })
})

describe('suggestScbWithdrawnToInwClgMatches', () => {
  it('matches cash withdrawal payment to unique INW CLG debit', () => {
    const payments = [
      tx({ id: 'p1', amount: 2201.31, details: '0000680354 CASH WITHDRAWN BY WENDY AFRIYIE ADDO' }),
    ]
    const debits = [tx({ id: 'd1', amount: 2201.31, details: 'INW CLG 210602' })]
    const out = suggestScbWithdrawnToInwClgMatches(payments, debits, new Set(), new Set())
    expect(out).toHaveLength(1)
  })
})

describe('suggestScbInwardClearingAmountUniqueMatches', () => {
  it('matches when cheque ref shifted but amount is unique on both sides', () => {
    const payments = [tx({ id: 'p1', amount: 17262.16, details: 'INW CLG 231969' })]
    const debits = [
      tx({ id: 'd1', amount: 1941.1, details: 'INW CLG 231969' }),
      tx({ id: 'd2', amount: 17262.16, details: 'INW CLG 702823' }),
    ]
    const out = suggestScbInwardClearingAmountUniqueMatches(payments, debits, new Set(), new Set())
    expect(out).toHaveLength(1)
    expect(out[0]!.bankTx.id).toBe('d2')
    expect(out[0]!.reason).toMatch(/ref shifted/)
  })
})

describe('suggestScbInwardClearingAlternateDebitMatches', () => {
  it('matches INW CLG cash line to unique CHQ DEP bank debit', () => {
    const payments = [tx({ id: 'p1', amount: 6628.01, details: 'INW CLG 210657' })]
    const debits = [
      tx({ id: 'd1', amount: 4134.61, details: 'INW CLG 210657' }),
      tx({
        id: 'd2',
        amount: 6628.01,
        details: '0000210618 CHQ DEP SCB H/S CHQ NO,2 IFO-IPMC',
      }),
    ]
    const out = suggestScbInwardClearingAlternateDebitMatches(payments, debits, new Set(), new Set())
    expect(out).toHaveLength(1)
    expect(out[0]!.bankTx.id).toBe('d2')
  })
})

describe('suggestScbInwardClearingFooterAmountMatches', () => {
  it('matches INW CLG payment to unique END OF STATEMENT bank debit', () => {
    const payments = [tx({ id: 'p1', amount: 5238.87, details: 'INW CLG 210676' })]
    const debits = [
      tx({ id: 'd1', amount: 767.55, details: 'INW CLG 210676' }),
      tx({ id: 'd2', amount: 5238.87, details: 'END OF STATEMENT' }),
    ]
    const out = suggestScbInwardClearingFooterAmountMatches(payments, debits, new Set(), new Set())
    expect(out).toHaveLength(1)
    expect(out[0]!.bankTx.id).toBe('d2')
  })
})

describe('scbClearingRefsConflict', () => {
  it('blocks cross-match between different INW CLG refs', () => {
    const cb = tx({ id: 'p', amount: 2425.5, details: 'INW CLG 259027' })
    const bk = tx({ id: 'd', amount: 2425.5, details: 'INW CLG 484648' })
    expect(scbClearingRefsConflict(cb, bk)).toBe(true)
    expect(scbClearingRefsConflict(cb, tx({ id: 'd2', amount: 2425.5, details: 'INW CLG 259027' }))).toBe(
      false
    )
  })
})

describe('extractScbOtRef', () => {
  it('reads OT reference token', () => {
    expect(
      extractScbOtRef(tx({ id: 'x', amount: 1, details: 'OT REF OT00201908090041 TGL' }))
    ).toBe('OT00201908090041')
  })
})
