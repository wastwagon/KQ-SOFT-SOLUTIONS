import { describe, expect, it } from 'vitest'
import {
  buildSuggestedJournalLines,
  buildSuggestedJournalsCsv,
} from './suggestedJournals.js'

describe('suggestedJournals', () => {
  it('builds balanced double-entry lines per category', () => {
    const lines = buildSuggestedJournalLines({
      currency: 'GHS',
      uncreditedLodgments: [{ date: '2023-09-01', name: 'Deposit', amount: 100 }],
      unpresentedCheques: [{ date: '2023-09-02', chqNo: '12', amount: 40 }],
      bankOnlyDebits: [{ date: '2023-09-03', details: 'SMS FEE', amount: 5 }],
      bankOnlyCredits: [{ date: '2023-09-04', details: 'Interest', amount: 2 }],
    })
    expect(lines).toHaveLength(8)
    const byEntry = new Map<string, number>()
    for (const l of lines) {
      byEntry.set(l.entryId, (byEntry.get(l.entryId) || 0) + l.debit - l.credit)
    }
    for (const net of byEntry.values()) expect(net).toBeCloseTo(0)
    expect(lines[0].accountCode).toBe('1100')
    expect(lines[1].accountCode).toBe('1150')
  })

  it('emits CSV with header and amounts', () => {
    const csv = buildSuggestedJournalsCsv({
      currency: 'GHS',
      bankOnlyDebits: [{ date: '2023-09-03', details: 'FEE, bank', amount: 1.5 }],
    })
    expect(csv.startsWith('EntryId,Line,Date')).toBe(true)
    expect(csv).toContain('6100')
    expect(csv).toContain('"FEE, bank"')
    expect(csv).toContain('1.50')
  })

  it('skips zero amounts', () => {
    const lines = buildSuggestedJournalLines({
      currency: 'GHS',
      uncreditedLodgments: [{ amount: 0 }],
    })
    expect(lines).toHaveLength(0)
  })
})
