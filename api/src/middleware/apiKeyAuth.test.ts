import { describe, it, expect } from 'vitest'
import { pruneRateLimitEntries } from './apiKeyAuth.js'

describe('pruneRateLimitEntries', () => {
  it('removes expired entries first', () => {
    const now = Date.now()
    const map = new Map<string, { count: number; resetAt: number }>()
    map.set('active', { count: 1, resetAt: now + 60_000 })
    map.set('expired', { count: 1, resetAt: now - 1 })

    pruneRateLimitEntries(map, now, 100)

    expect(map.has('expired')).toBe(false)
    expect(map.has('active')).toBe(true)
  })

  it('evicts oldest windows when over max', () => {
    const now = Date.now()
    const map = new Map<string, { count: number; resetAt: number }>()
    map.set('k1', { count: 1, resetAt: now + 1000 })
    map.set('k2', { count: 1, resetAt: now + 2000 })
    map.set('k3', { count: 1, resetAt: now + 3000 })

    pruneRateLimitEntries(map, now, 2)

    expect(map.size).toBe(2)
    expect(map.has('k1')).toBe(false)
    expect(map.has('k2')).toBe(true)
    expect(map.has('k3')).toBe(true)
  })
})
