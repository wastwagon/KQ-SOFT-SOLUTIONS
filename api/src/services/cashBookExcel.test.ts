import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  findCashBookTransactionHeaderRow,
  findErpGlCashBookHeaderRow,
  isTglErpCashBookLayout,
  normalizeErpGlCashBookTable,
  normalizeTglErpCashBookTable,
  pickBestExcelSheetIndex,
} from './cashBookExcel.js'
import { buildSuggestedMappingForDocument, canAutoMap } from './autoMapDocument.js'
import { parseImportedAmount } from './amountParser.js'
import { parseExcel } from './parser.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ACCT002_CASH = path.join(__dirname, '../../../testdataandresultsforacct002/cash book acct 2.xlsx')
const ACCT4702_CASH = path.join(__dirname, '../../../specimenbankstatementformats/acct4702 cashbk.xlsx')
const ADB_CASH = path.join(__dirname, '../../../adbstatementsformat/ADB cash bk.xlsx')

describe('cashBookExcel', () => {
  it('finds transaction header row with date + rec/paid', () => {
    const data = [
      ['month', '', 'semester/', 'doc', 'amount', 'amount'],
      ['code', 'date', 'name', 'details', 'term', 'ref', 'number', 'code', 'code', 'rec', 'paid', 'balance'],
      [9, '04-SEP-17', '', 'CHEQUE', '', '', '', '', '', '', 1200, 145.74],
    ]
    expect(findCashBookTransactionHeaderRow(data)).toBe(1)
  })

  it('picks a transaction sheet for Grace Baptist acct002 cash book', () => {
    if (!fs.existsSync(ACCT002_CASH)) return
    const best = pickBestExcelSheetIndex(ACCT002_CASH, 'cash_book_payments')
    expect(best).toBeGreaterThanOrEqual(0)
    const parsed = parseExcel(ACCT002_CASH, best)
    expect(parsed.headers.map((h) => h.toLowerCase())).toContain('date')
    expect(parsed.rows.length).toBeGreaterThan(20)
  })

  it('parses TGL ERP acct4702 cashbook with auto-map', () => {
    if (!fs.existsSync(ACCT4702_CASH)) return

    const raw = parseExcel(ACCT4702_CASH)
    expect(raw.headers).toContain('AMT RECEIVED')
    expect(raw.headers).toContain('AMT PAID')
    expect(raw.headers).toContain('Transaction Date')
    expect(raw.rows.length).toBe(779)

    const sumReceived = raw.rows.reduce(
      (s, r) => s + (parseImportedAmount(r[5]) || 0),
      0
    )
    const sumPaid = raw.rows.reduce((s, r) => s + (parseImportedAmount(r[6]) || 0), 0)
    expect(sumReceived).toBeCloseTo(11_756_548.18, 0)
    expect(sumPaid).toBeCloseTo(12_296_754.21, 0)

    const cr = buildSuggestedMappingForDocument('cash_book_receipts', raw.headers, null)
    const dr = buildSuggestedMappingForDocument('cash_book_payments', raw.headers, null)
    expect(canAutoMap('cash_book_receipts', raw.headers, cr)).toBe(true)
    expect(canAutoMap('cash_book_payments', raw.headers, dr)).toBe(true)
  })

  it('normalizes signed ERP Amount into receipt and payment columns', () => {
    const result = normalizeTglErpCashBookTable({
      headers: [
        'TGL Account Code',
        'Transaction Date',
        'Description',
        'Amount',
        'Cheque No',
        'Transaction Reference',
      ],
      rows: [
        ['25437', '4-Jan-2019', 'SWEEP TO GHS 0100106024702', ' 89,565.85 ', null, null],
        ['25437', '5-Jan-2019', 'INWARD TRANSFER', '-1,200.50', null, 'REF1'],
      ],
    })
    expect(result.rows[0]![5]).toBeNull()
    expect(result.rows[0]![6]).toBe(89_565.85)
    expect(result.rows[1]![5]).toBe(1_200.5)
    expect(result.rows[1]![6]).toBeNull()
  })

  it('preserves euro/foreign-currency columns on TGL multi-currency cash books', () => {
    const result = normalizeTglErpCashBookTable({
      headers: [
        'TGL Account Code',
        'Transaction Date',
        'Description',
        'Amount',
        'Currency Code',
        'Exch Rate',
        'Foreign Currency Amount',
        'Cheque No',
        'Transaction Reference',
      ],
      rows: [
        [
          '25010',
          '11-Dec-2018',
          'AFRICA MOVE - RELOCATION',
          '-13640.85',
          '23',
          '5.5111',
          '-2475.16',
          null,
          'GT BANK - EURO',
        ],
        [
          '25010',
          '17-Jan-2018',
          'PYT-JN3747€2529.8/SOFITEL',
          '-13319.4',
          '23',
          '5.265',
          '-2529.8',
          null,
          'GTBANK - EURO',
        ],
      ],
    })
    expect(result.headers).toContain('Foreign Currency Amount')
    expect(result.headers).toContain('FC AMT RECEIVED')
    expect(result.headers).toContain('FC AMT PAID')
    expect(result.headers).toContain('Currency Code')
    expect(result.headers).toContain('Exch Rate')
    // Local GHS still populated
    expect(result.rows[0]![5]).toBeCloseTo(13640.85, 2)
    expect(result.rows[0]![6]).toBeNull()
    // Euro amounts available for EUR projects
    expect(result.rows[0]![10]).toBeCloseTo(2475.16, 2)
    expect(result.rows[1]![10]).toBeCloseTo(2529.8, 2)

    const eurMap = buildSuggestedMappingForDocument('cash_book_receipts', result.headers, null, {
      projectCurrency: 'EUR',
    })
    expect(result.headers[eurMap.amt_received!]).toBe('FC AMT RECEIVED')

    const ghsMap = buildSuggestedMappingForDocument('cash_book_receipts', result.headers, null, {
      projectCurrency: 'GHS',
    })
    expect(result.headers[ghsMap.amt_received!]).toBe('AMT RECEIVED')
  })

  it('parses ERP GLPTLS1 ADB cashbook with auto-map', () => {
    if (!fs.existsSync(ADB_CASH)) return

    const raw = parseExcel(ADB_CASH)
    expect(raw.headers).toContain('AMT RECEIVED')
    expect(raw.headers).toContain('AMT PAID')
    expect(raw.rows.length).toBe(18)

    const sumReceived = raw.rows.reduce((s, r) => s + (parseImportedAmount(r[4]) || 0), 0)
    const sumPaid = raw.rows.reduce((s, r) => s + (parseImportedAmount(r[5]) || 0), 0)
    expect(sumReceived).toBeCloseTo(13_499_243.51, 0)
    expect(sumPaid).toBeCloseTo(13_323_810.34, 0)

    const cr = buildSuggestedMappingForDocument('cash_book_receipts', raw.headers, null)
    const dr = buildSuggestedMappingForDocument('cash_book_payments', raw.headers, null)
    expect(canAutoMap('cash_book_receipts', raw.headers, cr)).toBe(true)
    expect(canAutoMap('cash_book_payments', raw.headers, dr)).toBe(true)
  })

  it('finds ERP GL header row with Source and Debits/Credits', () => {
    const data = [
      ['G/L Transactions Listing - In Functional Currency  (GLPTLS1)'],
      [null, null, null, null, 'Source', null, 'Doc. Date', null, null, null, 'Reference', null, null, null, null, null, null, null, null, null, 'Seq.', null, 'Batch-Entry', null, 'Debits', null, null, 'Credits'],
      [null, null, null, null, 'CB-CB', null, '45180', null, null, null, 'BEING REDEMPTION', null, null, null, null, null, null, null, null, null, 173848, null, '192897-1', null, '5292081', null, null, null],
    ]
    expect(findErpGlCashBookHeaderRow(data)).toBe(1)
    const normalized = normalizeErpGlCashBookTable({
      headers: data[1] as string[],
      rows: [data[2] as unknown[]],
    })
    expect(normalized.rows[0]![5]).toBe(5_292_081)
    expect(normalized.rows[0]![4]).toBeNull()
  })
})
