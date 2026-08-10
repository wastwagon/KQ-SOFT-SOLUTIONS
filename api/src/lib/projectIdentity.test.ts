import { describe, it, expect } from 'vitest'
import {
  composeProjectDisplayName,
  resolveReportEntityName,
  formatReconciliationDateLabel,
} from './projectIdentity.js'

describe('composeProjectDisplayName', () => {
  it('joins business, account, number, and closing date', () => {
    expect(
      composeProjectDisplayName({
        statementBusinessName: 'GHANA COCOA BOARD',
        bankAccountName: 'Ecobank Current',
        accountNo: '1441001234567',
        reconciliationDate: '2023-09-30',
      })
    ).toBe('GHANA COCOA BOARD — Ecobank Current (1441001234567) — as at 2023-09-30')
  })

  it('omits empty parts without breaking', () => {
    expect(
      composeProjectDisplayName({
        statementBusinessName: 'Acme Ltd',
        reconciliationDate: '2025-01-31T00:00:00.000Z',
      })
    ).toBe('Acme Ltd — as at 2025-01-31')
  })
})

describe('resolveReportEntityName', () => {
  it('prefers statement business name', () => {
    expect(resolveReportEntityName('COCOBOD', 'KQ Soft Solutions')).toBe('COCOBOD')
  })

  it('falls back to organization name for legacy projects', () => {
    expect(resolveReportEntityName(null, 'KQ Soft Solutions')).toBe('KQ Soft Solutions')
    expect(resolveReportEntityName('  ', 'Firm Name')).toBe('Firm Name')
  })
})

describe('formatReconciliationDateLabel', () => {
  it('normalizes ISO and Date inputs', () => {
    expect(formatReconciliationDateLabel('2023-09-30T12:00:00.000Z')).toBe('2023-09-30')
    expect(formatReconciliationDateLabel(new Date('2023-09-30T00:00:00.000Z'))).toBe('2023-09-30')
  })
})
