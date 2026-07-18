import { describe, expect, it } from 'vitest'
import {
  forwardFillSparseHeaderRow,
  resolveMultiRowHeaders,
} from './excelHeaderResolve.js'
import { findHeaderRow } from './parser.js'

describe('excelHeaderResolve', () => {
  it('forward-fills sparse merged category cells', () => {
    expect(forwardFillSparseHeaderRow(['Amount', null, 'Balance', null])).toEqual([
      'Amount',
      'Amount',
      'Balance',
      null,
    ])
  })

  it('merges Amount|Debit / Amount|Credit stacked headers', () => {
    const data = [
      ['Account Statement', 'January 2026'],
      [null, null, 'Amount', null, 'Balance'],
      ['Date', 'Narration', 'Debit', 'Credit', ''],
      ['01/09/2023', 'Deposit', '', '500.00', '1500.00'],
      ['02/09/2023', 'Charge', '5.00', '', '1495.00'],
    ]
    // findHeaderRow may land on either category or detail row
    const idx = findHeaderRow(data)
    const resolved = resolveMultiRowHeaders(data, idx)
    expect(resolved.headerBandRows).toBeGreaterThanOrEqual(2)
    expect(resolved.headers.join(' ').toLowerCase()).toMatch(/debit/)
    expect(resolved.headers.join(' ').toLowerCase()).toMatch(/credit/)
    expect(resolved.headers[0].toLowerCase()).toMatch(/date/)
    expect(resolved.headers[0].toLowerCase()).not.toMatch(/amount/)
    const rows = data.slice(resolved.dataStart)
    expect(rows[0]?.[0]).toBe('01/09/2023')
    expect(rows).toHaveLength(2)
  })

  it('merges parent category above a dense detail header', () => {
    const data = [
      [null, null, 'Withdrawals', 'Deposits'],
      ['Date', 'Details', 'Debit', 'Credit'],
      ['03/01/2026', 'Payment', '40.00', ''],
    ]
    const resolved = resolveMultiRowHeaders(data, 1)
    expect(resolved.dataStart).toBe(2)
    expect(resolved.headers[0].toLowerCase()).toMatch(/^date$/)
    expect(resolved.headers[2].toLowerCase()).toMatch(/debit|withdrawal/)
    expect(resolved.headers[3].toLowerCase()).toMatch(/credit|deposit/)
  })

  it('leaves single-row headers unchanged', () => {
    const data = [
      ['Posting Date', 'Narration', 'Money Out', 'Money In', 'Balance'],
      ['01/01/2026', 'Opening', '', '', '1000'],
    ]
    const resolved = resolveMultiRowHeaders(data, 0)
    expect(resolved.headerBandRows).toBe(1)
    expect(resolved.headers).toEqual([
      'Posting Date',
      'Narration',
      'Money Out',
      'Money In',
      'Balance',
    ])
    expect(resolved.dataStart).toBe(1)
  })
})
