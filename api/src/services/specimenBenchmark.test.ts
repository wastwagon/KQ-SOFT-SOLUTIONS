import { describe, expect, it } from 'vitest'
import {
  amountsClose,
  formatBenchmarkSummary,
  runSpecimenBenchmark,
  summarizeParsedAmounts,
} from './specimenBenchmark.js'

describe('specimenBenchmark helpers', () => {
  it('amountsClose tolerates cent-level drift', () => {
    expect(amountsClose(100, 100.04)).toBe(true)
    expect(amountsClose(100, 100.2)).toBe(false)
    expect(amountsClose(1_000_000, 1_000_000.5)).toBe(true)
  })

  it('summarizeParsedAmounts uses debit/credit headers', () => {
    const headers = ['Date', 'Description', 'Debit', 'Credit']
    const rows = [
      ['2025-01-01', 'A', 10, 0],
      ['2025-01-02', 'B', 0, 25.5],
    ]
    expect(summarizeParsedAmounts(headers, rows)).toEqual({ sumDebit: 10, sumCredit: 25.5 })
  })
})

describe('corrected specimen parse regression (excel)', () => {
  it(
    're-parses excel originals to match manifest row counts and totals',
    async () => {
      const report = await runSpecimenBenchmark({
        excelOnly: true,
        includeMatch: true,
      })
      // Soft floor: matching pairs should produce some suggestions on real data.
      for (const m of report.match.rows) {
        expect(m.cashBookRows).toBeGreaterThan(0)
        expect(m.bankRows).toBeGreaterThan(0)
        expect(m.receiptSuggestions + m.paymentSuggestions + m.splitSuggestions).toBeGreaterThan(0)
      }

      const acct4702 = report.match.rows.find((m) => m.bankId === '15-acct4702-test-data')
      expect(acct4702).toBeTruthy()
      expect(acct4702!.sideInversion).toBe(true)
      // After side-inversion, coverage should be strong on this SCB/TGL pair.
      expect(acct4702!.receiptCoverage).toBeGreaterThan(0.7)
      expect(acct4702!.paymentCoverage).toBeGreaterThan(0.7)

      const acct430 = report.match.rows.find((m) => m.bankId === '16-acct430-test-data')
      expect(acct430).toBeTruthy()
      // Euro FC amounts should unlock real overlap with the EUR bank statement.
      expect(acct430!.receiptSuggestions + acct430!.paymentSuggestions).toBeGreaterThan(0)

      if (report.parse.failed > 0) {
        console.error(formatBenchmarkSummary(report))
      }
      expect(report.parse.failed, formatBenchmarkSummary(report)).toBe(0)
      expect(report.parse.passed).toBeGreaterThan(10)
    },
    120_000
  )
})

describe('corrected specimen parse regression (small PDFs)', () => {
  it(
    're-parses compact Ghana PDF originals against the manifest',
    async () => {
      const report = await runSpecimenBenchmark({
        excelOnly: false,
        includeMatch: false,
        bankIds: ['02-nib', '05-absa', '07-umb'],
      })
      // Skip excel companions in these folders for this assertion focus — filter PDF rows.
      const pdfRows = report.parse.rows.filter((r) => /\.pdf$/i.test(r.file) || /pdf/i.test(r.type))
      expect(pdfRows.length).toBeGreaterThan(0)
      const failed = pdfRows.filter((r) => !r.pass)
      if (failed.length) {
        console.error(formatBenchmarkSummary(report))
      }
      expect(failed.length).toBe(0)
    },
    180_000
  )
})
