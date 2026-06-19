import { describe, expect, it } from 'vitest'
import { shouldSkipBankStatementImportRow } from './bankStatementImport.js'

describe('shouldSkipBankStatementImportRow', () => {
  it('skips empty END OF STATEMENT footer rows', () => {
    expect(shouldSkipBankStatementImportRow('END OF STATEMENT')).toBe(true)
    expect(shouldSkipBankStatementImportRow('END OF STATEMENT', 0)).toBe(true)
  })

  it('keeps END OF STATEMENT rows that carry an amount (SCB clearing totals)', () => {
    expect(shouldSkipBankStatementImportRow('END OF STATEMENT', 5238.87)).toBe(false)
  })

  it('skips other balance footers', () => {
    expect(shouldSkipBankStatementImportRow('OPENING BALANCE')).toBe(true)
    expect(shouldSkipBankStatementImportRow('CLOSING BALANCE')).toBe(true)
  })

  it('keeps real transactions', () => {
    expect(shouldSkipBankStatementImportRow('INW CLG 484648')).toBe(false)
    expect(shouldSkipBankStatementImportRow('SWEEP FROM GHS 0100106024700')).toBe(false)
  })
})
