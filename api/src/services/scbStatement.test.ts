import { describe, expect, it } from 'vitest'
import path from 'path'
import fs from 'fs'
import * as XLSX from 'xlsx'
import {
  extractScbClosingBalance,
  extractScbTransactions,
  isScbGluedRow,
  isScbStatementLayout,
  normalizeScbExcelTable,
  parseScbGluedRow,
} from './scbStatement.js'
import { parseExcel } from './parser.js'
import { detectGhanaBankFormat } from './ghanaBankParsers.js'
import { buildSuggestedMappingForDocument, canAutoMap } from './autoMapDocument.js'

const SCB_RAW = path.resolve(import.meta.dirname, '../../../specimenbankstatementformats/scb statement.xlsx')

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
})
