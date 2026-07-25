import { describe, expect, it } from 'vitest'
import { expandWwwVariants, normalizeOrigin, resolveCorsOrigins } from './corsOrigins.js'

describe('corsOrigins', () => {
  it('normalizes trailing slash', () => {
    expect(normalizeOrigin(' https://kqsoftwaresolutions.com/ ')).toBe(
      'https://kqsoftwaresolutions.com'
    )
  })

  it('expands www and apex variants', () => {
    const expanded = expandWwwVariants(['https://kqsoftwaresolutions.com'])
    expect(expanded).toContain('https://kqsoftwaresolutions.com')
    expect(expanded).toContain('https://www.kqsoftwaresolutions.com')
  })

  it('prefers CORS_ORIGIN over APP_URL', () => {
    const r = resolveCorsOrigins({
      isProd: true,
      corsOriginEnv: 'https://app.example.com',
      appUrlEnv: 'https://other.example.com',
    })
    expect(r.source).toBe('cors_origin')
    expect(r.origins).toContain('https://app.example.com')
    expect(r.origins).toContain('https://www.app.example.com')
  })

  it('falls back to APP_URL then prod defaults', () => {
    const fromApp = resolveCorsOrigins({
      isProd: true,
      corsOriginEnv: '',
      appUrlEnv: 'https://billing.example.com/',
    })
    expect(fromApp.source).toBe('app_url')
    expect(fromApp.origins).toContain('https://billing.example.com')

    const fallback = resolveCorsOrigins({
      isProd: true,
      corsOriginEnv: '',
      appUrlEnv: '',
    })
    expect(fallback.source).toBe('prod_fallback')
    expect(fallback.origins).toContain('https://kqsoftwaresolutions.com')
    expect(fallback.origins).toContain('https://www.kqsoftwaresolutions.com')
  })
})
