import { describe, expect, it } from 'vitest'
import { retentionAnchorDate, retentionCutoff } from './dataRetention.js'

describe('dataRetention helpers', () => {
  it('computes cutoff N years before now', () => {
    const now = new Date('2026-07-25T12:00:00.000Z')
    expect(retentionCutoff(7, now).toISOString()).toBe('2019-07-25T12:00:00.000Z')
  })

  it('prefers reconciliationDate as anchor', () => {
    const recon = new Date('2020-01-15T00:00:00.000Z')
    const updated = new Date('2025-01-01T00:00:00.000Z')
    expect(retentionAnchorDate({ reconciliationDate: recon, updatedAt: updated })).toEqual(recon)
  })

  it('falls back to updatedAt when no reconciliationDate', () => {
    const updated = new Date('2025-01-01T00:00:00.000Z')
    expect(retentionAnchorDate({ reconciliationDate: null, updatedAt: updated })).toEqual(updated)
  })
})
