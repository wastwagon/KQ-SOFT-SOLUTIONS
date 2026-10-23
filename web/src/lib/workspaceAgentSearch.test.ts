import { describe, expect, it } from 'vitest'
import { agentPicksToPaletteItems, shouldUseWorkspaceAgent } from './workspaceAgentSearch'

describe('workspaceAgentSearch', () => {
  it('triggers on conversational queries', () => {
    expect(shouldUseWorkspaceAgent('billing')).toBe(false)
    expect(shouldUseWorkspaceAgent('how do I export a BRS pdf?')).toBe(true)
    expect(shouldUseWorkspaceAgent('show me reconciling projects for acme')).toBe(true)
  })

  it('maps agent picks to palette rows', () => {
    const items = agentPicksToPaletteItems(
      [{ path: '/settings/billing', label: 'Billing', reason: 'Manage plan' }],
      new Set()
    )
    expect(items[0]?.group).toBe('Assistant')
    expect(items[0]?.to).toBe('/settings/billing')
  })
})
