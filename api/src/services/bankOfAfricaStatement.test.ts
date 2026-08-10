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
    // After normalize, headers are already the transaction headers (row 0 of result).
    expect(findBankOfAfricaTransactionHeaderRow([parsed.headers, ...parsed.rows])).toBe(0)
    expect(isBankOfAfricaStatementLayout(parsed.headers, parsed.rows)).toBe(true)
  })

  it('parses BOA xlsm with 17 September transactions', () => {
    if (!fs.existsSync(BOA_XLSM)) return

    const sheetIndex = pickBestExcelSheetIndex(BOA_XLSM, 'bank_credits')
    expect(sheetIndex).toBe(0)

    const parsed = parseExcel(BOA_XLSM, sheetIndex)
    expect(parsed.headers).toContain('Debit')
    expect(parsed.headers).toContain('Credit')
    expect(parsed.headers).toContain('Value Date')
    expect(parsed.headers).not.toContain('control')
    expect(parsed.headers.some((h) => /^Col_/i.test(h))).toBe(false)
    expect(parsed.rows.length).toBe(17)

    const debitIdx = parsed.headers.indexOf('Debit')
    const creditIdx = parsed.headers.indexOf('Credit')
    const balIdx = parsed.headers.indexOf('Balance')

    const sumDebit = parsed.rows.reduce((s, r) => s + (Number(r[debitIdx]) || 0), 0)
    const sumCredit = parsed.rows.reduce((s, r) => s + (Number(r[creditIdx]) || 0), 0)
    expect(sumCredit).toBeCloseTo(406_040.29, 0)
    expect(sumDebit).toBeCloseTo(395_366.36, 0)

    const lastBalance = Number(parsed.rows[parsed.rows.length - 1]![balIdx])
    expect(lastBalance).toBeCloseTo(17_238.77, 0)

    // Dash placeholders cleaned; amounts are numbers.
    expect(parsed.rows.every((r) => r[debitIdx] == null || typeof r[debitIdx] === 'number')).toBe(true)
    expect(parsed.rows.every((r) => r[creditIdx] == null || typeof r[creditIdx] === 'number')).toBe(true)
    expect(String(parsed.rows[0]![0]).trim()).toBe('AX21156')
    expect(String(parsed.rows[0]![5]).trim()).toBe('MAT.DEPOT')
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
      parsed.headers.indexOf('Credit')
    )
  })

  it('parseDocumentFile accepts xlsm bank export', async () => {
    if (!fs.existsSync(BOA_XLSM)) return

    const result = await parseDocumentFile(BOA_XLSM, 'bank_credits', 0)
    expect(result.parseMethod).toBe('excel')
    expect(result.rows.length).toBe(17)
    expect(result.headers).toEqual([
      'Our Reference',
      'Trxn Code',
      'Account Number',
      'Operation Date',
      'Value Date',
      'Description',
      'Debit',
      'Credit',
      'Cheque Number',
      'Balance',
    ])
  })
})

describe('normalizeBankOfAfricaExcelTable', () => {
  it('filters zero-amount padding rows and cleans dash placeholders', () => {
    const result = normalizeBankOfAfricaExcelTable({
      headers: [
        'Our Reference',
        'Trxn Code',
        'Account Number',
        'Operation Date',
        'Value Date',
        'Description',
        'DEBIT',
        'CREDIT',
        'CHEQUE NUMBER',
        'BALANCE',
        'control',
        'Col_11',
      ],
      rows: [
        [' AX21156 ', 'DCI', '00291410102', '11-Sep-23', '9-Sep-23', 'MAT.DEPOT', ' -   ', ' 105,960.08 ', '', ' 112,524.92 ', '1', '1'],
        ['', '', '', '', '', '', '0', '0', '', '', '', ''],
        [' AX21156 ', 'DCI', '00291410102', '11-Sep-23', '9-Sep-23', 'MAT.DEPOT', '106,169.10', ' -   ', '', ' (130,612.74)', '2', '2'],
      ],
    })
    expect(result.headers).toEqual([
      'Our Reference',
      'Trxn Code',
      'Account Number',
      'Operation Date',
      'Value Date',
      'Description',
      'Debit',
      'Credit',
      'Cheque Number',
      'Balance',
    ])
    expect(result.rows.length).toBe(2)
    expect(result.rows[0]).toEqual([
      'AX21156',
      'DCI',
      '00291410102',
      '11-Sep-23',
      '9-Sep-23',
      'MAT.DEPOT',
      null,
      105960.08,
      null,
      112524.92,
    ])
    expect(result.rows[1]![6]).toBeCloseTo(106169.1, 2)
    expect(result.rows[1]![7]).toBeNull()
    expect(result.rows[1]![9]).toBeCloseTo(-130612.74, 2)
  })
})
