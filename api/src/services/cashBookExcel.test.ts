import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { findCashBookTransactionHeaderRow, pickBestExcelSheetIndex } from './cashBookExcel.js'
import { parseExcel } from './parser.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ACCT002_CASH = path.join(__dirname, '../../../testdataandresultsforacct002/cash book acct 2.xlsx')

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
})
