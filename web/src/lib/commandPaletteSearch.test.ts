import { describe, expect, it } from 'vitest'
import { normalizePaletteQuery, rankPaletteItems, scorePaletteItem } from './commandPaletteSearch'

describe('commandPaletteSearch', () => {
  it('strips conversational prefixes', () => {
    expect(normalizePaletteQuery('open billing')).toBe('billing')
    expect(normalizePaletteQuery('go to rec acme')).toBe('rec acme')
  })

  const project = {
    label: 'Ecobank Jun 2026',
    hint: 'reconciling · Acme Ltd',
    group: 'Projects',
    keywords: 'ecobank-jun acme',
  }

  it('matches reconcile shorthand against project status hint', () => {
    expect(scorePaletteItem(project, 'rec acme')).toBeGreaterThan(0)
  })

  it('ranks label prefix hits higher', () => {
    const a = { label: 'Acme draft', group: 'Projects', hint: 'draft' }
    const b = { label: 'Other', group: 'Projects', hint: 'acme draft' }
    expect(scorePaletteItem(a, 'acme')).toBeGreaterThan(scorePaletteItem(b, 'acme'))
  })

  it('filters unrelated queries', () => {
    expect(scorePaletteItem(project, 'zzzznotfound')).toBe(-1)
  })

  it('sorts by score', () => {
    const items = [
      { label: 'Billing', group: 'Settings', keywords: 'plan' },
      { label: 'Acme', group: 'Clients', keywords: '' },
    ]
    const ranked = rankPaletteItems(items, 'acme')
    expect(ranked[0]?.label).toBe('Acme')
  })
})
