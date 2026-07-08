import { describe, expect, it } from 'vitest'
import path from 'path'
import fs from 'fs'
import {
  looksLikeAbsaStatementText,
  parseAbsaPdfText,
  shouldUseAbsaPdfParser,
} from './absaStatement.js'
import { parseBankPdf } from './documentParse.js'
import { buildSuggestedMappingForDocument, canAutoMap } from './autoMapDocument.js'

const ABSA_PDF = path.resolve(
  import.meta.dirname,
  '../../../adsastatementformat 2/ABSA cocoa purchases call deposit(2086268)-september,2023.pdf'
)

const SAMPLE_TEXT = `Absa Bank Ghana Limited
INTERIM STATEMENT
Opening Available Balance: 2.00
DateValue DateDescriptionSerial NoDebitCreditBalance
08/12/2022EBOX170,000,000.00170,000,000.00
URGENT PAYMENT
FT2234109356
GHANA COCOA BOARD
09/12/2022EBOX170,000,000.000.00
23/12/2022INVESTMENT BANK168285261,178,082.19261,178,082.19
28/12/2022EBOX261,178,082.190.00
07/07/2023EBOX200.002.00`

describe('absaStatement', () => {
  it('detects Absa interim PDF layout', () => {
    expect(looksLikeAbsaStatementText(SAMPLE_TEXT)).toBe(true)
  })

  it('parses glued Absa transaction lines', () => {
    const r = parseAbsaPdfText(SAMPLE_TEXT)
    expect(r.rows.length).toBeGreaterThanOrEqual(5)
    expect(r.headers).toContain('Debit')
    expect(r.headers).toContain('Credit')
    const creditRow = r.rows.find((row) => Number(row[5]) === 170_000_000)
    expect(creditRow).toBeTruthy()
    expect(r.rows[r.rows.length - 1]![6]).toBe(2)
  })

  it('shouldUseAbsaPdfParser flags generic junk headers', () => {
    expect(
      shouldUseAbsaPdfParser({
        headers: ['DateValue', 'DateDescriptionSerial', 'NoDebitCreditBalance'],
        rows: [['08/12/2022EBOX170,000,000.00170,000,000.00']],
      })
    ).toBe(true)
  })

  it('suggested mapping works on parsed Absa headers', () => {
    const r = parseAbsaPdfText(SAMPLE_TEXT)
    const cr = buildSuggestedMappingForDocument('bank_credits', r.headers, 'absa')
    const dr = buildSuggestedMappingForDocument('bank_debits', r.headers, 'absa')
    expect(canAutoMap('bank_credits', r.headers, cr)).toBe(true)
    expect(canAutoMap('bank_debits', r.headers, dr)).toBe(true)
  })

  it('parses real Absa call-deposit PDF specimen', async () => {
    if (!fs.existsSync(ABSA_PDF)) return

    const result = await parseBankPdf(ABSA_PDF)
    expect(result.parseMethod).toBe('absa_pdf')
    expect(result.headers).toContain('Debit')
    expect(result.headers).toContain('Credit')
    expect(result.rows.length).toBe(8)

    const sumDebit = result.rows.reduce((s, r) => s + (Number(r[4]) || 0), 0)
    const sumCredit = result.rows.reduce((s, r) => s + (Number(r[5]) || 0), 0)
    expect(sumCredit).toBeCloseTo(731_178_282.19, 0)
    expect(sumDebit).toBeCloseTo(731_178_280.19, 0)

    const lastBalance = Number(result.rows[result.rows.length - 1]![6])
    expect(lastBalance).toBeCloseTo(2, 0)
  }, 30000)
})
