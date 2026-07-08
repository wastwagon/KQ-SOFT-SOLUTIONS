import { describe, expect, it } from 'vitest'
import path from 'path'
import fs from 'fs'
import {
  looksLikeAdbStatementText,
  parseAdbAmountTail,
  parseAdbPdfText,
  shouldUseAdbPdfParser,
} from './adbStatement.js'
import { parseBankPdf } from './documentParse.js'
import { parseExcel } from './parser.js'
import { buildSuggestedMappingForDocument, canAutoMap } from './autoMapDocument.js'
import { detectGhanaBankFormat } from './ghanaBankParsers.js'

const ADB_CALL_PDF = path.resolve(
  import.meta.dirname,
  '../../../adbstatementsformat/ADB COCOA BOD PURCHASE ACC CALL[1061810015800001]-september,2023.pdf'
)
const ADB_PURCHASE_PDF = path.resolve(
  import.meta.dirname,
  '../../../adbstatementsformat/adb COCOA BOD PURCHASE ACC[1061020015800001]-september,2023.pdf'
)
const ADB_CASH = path.resolve(import.meta.dirname, '../../../adbstatementsformat/ADB cash bk.xlsx')

describe('adbStatement', () => {
  it('detects ADB PDF layout', () => {
    const text = `STATEMENT OF ACCOUNT
DateBranchDescriptionReferenceValueDateDebitsCreditsBalance
01-09-2023106
SWEEPINAMOUNTTO
1061020015800001
106SWEP18268000701-09-202349,950.000.00681,704.88`
    expect(looksLikeAdbStatementText(text)).toBe(true)
  })

  it('parses glued amount tail', () => {
    expect(parseAdbAmountTail('106SWEP18268000701-09-202349,950.000.00681,704.88')).toEqual({
      prefix: '106SWEP182680007',
      reference: '106SWEP182680007',
      description: '',
      valueDate: '01-09-2023',
      debit: 49_950,
      credit: 0,
      balance: 681_704.88,
    })
    expect(
      parseAdbAmountTail('CREDITINTEREST106CLINGHS00000201-10-20230.0016,047.091,041,233.30')
    ).toMatchObject({
      description: 'CREDITINTEREST',
      credit: 16_047.09,
    })
    expect(
      parseAdbAmountTail('COSTOF91-DAY@25.50%PA000920023254214411-09-20235,292,080.100.00712,659.69')
    ).toMatchObject({
      debit: 5_292_080.1,
      credit: 0,
      balance: 712_659.69,
    })
    expect(parseAdbAmountTail('000903023249003606-09-202318,996.090.00-18,946.09')).toMatchObject({
      debit: 18_996.09,
      credit: 0,
      balance: -18_946.09,
    })
  })

  it('shouldUseAdbPdfParser flags generic junk headers', () => {
    expect(
      shouldUseAdbPdfParser({
        headers: ['DateBranchDescriptionReference'],
        rows: [['01-09-2023106SWEEP']],
      })
    ).toBe(true)
  })

  it('parses call deposit account September 2023 specimen', async () => {
    if (!fs.existsSync(ADB_CALL_PDF)) return

    const result = await parseBankPdf(ADB_CALL_PDF)
    expect(result.parseMethod).toBe('adb_pdf')
    expect(result.rows.length).toBeGreaterThan(50)
    expect(result.rows.length).toBeLessThan(90)

    const format = detectGhanaBankFormat(result.headers, result.rows.slice(0, 3))
    expect(format).toBe('adb')

    const cr = buildSuggestedMappingForDocument('bank_credits', result.headers, 'adb')
    const dr = buildSuggestedMappingForDocument('bank_debits', result.headers, 'adb')
    expect(canAutoMap('bank_credits', result.headers, cr)).toBe(true)
    expect(canAutoMap('bank_debits', result.headers, dr)).toBe(true)

    const sumDebit = result.rows.reduce((s, r) => s + (Number(r[5]) || 0), 0)
    const sumCredit = result.rows.reduce((s, r) => s + (Number(r[6]) || 0), 0)
    expect(sumDebit).toBeCloseTo(13_317_026.31, 0)
    expect(sumCredit).toBeCloseTo(13_626_604.73, 0)

    const lastBalance = Number(result.rows[result.rows.length - 1]![7])
    expect(lastBalance).toBeCloseTo(1_041_233.3, 2)

    const interest = result.rows.find((r) => Number(r[6]) === 16_047.09)
    expect(interest).toBeTruthy()
    expect(String(interest?.[2])).toMatch(/CREDITINTEREST/i)
  }, 30000)

  it('parses purchase account September 2023 specimen', async () => {
    if (!fs.existsSync(ADB_PURCHASE_PDF)) return

    const result = await parseBankPdf(ADB_PURCHASE_PDF)
    expect(result.parseMethod).toBe('adb_pdf')
    expect(result.rows.length).toBeGreaterThan(50)

    const sumDebit = result.rows.reduce((s, r) => s + (Number(r[5]) || 0), 0)
    const sumCredit = result.rows.reduce((s, r) => s + (Number(r[6]) || 0), 0)
    expect(sumDebit).toBeCloseTo(1_267_746.09, 0)
    expect(sumCredit).toBeCloseTo(1_267_746.09, 0)

    const lastBalance = Number(result.rows[result.rows.length - 1]![7])
    expect(lastBalance).toBeCloseTo(50, 2)

    const cheque = result.rows.find((r) => Number(r[5]) === 18_996.09)
    expect(cheque).toBeTruthy()
    expect(String(cheque?.[2])).toMatch(/EXPRESSADBCHQ/i)
  }, 30000)

  it('parses sample multi-line block', () => {
    const text = `DateBranchDescriptionReferenceValueDateDebitsCreditsBalance
01-09-2023106
SWEEPINAMOUNTTO
1061020015800001
106SWEP18268000701-09-202349,950.000.00681,704.88
11-09-2023106COSTOF91-DAY@25.50%PA000920023254214411-09-20235,292,080.100.00712,659.69`
    const r = parseAdbPdfText(text)
    expect(r.rows.length).toBe(2)
    expect(r.rows[0]![5]).toBe(49_950)
    expect(r.rows[1]![5]).toBeCloseTo(5_292_080.1, 1)
  })

  it('ADB cash book GL export supports cash book auto-map', () => {
    if (!fs.existsSync(ADB_CASH)) return

    const raw = parseExcel(ADB_CASH)
    expect(raw.headers).toContain('AMT RECEIVED')
    expect(raw.headers).toContain('AMT PAID')
    expect(raw.rows.length).toBeGreaterThan(10)

    const cr = buildSuggestedMappingForDocument('cash_book_receipts', raw.headers, null)
    const dr = buildSuggestedMappingForDocument('cash_book_payments', raw.headers, null)
    expect(canAutoMap('cash_book_receipts', raw.headers, cr)).toBe(true)
    expect(canAutoMap('cash_book_payments', raw.headers, dr)).toBe(true)
  })
})
