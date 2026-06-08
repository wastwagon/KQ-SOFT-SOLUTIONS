import { describe, it, expect } from 'vitest'
import {
  isEcobankClearingCredit,
  suggestEcobankClearingMatches,
  findLinkedEcobankClearingPairIds,
  detectDuplicateChequePayments,
  mergePaymentSuggestions,
  computeUnpresentedChequesTotal,
  paymentHasUnmatchedBankCounterpart,
  paymentHasTransferCounterpart,
  isLevyPayment,
  computeBankOnlyCreditsTotal,
  computeBankOnlyDebitsTotal,
  clearingCreditHasPaymentCounterpart,
  ecobankClearingLineHasPaymentCounterpart,
  creditHasCashBookCounterpart,
  isCreditReclassifiedAsDebit,
  suggestEcobankPaymentDebitMatches,
  suggestEcobankStatutoryDepositMatches,
  resolveEcobankGhanaProfile,
  buildBankOnlyScheduleRows,
  isEcobankPatternMatchReason,
} from './ecobankClearingMatcher.js'
import type { Tx } from './matching.js'

const tx = (partial: Partial<Tx> & Pick<Tx, 'id' | 'amount'>): Tx => ({
  date: null,
  name: null,
  details: null,
  chqNo: null,
  docRef: null,
  ...partial,
})

describe('isEcobankClearingCredit', () => {
  it('detects inward clearing and HSE deposit lines', () => {
    expect(
      isEcobankClearingCredit({
        details: 'CHEQUE CLEARING -\r\nINWARD LCY ECOBANK\r\nCHQ NO 002085 received from Clearing',
      })
    ).toBe(true)
    expect(
      isEcobankClearingCredit({
        details: 'CHEQUE DEPOSIT - HSE\r\nCHEQUE CHEQUE DEPOSIT - HSE CHEQUE-EGH CHQ 2066',
      })
    ).toBe(true)
    expect(isEcobankClearingCredit({ details: 'CHEQUE WITHDRAWAL CHQ 002067' })).toBe(false)
    expect(
      isEcobankClearingCredit({
        details: 'HSE CHEQUE-EGH CHQ NO 926118 DEPOSIT BO LORDSHIP INSURANCE BROKERS LIMITED',
      })
    ).toBe(true)
    expect(
      isEcobankClearingCredit({
        details: 'HSE CHEQUE-EGH CHQ 926116 PAID TO ALEX SETSOAFIA AVORKPO.',
      })
    ).toBe(false)
    expect(
      isEcobankClearingCredit({ details: 'CHQ NO 926117 received from Clearing' })
    ).toBe(true)
  })
})

describe('suggestEcobankStatutoryDepositMatches', () => {
  it('suggests GRA payment ↔ HSE GRA deposit on debit column when chq numbers differ', () => {
    const payments = [
      tx({
        id: 'p1',
        amount: 2981.81,
        chqNo: '926044',
        name: 'GRA',
        details: 'Payment of staff PAYE for Dec 25',
      }),
    ]
    const debits = [
      tx({
        id: 'd1',
        amount: 2981.81,
        details: 'HSE CHEQUE-EGH CHQ 925966 DEP. BO LORDSHIP INSURANCE BROKERS LIMITED IRO GRA PMT.',
      }),
    ]
    const result = suggestEcobankStatutoryDepositMatches(payments, [], new Set(), new Set(), 0.01, debits)
    expect(result).toHaveLength(1)
    expect(result[0]!.cashBookTx.id).toBe('p1')
    expect(result[0]!.bankTx.id).toBe('d1')
  })

  it('suggests GRA payment ↔ HSE GRA deposit when chq numbers differ', () => {
    const payments = [
      tx({
        id: 'p1',
        amount: 2981.81,
        chqNo: '926044',
        name: 'GRA',
        details: 'Payment of staff PAYE for Dec 25',
      }),
    ]
    const credits = [
      tx({
        id: 'c1',
        amount: 2981.81,
        details: 'HSE CHEQUE-EGH CHQ 925966 DEP. BO LORDSHIP INSURANCE BROKERS LIMITED IRO GRA PMT',
      }),
    ]
    const result = suggestEcobankStatutoryDepositMatches(payments, credits, new Set(), new Set())
    expect(result).toHaveLength(1)
    expect(result[0]!.cashBookTx.id).toBe('p1')
    expect(result[0]!.bankTx.id).toBe('c1')
  })
})

describe('suggestEcobankClearingMatches', () => {
  it('suggests payment ↔ inward clearing credit when chq and amount match', () => {
    const payments = [
      tx({
        id: 'p1',
        amount: 4897.36,
        chqNo: '002085',
        details: 'Final payment of finders fees',
        date: new Date('2026-01-31'),
      }),
    ]
    const credits = [
      tx({
        id: 'c1',
        amount: 4897.36,
        chqNo: '002085',
        details: 'CHEQUE CLEARING -\r\nINWARD LCY ECOBANK\r\nCHQ NO 002085 received from Clearing',
        date: new Date('2026-02-04'),
      }),
    ]
    const result = suggestEcobankClearingMatches(payments, credits, new Set(), new Set())
    expect(result).toHaveLength(1)
    expect(result[0]!.cashBookTx.id).toBe('p1')
    expect(result[0]!.bankTx.id).toBe('c1')
    expect(result[0]!.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('does not suggest withdrawal credits', () => {
    const payments = [tx({ id: 'p1', amount: 3000, chqNo: '002068', details: 'Gift' })]
    const credits = [
      tx({
        id: 'c1',
        amount: 3000,
        details: 'CHEQUE WITHDRAWAL CHEQUE WITHDRAWAL- EGH CHQ 002068',
      }),
    ]
    expect(suggestEcobankClearingMatches(payments, credits, new Set(), new Set())).toHaveLength(0)
  })
})

describe('findLinkedEcobankClearingPairIds', () => {
  it('links unmatched payment and clearing credit pairs', () => {
    const payments = [tx({ id: 'p1', amount: 7605, chqNo: '002065' })]
    const credits = [
      tx({
        id: 'c1',
        amount: 7605,
        chqNo: '002065',
        details: 'CHEQUE DEPOSIT - HSE CHEQUE- EGH CHQ NO. 002065',
      }),
    ]
    const { paymentIds, creditIds } = findLinkedEcobankClearingPairIds(payments, credits)
    expect(paymentIds.has('p1')).toBe(true)
    expect(creditIds.has('c1')).toBe(true)
  })
})

describe('detectDuplicateChequePayments', () => {
  it('flags duplicate chq numbers in cash book payments', () => {
    const payments = [
      tx({ id: 'a', amount: 1327.31, chqNo: '002066' }),
      tx({ id: 'b', amount: 1327.31, chqNo: '002066' }),
      tx({ id: 'c', amount: 500, chqNo: '002079' }),
    ]
    const warnings = detectDuplicateChequePayments(payments)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.chqNo).toBe('002066')
    expect(warnings[0]!.count).toBe(2)
  })
})

describe('computeUnpresentedChequesTotal', () => {
  it('counts only payments with no bank debit or clearing credit counterpart', () => {
    const payments = [
      tx({ id: 'p1', amount: 944, chqNo: '002079', details: 'transport' }),
      tx({ id: 'p2', amount: 1327.31, chqNo: '002066', details: 'sanitation' }),
    ]
    const debits: Tx[] = []
    const credits = [
      tx({
        id: 'c1',
        amount: 1327.31,
        chqNo: '2066',
        details: 'CHEQUE DEPOSIT - HSE CHEQUE-EGH CHQ 2066',
      }),
    ]
    const { total, rows } = computeUnpresentedChequesTotal(payments, debits, credits, 0)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe('p1')
    expect(total).toBe(944)
    expect(paymentHasUnmatchedBankCounterpart(payments[1]!, debits, credits)).toBe(true)
  })

  it('excludes payments when bank debit exists even if already matched (not in unmatched list)', () => {
    const payments = [tx({ id: 'p1', amount: 550, chqNo: '002098', details: 'levy' })]
    const debits = [
      tx({
        id: 'd1',
        amount: 550,
        details: 'CHEQUE WITHDRAWAL CHEQUE WITHDRAWAL- EGH CHQ 002098',
      }),
    ]
    const { total, rows } = computeUnpresentedChequesTotal(payments, debits, [], 0)
    expect(rows).toHaveLength(0)
    expect(total).toBe(0)
  })

  it('excludes levy payments and transfer payments from unpresented', () => {
    const payments = [
      tx({ id: 'p1', amount: 3521.55, chqNo: '002093', details: 'Payment of 3rd quarter levy 2026', name: 'IBAG' }),
      tx({ id: 'p2', amount: 82500, chqNo: '002105', details: 'Support in purchasing ED vehicle', name: 'SWISS GROUP LTD' }),
      tx({ id: 'p3', amount: 944, chqNo: '002079', details: 'transport' }),
    ]
    const debits = [
      tx({
        id: 'd1',
        amount: 82500,
        details: 'FUNDS TRANSFER OUTWARD - LOCAL NRT BO LORDSHIP INSURANCE BROKERS LTD IFO SWISS',
      }),
    ]
    expect(isLevyPayment(payments[0]!)).toBe(true)
    expect(paymentHasTransferCounterpart(payments[1]!, debits)).toBe(true)
    const { total, rows } = computeUnpresentedChequesTotal(payments, debits, [], 0)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe('p3')
    expect(total).toBe(944)
  })

  it('links withdrawal debits by amount and payee when Ecobank truncates chq refs', () => {
    const payments = [tx({ id: 'p1', amount: 2000, chqNo: '002112', name: 'Philip Akuffo' })]
    const debits = [
      tx({
        id: 'd1',
        amount: 2000,
        details: 'CHEQUE WITHDRAWAL CHEQUE WITHDRAWAL- EGH CHQ NO 212PAID TO AKUFFO PHILIP KWAME-0',
      }),
    ]
    const { rows } = computeUnpresentedChequesTotal(payments, debits, [], 0)
    expect(rows).toHaveLength(0)
  })
})

describe('computeBankOnlyCreditsTotal', () => {
  it('excludes inward clearing and FT consolidation; keeps outward clearing and treasury', () => {
    const credits = [
      tx({
        id: 'c1',
        amount: 9500,
        details: 'CHEQUE CLEARING - INWARD LCY ECOBANK CHQ NO 002129 received from Clearing',
      }),
      tx({
        id: 'c2',
        amount: 1937.92,
        details: 'FT Consolidation for SDMC PAYROLL UPLOAD:SALARY AND COMM',
      }),
      tx({
        id: 'c3',
        amount: 1247.1,
        details: 'CHEQUE CLEARING - OUTWARD LCY OMNI BANK CHQ# 206046',
      }),
      tx({ id: 'c4', amount: 114947, details: 'TREASURY BILLS MATURED 182-DAY' }),
    ]
    expect(isCreditReclassifiedAsDebit(credits[0]!)).toBe(true)
    expect(isCreditReclassifiedAsDebit(credits[1]!)).toBe(true)
    expect(isCreditReclassifiedAsDebit(credits[2]!)).toBe(false)
    const total = computeBankOnlyCreditsTotal(credits, [], [], 0)
    expect(total).toBe(1247.1 + 114947)
  })
})

describe('computeBankOnlyDebitsTotal', () => {
  it('adds reclassified inward clearing and FT credits to bank-only debits', () => {
    const debits = [tx({ id: 'd1', amount: 10, details: 'FUNDS TRANSFER OUTWARD Charge on BO LORDSHIP' })]
    const credits = [
      tx({
        id: 'c1',
        amount: 2280,
        details: 'CHEQUE CLEARING - INWARD LCY ECOBANK CHQ NO 002130 received from Clearing',
      }),
      tx({ id: 'c2', amount: 1944.65, details: 'FT Consolidation for SDMC' }),
    ]
    const total = computeBankOnlyDebitsTotal(debits, credits, [], 0.01, new Set())
    expect(total).toBe(10 + 2280 + 1944.65)
  })

  it('excludes withdrawal debits when a matched payment shares the amount', () => {
    const debits = [tx({ id: 'd1', amount: 13000, details: 'CHEQUE WITHDRAWAL EGH CHQ 2132 PAID TO ALEX' })]
    const payments = [tx({ id: 'p1', amount: 13000, chqNo: '002102', name: 'Philip Akuffo' })]
    const total = computeBankOnlyDebitsTotal(debits, [], payments, 0.01, new Set(['p1']))
    expect(total).toBe(0)
  })

  it('excludes reclassified clearing credits linked to a judgment payment', () => {
    const credits = [
      tx({
        id: 'c1',
        amount: 2244,
        chqNo: '925881',
        details: 'CHEQUE CLEARING - INWARD LCY ECOBANK CHQ NO 925881',
      }),
    ]
    const payments = [
      tx({ id: 'p1', amount: 2244, chqNo: '926062', name: 'Sodium Solutions', details: 'Judgment debt' }),
    ]
    expect(clearingCreditHasPaymentCounterpart(credits[0]!, payments)).toBe(true)
    const total = computeBankOnlyDebitsTotal([], credits, payments)
    expect(total).toBe(0)
  })

  it('excludes debit-posted clearing lines for sole judgment payments (9033 Doris/Rita)', () => {
    const debits = [
      tx({ id: 'd1', amount: 2500, details: 'CHQ NO 925886 received from Clearing' }),
      tx({
        id: 'd2',
        amount: 785,
        details: 'CHEQUE CLEARING - INWARD LCY ECOBANK CHQ NO 925880 received from Clearing',
      }),
    ]
    const payments = [
      tx({ id: 'p1', amount: 2500, chqNo: '925978', name: 'Doris Quayson' }),
      tx({ id: 'p2', amount: 2500, chqNo: '926118', name: 'Doris Quayson' }),
      tx({ id: 'p3', amount: 2500, chqNo: '926062', name: 'Doris Quayson' }),
      tx({ id: 'p4', amount: 785, chqNo: '925972', name: 'Rita Korkoi Mensah (Brice)' }),
      tx({ id: 'p5', amount: 785, chqNo: '926100', name: 'Rita Korkoi Mensah (Brice)' }),
      tx({ id: 'p6', amount: 785, chqNo: '926057', name: 'Rita Korkoi Mensah (Brice)' }),
    ]
    const matched = new Set(['p1', 'p2', 'p4', 'p5'])
    expect(
      ecobankClearingLineHasPaymentCounterpart(debits[0]!, payments, 0.01, { matchedPaymentIds: matched })
    ).toBe(true)
    expect(
      ecobankClearingLineHasPaymentCounterpart(debits[1]!, payments, 0.01, { matchedPaymentIds: matched })
    ).toBe(true)
    const total = computeBankOnlyDebitsTotal(debits, [], payments, 0.01, matched)
    expect(total).toBe(0)
  })

  it('excludes HSE deposits paired to statutory payments when workbook netting is on', () => {
    const debits = [
      tx({
        id: 'd1',
        amount: 2981.81,
        chqNo: '926094',
        details: 'HSE CHEQUE-EGH CHQ NO 926094 B/O LORDSHIP INSURANCE BROKERS LIMITED',
      }),
    ]
    const payments = [
      tx({ id: 'p1', amount: 2981.81, chqNo: '926092', name: 'GRA', details: 'Payment of staff PAYE' }),
    ]
    const total = computeBankOnlyDebitsTotal(debits, [], payments, 0.01, undefined, undefined, {
      workbookNetting: true,
    })
    expect(total).toBe(0)
  })

  it('honours workbook exclude bank ids', () => {
    const debits = [tx({ id: 'd1', amount: 3000, details: 'CHEQUE WITHDRAWAL CHQ 925989' })]
    const total = computeBankOnlyDebitsTotal(debits, [], [], 0.01, undefined, new Set(['d1']))
    expect(total).toBe(0)
  })
})

describe('creditHasCashBookCounterpart', () => {
  it('keeps withdrawal credits in bank-only even when amount matches a payment', () => {
    const credit = tx({
      id: 'c1',
      amount: 3000,
      details: 'CHEQUE WITHDRAWAL CHEQUE WITHDRAWAL- EGH CHQ 2103 PAID TO ALEX',
    })
    const payments = [tx({ id: 'p1', amount: 3000, chqNo: '002103', name: 'Philip Akuffo' })]
    expect(creditHasCashBookCounterpart(credit, payments, [])).toBe(false)
  })
})

describe('suggestEcobankPaymentDebitMatches', () => {
  it('prefers chq/ref + amount over payee when bank line cites a different chq', () => {
    const payments = [
      tx({ id: 'p1', amount: 5000, chqNo: '925976', name: 'Philip akuffo', details: 'Part payment of ED fuel' }),
      tx({ id: 'p2', amount: 5000, chqNo: '926075', name: 'Royal Adjei', details: 'Payment of Short Loan' }),
    ]
    const debits = [
      tx({
        id: 'd1',
        amount: 5000,
        chqNo: '925976',
        details: 'WITHDRAWAL- EGH CHQ NO 925976 PD TO ROYAL ADJEI - 0246136244',
      }),
    ]
    const result = suggestEcobankPaymentDebitMatches(payments, debits, new Set(), new Set())
    expect(result).toHaveLength(1)
    expect(result[0]!.cashBookTx.id).toBe('p1')
    expect(result[0]!.reason).toContain('chq/ref + amount')
  })
  it('suggests cross-chq withdrawal when payee matches but bank cites a different chq', () => {
    const payments = [
      tx({ id: 'p2', amount: 5000, chqNo: '926075', name: 'Royal Adjei', details: 'Payment of Short Loan' }),
    ]
    const debits = [
      tx({
        id: 'd1',
        amount: 5000,
        chqNo: '925976',
        details: 'WITHDRAWAL- EGH CHQ NO 925976 PD TO ROYAL ADJEI - 0246136244',
      }),
    ]
    const result = suggestEcobankPaymentDebitMatches(payments, debits, new Set(), new Set())
    expect(result).toHaveLength(1)
    expect(result[0]!.cashBookTx.id).toBe('p2')
    expect(result[0]!.reason).toContain('cross-chq')
  })
  it('suggests transfer payment ↔ outward transfer debit', () => {
    const payments = [
      tx({
        id: 'p1',
        amount: 82500,
        chqNo: '002105',
        name: 'SWISS GROUP LTD',
        details: 'Support in purchasing ED vehicle',
      }),
    ]
    const debits = [
      tx({
        id: 'd1',
        amount: 82500,
        details: 'FUNDS TRANSFER OUTWARD - LOCAL NRT BO LORDSHIP INSURANCE BROKERS LTD IFO SWISS',
      }),
    ]
    const result = suggestEcobankPaymentDebitMatches(payments, debits, new Set(), new Set())
    expect(result).toHaveLength(1)
    expect(result[0]!.confidence).toBeGreaterThanOrEqual(0.9)
  })
})

describe('resolveEcobankGhanaProfile', () => {
  it('activates for Ecobank bank accounts and inward clearing text', () => {
    expect(
      resolveEcobankGhanaProfile({
        bankAccounts: [{ name: 'Ecobank Tesano 9035', bankName: 'Ecobank' }],
      }).active
    ).toBe(true)
    expect(
      resolveEcobankGhanaProfile({
        sampleBankText: 'CHEQUE CLEARING - INWARD LCY ECOBANK CHQ NO 002085',
      }).active
    ).toBe(true)
    expect(resolveEcobankGhanaProfile({ bankAccounts: [{ name: 'GCB Main' }] }).active).toBe(false)
  })

  it('enables workbook netting only when opted in (env or explicit flag)', () => {
    expect(
      resolveEcobankGhanaProfile({
        bankAccounts: [{ name: 'Ecobank Tesano', bankName: 'Ecobank' }],
      }).workbookNetting
    ).toBe(false)
    expect(
      resolveEcobankGhanaProfile({
        bankAccounts: [{ name: 'Ecobank Tesano', bankName: 'Ecobank' }],
        workbookNetting: true,
      }).workbookNetting
    ).toBe(true)
    expect(resolveEcobankGhanaProfile({ bankAccounts: [{ name: 'GCB Main' }] }).workbookNetting).toBe(false)
  })
})

describe('isEcobankPatternMatchReason', () => {
  it('matches clearing, transfer, and withdrawal suggestion reasons', () => {
    expect(isEcobankPatternMatchReason('Ecobank clearing: chq/ref + amount')).toBe(true)
    expect(isEcobankPatternMatchReason('Ecobank transfer: amount + payee')).toBe(true)
    expect(isEcobankPatternMatchReason('amount + date match')).toBe(false)
  })
})

describe('buildBankOnlyScheduleRows', () => {
  it('reclassifies inward clearing credits onto the debit schedule', () => {
    const debits = [tx({ id: 'd1', amount: 10, details: 'SERVICE CHARGE' })]
    const credits = [
      tx({
        id: 'c1',
        amount: 2280,
        details: 'CHEQUE CLEARING - INWARD LCY ECOBANK CHQ NO 002130',
      }),
      tx({ id: 'c2', amount: 1247.1, details: 'CHEQUE CLEARING - OUTWARD LCY OMNI BANK' }),
    ]
    const { debits: bod, credits: boc } = buildBankOnlyScheduleRows(debits, credits, [], [])
    expect(bod).toHaveLength(2)
    expect(bod.some((r) => r.id === 'c1')).toBe(true)
    expect(boc).toHaveLength(1)
    expect(boc[0]!.id).toBe('c2')
  })
})

describe('mergePaymentSuggestions', () => {
  it('prefers clearing suggestions over standard when same cash book row', () => {
    const clearing = [
      {
        cashBookTx: tx({ id: 'p1', amount: 100, chqNo: '001' }),
        bankTx: tx({ id: 'c1', amount: 100, details: 'CHEQUE CLEARING - INWARD' }),
        confidence: 0.95,
        reason: 'clearing',
      },
    ]
    const standard = [
      {
        cashBookTx: tx({ id: 'p1', amount: 100, chqNo: '001' }),
        bankTx: tx({ id: 'd1', amount: 100, details: 'CHEQUE WITHDRAWAL' }),
        confidence: 0.9,
        reason: 'debit',
      },
    ]
    const merged = mergePaymentSuggestions(clearing, standard)
    expect(merged).toHaveLength(1)
    expect(merged[0]!.bankTx.id).toBe('c1')
  })
})
