import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/** Mirror `reopenSchema` in projects route — sources must return to mapping for uploads. */
const reopenSchema = z.object({
  mode: z.enum(['reconcile', 'sources']).optional().default('reconcile'),
})

function nextStatusAfterReopen(mode: 'reconcile' | 'sources') {
  return mode === 'sources' ? 'mapping' : 'reconciling'
}

describe('project reopen', () => {
  it('defaults to reconcile mode', () => {
    const body = reopenSchema.parse({})
    expect(body.mode).toBe('reconcile')
    expect(nextStatusAfterReopen(body.mode)).toBe('reconciling')
  })

  it('accepts sources mode for upload/map', () => {
    const body = reopenSchema.parse({ mode: 'sources' })
    expect(nextStatusAfterReopen(body.mode)).toBe('mapping')
  })

  it('rejects unknown mode', () => {
    expect(() => reopenSchema.parse({ mode: 'upload' })).toThrow()
  })
})
