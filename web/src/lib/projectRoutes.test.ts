import { describe, expect, it } from 'vitest'
import { isProjectStepId, projectStepPath, projectPathForStatus } from './projectRoutes'

describe('projectRoutes', () => {
  it('builds canonical step paths', () => {
    expect(projectStepPath('acme-jun')).toBe('/projects/acme-jun')
    expect(projectStepPath('acme-jun', 'reconcile')).toBe('/projects/acme-jun/reconcile')
  })

  it('validates step ids', () => {
    expect(isProjectStepId('reconcile')).toBe(true)
    expect(isProjectStepId('bogus')).toBe(false)
  })

  it('maps status to workflow step', () => {
    expect(projectPathForStatus('x', 'mapping')).toBe('/projects/x/map')
    expect(projectPathForStatus('x', 'reconciling')).toBe('/projects/x/reconcile')
    expect(projectPathForStatus('x', 'completed')).toBe('/projects/x/report')
  })
})
