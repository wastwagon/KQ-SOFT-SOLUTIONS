import { describe, expect, it } from 'vitest'
import {
  buildWorkspaceSearchCatalog,
  filterAgentPicksToCatalog,
} from './workspaceAgentSearch.js'

const baseCtx = {
  role: 'admin',
  isPlatformAdmin: false,
  features: {
    api_access: false,
    bank_rules: false,
    audit_trail: false,
    multi_client: true,
  },
  projects: [
    { slug: 'acme-jun', name: 'Acme Jun', status: 'reconciling', clientName: 'Acme Ltd' },
  ],
  clients: [{ id: 'c1', name: 'Acme Ltd' }],
}

describe('workspaceAgentSearch catalog', () => {
  it('includes project reconcile and report paths', () => {
    const catalog = buildWorkspaceSearchCatalog(baseCtx)
    const paths = catalog.map((d) => d.path)
    expect(paths).toContain('/projects/acme-jun/reconcile')
    expect(paths).toContain('/projects/acme-jun/report')
    expect(paths).toContain('/projects?clientId=c1')
  })

  it('rejects paths outside the allowlist', () => {
    const catalog = buildWorkspaceSearchCatalog(baseCtx)
    const filtered = filterAgentPicksToCatalog(
      [
        { path: '/projects/acme-jun/reconcile', label: 'Go reconcile' },
        { path: '/evil', label: 'Nope' },
      ],
      catalog
    )
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.path).toBe('/projects/acme-jun/reconcile')
  })
})
