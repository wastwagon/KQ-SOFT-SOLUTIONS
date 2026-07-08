import { describe, expect, it } from 'vitest'
import path from 'path'
import fs from 'fs'
import {
  findStanbicTransactionHeaderRow,
  isStanbicStatementLayout,
  normalizeStanbicExcelTable,
} from './stanbicStatement.js'
import { parseExcel } from './parser.js'
import { buildSuggestedMappingForDocument, canAutoMap } from './autoMapDocument.js'
import { detectGhanaBankFormat } from './ghanaBankParsers.js'

const STANBIC_XLSX = path.resolve(
  import.meta.dirname,
  '../../../../stanbic bank special call deposits(9040006517670)-july,2023 to sept 2023.xlsx'
)
const STANBIC_DOWNLOADS =
  '/Users/OceanCyber/Downloads/stanbic bank special call deposits(9040006517670)-july,2023 to sept 2023.xlsx'

function resolveStanbicXlsx(): string | null {
  if (fs.existsSync(STANBIC_XLSX)) return STANBIC_XLSX
  if (fs.existsSync(STANBIC_DOWNLOADS)) return STANBIC_DOWNLOADS
  return null
}

describe('stanbicStatement', () => {
  it('finds Stanbic header row', () => {
    const data = [
      ['Branch name : STANBIC'],
      ['Transaction Date', 'Value Date', '', 'Transaction Description', '', '', '', '', 'Fee', '', 'Debits', 'Credits', 'Balance'],
    ]
    expect(findStanbicTransactionHeaderRow(data)).toBe(1)
  })

  it('parses Stanbic call deposit statement', () => {
    const xlsx = resolveStanbicXlsx()
    if (!xlsx) return

    const parsed = parseExcel(xlsx, 0)
    expect(isStanbicStatementLayout(parsed.headers, parsed.rows)).toBe(true)
    expect(parsed.headers).toEqual([
      'Transaction Date',
      'Value Date',
      'Description',
      'Fee',
      'Debit',
      'Credit',
      'Balance',
    ])
    expect(parsed.rows.length).toBe(3)

    const format = detectGhanaBankFormat(parsed.headers, parsed.rows.slice(0, 3))
    expect(format).toBe('stanbic')

    const cr = buildSuggestedMappingForDocument('bank_credits', parsed.headers, format)
    const dr = buildSuggestedMappingForDocument('bank_debits', parsed.headers, format)
    expect(canAutoMap('bank_credits', parsed.headers, cr)).toBe(true)
    expect(canAutoMap('bank_debits', parsed.headers, dr)).toBe(true)

    const sumCredit = parsed.rows.reduce((s, r) => s + (Number(r[5]) || 0), 0)
    expect(sumCredit).toBeCloseTo(20.86, 2)

    const lastBalance = Number(parsed.rows[parsed.rows.length - 1]![6])
    expect(lastBalance).toBeCloseTo(841.78, 2)

    expect(String(parsed.rows[0]![2])).toContain('INT.PD')
    expect(String(parsed.rows[0]![2])).toContain('INTEREST RUN')
  })

  it('filters opening balance and page summary rows', () => {
    const result = normalizeStanbicExcelTable({
      headers: [
        'Transaction Date',
        'Value Date',
        'Transaction Description',
        'Debits',
        'Credits',
        'Balance',
      ],
      rows: [
        ['', '', 'STATEMENT OPENING BALANCE', '', '', 820.92],
        ['31-07-2023', '31-07-2023', '9040006517670:INT.PD', '', 6.97, 827.89],
        ['', '', '07-2023 INTEREST RUN', '', '', ''],
        ['', '', 'Credits', '', 20.86, ''],
      ],
    })
    expect(result.rows.length).toBe(1)
    expect(result.rows[0]![5]).toBe(6.97)
    expect(String(result.rows[0]![2])).toContain('INTEREST RUN')
  })
})
