import { describe, expect, it } from 'vitest'
import { pickOrgBillingEmail } from './orgBillingEmail.js'

describe('pickOrgBillingEmail', () => {
  it('prefers admin over first member', () => {
    const email = pickOrgBillingEmail([
      { role: 'viewer', user: { email: 'first@example.com' } },
      { role: 'admin', user: { email: 'boss@example.com' } },
    ])
    expect(email).toBe('boss@example.com')
  })

  it('falls back to any member when no admin email', () => {
    const email = pickOrgBillingEmail([
      { role: 'preparer', user: { email: 'prep@example.com' } },
    ])
    expect(email).toBe('prep@example.com')
  })

  it('returns undefined when no emails', () => {
    expect(pickOrgBillingEmail([{ role: 'admin', user: { email: '' } }])).toBeUndefined()
    expect(pickOrgBillingEmail([])).toBeUndefined()
  })
})
