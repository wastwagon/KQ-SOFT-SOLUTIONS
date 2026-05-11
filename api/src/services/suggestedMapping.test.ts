import { describe, expect, it } from 'vitest'
import { buildSmartSuggestedMapping, getMappingConfidence, normHeader } from './suggestedMapping.js'

describe('suggestedMapping', () => {
  it('normHeader collapses underscores and spaces', () => {
    expect(normHeader('  Doc_REF  ')).toBe('doc ref')
  })

  it('maps bank statement columns from common headers', () => {
    const headers = ['Value Date', 'Description', 'Money In', 'Money Out']
    const m = buildSmartSuggestedMapping(headers, false, {})
    expect(m.transaction_date).toBe(0)
    expect(m.description).toBe(1)
  })

  it('preserves existing suggested indices when merging', () => {
    const headers = ['Date', 'Narrative', 'Cr', 'Dr']
    const existing = { transaction_date: 0, credit: 2 }
    const m = buildSmartSuggestedMapping(headers, false, existing)
    expect(m.transaction_date).toBe(0)
    expect(m.credit).toBe(2)
  })

  it('getMappingConfidence marks strong header matches', () => {
    const headers = ['Date', 'Particulars']
    const mapping = { transaction_date: 0, description: 1 }
    const c = getMappingConfidence(headers, mapping)
    expect(c.transaction_date).toBe('high')
    expect(c.description).toBe('high')
  })
})
