import { describe, it, expect } from 'vitest'
import type { Tx } from './matching.js'
import {
  extractGhanaChequeRef,
  extractFtRef,
  resolveAbsaProfile,
  resolveBoaProfile,
  resolveGcbProfile,
  resolveNibProfile,
  resolvePrudentialProfile,
  suggestAbsaEboxCreditMatches,
  suggestAbsaFtMatches,
  suggestAbsaInvestmentCreditMatches,
  suggestBoaCashDepositMatches,
  suggestBoaInwardChequeMatches,
  suggestBoaMaturityMatches,
  suggestGcbChequeWithdrawalMatches,
  suggestGcbCashDepositMatches,
  suggestGcbBogChqMatches,
  suggestNibInwardChequeMatches,
  suggestNibCashDepositMatches,
  suggestNibTelexMatches,
  suggestPrudentialInwardClearingMatches,
  suggestPrudentialChequeWithdrawalMatches,
  suggestPrudentialNrtMatches,
  isGhanaRegionalPatternMatchReason,
} from './ghanaRegionalMatchers.js'

function tx(partial: Partial<Tx> & { id: string; amount: number }): Tx {
  return {
    id: partial.id,
    amount: partial.amount,
    date: partial.date ?? new Date('2023-09-15'),
    name: partial.name ?? null,
    details: partial.details ?? null,
    chqNo: partial.chqNo ?? null,
    docRef: partial.docRef ?? null,
  }
}

describe('isGhanaRegionalPatternMatchReason coverage', () => {
  it('accepts every bulk-safe reason string used by regional matchers', () => {
    const reasons = [
      'GCB cheque withdrawal: chq/ref + amount',
      'GCB cash deposit: amount + payee',
      'GCB CHQ lodgement: chq + amount',
      'NIB inward cheque: chq/ref + amount',
      'NIB cash deposit: amount + payee',
      'NIB telex: amount + payee',
      'Prudential inward clearing: amount + payee',
      'Prudential cheque withdrawal: chq/ref + amount',
      'Prudential NRT: amount + payee',
      'Prudential call/credit: amount + payee',
      'Absa investment: amount + payee/ref',
      'Absa EBOX: amount + payee',
      'Absa FT: FT ref + amount',
      'BOA inward cheque: chq/ref + amount',
      'BOA cash deposit: amount + payee',
      'BOA maturity: ref + amount',
      'BOA interest: amount + payee',
    ]
    for (const reason of reasons) {
      expect(isGhanaRegionalPatternMatchReason(reason)).toBe(true)
    }
    expect(isGhanaRegionalPatternMatchReason('Amount match')).toBe(false)
  })
})

describe('extractGhanaChequeRef', () => {
  it('reads GCB /Chq_No - style', () => {
    expect(
      extractGhanaChequeRef(
        tx({
          id: '1',
          amount: 1,
          details: 'Cheque Withdrawal // FRANCIS /Chq_No - 530773',
        })
      )
    ).toBe('530773')
  })

  it('reads NIB By cheque No and IFO Chq', () => {
    expect(
      extractGhanaChequeRef(tx({ id: '1', amount: 1, details: 'By cheque No: 000404' }))
    ).toBe('000404')
    expect(
      extractGhanaChequeRef(
        tx({ id: '1', amount: 1, details: 'CHQ NO 000399 FROM NIB ACCRA MAIN IFO Chq 000399' })
      )
    ).toBe('000399')
  })
})

describe('profile resolvers', () => {
  it('detects GCB from account name or sample narration', () => {
    expect(resolveGcbProfile({ bankAccounts: [{ id: '1', name: 'GCB Accra' }] }).active).toBe(true)
    expect(
      resolveGcbProfile({
        sampleBankText: 'Cash Deposit// STANLEY /Chq_No - 123\nCheque Withdrawal // X /Chq_No - 456',
      }).active
    ).toBe(true)
  })

  it('detects NIB from sample inward cheque lines', () => {
    expect(
      resolveNibProfile({
        sampleBankText: 'FT23278B7PSK Inward Cheque - Dr\nBy cheque No: 000404',
      }).active
    ).toBe(true)
    expect(resolveNibProfile({ bankAccounts: [{ id: '1', name: 'NIB Head Office' }] }).active).toBe(
      true
    )
  })

  it('detects Prudential from INWARD CLEARING + CALL TRANSACTIONS', () => {
    expect(
      resolvePrudentialProfile({
        sampleBankText: 'INWARD CLEARING ENTERPRISE LIFE\nCALL TRANSACTIONS - CR',
      }).active
    ).toBe(true)
    expect(
      resolvePrudentialProfile({ bankAccounts: [{ id: '1', name: 'Prudential Ring Road' }] }).active
    ).toBe(true)
  })

  it('detects Absa from EBOX + INVESTMENT BANK sample', () => {
    expect(
      resolveAbsaProfile({
        sampleBankText: 'EBOX URGENT PAYMENT\nINVESTMENT BANK FT2234109356',
      }).active
    ).toBe(true)
    expect(resolveAbsaProfile({ bankAccounts: [{ id: '1', name: 'Absa Corporate' }] }).active).toBe(
      true
    )
  })

  it('detects BOA from CHECK PAID + MAT.DEPOT sample', () => {
    expect(
      resolveBoaProfile({
        sampleBankText: 'CHECK PAID Cheque: 0000510 /INW.CHQ\nMAT.DEPOT AX21156',
      }).active
    ).toBe(true)
    expect(
      resolveBoaProfile({ bankAccounts: [{ id: '1', name: 'Bank of Africa COCOBOD' }] }).active
    ).toBe(true)
  })
})

describe('GCB matchers', () => {
  it('matches cheque withdrawal on chq + amount', () => {
    const payments = [tx({ id: 'p1', amount: 2500, details: 'Francis chq', chqNo: '530773' })]
    const debits = [
      tx({
        id: 'd1',
        amount: 2500,
        details: 'Cheque Withdrawal // FRANCIS MENSAH /Chq_No - 530773',
      }),
      tx({ id: 'd2', amount: 100, details: 'Service charge' }),
    ]
    const out = suggestGcbChequeWithdrawalMatches(payments, debits, new Set(), new Set())
    expect(out).toHaveLength(1)
    expect(out[0]!.confidence).toBe(0.92)
    expect(out[0]!.reason).toMatch(/GCB cheque withdrawal/)
    expect(isGhanaRegionalPatternMatchReason(out[0]!.reason)).toBe(true)
  })

  it('matches cash deposit with payee corroboration', () => {
    const receipts = [tx({ id: 'r1', amount: 8000, details: 'Deposit Stanley Coffie' })]
    const credits = [
      tx({
        id: 'c1',
        amount: 8000,
        details: 'Cash Deposit// STANLEY COFFIE ACCRA',
      }),
    ]
    const out = suggestGcbCashDepositMatches(receipts, credits, new Set(), new Set())
    expect(out).toHaveLength(1)
    expect(out[0]!.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('matches BOG CHQ lodgement on chq + amount', () => {
    const payments = [tx({ id: 'p1', amount: 8000, chqNo: '139425', details: 'BOG cheque' })]
    const debits = [
      tx({
        id: 'd1',
        amount: 8000,
        details: 'BANK OF GHANA CHQ - bog chq 139425~139425 - DEP. AT REPUBLIC HOUSE',
      }),
    ]
    const out = suggestGcbBogChqMatches(payments, debits, new Set(), new Set())
    expect(out).toHaveLength(1)
    expect(out[0]!.reason).toMatch(/GCB CHQ lodgement/)
  })
})

describe('NIB matchers', () => {
  it('matches inward cheque debit on chq + amount', () => {
    const payments = [tx({ id: 'p1', amount: 1500, chqNo: '000399', details: 'Supplier' })]
    const debits = [
      tx({
        id: 'd1',
        amount: 1500,
        details: 'FT23278B7PSK Inward Cheque - Dr CHQ NO 000399 FROM NIB ACCRA MAIN IFO Chq 000399',
      }),
    ]
    const out = suggestNibInwardChequeMatches(payments, debits, new Set(), new Set())
    expect(out).toHaveLength(1)
    expect(out[0]!.confidence).toBe(0.92)
  })

  it('matches telex credit with payee', () => {
    const receipts = [tx({ id: 'r1', amount: 50000, details: 'GHANA COCOA BOARD receipt' })]
    const credits = [
      tx({
        id: 'c1',
        amount: 50000,
        details: 'FT232916PM3C Inward Telex Payment GHANA COCOA BOARD',
      }),
    ]
    const out = suggestNibTelexMatches(receipts, credits, new Set(), new Set())
    expect(out).toHaveLength(1)
    expect(out[0]!.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('caps unique-amount cash deposit below Phase B', () => {
    const receipts = [tx({ id: 'r1', amount: 200, details: 'Misc' })]
    const credits = [tx({ id: 'c1', amount: 200, details: 'Cash Deposit UNKNOWN' })]
    const out = suggestNibCashDepositMatches(receipts, credits, new Set(), new Set())
    expect(out).toHaveLength(1)
    expect(out[0]!.confidence).toBe(0.84)
  })
})

describe('Prudential matchers', () => {
  it('matches inward clearing with payee', () => {
    const payments = [tx({ id: 'p1', amount: 3200, details: 'ENTERPRISE LIFE premium' })]
    const debits = [
      tx({
        id: 'd1',
        amount: 3200,
        details: 'INWARD CLEARING ENTERPRISE LIFE ASSURANCE',
      }),
    ]
    const out = suggestPrudentialInwardClearingMatches(payments, debits, new Set(), new Set())
    expect(out).toHaveLength(1)
    expect(out[0]!.confidence).toBeGreaterThanOrEqual(0.9)
    expect(out[0]!.reason).toMatch(/Prudential inward clearing/)
  })

  it('matches cheque withdrawal on chq + amount', () => {
    const payments = [tx({ id: 'p1', amount: 900, chqNo: '001122', details: 'Vendor' })]
    const debits = [
      tx({
        id: 'd1',
        amount: 900,
        details: 'CHEQUE WITHDRAWAL CHQ NO 001122 PAID TO VENDOR',
      }),
    ]
    const out = suggestPrudentialChequeWithdrawalMatches(payments, debits, new Set(), new Set())
    expect(out).toHaveLength(1)
    expect(out[0]!.confidence).toBe(0.92)
  })

  it('matches NRT with payee; unique amount alone stays at 0.84', () => {
    const payments = [tx({ id: 'p1', amount: 450, details: 'Utility ECG payment' })]
    const debits = [
      tx({ id: 'd1', amount: 450, details: 'NRT ACH OUT ECG UTILITY' }),
    ]
    const withPayee = suggestPrudentialNrtMatches(payments, debits, new Set(), new Set())
    expect(withPayee[0]!.confidence).toBeGreaterThanOrEqual(0.9)

    const uniqueOnly = suggestPrudentialNrtMatches(
      [tx({ id: 'p2', amount: 111, details: 'X' })],
      [tx({ id: 'd2', amount: 111, details: 'NRT ACH OUT ZZZ999' })],
      new Set(),
      new Set()
    )
    expect(uniqueOnly[0]!.confidence).toBe(0.84)
  })
})

describe('Absa matchers', () => {
  it('matches investment bank credit with payee', () => {
    const receipts = [tx({ id: 'r1', amount: 170000000, details: 'GHANA COCOA BOARD investment' })]
    const credits = [
      tx({
        id: 'c1',
        amount: 170000000,
        details: 'INVESTMENT BANK GHANA COCOA BOARD FT2234109356',
      }),
    ]
    const out = suggestAbsaInvestmentCreditMatches(receipts, credits, new Set(), new Set())
    expect(out).toHaveLength(1)
    expect(out[0]!.confidence).toBeGreaterThanOrEqual(0.9)
    expect(isGhanaRegionalPatternMatchReason(out[0]!.reason)).toBe(true)
  })

  it('matches EBOX with payee; unique amount alone stays at 0.84', () => {
    const withPayee = suggestAbsaEboxCreditMatches(
      [tx({ id: 'r1', amount: 200, details: 'Urgent payment cocoa' })],
      [tx({ id: 'c1', amount: 200, details: 'EBOX URGENT PAYMENT GHANA COCOA' })],
      new Set(),
      new Set()
    )
    expect(withPayee[0]!.confidence).toBeGreaterThanOrEqual(0.9)

    const unique = suggestAbsaEboxCreditMatches(
      [tx({ id: 'r2', amount: 99, details: 'Misc' })],
      [tx({ id: 'c2', amount: 99, details: 'EBOX' })],
      new Set(),
      new Set()
    )
    expect(unique[0]!.confidence).toBe(0.84)
  })

  it('matches shared FT ref + amount', () => {
    expect(extractFtRef(tx({ id: 'x', amount: 1, details: 'FT2234109356 URGENT' }))).toBe(
      'FT2234109356'
    )
    const out = suggestAbsaFtMatches(
      [tx({ id: 'p1', amount: 5000, details: 'Transfer FT2234109356' })],
      [tx({ id: 'd1', amount: 5000, details: 'FT2234109356 SETTLEMENT' })],
      new Set(),
      new Set()
    )
    expect(out).toHaveLength(1)
    expect(out[0]!.confidence).toBe(0.92)
    expect(out[0]!.reason).toMatch(/Absa FT/)
  })
})

describe('BOA matchers', () => {
  it('matches CHECK PAID / INW.CHQ on chq + amount', () => {
    const payments = [tx({ id: 'p1', amount: 1200, chqNo: '0000510', details: 'Supplier' })]
    const debits = [
      tx({
        id: 'd1',
        amount: 1200,
        details: 'CHECK PAID Cheque: 0000510 /BANK-34 /INW.CHQ /00000000 0000510',
        chqNo: '0000510',
      }),
    ]
    const out = suggestBoaInwardChequeMatches(payments, debits, new Set(), new Set())
    expect(out).toHaveLength(1)
    expect(out[0]!.confidence).toBe(0.92)
    expect(out[0]!.reason).toMatch(/BOA inward cheque/)
  })

  it('matches cash deposit with payee', () => {
    const out = suggestBoaCashDepositMatches(
      [tx({ id: 'r1', amount: 3500, details: 'Deposit Adelaide Agyemang' })],
      [tx({ id: 'c1', amount: 3500, details: 'YOUR CASH DEPOSIT ADELAIDE AGYEMANG' })],
      new Set(),
      new Set()
    )
    expect(out).toHaveLength(1)
    expect(out[0]!.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('matches MAT.DEPOT on Our Reference + amount', () => {
    const out = suggestBoaMaturityMatches(
      [tx({ id: 'r1', amount: 105960.08, details: 'Maturity', docRef: 'AX21156' })],
      [tx({ id: 'c1', amount: 105960.08, details: 'MAT.DEPOT', docRef: 'AX21156' })],
      new Set(),
      new Set()
    )
    expect(out).toHaveLength(1)
    expect(out[0]!.confidence).toBe(0.92)
    expect(out[0]!.reason).toMatch(/BOA maturity/)
  })
})
