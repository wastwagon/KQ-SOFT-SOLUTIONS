import { describe, expect, it } from 'vitest'
import { normalizeOrgMemberRole } from './orgMemberRole.js'

describe('normalizeOrgMemberRole', () => {
  it('maps member to preparer', () => {
    expect(normalizeOrgMemberRole('member')).toBe('preparer')
  })

  it('passes through known roles', () => {
    expect(normalizeOrgMemberRole('admin')).toBe('admin')
    expect(normalizeOrgMemberRole('viewer')).toBe('viewer')
  })
})
