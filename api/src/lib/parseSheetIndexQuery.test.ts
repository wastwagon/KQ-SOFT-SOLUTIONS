import { describe, expect, it } from 'vitest'
import { parseSheetIndexQuery } from './parseSheetIndexQuery.js'

describe('parseSheetIndexQuery', () => {
  it('returns 0 for undefined, null, or empty', () => {
    expect(parseSheetIndexQuery(undefined)).toBe(0)
    expect(parseSheetIndexQuery(null)).toBe(0)
    expect(parseSheetIndexQuery('')).toBe(0)
  })

  it('parses non-negative integers from string or number', () => {
    expect(parseSheetIndexQuery('0')).toBe(0)
    expect(parseSheetIndexQuery('2')).toBe(2)
    expect(parseSheetIndexQuery(3)).toBe(3)
  })

  it('uses first element of array query params', () => {
    expect(parseSheetIndexQuery(['1', '9'])).toBe(1)
  })

  it('returns 0 for negative or non-numeric strings', () => {
    expect(parseSheetIndexQuery('-1')).toBe(0)
    expect(parseSheetIndexQuery('abc')).toBe(0)
  })

  it('parses leading digits before a decimal (parseInt behaviour)', () => {
    expect(parseSheetIndexQuery('3.5')).toBe(3)
  })
})
