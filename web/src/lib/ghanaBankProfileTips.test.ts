import { describe, it, expect } from 'vitest'
import { ghanaBankProfileTip, GHANA_BANK_PROFILE_TIPS } from './ghanaBankProfileTips'

describe('ghanaBankProfileTip', () => {
  it('covers all Ghana banks with pattern matchers', () => {
    for (const key of ['ecobank', 'scb', 'gcb', 'nib', 'prudential', 'absa', 'boa']) {
      expect(GHANA_BANK_PROFILE_TIPS[key]).toBeTruthy()
      expect(ghanaBankProfileTip(key)?.title).toBeTruthy()
    }
  })

  it('returns null for unknown formats', () => {
    expect(ghanaBankProfileTip('unknown')).toBeNull()
    expect(ghanaBankProfileTip(null)).toBeNull()
  })
})
