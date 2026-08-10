import { describe, expect, it } from 'vitest'
import path from 'path'
import fs from 'fs'
import {
  joinNibNarrationParts,
  looksLikeNibStatementText,
  parseNibAmountLine,
  parseNibPdfText,
  shouldUseNibPdfParser,
} from './nibStatement.js'
import { parseBankPdf } from './documentParse.js'
import { buildSuggestedMappingForDocument, canAutoMap } from './autoMapDocument.js'
import { detectGhanaBankFormat } from './ghanaBankParsers.js'

const NIB_PDF = path.resolve(
  import.meta.dirname,
  '../../../nibbankstatementformat/NIB(1102037505201)[10535].pdf'
)

describe('nibStatement', () => {
  it('detects NIB PDF layout', () => {
    const text = `Account Statement
Booking DateReferenceDescriptionValue DateDebitCreditClosing Balance
Balance at Period Start
839,192.74
05 OCT 23TT23278G3SMBCash Deposit05 OCT 23
2,637.00841,829.74`
    expect(looksLikeNibStatementText(text)).toBe(true)
  })

  it('parses glued amount lines', () => {
    expect(parseNibAmountLine('2,637.00841,829.74')).toEqual({
      txn: 2637,
      balance: 841_829.74,
    })
    expect(parseNibAmountLine('838,899.74')).toEqual({
      txn: 0,
      balance: 838_899.74,
    })
  })

  it('shouldUseNibPdfParser flags generic junk headers', () => {
    expect(
      shouldUseNibPdfParser({
        headers: ['Booking', 'DateReferenceDescription'],
        rows: [['05 OCT 23TT23278G3SMB']],
      })
    ).toBe(true)
  })

  it('parses real NIB October 2023 specimen', async () => {
    if (!fs.existsSync(NIB_PDF)) return

    const result = await parseBankPdf(NIB_PDF)
    expect(result.parseMethod).toBe('nib_pdf')
    expect(result.headers).toContain('Debit')
    expect(result.headers).toContain('Credit')
    expect(result.rows.length).toBe(12)

    const format = detectGhanaBankFormat(result.headers, result.rows.slice(0, 3))
    expect(format).toBe('nib')

    const cr = buildSuggestedMappingForDocument('bank_credits', result.headers, 'nib')
    const dr = buildSuggestedMappingForDocument('bank_debits', result.headers, 'nib')
    expect(canAutoMap('bank_credits', result.headers, cr)).toBe(true)
    expect(canAutoMap('bank_debits', result.headers, dr)).toBe(true)

    const sumDebit = result.rows.reduce((s, r) => s + (Number(r[4]) || 0), 0)
    const sumCredit = result.rows.reduce((s, r) => s + (Number(r[5]) || 0), 0)
    expect(sumCredit).toBeCloseTo(108_132.15, 2)
    expect(sumDebit).toBeCloseTo(40_976, 2)

    const lastBalance = Number(result.rows[result.rows.length - 1]![6])
    expect(lastBalance).toBe(906_348.89)

    const deposit = result.rows.find((r) => String(r[2]).includes('Cash Deposit') && Number(r[5]) === 2637)
    expect(deposit).toBeTruthy()

    const charge = result.rows.find((r) => String(r[2]).includes('Application') && Number(r[4]) === 100)
    expect(charge).toBeTruthy()
  }, 30000)

  it('parses sample block from native text', () => {
    const text = `Booking DateReferenceDescriptionValue DateDebitCreditClosing Balance
Balance at Period Start
839,192.74
05 OCT 23TT23278G3SMBCash Deposit05 OCT 23
2,637.00841,829.74
DARKO FRANKLIN
05 OCT 23FT23278B7PSKInward Cheque - Dr05 OCT 232,930.00
838,899.74`
    const r = parseNibPdfText(text)
    expect(r.rows.length).toBe(2)
    expect(r.rows[0]![5]).toBe(2637)
    expect(r.rows[0]![2]).toBe('Cash Deposit DARKO FRANKLIN')
    expect(r.rows[1]![4]).toBe(2930)
  })

  it('joins mid-word PDF wraps in narration', () => {
    expect(joinNibNarrationParts(['Inward Telex Paym', 'ent', 'GHANA COCOA'])).toBe(
      'Inward Telex Payment GHANA COCOA'
    )
    expect(joinNibNarrationParts(['CHQ NO 000399 FR', 'OM NIB ACCRA MA', 'IN IFO Chq 000399'])).toBe(
      'CHQ NO 000399 FROM NIB ACCRA MAIN IFO Chq 000399'
    )
    expect(
      joinNibNarrationParts([
        'CHQ NO 000376 F',
        'ROM NIB ACCRA M',
        'AIN IFO Chq 00037',
        '6 ifo FALIDU TAHIR',
        'U Ordering Cust: 37',
        '5052',
      ])
    ).toBe('CHQ NO 000376 FROM NIB ACCRA MAIN IFO Chq 000376 ifo FALIDU TAHIRU Ordering Cust: 375052')
    expect(joinNibNarrationParts(['By cheque No: 000', '404'])).toBe('By cheque No: 000404')
    expect(joinNibNarrationParts(['DARKO FRANKLIN', 'A'])).toBe('DARKO FRANKLIN A')
  })

  it('keeps post-amount description details from real specimen', async () => {
    if (!fs.existsSync(NIB_PDF)) return

    const result = await parseBankPdf(NIB_PDF)
    const byRef = Object.fromEntries(result.rows.map((r) => [String(r[1]), String(r[2])]))

    expect(byRef.TT23278G3SMB).toContain('DARKO FRANKLIN')
    expect(byRef.FT23278B7PSK).toMatch(/CHQ NO 000399.*FROM NIB ACCRA MAIN/i)
    expect(byRef.TT232794G1HG).toMatch(/ISAAC YAW NORTEY/i)
    expect(byRef.TT232794G1HG).toMatch(/By cheque No:\s*000404/i)
    expect(byRef.FT232916PM3C).toMatch(/Inward Telex Payment/i)
    expect(byRef.FT232916PM3C).toContain('GHANA COCOA')
    expect(byRef.FT232916PM3C).not.toMatch(/Paym ent/)
    expect(byRef.FT23304393BV).toBe(
      'Application Of Charges ACCT MAINT CHARGE AS AT 31 OCT 2023'
    )
  }, 30000)
})
