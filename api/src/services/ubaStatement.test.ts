import { describe, expect, it } from 'vitest'
import path from 'path'
import fs from 'fs'
import {
  looksLikeUbaStatementText,
  parseUbaAmountLine,
  parseUbaPdfText,
  shouldUseUbaPdfParser,
} from './ubaStatement.js'
import { parseBankPdf } from './documentParse.js'
import { buildSuggestedMappingForDocument, canAutoMap } from './autoMapDocument.js'
import { detectGhanaBankFormat } from './ghanaBankParsers.js'

const UBA_PDF = path.resolve(
  import.meta.dirname,
  '../../../../uba(00111940701503)-sept.2023.pdf'
)
const UBA_PDF_DOWNLOADS = '/Users/OceanCyber/Downloads/uba(00111940701503)-sept.2023.pdf'

function resolveUbaPdf(): string | null {
  if (fs.existsSync(UBA_PDF)) return UBA_PDF
  if (fs.existsSync(UBA_PDF_DOWNLOADS)) return UBA_PDF_DOWNLOADS
  return null
}

describe('ubaStatement', () => {
  it('detects UBA PDF layout', () => {
    const text = `Africa's global bank
ACCOUNT STATEMENT (Sep 01, 2023 - Sep 30, 2023)
TRANS DATE VALUE DATE NARRATION DEBITCREDITBALANCE
01-Sep-2023 01-Sep-2023
TD0010497060019 : Closure
77,298,438.0977,321,885.34`
    expect(looksLikeUbaStatementText(text)).toBe(true)
  })

  it('parses glued amount lines', () => {
    expect(parseUbaAmountLine('77,298,438.0977,321,885.34')).toEqual({
      txn: 77_298_438.09,
      balance: 77_321_885.34,
    })
    expect(parseUbaAmountLine('46,056.00-22,608.75')).toEqual({
      txn: 46_056,
      balance: -22_608.75,
    })
    expect(parseUbaAmountLine('182.5123,423.29')).toEqual({
      txn: 182.51,
      balance: 23_423.29,
    })
  })

  it('shouldUseUbaPdfParser flags generic junk', () => {
    expect(
      shouldUseUbaPdfParser({
        headers: ['Col_0'],
        rows: [['Hello Ghana Cocoa Board !']],
      })
    ).toBe(true)
  })

  it('parses sample block text', () => {
    const text = `Opening Balance: 23,447.25
DEBITCREDITBALANCE
01-Sep-2023 01-Sep-2023 Opening Balance0.000.0023,447.25
01-Sep-2023 01-Sep-2023
TD0010497060019 : Closure Proceeds Credit to Repayment Acct.
77,298,438.0977,321,885.34
08-Sep-2023 01-Sep-2023
TD0010497060020 Deposit Opening TDA Account
77,298,438.0923,447.25`
    const r = parseUbaPdfText(text)
    expect(r.rows.length).toBe(2)
    expect(r.rows[0]![5]).toBeCloseTo(77_298_438.09, 0)
    expect(r.rows[1]![4]).toBeCloseTo(77_298_438.09, 0)
  })

  it('parses real UBA September 2023 specimen', async () => {
    const pdf = resolveUbaPdf()
    if (!pdf) return

    const result = await parseBankPdf(pdf)
    expect(result.parseMethod).toBe('uba_pdf')
    expect(result.headers).toContain('Debit')
    expect(result.headers).toContain('Credit')
    expect(result.rows.length).toBeGreaterThanOrEqual(10)
    expect(result.rows.length).toBeLessThanOrEqual(20)

    const format = detectGhanaBankFormat(result.headers, result.rows.slice(0, 5))
    expect(format).toBe('uba')

    const cr = buildSuggestedMappingForDocument('bank_credits', result.headers, format)
    const dr = buildSuggestedMappingForDocument('bank_debits', result.headers, format)
    expect(canAutoMap('bank_credits', result.headers, cr)).toBe(true)
    expect(canAutoMap('bank_debits', result.headers, dr)).toBe(true)

    const sumDebit = result.rows.reduce((s, r) => s + (Number(r[4]) || 0), 0)
    const sumCredit = result.rows.reduce((s, r) => s + (Number(r[5]) || 0), 0)
    expect(sumCredit).toBeCloseTo(77_372_243.32, 0)
    expect(sumDebit).toBeCloseTo(77_372_267.28, 0)

    const lastBalance = Number(result.rows[result.rows.length - 1]![6])
    expect(lastBalance).toBeCloseTo(23_423.29, 0)
  }, 30000)
})
