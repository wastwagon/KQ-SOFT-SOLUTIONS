import { afterEach, describe, expect, it } from 'vitest'
import { securityMiddleware } from './security.js'

interface FakeRes {
  statusCode: number
  headers: Record<string, string>
  setHeader(name: string, value: string): void
  removeHeader(name: string): void
  getHeader(name: string): string | undefined
  end(): void
  on(): void
}

function fakeRes(): FakeRes {
  const headers: Record<string, string> = {}
  return {
    statusCode: 200,
    headers,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value
    },
    removeHeader(name: string) {
      delete headers[name.toLowerCase()]
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()]
    },
    end() {
      /* no-op */
    },
    on() {
      /* no-op */
    },
  }
}

function fakeReq(method = 'GET') {
  return {
    method,
    headers: {},
    url: '/health',
    secure: false,
  } as never
}

const ORIGINAL_NODE_ENV = process.env.NODE_ENV

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV
  delete process.env.HELMET_DISABLE_CSP
})

describe('securityMiddleware', () => {
  it('sets X-Content-Type-Options and Referrer-Policy by default', async () => {
    const mw = securityMiddleware()
    const res = fakeRes()
    await new Promise<void>((resolve) => {
      mw(fakeReq(), res as never, () => resolve())
    })
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })

  it('emits a Content-Security-Policy with locked-down defaults', async () => {
    const mw = securityMiddleware()
    const res = fakeRes()
    await new Promise<void>((resolve) => {
      mw(fakeReq(), res as never, () => resolve())
    })
    const csp = res.headers['content-security-policy']
    expect(csp).toBeDefined()
    expect(csp).toContain("default-src 'self'")
    // The API should never serve scripts.
    expect(csp).toContain("script-src 'none'")
    // Branding logos / data URIs need to load from the API origin.
    expect(csp).toMatch(/img-src[^;]*'self'/)
    expect(csp).toMatch(/img-src[^;]*data:/)
    // API responses must never be framed.
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('sets cross-origin resource policy to cross-origin (so the SPA can load logos)', async () => {
    const mw = securityMiddleware()
    const res = fakeRes()
    await new Promise<void>((resolve) => {
      mw(fakeReq(), res as never, () => resolve())
    })
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin')
  })

  it('omits HSTS in non-production so local docker stacks work', async () => {
    process.env.NODE_ENV = 'development'
    const mw = securityMiddleware()
    const res = fakeRes()
    await new Promise<void>((resolve) => {
      mw(fakeReq(), res as never, () => resolve())
    })
    expect(res.headers['strict-transport-security']).toBeUndefined()
  })

  it('emits HSTS with a long max-age in production', async () => {
    process.env.NODE_ENV = 'production'
    const mw = securityMiddleware()
    const res = fakeRes()
    await new Promise<void>((resolve) => {
      mw(fakeReq(), res as never, () => resolve())
    })
    const hsts = res.headers['strict-transport-security']
    expect(hsts).toBeDefined()
    expect(hsts).toMatch(/max-age=\d+/)
    const match = hsts?.match(/max-age=(\d+)/)
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(31_536_000)
    expect(hsts).toContain('includeSubDomains')
  })

  it('skips CSP when HELMET_DISABLE_CSP=1', async () => {
    process.env.HELMET_DISABLE_CSP = '1'
    const mw = securityMiddleware()
    const res = fakeRes()
    await new Promise<void>((resolve) => {
      mw(fakeReq(), res as never, () => resolve())
    })
    expect(res.headers['content-security-policy']).toBeUndefined()
    // Other headers still present.
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })
})
