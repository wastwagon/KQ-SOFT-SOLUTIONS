import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { parseExcel } from '../services/parser.js'
import {
  computeBrsMetrics,
  deriveCashBookFromWorkbookSchedule,
  extractCashBookClosingBalanceFromDoc,
  extractSourceClosingBalanceFromDocs,
  parseImportedAmount,
} from './report.js'

const repoRoot = path.resolve(process.cwd(), '..')

function readGolden() {
  const p = path.join(repoRoot, 'new-test-data', 'qtest-licl-golden.json')
  const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>
  const golden = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('_'))) as Record<string, unknown>
  return golden as {
    sourceFiles: string[]
    currency: string
    balancePerCashBook: number
    bankStatementClosingBalance: number
    uncreditedLodgmentsTimingTotal: number
    unpresentedChequesTotal: number
    bankOnlyDebitsNotInCashBookTotal: number
    bankOnlyCreditsNotInCashBookTotal: number
    layoutReference: Record<string, unknown>
  }
}

describe('Qtest LICL golden workbook figures (fixture-driven)', () => {
  const cashbookPath = path.join(repoRoot, 'new-test-data', 'Qtestcash book.xlsx')
  const bankPath = path.join(repoRoot, 'new-test-data', 'Qtestbank statement.xlsx')
  const golden = readGolden()

  it('reads declared closing balances from the Qtest Excel sources', () => {
    expect(extractCashBookClosingBalanceFromDoc(cashbookPath)).toBeCloseTo(golden.balancePerCashBook, 4)
    expect(extractSourceClosingBalanceFromDocs([bankPath])).toBeCloseTo(golden.bankStatementClosingBalance, 4)
    // First non-null wins; cash book precedes bank in some callers — enforce bank-last when stacking.
    expect(extractSourceClosingBalanceFromDocs([bankPath, cashbookPath])).toBeCloseTo(golden.bankStatementClosingBalance, 4)
  })

  it('sums bank debits tagged with REF lines (Ecobank-style clearing/settlement rows) from the workbook to 833.14', () => {
    const { headers, rows } = parseExcel(bankPath)
    const descIdx = headers.findIndex((h) => /description/i.test(String(h)))
    const debitIdx = headers.findIndex((h) =>String(h).trim().toLowerCase() === 'debit')
    expect(descIdx).toBeGreaterThanOrEqual(0)
    expect(debitIdx).toBeGreaterThanOrEqual(0)

    let clearingSum = 0
    for (const row of rows as unknown[][]) {
      const desc = String(row[descIdx] ?? '').trim()
      if (!/^ref\s*:/i.test(desc)) continue
      clearingSum += parseImportedAmount(row[debitIdx])
    }

    expect(clearingSum).toBeCloseTo(golden.bankOnlyDebitsNotInCashBookTotal, 2)
  })

  it('locates the 4,000 uncredited lodgment receipt on the parsed cash workbook (dan / sales)', () => {
    const { headers, rows } = parseExcel(cashbookPath)
    const nameIdx = headers.findIndex((h) => /^name$/i.test(String(h).trim()))
    const recvIdx = headers.findIndex((h) => /amt\s*received/i.test(String(h)))
    expect(nameIdx).toBeGreaterThanOrEqual(0)
    expect(recvIdx).toBeGreaterThanOrEqual(0)

    const hits = rows.filter((row) => {
      const nm = String((row as unknown[])[nameIdx] ?? '').toLowerCase()
      const amt = parseImportedAmount((row as unknown[])[recvIdx])
      return nm.includes('dan') && Math.abs(amt - golden.uncreditedLodgmentsTimingTotal) < 0.01
    })

    expect(hits.length).toBeGreaterThanOrEqual(1)
  })

  it('tie-out matches the LICL two-column workbook (same arithmetic the UI renders)', () => {
    const { bankStatementClosingBalance, balancePerCashBook, uncreditedLodgmentsTimingTotal, unpresentedChequesTotal } =
      golden
    const { bankOnlyDebitsNotInCashBookTotal, bankOnlyCreditsNotInCashBookTotal } = golden

    const derivedCash =
      bankStatementClosingBalance +
      uncreditedLodgmentsTimingTotal -
      unpresentedChequesTotal +
      bankOnlyDebitsNotInCashBookTotal -
      bankOnlyCreditsNotInCashBookTotal

    expect(derivedCash).toBeCloseTo(balancePerCashBook, 2)

    const uncreditedLodgmentsTotal = uncreditedLodgmentsTimingTotal
    const m = computeBrsMetrics({
      balancePerCashBook,
      uncreditedLodgmentsTotal,
      uncreditedLodgmentsTimingTotal,
      unpresentedChequesTotal,
      bankOnlyCreditsNotInCashBookTotal,
      bankOnlyDebitsNotInCashBookTotal,
      bankStatementClosingBalance,
    })

    expect(m.bankClosingBalance).toBeCloseTo(bankStatementClosingBalance, 2)
    expect(m.bankClosingBalanceGhanaStyle).toBeCloseTo(
      balancePerCashBook -
        uncreditedLodgmentsTimingTotal +
        unpresentedChequesTotal +
        (bankOnlyCreditsNotInCashBookTotal - bankOnlyDebitsNotInCashBookTotal),
      2,
    )
    const workbookDerived = deriveCashBookFromWorkbookSchedule({
      bankClosingBalance: bankStatementClosingBalance,
      uncreditedLodgmentsTimingTotal,
      unpresentedChequesTotal,
      bankOnlyDebitsNotInCashBookTotal,
      bankOnlyCreditsNotInCashBookTotal,
    })
    expect(workbookDerived).toBeCloseTo(balancePerCashBook, 2)
  })

  it('golden JSON lists the Qtest source files and layout row order for product alignment', () => {
    expect(golden.sourceFiles).toContain('Qtestcash book.xlsx')
    expect(golden.sourceFiles).toContain('Qtestbank statement.xlsx')
    const rows = golden.layoutReference.rowOrder as string[]
    expect(rows[0]).toMatch(/closing balance per bank statement/i)
    expect(rows).toContain('Cash book balance at end of period')
  })
})
