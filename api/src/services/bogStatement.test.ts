import { describe, expect, it } from 'vitest'
import path from 'path'
import fs from 'fs'
import {
  findBogTransactionHeaderRow,
  formatBogDate,
  isBogStatementLayout,
  normalizeBogExcelTable,
  parseBogGluedTransactions,
  splitBogAmountCell,
} from './bogStatement.js'
import { parseExcel } from './parser.js'
import { buildSuggestedMappingForDocument, canAutoMap } from './autoMapDocument.js'
import { detectGhanaBankFormat } from './ghanaBankParsers.js'

const BOG_XLSX = path.resolve(
  import.meta.dirname,
  '../../../BOG COCOBOD GHS ADV OPERATIONAL EXP ACCT(01102022-30092023).xlsx'
)

describe('bogStatement', () => {
  it('formats BOG post dates from Excel strings', () => {
    expect(formatBogDate('07 Oct 2022')).toBe('07/10/2022')
    expect(formatBogDate('21 NOV 22')).toBe('21/11/2022')
  })

  it('splits merged debit/credit amount cells', () => {
    expect(splitBogAmountCell('-247,742.86 0.00')).toEqual({ debit: 247742.86, credit: 0 })
    expect(splitBogAmountCell('0.00             2,000,000.00')).toEqual({ debit: 0, credit: 2000000 })
    expect(splitBogAmountCell('-136939.16')).toEqual({ debit: 136939.16, credit: 0 })
  })

  it('recovers transactions from glued overflow cell', () => {
    const glued = `21 NOV 22  Transfer FT2232508520 21 NOV 22 0.00 2,000,000.00 2,366,770.85 DEP
28 NOV 22  Cash Withdrawal TT2233200419 WDR AKO- 28 NOV 22 -19,092.78 0.00 2,347,678.07 WDR`
    const rows = parseBogGluedTransactions(glued)
    expect(rows.length).toBeGreaterThanOrEqual(2)
    expect(rows[0]!.credit).toBe(2000000)
    expect(rows[1]!.debit).toBeCloseTo(19092.78, 0)
  })

  it('parses BOG COCOBOD operational expense statement', () => {
    if (!fs.existsSync(BOG_XLSX)) return

    const parsed = parseExcel(BOG_XLSX, 0)
    expect(isBogStatementLayout(parsed.headers, parsed.rows)).toBe(true)
    expect(parsed.headers).toEqual([
      'Post Date',
      'Description',
      'Reference',
      'Value Date',
      'Debit',
      'Credit',
      'Balance',
    ])
    expect(parsed.rows.length).toBeGreaterThanOrEqual(40)

    const format = detectGhanaBankFormat(parsed.headers, parsed.rows.slice(0, 5))
    expect(format).toBe('bog')

    const cr = buildSuggestedMappingForDocument('bank_credits', parsed.headers, format)
    const dr = buildSuggestedMappingForDocument('bank_debits', parsed.headers, format)
    expect(canAutoMap('bank_credits', parsed.headers, cr)).toBe(true)
    expect(canAutoMap('bank_debits', parsed.headers, dr)).toBe(true)

    expect(parsed.rows[0]![0]).toBe('07/10/2022')

    const sumDebit = parsed.rows.reduce((s, r) => s + (Number(r[4]) || 0), 0)
    const sumCredit = parsed.rows.reduce((s, r) => s + (Number(r[5]) || 0), 0)
    expect(sumCredit).toBeCloseTo(2_000_000, 0)
    expect(sumDebit).toBeGreaterThan(5_000_000)
  })
})

describe('findBogTransactionHeaderRow', () => {
  it('detects BOG header row', () => {
    const data = [
      ['Bank of Ghana', 'Customer Account Statement'],
      ['Post Date', 'Description', '', 'Reference', '', 'Instr. No.', '', 'Value Date', '', 'Debit Amt   Credit Amt'],
    ]
    expect(findBogTransactionHeaderRow(data)).toBe(1)
  })
})
