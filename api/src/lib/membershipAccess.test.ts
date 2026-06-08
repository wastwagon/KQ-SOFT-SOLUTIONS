import { describe, expect, it } from 'vitest'
import { membershipAccessBlocked } from './membershipAccess.js'

describe('membershipAccessBlocked', () => {
  const base = {
    role: 'admin',
    userEmail: 'user@example.com',
    userSuspendedAt: null,
    orgSuspendedAt: null,
  }

  it('allows active user and org', () => {
    expect(membershipAccessBlocked(base).blocked).toBe(false)
  })

  it('blocks suspended user', () => {
    const r = membershipAccessBlocked({
      ...base,
      userSuspendedAt: new Date(),
    })
    expect(r.blocked).toBe(true)
    expect(r.code).toBe('USER_SUSPENDED')
  })

  it('blocks suspended org for normal users', () => {
    const r = membershipAccessBlocked({
      ...base,
      orgSuspendedAt: new Date(),
    })
    expect(r.blocked).toBe(true)
    expect(r.code).toBe('ORG_SUSPENDED')
  })

  it('allows platform admin through suspended org', () => {
    const r = membershipAccessBlocked({
      ...base,
      userEmail: 'admin@kqsoftwaresolutions.com',
      orgSuspendedAt: new Date(),
    })
    expect(r.blocked).toBe(false)
  })
})
