import { describe, expect, it } from 'vitest'
import path from 'path'
import fs from 'fs'
import {
  looksLikePrudentialStatementText,
  parsePrudentialPdfText,
  parsePruAmountLine,
  extractPruDateFromLine,
  shouldUsePrudentialPdfParser,
} from './prudentialStatement.js'
import { parseBankPdf } from './documentParse.js'
import { buildSuggestedMappingForDocument, canAutoMap } from './autoMapDocument.js'
import { resolveDetectedBankFormat } from './ghanaBankParsers.js'

const PRU_PDF = path.resolve(
  import.meta.dirname,
  '../../../Prudential bank(0091900180008)_sep 23[10235].pdf'
)

describe('prudentialStatement', () => {
  it('detects Prudential PDF layout', () => {
    const text = `TRANSACTION DETAILSREF. NO.VALUE DATEDEBITCREDITBALANCETRANS. DATE
RING ROAD CENTRAL BRANCH
CURRENT ACCOUNT STATEMENT
PRINCIPAL PAYMENT
01-SEP-23
02-SEP-23
50,000,000.0049,999,735.00`
    expect(looksLikePrudentialStatementText(text)).toBe(true)
  })

  it('parses glued amount lines', () => {
    expect(parsePruAmountLine('50,000,000.0049,999,735.00')).toEqual({
      amount: 50_000_000,
      balance: 49_999_735,
    })
    expect(parsePruAmountLine('3,412,351.223,411,866.22DR')).toEqual({
      amount: 3_412_351.22,
      balance: -3_411_866.22,
    })
    expect(parsePruAmountLine('4.508,487,580.18DR')).toEqual({
      amount: 4.5,
      balance: -8_487_580.18,
    })
  })

  it('extracts trans date from ref-prefixed value date lines', () => {
    expect(extractPruDateFromLine('19034915-SEP-23')).toBe('15-SEP-23')
    expect(extractPruDateFromLine('15-SEP-23')).toBe('15-SEP-23')
  })

  it('parses inward clearing block with embedded value date', () => {
    const text = `BALANCE BROUGHT FWD.
01-SEP-23265.00DR
INWARD CLEARING
15-SEP-23
19034915-SEP-23
91,021.553,488,237.93DR
: ENTERPRISE INSURANCE CO LTD  /0096744232580001`
    const r = parsePrudentialPdfText(text)
    expect(r.rows.length).toBe(1)
    expect(r.rows[0]![5]).toBeCloseTo(91_021.55, 2)
    expect(String(r.rows[0]![1])).toMatch(/INWARD CLEARING/i)
  })

  it('shouldUsePrudentialPdfParser flags generic junk headers', () => {
    expect(
      shouldUsePrudentialPdfParser({
        headers: ['Opening', 'BalancesClosing', 'Balances'],
        rows: [['01-SEP-23265.00DR']],
      })
    ).toBe(true)
  })

  it('parses real Prudential September 2023 specimen', async () => {
    if (!fs.existsSync(PRU_PDF)) return

    const result = await parseBankPdf(PRU_PDF)
    expect(result.parseMethod).toBe('prudential_pdf')
    expect(result.headers).toContain('Debit')
    expect(result.headers).toContain('Credit')
    expect(result.rows.length).toBeGreaterThan(50)
    expect(result.rows.length).toBeLessThan(450)

    const creditRows = result.rows.filter((r) => Number(r[5]) > 0)
    expect(creditRows.length).toBeGreaterThanOrEqual(45)
    expect(result.rows.some((r) => Math.abs(Number(r[5]) - 91_021.55) < 0.01)).toBe(true)
    expect(result.rows.some((r) => Math.abs(Number(r[5]) - 351_241.25) < 0.01)).toBe(true)

    const debits45 = result.rows.filter((r) => Number(r[4]) === 4.5).length
    expect(debits45).toBeLessThan(20)

    const cr = buildSuggestedMappingForDocument('bank_credits', result.headers, 'prudential')
    const dr = buildSuggestedMappingForDocument('bank_debits', result.headers, 'prudential')
    expect(canAutoMap('bank_credits', result.headers, cr)).toBe(true)
    expect(canAutoMap('bank_debits', result.headers, dr)).toBe(true)
    expect(resolveDetectedBankFormat(result.headers, result.rows.slice(0, 5), result.parseMethod)).toBe(
      'prudential'
    )

    const sumDebit = result.rows.reduce((s, r) => s + (Number(r[4]) || 0), 0)
    const sumCredit = result.rows.reduce((s, r) => s + (Number(r[5]) || 0), 0)
    expect(sumCredit).toBeGreaterThan(423_285_158)
    expect(sumCredit).toBeLessThan(440_000_000)
    expect(sumDebit).toBeGreaterThan(20_000_000)

    const firstCredit = result.rows.find((r) => Number(r[5]) === 50_000_000)
    expect(firstCredit).toBeTruthy()
  }, 30000)

  it('parses sample block from native text', () => {
    const text = `BALANCE BROUGHT FWD.
01-SEP-23265.00DR
PRINCIPAL PAYMENT
01-SEP-23
02-SEP-23
50,000,000.0049,999,735.00
/000REPO231850003
CALL TRANSACTIONS - DR
04-SEP-23
04-SEP-23
14,999,300.001,185.00
/009SWO1191540006`
    const r = parsePrudentialPdfText(text)
    expect(r.rows.length).toBe(2)
    expect(r.rows[0]![5]).toBe(50_000_000)
    expect(r.rows[1]![4]).toBe(14_999_300)
  })
})
