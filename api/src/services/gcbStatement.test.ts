import { describe, expect, it } from 'vitest'
import path from 'path'
import fs from 'fs'
import {
  looksLikeGcbStatementText,
  parseGcbPdfText,
  shouldUseGcbPdfParser,
} from './gcbStatement.js'
import { parseBankPdf } from './documentParse.js'

const GCB_PDF = path.resolve(
  import.meta.dirname,
  '../../../gcbstatementformat/gcb republic house corporate(1061130000070)-sept.2023.pdf'
)

describe('gcbStatement', () => {
  it('detects GCB PDF layout from merged headers', () => {
    const sample =
      'DateDescriptionRef / Chq No.Value Date DebitCreditBalance\n01-Sep-2023Cash Deposit 106CHDP01-Sep-20231,600.002,983.41'
    expect(looksLikeGcbStatementText(sample)).toBe(true)
  })

  it('parses single-line GCB transaction tail', () => {
    const sample = `DateDescriptionRef / Chq No.Value Date DebitCreditBalance
Opening Balance
2,363.41
01-Sep-2023Cash Deposit// STANLEY COFFIE  106CHDP23244005201-Sep-20231,600.002,983.41`
    const r = parseGcbPdfText(sample)
    expect(r.rows.length).toBe(1)
    expect(r.rows[0]![1]).toMatch(/STANLEY COFFIE/i)
    expect(r.rows[0]![5]).toBe(1600)
    expect(r.rows[0]![6]).toBe(2983.41)
  })

  it('parses multi-line GCB cheque withdrawal block', () => {
    const sample = `DateDescriptionRef / Chq No.Value Date DebitCreditBalance
Opening Balance
2,363.41
01-Sep-2023
Cheque Withdrawal // FRANCIS GYAMFI OCRAN
106CQWL232440021
/Chq_No - 530773
01-Sep-20231,000.00383.41`
    const r = parseGcbPdfText(sample)
    expect(r.rows.length).toBe(1)
    expect(r.rows[0]![1]).toMatch(/Cheque Withdrawal/i)
    expect(r.rows[0]![4]).toBe(1000)
    expect(r.rows[0]![7]).toBe('530773')
  })

  it('shouldUseGcbPdfParser flags generic junk from line-splitter', () => {
    expect(
      shouldUseGcbPdfParser({
        headers: ['Opening', 'Balance'],
        rows: [['2,363.41'], ['Customer No. : 000012736']],
      })
    ).toBe(true)
  })

  it('parses real GCB Republic House PDF specimen', async () => {
    if (!fs.existsSync(GCB_PDF)) return

    const native = fs.readFileSync(GCB_PDF)
    const pdfParse = (await import('pdf-parse-new')).default as (
      b: Buffer
    ) => Promise<{ text: string }>
    const { text } = await pdfParse(native)
    expect(looksLikeGcbStatementText(text)).toBe(true)

    const parsed = parseGcbPdfText(text)
    expect(parsed.headers).toContain('Debit')
    expect(parsed.headers).toContain('Credit')
    expect(parsed.rows.length).toBeGreaterThan(285)
    expect(parsed.rows.length).toBeLessThan(295)

    const sumDebit = parsed.rows.reduce((s, r) => s + (Number(r[4]) || 0), 0)
    const sumCredit = parsed.rows.reduce((s, r) => s + (Number(r[5]) || 0), 0)
    expect(sumDebit).toBeGreaterThan(4_000_000)
    expect(sumCredit).toBeGreaterThan(4_000_000)

    const lastBalance = Number(parsed.rows[parsed.rows.length - 1]![6])
    expect(lastBalance).toBeCloseTo(11373.41, 0)
  }, 20000)

  it('parseBankPdf uses GCB parser for GCB specimen', async () => {
    if (!fs.existsSync(GCB_PDF)) return

    const result = await parseBankPdf(GCB_PDF)
    expect(result.parseMethod).toBe('gcb_pdf')
    expect(result.headers).toContain('Debit')
    expect(result.headers).toContain('Credit')
    expect(result.rows.length).toBeGreaterThan(285)
    expect(result.rows.length).toBeLessThan(295)
  }, 20000)
})
