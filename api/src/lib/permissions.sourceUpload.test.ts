import { describe, expect, it } from 'vitest'
import { isProjectSourceIdentityLocked, isProjectSourceUploadAllowed } from './permissions.js'

describe('source upload lock', () => {
  it('allows uploads in draft and mapping', () => {
    expect(isProjectSourceUploadAllowed('draft')).toBe(true)
    expect(isProjectSourceUploadAllowed('mapping')).toBe(true)
    expect(isProjectSourceIdentityLocked('draft')).toBe(false)
    expect(isProjectSourceIdentityLocked('mapping')).toBe(false)
  })

  it('locks uploads from reconcile onward', () => {
    expect(isProjectSourceIdentityLocked('reconciling')).toBe(true)
    expect(isProjectSourceIdentityLocked('submitted_for_review')).toBe(true)
    expect(isProjectSourceIdentityLocked('completed')).toBe(true)
  })
})
