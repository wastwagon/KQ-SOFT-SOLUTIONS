import { afterEach, describe, expect, it } from 'vitest'
import { hasPlanFeature, isStoredFeaturesEmpty, mergePlanFeatures, planRank, setPlanRuntimeEntitlements, clearPlanRuntimeEntitlements } from './planFeatures.js'

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

  it('enables split matching on every tier', () => {
    for (const plan of ['basic', 'standard', 'premium', 'firm'] as const) {
      expect(hasPlanFeature(plan, 'one_to_many')).toBe(true)
      expect(hasPlanFeature(plan, 'many_to_many')).toBe(true)
    }
  })

  it('lets CMS runtime entitlements override code defaults', () => {
    setPlanRuntimeEntitlements('basic', { features: { one_to_many: false, bank_rules: true } })
    expect(hasPlanFeature('basic', 'bank_rules')).toBe(true)
    expect(hasPlanFeature('basic', 'api_access')).toBe(false)
    expect(hasPlanFeature('basic', 'one_to_many')).toBe(true)
    clearPlanRuntimeEntitlements()
    expect(hasPlanFeature('basic', 'one_to_many')).toBe(true)
  })

  it('treats missing CMS feature JSON as empty', () => {
    expect(isStoredFeaturesEmpty(null)).toBe(true)
    expect(isStoredFeaturesEmpty({})).toBe(true)
    expect(isStoredFeaturesEmpty({ bank_rules: true })).toBe(false)
    expect(isStoredFeaturesEmpty({ unknown: true })).toBe(true)
  })

  it('keeps split matching on when CMS stored false', () => {
    const merged = mergePlanFeatures('basic', { one_to_many: false, many_to_many: false, bank_rules: false })
    expect(merged.one_to_many).toBe(true)
    expect(merged.many_to_many).toBe(true)
    expect(merged.bank_rules).toBe(false)
  })
})
