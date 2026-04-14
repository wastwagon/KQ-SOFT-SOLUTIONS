import { describe, it, expect } from 'vitest'
import {
  detectGhanaBankFormat,
  getSuggestedBankMapping,
  extractChqNoFromDescription,
} from './ghanaBankParsers.js'

describe('detectGhanaBankFormat', () => {
  it('detects Ecobank from headers and content', () => {
    const headers = ['Transaction Date', 'Description', 'Credit']
    const rows = [['2025-01-06', 'FUNDS TRANSFER - INWARD GHAAO00625HWE6R trf b/o ENTERPRISE LIFE', 29584.84]]
    const format = detectGhanaBankFormat(headers, rows)
    expect(format).toBe('ecobank')
  })

  it('detects Ecobank from CHEQUE WITHDRAWAL in description', () => {
    const headers = ['transaction_date', 'description', 'debit']
    const rows = [['2025-01-03', 'CHEQUE WITHDRAWAL CHQ NO 1925 PAID TO AKUFFO PHILIP', 3615]]
    const format = detectGhanaBankFormat(headers, rows)
    expect(format).toBe('ecobank')
  })

  it('returns null for unrecognized format', () => {
    const headers = ['ColA', 'ColB', 'ColC']
    const rows = [['a', 'b', 'c']]
    const format = detectGhanaBankFormat(headers, rows)
    expect(format).toBeNull()
  })

  it('detects Stanbic from header/content', () => {
    const headers = ['Value Date', 'Description', 'Credit', 'Debit']
    const rows = [['2025-01-06', 'Stanbic Bank transfer - SALARY PAYROLL', 50000, 0]]
    const format = detectGhanaBankFormat(headers, rows)
    expect(format).toBe('stanbic')
  })

  it('detects Fidelity from content', () => {
    const headers = ['Posting Date', 'Particulars', 'Amount']
    const rows = [['2025-01-10', 'Fidelity Bank mobile banking transfer', 1000]]
    const format = detectGhanaBankFormat(headers, rows)
    expect(format).toBe('fidelity')
  })

  it('detects UBA from content', () => {
    const headers = ['Date', 'Narrative', 'Credit', 'Debit']
    const rows = [['2025-01-05', 'UBA Ghana instant transfer RRN 123', 2500, 0]]
    const format = detectGhanaBankFormat(headers, rows)
    expect(format).toBe('uba')
  })

  it('detects Absa from content', () => {
    const headers = ['Transaction Date', 'Description', 'Credit']
    const rows = [['2025-01-08', 'Absa Bank cheque deposit CHQ 001234', 15000]]
    const format = detectGhanaBankFormat(headers, rows)
    expect(format).toBe('absa')
  })
})

describe('getSuggestedBankMapping', () => {
  it('returns mapping for Ecobank credits', () => {
    const headers = ['Transaction Date', 'Description', 'Credit']
    const mapping = getSuggestedBankMapping('ecobank', headers, 'credits')
    expect(mapping.transaction_date).toBe(0)
    expect(mapping.description).toBe(1)
    expect(mapping.credit).toBe(2)
  })

  it('returns mapping for Ecobank debits', () => {
    const headers = ['Date', 'Description', 'Debit']
    const mapping = getSuggestedBankMapping('ecobank', headers, 'debits')
    expect(mapping.transaction_date).toBeDefined()
    expect(mapping.description).toBeDefined()
    expect(mapping.debit).toBeDefined()
  })

  it('returns mapping for Stanbic credits', () => {
    const headers = ['Value Date', 'Description', 'Credit']
    const mapping = getSuggestedBankMapping('stanbic', headers, 'credits')
    expect(mapping.transaction_date).toBeDefined()
    expect(mapping.description).toBeDefined()
    expect(mapping.credit).toBeDefined()
  })
})

describe('extractChqNoFromDescription', () => {
  it('extracts CHQ NO pattern', () => {
    expect(extractChqNoFromDescription('CHEQUE WITHDRAWAL CHQ NO 1925 PAID TO AKUFFO')).toBe('1925')
  })

  it('extracts CHQ# pattern', () => {
    expect(extractChqNoFromDescription('Access bank cheque CHQ# 002038')).toBe('002038')
  })

  it('extracts Cheque pattern', () => {
    expect(extractChqNoFromDescription('Commissions received via Access bank cheque 001688')).toBe('001688')
    expect(extractChqNoFromDescription('Cheque No 001957')).toBe('001957')
  })

  it('returns null for no match', () => {
    expect(extractChqNoFromDescription('FUNDS TRANSFER - INWARD')).toBeNull()
    expect(extractChqNoFromDescription(null)).toBeNull()
    expect(extractChqNoFromDescription('')).toBeNull()
  })
})
