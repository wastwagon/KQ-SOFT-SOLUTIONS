import { describe, expect, it } from 'vitest'
import { hasPlanFeature, planRank } from './planFeatures.js'

describe('planFeatures', () => {
  it('ranks plans in order', () => {
    expect(planRank('basic')).toBe(0)
    expect(planRank('standard')).toBe(1)
    expect(planRank('premium')).toBe(2)
    expect(planRank('firm')).toBe(3)
    expect(planRank('unknown')).toBe(-1)
  })

  it('gates ai_suggestions to Standard+', () => {
    expect(hasPlanFeature('basic', 'ai_suggestions')).toBe(false)
    expect(hasPlanFeature('standard', 'ai_suggestions')).toBe(true)
    expect(hasPlanFeature('premium', 'ai_suggestions')).toBe(true)
    expect(hasPlanFeature('firm', 'ai_suggestions')).toBe(true)
  })

  it('keeps one_to_many on Premium+', () => {
    expect(hasPlanFeature('basic', 'one_to_many')).toBe(false)
    expect(hasPlanFeature('standard', 'one_to_many')).toBe(false)
    expect(hasPlanFeature('premium', 'one_to_many')).toBe(true)
  })
})
