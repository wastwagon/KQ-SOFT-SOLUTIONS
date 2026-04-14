import { describe, it, expect, vi } from 'vitest'

describe('requireJwtSecret', () => {
  it('returns env secret when present', async () => {
    vi.resetModules()
    process.env.NODE_ENV = 'development'
    process.env.JWT_SECRET = 'abc123'
    const mod = await import('./auth.js')
    expect(mod.requireJwtSecret()).toBe('abc123')
  })

  it('returns test fallback in test env when missing', async () => {
    vi.resetModules()
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET = ''
    const mod = await import('./auth.js')
    expect(mod.requireJwtSecret()).toBe('test-secret')
  })
})
