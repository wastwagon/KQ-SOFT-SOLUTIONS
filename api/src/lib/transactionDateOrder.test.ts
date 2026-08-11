import { describe, expect, it } from 'vitest'
import {
  compareDatesDescending,
  sortParsedRowsNewestFirst,
  withParsedRowsNewestFirst,
} from './transactionDateOrder.js'

describe('transactionDateOrder', () => {
  it('orders dates newest first', () => {
    expect(compareDatesDescending(new Date('2026-12-30'), new Date('2026-01-01'))).toBeLessThan(0)
    expect(compareDatesDescending(new Date('2026-01-01'), new Date('2026-12-30'))).toBeGreaterThan(0)
  })

  it('puts null dates after real dates', () => {
    expect(compareDatesDescending(new Date('2026-06-01'), null)).toBeLessThan(0)
    expect(compareDatesDescending(null, new Date('2026-06-01'))).toBeGreaterThan(0)
  })

  it('sorts cleanup rows newest first (30 Dec … 1 Jan)', () => {
    const headers = ['Date', 'Description', 'Debit']
    const rows = [
      ['01/01/2026', 'Oldest', 10],
      ['15/06/2026', 'Mid', 20],
      ['30/12/2026', 'Newest', 30],
    ]
    const sorted = sortParsedRowsNewestFirst(headers, rows)
    expect(sorted.map((r) => r[1])).toEqual(['Newest', 'Mid', 'Oldest'])
  })

  it('withParsedRowsNewestFirst leaves sums logic input ordered', () => {
    const parsed = withParsedRowsNewestFirst({
      headers: ['transaction_date', 'credit'],
      rows: [
        ['2026-01-01', 1],
        ['2026-12-30', 2],
      ],
    })
    expect(parsed.rows[0]![0]).toBe('2026-12-30')
  })
})
