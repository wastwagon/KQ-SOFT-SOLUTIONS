import { describe, it, expect } from 'vitest'
import {
  applyCurrentPeriodRollForwardFilter,
  buildRollForwardSnapshot,
  chequeRollForwardKey,
  computeOutstandingAtEndOfChain,
  computeSnapshotUnpresentedRows,
  listPriorOutstandingChequeRows,
  paymentAppearsInCurrentPeriod,
  paymentClearedInCurrentPeriod,
} from './brsRollForward.js'
import type { ClearingTxLike } from './ecobankClearingMatcher.js'

const tx = (partial: Partial<ClearingTxLike> & Pick<ClearingTxLike, 'id' | 'amount'>): ClearingTxLike => ({
  chqNo: null,
  details: null,
  name: null,
  date: null,
  docRef: null,
  ...partial,
})

describe('brsRollForward', () => {
  it('matches cheques across periods by chq number and amount', () => {
    const prior = tx({ id: 'p1', amount: 2000, chqNo: '925928', date: '2026-01-01' })
    const current = tx({ id: 'c1', amount: 2000, chqNo: '925928', date: '2026-04-15', name: 'Different' })
    expect(chequeRollForwardKey(prior.chqNo, prior.amount)).toBe(chequeRollForwardKey(current.chqNo, current.amount))
    expect(paymentAppearsInCurrentPeriod(prior, [current])).toBe(true)
  })

  it('uses Ecobank unpresented rows (not all unmatched payments) for roll-forward source', () => {
    const snapshot = buildRollForwardSnapshot({
      name: 'Q1 9033',
      bankAccounts: [{ name: 'Ecobank 9033' }],
      receipts: [],
      payments: [
        tx({ id: 'a1', amount: 4839.56, chqNo: '926073', name: 'ECG' }),
        tx({ id: 'a2', amount: 650, chqNo: '926072' }),
        tx({ id: 'a3', amount: 510.7, chqNo: '926023' }),
        tx({ id: 'a4', amount: 2000, chqNo: '925928' }),
        tx({ id: 'b1', amount: 5000, chqNo: '925976', name: 'Philip', details: 'ED fuel' }),
        tx({ id: 'j1', amount: 700, chqNo: '925981', name: 'VODAFONE' }),
      ],
      debits: [
        tx({
          id: 'w1',
          amount: 5000,
          details: 'WITHDRAWAL- EGH CHQ NO 925976 PD TO ROYAL',
        }),
      ],
      credits: [],
      matches: [
        {
          matchItems: [
            { transactionId: 'b1', side: 'cash_book' },
            { transactionId: 'w1', side: 'bank' },
          ],
        },
      ],
    })
    const unmatchedOnly = snapshot.payments.filter((p) => !snapshot.matchedCbIds.has(p.id))
    expect(unmatchedOnly).toHaveLength(5)
    const rows = computeSnapshotUnpresentedRows(snapshot, 0, { workbookNetting: true })
    expect(rows).toHaveLength(4)
    expect(rows.map((r) => r.chqNo).sort()).toEqual(['925928', '926023', '926072', '926073'])
  })

  it('drops brought-forward cheques that clear on the current bank statement', () => {
    const prior = tx({ id: 'u1', amount: 2000, chqNo: '925928' })
    const cleared = paymentClearedInCurrentPeriod(
      prior,
      [tx({ id: 'd1', amount: 2000, chqNo: '925928', details: 'WITHDRAWAL CHQ 925928' })],
      []
    )
    expect(cleared).toBe(true)
    const items = applyCurrentPeriodRollForwardFilter(
      [prior],
      {
        payments: [],
        debits: [tx({ id: 'd1', amount: 2000, chqNo: '925928', details: 'WITHDRAWAL CHQ 925928' })],
        credits: [],
      },
      'Q1'
    )
    expect(items).toHaveLength(0)
  })

  it('carries all unmatched payments for non-Ecobank roll-forward', () => {
    const q1 = buildRollForwardSnapshot({
      name: 'Q1 GCB',
      bankAccounts: [{ name: 'GCB Main Branch' }],
      receipts: [],
      payments: [
        tx({ id: 'g1', amount: 1200, chqNo: '100001' }),
        tx({ id: 'g2', amount: 800, chqNo: '100002' }),
      ],
      debits: [],
      credits: [],
      matches: [],
    })
    const rows = computeSnapshotUnpresentedRows(q1, 0, { workbookNetting: false })
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.chqNo).sort()).toEqual(['100001', '100002'])
  })

  it('chains multi-period outstanding cheques oldest to newest', () => {
    const q1 = buildRollForwardSnapshot({
      name: 'Q1',
      bankAccounts: [{ name: 'Ecobank' }],
      receipts: [],
      payments: [tx({ id: 'q1p', amount: 1000, chqNo: '111111' })],
      debits: [],
      credits: [],
      matches: [],
    })
    const q2 = buildRollForwardSnapshot({
      name: 'Q2',
      bankAccounts: [{ name: 'Ecobank' }],
      receipts: [],
      payments: [tx({ id: 'q2p', amount: 500, chqNo: '222222' })],
      debits: [],
      credits: [],
      matches: [],
    })
    const outstanding = computeOutstandingAtEndOfChain([q1, q2], { workbookNetting: false })
    expect(outstanding.map((r) => r.chqNo).sort()).toEqual(['111111', '222222'])
    const bf = listPriorOutstandingChequeRows(q2, [
      {
        date: '2026-01-31',
        name: 'Prior',
        chqNo: '111111',
        amount: 1000,
        fromProject: 'Q1',
      },
    ])
    expect(bf.map((r) => r.chqNo).sort()).toEqual(['111111', '222222'])
  })
})
