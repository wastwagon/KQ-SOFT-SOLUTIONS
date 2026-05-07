import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  computeBrsMetrics,
  deriveCashBookFromWorkbookSchedule,
  extractCashBookClosingBalanceFromDoc,
  extractSourceClosingBalanceFromDocs,
  hasChequeOrRefLink,
  refTokensEquivalent,
} from './report.js'

describe('report helpers', () => {
  it('extracts declared closing balances from source workbooks', () => {
    const repoRoot = path.resolve(process.cwd(), '..')
    const cashbook = path.join(repoRoot, 'new-test-data', 'Qtestcash book.xlsx')
    const bankStatement = path.join(repoRoot, 'new-test-data', 'Qtestbank statement.xlsx')

    expect(extractCashBookClosingBalanceFromDoc(cashbook)).toBe(4000)
    expect(extractCashBookClosingBalanceFromDoc(bankStatement)).toBe(4566.86)
    expect(extractSourceClosingBalanceFromDocs([bankStatement, cashbook])).toBe(4566.86)
  })

  it('matches cheque/ref tokens using suffix equivalence', () => {
    expect(refTokensEquivalent('122358', '358')).toBe(true)
    expect(refTokensEquivalent('000299', '299')).toBe(true)
    expect(refTokensEquivalent('122358', '122359')).toBe(false)
  })

  it('links bank debits to cash-book rows via cheque text', () => {
    const cashBook = {
      id: 'cb1',
      date: '2023-01-11',
      name: 'ken',
      details: null,
      chqNo: '122358',
      docRef: '028',
      amount: 200,
    }
    const bankDebit = {
      id: 'bk1',
      date: '2023-01-11',
      name: null,
      details: 'ken chq no 358',
      chqNo: null,
      docRef: null,
      amount: 200,
    }
    expect(hasChequeOrRefLink(cashBook, bankDebit)).toBe(true)
  })

  it('computes consistent primary and diagnostic balances', () => {
    const noStatement = computeBrsMetrics({
      balancePerCashBook: 4000,
      uncreditedLodgmentsTotal: 4000,
      uncreditedLodgmentsTimingTotal: 4000,
      unpresentedChequesTotal: 5000,
      bankOnlyCreditsNotInCashBookTotal: 0,
      bankOnlyDebitsNotInCashBookTotal: 833.14,
      bankStatementClosingBalance: null,
    })
    expect(noStatement.bankClosingBalanceGhanaStyle).toBeCloseTo(4166.86, 2)
    expect(noStatement.bankClosingBalance).toBeCloseTo(4166.86, 2)
    expect(noStatement.bankClosingBalanceLegacy).toBeCloseTo(5000, 2)

    const withStatement = computeBrsMetrics({
      balancePerCashBook: 4000,
      uncreditedLodgmentsTotal: 4000,
      uncreditedLodgmentsTimingTotal: 4000,
      unpresentedChequesTotal: 5000,
      bankOnlyCreditsNotInCashBookTotal: 0,
      bankOnlyDebitsNotInCashBookTotal: 833.14,
      bankStatementClosingBalance: 4566.86,
    })
    expect(withStatement.bankClosingBalance).toBeCloseTo(4566.86, 2)
    expect(withStatement.bankClosingBalanceGhanaStyle).toBeCloseTo(4166.86, 2)
  })

  it('derives cash book from workbook schedule (same order as primary BRS rows)', () => {
    const derived = deriveCashBookFromWorkbookSchedule({
      bankClosingBalance: 4566.86,
      uncreditedLodgmentsTimingTotal: 4000,
      unpresentedChequesTotal: 5400,
      bankOnlyDebitsNotInCashBookTotal: 833.14,
      bankOnlyCreditsNotInCashBookTotal: 0,
    })
    expect(derived).toBeCloseTo(4000, 2)
  })
})
