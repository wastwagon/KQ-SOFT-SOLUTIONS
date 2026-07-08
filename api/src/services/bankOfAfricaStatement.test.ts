import { describe, expect, it } from 'vitest'
import path from 'path'
import fs from 'fs'
import {
  findBankOfAfricaTransactionHeaderRow,
  isBankOfAfricaStatementLayout,
  normalizeBankOfAfricaExcelTable,
} from './bankOfAfricaStatement.js'
import { parseExcel } from './parser.js'
import { parseDocumentFile } from './documentParse.js'
import { buildSuggestedMappingForDocument, canAutoMap } from './autoMapDocument.js'
import { detectGhanaBankFormat, getSuggestedBankMapping } from './ghanaBankParsers.js'
import { pickBestExcelSheetIndex } from './cashBookExcel.js'

const BOA_XLSM = path.resolve(
  import.meta.dirname,
  '../../../bankofafricastatementformat/bank of africa.xlsm'
)

describe('bankOfAfricaStatement', () => {
  it('finds BOA header row in template sheet', () => {
    if (!fs.existsSync(BOA_XLSM)) return
    const parsed = parseExcel(BOA_XLSM, 0)
    const matrix = [parsed.headers, ...parsed.rows]
    expect(findBankOfAfricaTransactionHeaderRow(matrix)).toBe(0)
    expect(isBankOfAfricaStatementLayout(parsed.headers, parsed.rows)).toBe(true)
  })

  it('parses BOA xlsm with 17 September transactions', () => {
    if (!fs.existsSync(BOA_XLSM)) return

    const sheetIndex = pickBestExcelSheetIndex(BOA_XLSM, 'bank_credits')
    expect(sheetIndex).toBe(0)

    const parsed = parseExcel(BOA_XLSM, sheetIndex)
    expect(parsed.headers).toContain('DEBIT')
    expect(parsed.headers).toContain('CREDIT')
    expect(parsed.headers).toContain('Value Date')
    expect(parsed.rows.length).toBe(17)

    const sumDebit = parsed.rows.reduce(
      (s, r) => s + (Number(String(r[parsed.headers.indexOf('DEBIT')] ?? '').replace(/,/g, '')) || 0),
      0
    )
    const sumCredit = parsed.rows.reduce(
      (s, r) => s + (Number(String(r[parsed.headers.indexOf('CREDIT')] ?? '').replace(/,/g, '')) || 0),
      0
    )
    expect(sumCredit).toBeCloseTo(406_040.29, 0)
    expect(sumDebit).toBeCloseTo(395_366.36, 0)

    const lastBalance = Number(String(parsed.rows[parsed.rows.length - 1]![parsed.headers.indexOf('BALANCE')] ?? '').replace(/,/g, ''))
    expect(lastBalance).toBeCloseTo(17_238.77, 0)
  })

  it('detects BOA format and auto-maps credits/debits', () => {
    if (!fs.existsSync(BOA_XLSM)) return

    const parsed = parseExcel(BOA_XLSM, 0)
    const format = detectGhanaBankFormat(parsed.headers, parsed.rows.slice(0, 5))
    expect(format).toBe('boa')

    const cr = buildSuggestedMappingForDocument('bank_credits', parsed.headers, format)
    const dr = buildSuggestedMappingForDocument('bank_debits', parsed.headers, format)
    expect(canAutoMap('bank_credits', parsed.headers, cr)).toBe(true)
    expect(canAutoMap('bank_debits', parsed.headers, dr)).toBe(true)
    expect(cr.transaction_date).toBe(parsed.headers.indexOf('Value Date'))
    expect(getSuggestedBankMapping('boa', parsed.headers, 'credits').credit).toBe(
      parsed.headers.indexOf('CREDIT')
    )
  })

  it('parseDocumentFile accepts xlsm bank export', async () => {
    if (!fs.existsSync(BOA_XLSM)) return

    const result = await parseDocumentFile(BOA_XLSM, 'bank_credits', 0)
    expect(result.parseMethod).toBe('excel')
    expect(result.rows.length).toBe(17)
  })
})

describe('normalizeBankOfAfricaExcelTable', () => {
  it('filters zero-amount padding rows', () => {
    const result = normalizeBankOfAfricaExcelTable({
      headers: ['Our Reference', 'Value Date', 'Description', 'DEBIT', 'CREDIT'],
      rows: [
        ['AX1', '2023-09-11', 'MAT.DEPOT', '0', '100'],
        ['', '', '', '0', '0'],
        ['', '', '', '', ''],
      ],
    })
    expect(result.rows.length).toBe(1)
  })
})
