import { afterEach, describe, expect, it } from 'vitest'
import {
  auditExportAllowed,
  bankRuleLimit,
  bulkMatchLimit,
  catalogueFeatureDepth,
  discrepancyRowCap,
  featureDepth,
  hasPlanFeature,
  isStoredFeaturesEmpty,
  mergePlanFeatures,
  missingChequeRowCap,
  planRank,
  replacePlanSlugRanks,
  setPlanRuntimeEntitlements,
  clearPlanRuntimeEntitlements,
} from './planFeatures.js'

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

  it('uses CMS slug ranks for custom plans between tiers', () => {
    replacePlanSlugRanks({
      free: 0,
      basic: 1,
      growth: 2,
      standard: 3,
      premium: 4,
      firm: 5,
    })
    expect(planRank('growth')).toBe(2)
    expect(catalogueFeatureDepth('growth', 'bulk_match')).toBe('full')
    expect(catalogueFeatureDepth('growth', 'bank_rules')).toBe('partial')
    expect(catalogueFeatureDepth('growth', 'threshold_approval')).toBe('none')
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

  it('gives every tier a slice of the review tools, and keeps the fuller version above', () => {
    expect(catalogueFeatureDepth('free', 'bulk_match')).toBe('partial')
    expect(catalogueFeatureDepth('free', 'audit_trail')).toBe('partial')
    expect(catalogueFeatureDepth('free', 'discrepancy_report')).toBe('partial')
    expect(catalogueFeatureDepth('free', 'missing_cheques_report')).toBe('partial')
    expect(catalogueFeatureDepth('free', 'bank_rules')).toBe('none')
    expect(catalogueFeatureDepth('free', 'ai_suggestions')).toBe('none')
    expect(catalogueFeatureDepth('free', 'one_to_many')).toBe('none')

    expect(bulkMatchLimit('free')).toBe(10)
    expect(bulkMatchLimit('basic')).toBe(50)
    expect(bulkMatchLimit('standard')).toBe(50)
    expect(bulkMatchLimit('premium')).toBe(100)
    expect(bulkMatchLimit('firm')).toBe(500)
    expect(discrepancyRowCap('free')).toBe(5)
    expect(discrepancyRowCap('basic')).toBe(-1)
    expect(missingChequeRowCap('free')).toBe(10)
    expect(missingChequeRowCap('basic')).toBe(-1)
    expect(bankRuleLimit('basic')).toBe(5)
    expect(bankRuleLimit('standard')).toBe(-1)
    expect(auditExportAllowed('free')).toBe(false)
    expect(auditExportAllowed('basic')).toBe(false)
    expect(auditExportAllowed('standard')).toBe(true)
    expect(featureDepth('standard', 'threshold_approval')).toBe('partial')
    expect(featureDepth('premium', 'threshold_approval')).toBe('full')
    expect(hasPlanFeature('basic', 'discrepancy_report')).toBe(true)
    expect(hasPlanFeature('basic', 'missing_cheques_report')).toBe(true)
    expect(hasPlanFeature('basic', 'bank_rules')).toBe(true)
    expect(hasPlanFeature('basic', 'full_branding')).toBe(false)
    expect(hasPlanFeature('premium', 'api_access')).toBe(false)
    expect(hasPlanFeature('firm', 'api_access')).toBe(true)
    expect(hasPlanFeature('firm', 'multi_client')).toBe(true)
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
