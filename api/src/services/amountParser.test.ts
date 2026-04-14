import { describe, expect, it } from 'vitest'
import { parseImportedAmount } from './amountParser.js'

describe('parseImportedAmount', () => {
  it('returns number input as-is', () => {
    expect(parseImportedAmount(123.45)).toBe(123.45)
  })

  it('parses comma separated numbers', () => {
    expect(parseImportedAmount('1,234.56')).toBe(1234.56)
  })

  it('parses accounting bracket negatives', () => {
    expect(parseImportedAmount('(1,234.56)')).toBe(-1234.56)
  })

  it('parses trailing minus values', () => {
    expect(parseImportedAmount('1234.56-')).toBe(-1234.56)
  })

  it('parses signed values', () => {
    expect(parseImportedAmount('+100')).toBe(100)
    expect(parseImportedAmount('-100')).toBe(-100)
  })

  it('returns zero for invalid and empty inputs', () => {
    expect(parseImportedAmount('')).toBe(0)
    expect(parseImportedAmount('abc')).toBe(0)
    expect(parseImportedAmount(null)).toBe(0)
    expect(parseImportedAmount(undefined)).toBe(0)
  })
})
