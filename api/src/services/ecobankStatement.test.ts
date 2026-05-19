import { describe, expect, it } from 'vitest'
import {
  findEcobankTransactionHeaderRow,
  normalizeEcobankExcelTable,
  parseEcobankPdfText,
} from './ecobankStatement.js'
import { parseExcel } from './parser.js'
import path from 'path'

describe('ecobankStatement', () => {
  it('finds transaction header row in summary layout', () => {
    const data = [
      ['Account Summary'],
      ['Transaction Date', 'Description', 'Reference Number', 'Value Date', 'Payments', 'Deposits', 'Balance'],
      ['46112', 'FEE', 'REF1', '46113', 'GHS48.00', '', '18643'],
    ]
    expect(findEcobankTransactionHeaderRow(data)).toBe(1)
  })

  it('normalizes Payments/Deposits to Debit/Credit', () => {
    const data = [
      ['Transaction Date', 'Description', 'Payments', 'Deposits'],
      ['46112', 'CHEQUE DEPOSIT', 'GHS100.00', ''],
      ['46111', 'CHEQUE WITHDRAWAL', 'GHS50.00', ''],
    ]
    const out = normalizeEcobankExcelTable({ headers: data[0] as string[], rows: data.slice(1) })
    expect(out.headers).toContain('Debit')
    expect(out.headers).toContain('Credit')
    expect(out.rows.length).toBe(2)
    expect(out.rows[0]![5]).toBe(100) // deposit reclassified to credit
    expect(out.rows[1]![4]).toBe(50)
  })

  it('parses real Ecobank xlsx export', () => {
    const p = path.join(process.cwd(), '../asdiscussed/1778163944552.xlsx')
    const r = parseExcel(p)
    expect(r.rows.length).toBeGreaterThan(20)
    expect(r.headers).toContain('Debit')
    expect(r.headers).toContain('Credit')
  })

  it('parses Ecobank PDF text blocks', () => {
    const sample = `Transaction DateDescriptionReference NumberValue DatePaymentsDepositsBalance
31-Mar-2026CHEQUE DEPOSIT
H55LOCH26090051831-Mar-2026GHS3,700.00GHS18,691.29`
    const r = parseEcobankPdfText(sample)
    expect(r.rows.length).toBeGreaterThanOrEqual(1)
    expect(r.headers[0]).toBe('Transaction Date')
  })
})
