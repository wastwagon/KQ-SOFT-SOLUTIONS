import { describe, expect, it } from 'vitest'
import {
  applyQuotaToMarketingMatrix,
  parseStoredMarketing,
  suggestTaglineFromQuotas,
} from './planMarketing.js'

describe('planMarketing', () => {
  it('parses stored marketing and merges defaults', () => {
    const m = parseStoredMarketing({ tagline: 'Custom tagline', bullets: ['One'] }, 'free')
    expect(m.tagline).toBe('Custom tagline')
    expect(m.bullets).toEqual(['One'])
    expect(m.ctaLabel).toBe('Start free')
  })

  it('refreshes limit rows in the feature matrix from quotas', () => {
    const base = parseStoredMarketing(null, 'free')
    const updated = applyQuotaToMarketingMatrix(base, {
      bankAccounts: 1,
      projectsPerMonth: 5,
      transactionsPerMonth: 300,
      usersLimit: 1,
    })
    expect(updated.featureMatrix.transactions).toBe('300 / month')
  })

  it('suggests taglines from quotas', () => {
    expect(
      suggestTaglineFromQuotas({
        bankAccounts: 1,
        projectsPerMonth: 5,
        transactionsPerMonth: 300,
        usersLimit: 1,
      })
    ).toContain('300 transactions')
  })
})
