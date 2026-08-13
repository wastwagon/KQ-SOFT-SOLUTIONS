import { describe, expect, it } from 'vitest'
import {
  compareDatesAscending,
  compareDatesNewestFirst,
  sortParsedRowsByDate,
  withParsedRowsOldestFirst,
} from './transactionDateOrder.js'

describe('transactionDateOrder', () => {
  it('orders dates oldest first by default', () => {
    expect(compareDatesAscending(new Date('2026-01-01'), new Date('2026-12-30'))).toBeLessThan(0)
    expect(compareDatesAscending(new Date('2026-12-30'), new Date('2026-01-01'))).toBeGreaterThan(0)
  })

  it('orders dates newest first when requested', () => {
    expect(compareDatesNewestFirst(new Date('2026-12-30'), new Date('2026-01-01'))).toBeLessThan(0)
    expect(compareDatesNewestFirst(new Date('2026-01-01'), new Date('2026-12-30'))).toBeGreaterThan(0)
  })

  it('puts null dates after real dates (oldest-first)', () => {
    expect(compareDatesAscending(new Date('2026-06-01'), null)).toBeLessThan(0)
    expect(compareDatesAscending(null, new Date('2026-06-01'))).toBeGreaterThan(0)
  })

  it('sorts cleanup rows oldest first (1 Jan … 30 Dec)', () => {
    const headers = ['Date', 'Description', 'Debit']
    const rows = [
      ['30/12/2026', 'Newest', 30],
      ['01/01/2026', 'Oldest', 10],
      ['15/06/2026', 'Mid', 20],
    ]
    const sorted = sortParsedRowsByDate(headers, rows, 'oldest_first')
    expect(sorted.map((r) => r[1])).toEqual(['Oldest', 'Mid', 'Newest'])
  })

  it('sorts newest first when order is newest_first', () => {
    const headers = ['Date', 'Description']
    const rows = [
      ['01/01/2026', 'Oldest'],
      ['30/12/2026', 'Newest'],
      ['15/06/2026', 'Mid'],
    ]
    const sorted = sortParsedRowsByDate(headers, rows, 'newest_first')
    expect(sorted.map((r) => r[1])).toEqual(['Newest', 'Mid', 'Oldest'])
  })

  it('withParsedRowsOldestFirst applies book order', () => {
    const parsed = withParsedRowsOldestFirst({
      headers: ['transaction_date', 'credit'],
      rows: [
        ['2026-12-30', 2],
        ['2026-01-01', 1],
      ],
    })
    expect(parsed.rows[0]![0]).toBe('2026-01-01')
  })
})
