import { describe, expect, it } from 'vitest'
import {
  reconstructTableFromWords,
  shouldPreferGeometryTable,
  type OcrWord,
} from './genericStatementTable.js'

function w(text: string, x0: number, y0: number, x1 = x0 + text.length * 8, y1 = y0 + 14): OcrWord {
  return { text, x0, y0, x1, y1, confidence: 90, page: 0 }
}

describe('genericStatementTable', () => {
  it('preserves empty debit/credit cells via column bands', () => {
    // Header: Date | Description | Debit | Credit | Balance
    const yH = 40
    const words: OcrWord[] = [
      w('Date', 10, yH, 50),
      w('Description', 120, yH, 220),
      w('Debit', 320, yH, 370),
      w('Credit', 420, yH, 480),
      w('Balance', 540, yH, 610),
      // Deposit: empty debit, credit filled
      w('01/09/2023', 10, 80, 100),
      w('Customer', 120, 80, 190),
      w('deposit', 195, 80, 260),
      w('500.00', 420, 80, 480),
      w('1500.00', 540, 80, 610),
      // Charge: debit filled, empty credit
      w('02/09/2023', 10, 110, 100),
      w('Bank', 120, 110, 160),
      w('charge', 165, 110, 220),
      w('5.00', 320, 110, 360),
      w('1495.00', 540, 110, 610),
    ]

    const table = reconstructTableFromWords(words)
    expect(table.columnMode).toBe('header_bands')
    expect(table.headers.map((h) => h.toLowerCase())).toEqual(
      expect.arrayContaining(['date', 'description', 'debit', 'credit', 'balance'])
    )
    expect(table.rows.length).toBe(2)
    const [deposit, charge] = table.rows as string[][]
    expect(deposit[0]).toContain('01/09/2023')
    expect(deposit[2]).toBe('') // empty debit
    expect(deposit[3]).toMatch(/500/)
    expect(charge[2]).toMatch(/5/)
    expect(charge[3]).toBe('') // empty credit
  })

  it('joins multi-line narrative continuations into the prior row', () => {
    const words: OcrWord[] = [
      w('Date', 10, 20, 50),
      w('Details', 100, 20, 160),
      w('Amount', 400, 20, 460),
      w('03/01/2026', 10, 50, 100),
      w('Payment', 100, 50, 160),
      w('to', 165, 50, 185),
      w('100.00', 400, 50, 460),
      // Continuation — no date, under details column
      w('supplier', 100, 75, 170),
      w('invoice', 175, 75, 235),
      w('44', 240, 75, 265),
    ]
    const table = reconstructTableFromWords(words)
    expect(table.rows.length).toBe(1)
    const row = table.rows[0] as string[]
    expect(row[1].toLowerCase()).toMatch(/payment.*supplier.*invoice/)
    expect(row[2]).toMatch(/100/)
  })

  it('prefers geometry when text splitter collapsed empty amount columns', () => {
    const textTable = {
      headers: ['Date', 'Description', 'Amount'],
      rows: [
        ['01/09/2023', 'Deposit', '500.00'],
        ['02/09/2023', 'Charge', '5.00'],
      ],
    }
    const geometry = reconstructTableFromWords([
      w('Date', 10, 20, 50),
      w('Description', 100, 20, 200),
      w('Debit', 300, 20, 350),
      w('Credit', 400, 20, 460),
      w('01/09/2023', 10, 50, 100),
      w('Deposit', 100, 50, 160),
      w('500.00', 400, 50, 460),
      w('02/09/2023', 10, 80, 100),
      w('Charge', 100, 80, 160),
      w('5.00', 300, 80, 340),
    ])
    expect(shouldPreferGeometryTable(textTable, geometry)).toBe(true)
  })
})
