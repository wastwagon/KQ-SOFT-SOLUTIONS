import { afterEach, describe, expect, it } from 'vitest'
import { hasPlanFeature, isStoredFeaturesEmpty, mergePlanFeatures, planRank, setPlanRuntimeEntitlements, clearPlanRuntimeEntitlements } from './planFeatures.js'

describe('planFeatures', () => {
  afterEach(() => {
    clearPlanRuntimeEntitlements()
  })
  it('ranks plans in order', () => {
    expect(planRank('free')).toBe(0)
    expect(planRank('basic')).toBe(1)
    expect(planRank('standard')).toBe(2)
    expect(planRank('premium')).toBe(3)
    expect(planRank('firm')).toBe(4)
    expect(planRank('unknown')).toBe(-1)
  })

  it('enables ai_suggestions and bulk_match on every tier', () => {
    for (const plan of ['basic', 'standard', 'premium', 'firm'] as const) {
      expect(hasPlanFeature(plan, 'ai_suggestions')).toBe(true)
      expect(hasPlanFeature(plan, 'bulk_match')).toBe(true)
    }
  })

  it('starts split matching, many-to-many, and roll forward at Solo', () => {
    expect(hasPlanFeature('free', 'one_to_many')).toBe(false)
    expect(hasPlanFeature('free', 'many_to_many')).toBe(false)
    expect(hasPlanFeature('free', 'roll_forward')).toBe(false)
    for (const plan of ['basic', 'standard', 'premium', 'firm'] as const) {
      expect(hasPlanFeature(plan, 'one_to_many')).toBe(true)
      expect(hasPlanFeature(plan, 'many_to_many')).toBe(true)
      expect(hasPlanFeature(plan, 'roll_forward')).toBe(true)
    }
  })

  it('lets CMS runtime entitlements override code defaults', () => {
    setPlanRuntimeEntitlements('basic', { features: { one_to_many: false, bank_rules: true } })
    expect(hasPlanFeature('basic', 'bank_rules')).toBe(true)
    expect(hasPlanFeature('basic', 'api_access')).toBe(false)
    expect(hasPlanFeature('basic', 'one_to_many')).toBe(false)
    clearPlanRuntimeEntitlements()
    expect(hasPlanFeature('basic', 'one_to_many')).toBe(true)
    expect(hasPlanFeature('basic', 'roll_forward')).toBe(true)
  })

  it('treats missing CMS feature JSON as empty', () => {
    expect(isStoredFeaturesEmpty(null)).toBe(true)
    expect(isStoredFeaturesEmpty({})).toBe(true)
    expect(isStoredFeaturesEmpty({ bank_rules: true })).toBe(false)
    expect(isStoredFeaturesEmpty({ unknown: true })).toBe(true)
  })

  it('uses stored CMS flags when present, otherwise the Solo floor', () => {
    const storedOff = mergePlanFeatures('basic', {
      one_to_many: false,
      many_to_many: false,
      roll_forward: false,
      bank_rules: false,
    })
    expect(storedOff.one_to_many).toBe(false)
    expect(storedOff.many_to_many).toBe(false)
    expect(storedOff.roll_forward).toBe(false)
    expect(storedOff.bank_rules).toBe(false)

    const defaults = mergePlanFeatures('basic', null)
    expect(defaults.one_to_many).toBe(true)
    expect(defaults.many_to_many).toBe(true)
    expect(defaults.roll_forward).toBe(true)
    expect(mergePlanFeatures('free', null).roll_forward).toBe(false)
  })
})
