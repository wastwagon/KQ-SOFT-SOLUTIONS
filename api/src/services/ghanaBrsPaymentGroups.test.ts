import { describe, it, expect } from 'vitest'
import {
  classifyGhanaBrsPayment,
  computeWorkingPaperFromClearingOffsets,
  summarizeGhanaBrsPaymentGroups,
} from './ghanaBrsPaymentGroups.js'
import type { ClearingTxLike } from './ecobankClearingMatcher.js'

const tx = (partial: Partial<ClearingTxLike> & Pick<ClearingTxLike, 'id' | 'amount'>): ClearingTxLike => ({
  chqNo: null,
  details: null,
  name: null,
  date: null,
  ...partial,
})

describe('ghanaBrsPaymentGroups', () => {
  it('classifies Account901-style rows into permanent groups', () => {
    const payments = [
      tx({ id: 'a1', amount: 4839.56, chqNo: '926073', name: 'ECG' }),
      tx({ id: 'b1', amount: 950, chqNo: '926101', name: 'Samuel Narh - Board Secretary' }),
      tx({ id: 'b2', amount: 5000, chqNo: '926075', name: 'Royal Adjei - Short Loan' }),
      tx({ id: 'star', amount: 5000, chqNo: '925976', name: 'Philip - fuel allowance' }),
      tx({ id: 'j1', amount: 2981.81, chqNo: '926092', name: 'GRA' }),
      tx({ id: 'r2', amount: 3000, chqNo: '925987', name: 'Philip Akuffo' }),
    ]
    const bankDebits = [
      tx({
        id: 'bd1',
        amount: 5000,
        details: 'WITHDRAWAL- EGH CHQ NO 925976 PD TO ROYAL',
      }),
    ]

    expect(classifyGhanaBrsPayment(payments[0], bankDebits, [])).toBe('section_a')
    expect(classifyGhanaBrsPayment(payments[1], bankDebits, [])).toBe('timing_open')
    expect(classifyGhanaBrsPayment(payments[2], bankDebits, [])).toBe('timing_open')
    expect(classifyGhanaBrsPayment(payments[3], bankDebits, [])).toBe('timing_bank_linked')
    expect(classifyGhanaBrsPayment(payments[4], bankDebits, [])).toBe('judgment')
    expect(classifyGhanaBrsPayment(payments[5], bankDebits, [])).toBe('round2_contra')

    const summary = summarizeGhanaBrsPaymentGroups(payments, bankDebits, [])
    expect(summary.sectionATotal).toBeCloseTo(4839.56, 2)
    expect(summary.openTimingTotal).toBeCloseTo(5950, 2)
    expect(summary.workingUnpresentedTotal).toBeCloseTo(4839.56 + 5950, 2)
    expect(summary.scheduleExplanation).toMatch(/Working \(\?\?\)/)
  })

  it('treats security / board secretary payees as open timing without amount whitelist', () => {
    const p = tx({
      id: 'sec',
      amount: 1200,
      chqNo: '999001',
      name: 'Skones Security Ltd - Payment of Security Services',
    })
    expect(classifyGhanaBrsPayment(p, [], [])).toBe('timing_open')
  })

  it('builds Account902 Working (??) unpresented from Face + finders clearing offsets', () => {
    const faceRows = [
      tx({ id: 'u1', amount: 944, chqNo: '002079', name: 'Alex' }),
      tx({ id: 'u2', amount: 710, chqNo: '002101', name: 'Philip' }),
      tx({ id: 'u3', amount: 969.18, chqNo: '002117' }),
    ]
    const faceTotal = 2623.18
    const matched = [
      {
        payment: tx({ id: 'p1', amount: 7605, chqNo: '002065', name: 'GM / Payment of finders fees - GM' }),
        bankDebit: tx({
          id: 'b1',
          amount: 7605,
          details: 'CHEQUE DEPOSIT - HSE CHEQUE- EGH CHQ NO. 002065',
        }),
      },
      {
        payment: tx({ id: 'p2', amount: 9978.21, chqNo: '002059', name: 'Payment of finders fees for Cocoa Marketing' }),
        bankDebit: tx({
          id: 'b2',
          amount: 9978.21,
          details: 'CHEQUE CLEARING - INWARD LCY ECOBANK CHQ NO 002059',
        }),
      },
      {
        payment: tx({ id: 'p3', amount: 1327.31, chqNo: '002066', name: 'Helina Yeboah / finders fees' }),
        bankDebit: tx({
          id: 'b3',
          amount: 1327.31,
          details: 'CHEQUE DEPOSIT - HSE CHEQUE-EGH CHQ 2066',
        }),
      },
      {
        payment: tx({ id: 'p4', amount: 3521.55, chqNo: '002091', name: 'IBAG' }),
        bankDebit: tx({
          id: 'b4',
          amount: 3521.55,
          details: 'CHEQUE CLEARING - INWARD LCY ECOBANK CHQ NO 002091',
        }),
      },
      {
        payment: tx({ id: 'p5', amount: 3521.55, chqNo: '002092', name: 'IBAG' }),
        bankDebit: tx({
          id: 'b5',
          amount: 3521.55,
          details: 'CHEQUE CLEARING - INWARD LCY ECOBANK CHQ NO 002092',
        }),
      },
    ]
    const result = computeWorkingPaperFromClearingOffsets(faceTotal, faceRows, matched)
    expect(result.clearingOffsetTotal).toBeCloseTo(25953.62, 2)
    expect(result.unpresentedChequesTotal).toBeCloseTo(28576.8, 2)
  })
})
