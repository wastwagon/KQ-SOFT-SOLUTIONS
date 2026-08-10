import { describe, expect, it } from 'vitest'
import path from 'path'
import fs from 'fs'
import * as XLSX from 'xlsx'
import {
  extractScbClosingBalance,
  extractScbTransactions,
  isScbGluedRow,
  isScbStatementLayout,
  looksLikeScbStatementText,
  normalizeScbExcelTable,
  parseScbGluedRow,
  parseScbPdfText,
} from './scbStatement.js'
import { parseExcel } from './parser.js'
import { parseBankPdf } from './documentParse.js'
import { detectGhanaBankFormat, resolveDetectedBankFormat } from './ghanaBankParsers.js'
import { buildSuggestedMappingForDocument, canAutoMap } from './autoMapDocument.js'

const SCB_RAW = path.resolve(import.meta.dirname, '../../../specimenbankstatementformats/scb statement.xlsx')
const SCB_PDF = path.resolve(
  import.meta.dirname,
  '../../../resultofcleanedfile/cocobod STANCHART SEPT 23.pdf'
)

describe('scbStatement', () => {
  it('parses glued first-page rows', () => {
    if (!fs.existsSync(SCB_RAW)) return
    const parsed = parseExcel(SCB_RAW, 0)
    expect(isScbStatementLayout([['STATEMENT OF ACCOUNT'], ['ENTRY DATE', 'DEBITS']])).toBe(false)
    expect(parsed.rows.some((r) => /FAB CHQ# 484623/i.test(String(r[2])))).toBe(true)
    expect(extractScbClosingBalance([])).toBe('')
  })

  it('normalizes full SCB workbook with first page and closing 540,206.03', () => {
    if (!fs.existsSync(SCB_RAW)) return
    const parsed = parseExcel(SCB_RAW, 0)
    expect(parsed.rows.length).toBeGreaterThan(800)
    expect(parsed.rows.some((r) => /INW CLG 702823/i.test(String(r[2])))).toBe(true)
    const last = parsed.rows[parsed.rows.length - 1]
    expect(Number(last?.[6])).toBeCloseTo(540206.03, 2)
  })

  it('parseScbGluedRow reads Feb 2019 page-1 transactions', () => {
    if (!fs.existsSync(SCB_RAW)) return
    const rows = XLSX.utils.sheet_to_json(XLSX.readFile(SCB_RAW).Sheets.Sheet1, {
      header: 1,
      defval: '',
    }) as unknown[][]
    const page1 = rows.find((r) => isScbGluedRow(r))
    expect(page1).toBeDefined()
    const txs = parseScbGluedRow(page1!)
    expect(txs.some((t) => /DEBIT INTEREST/i.test(t.description))).toBe(true)
    expect(Number(txs.find((t) => /DEBIT INTEREST/i.test(t.description))?.balance)).toBeCloseTo(
      60886.51,
      2
    )
  })

  it('extractScbTransactions dedupes and sorts', () => {
    if (!fs.existsSync(SCB_RAW)) return
    const rows = XLSX.utils.sheet_to_json(XLSX.readFile(SCB_RAW).Sheets.Sheet1, {
      header: 1,
      defval: '',
    }) as unknown[][]
    const txs = extractScbTransactions(rows)
    expect(txs.length).toBeGreaterThan(800)
    expect(normalizeScbExcelTable(rows).headers[0]).toBe('ENTRY DATE')
  })

  it('detects scb format and auto-maps credits and debits', () => {
    if (!fs.existsSync(SCB_RAW)) return
    const parsed = parseExcel(SCB_RAW, 0)
    const format = detectGhanaBankFormat(parsed.headers, parsed.rows.slice(0, 5))
    expect(format).toBe('scb')

    const cr = buildSuggestedMappingForDocument('bank_credits', parsed.headers, format)
    const dr = buildSuggestedMappingForDocument('bank_debits', parsed.headers, format)
    expect(canAutoMap('bank_credits', parsed.headers, cr)).toBe(true)
    expect(canAutoMap('bank_debits', parsed.headers, dr)).toBe(true)
    expect(cr.transaction_date).toBe(1) // VALUE DATE preferred over ENTRY DATE
    expect(cr.credit).toBe(5)
    expect(dr.debit).toBe(4)
  })

  it('detects and parses SCB PDF withdrawal/deposit glued lines', () => {
    const text = `Statement of Account
DepositDescriptionDateBalanceWithdrawal
Thank you for banking with Standard Chartered.
77,070,899.92
Balance Brought Forward
5,903,288.8301 Sep 2023SWEEP TO GHS 0100103114800  SWEEP TO
GHS 0100103114800   /2023/09/01-2816474
201407150016 / 01 T2006/001
71,167,611.09
11 Sep 202385,551.81SWEEP FROM GHS 0100103114800  SWEEP
FROM GHS 0100103114800    201407150015 /
02 T2006/002
21,001,974.75`
    expect(looksLikeScbStatementText(text)).toBe(true)
    const r = parseScbPdfText(text)
    expect(r.rows.length).toBe(2)
    expect(r.rows[0]![4]).toBeCloseTo(5_903_288.83, 2)
    expect(r.rows[0]![5]).toBeNull()
    expect(r.rows[0]![6]).toBeCloseTo(71_167_611.09, 2)
    expect(String(r.rows[0]![2])).toMatch(/SWEEP TO/i)
    expect(r.rows[1]![5]).toBeCloseTo(85_551.81, 2)
    expect(r.rows[1]![4]).toBeNull()
    expect(String(r.rows[1]![2])).toMatch(/SWEEP FROM/i)
  })

  it('parseBankPdf uses SCB PDF parser for StanChart specimen', async () => {
    if (!fs.existsSync(SCB_PDF)) return
    const result = await parseBankPdf(SCB_PDF)
    expect(result.parseMethod).toBe('scb_pdf')
    expect(result.rows.length).toBeGreaterThanOrEqual(18)
    expect(result.rows.length).toBeLessThanOrEqual(30)
    expect(resolveDetectedBankFormat(result.headers, result.rows.slice(0, 3), result.parseMethod)).toBe(
      'scb'
    )
    const sumDebit = result.rows.reduce((s, r) => s + (Number(r[4]) || 0), 0)
    const sumCredit = result.rows.reduce((s, r) => s + (Number(r[5]) || 0), 0)
    expect(sumDebit).toBeGreaterThan(100_000_000)
    expect(sumCredit).toBeGreaterThan(100_000_000)
    const lastBalance = Number(result.rows[result.rows.length - 1]![6])
    expect(lastBalance).toBeGreaterThan(10_000_000)
    const cr = buildSuggestedMappingForDocument('bank_credits', result.headers, 'scb')
    const dr = buildSuggestedMappingForDocument('bank_debits', result.headers, 'scb')
    expect(canAutoMap('bank_credits', result.headers, cr)).toBe(true)
    expect(canAutoMap('bank_debits', result.headers, dr)).toBe(true)
  }, 30000)
})
