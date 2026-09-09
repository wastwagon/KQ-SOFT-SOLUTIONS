import { afterEach, describe, expect, it } from 'vitest'
import { hasPlanFeature, isStoredFeaturesEmpty, planRank, setPlanRuntimeEntitlements, clearPlanRuntimeEntitlements } from './planFeatures.js'

describe('planFeatures', () => {
  afterEach(() => {
    clearPlanRuntimeEntitlements()
  })
  it('ranks plans in order', () => {
    expect(planRank('basic')).toBe(0)
    expect(planRank('standard')).toBe(1)
    expect(planRank('premium')).toBe(2)
    expect(planRank('firm')).toBe(3)
    expect(planRank('unknown')).toBe(-1)
  })

  it('enables ai_suggestions and bulk_match on every tier', () => {
    for (const plan of ['basic', 'standard', 'premium', 'firm'] as const) {
      expect(hasPlanFeature(plan, 'ai_suggestions')).toBe(true)
      expect(hasPlanFeature(plan, 'bulk_match')).toBe(true)
    }
  })

  it('keeps one_to_many on Premium+', () => {
    expect(hasPlanFeature('basic', 'one_to_many')).toBe(false)
    expect(hasPlanFeature('standard', 'one_to_many')).toBe(false)
    expect(hasPlanFeature('premium', 'one_to_many')).toBe(true)
  })

  it('lets CMS runtime entitlements override code defaults', () => {
    setPlanRuntimeEntitlements('basic', { features: { one_to_many: true, bank_rules: true } })
    expect(hasPlanFeature('basic', 'one_to_many')).toBe(true)
    expect(hasPlanFeature('basic', 'bank_rules')).toBe(true)
    expect(hasPlanFeature('basic', 'api_access')).toBe(false)
    clearPlanRuntimeEntitlements()
    expect(hasPlanFeature('basic', 'one_to_many')).toBe(false)
  })

  it('treats missing CMS feature JSON as empty', () => {
    expect(isStoredFeaturesEmpty(null)).toBe(true)
    expect(isStoredFeaturesEmpty({})).toBe(true)
    expect(isStoredFeaturesEmpty({ bank_rules: true })).toBe(false)
    expect(isStoredFeaturesEmpty({ unknown: true })).toBe(true)
  })
})
