import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('../lib/prisma.js', () => ({
  prisma: { $queryRaw: mocks.queryRaw },
}))

vi.mock('./logging.js', () => ({
  logger: {
    warn: mocks.warn,
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  REQUEST_ID_HEADER: 'x-request-id',
}))

import { livenessHandler, readinessHandler } from './readiness.js'

interface FakeRes {
  statusCode: number
  body: unknown
  status(code: number): FakeRes
  json(payload: unknown): FakeRes
}

function fakeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    },
  }
  return res
}

describe('livenessHandler', () => {
  it('always returns 200 with service id', () => {
    const res = fakeRes()
    livenessHandler({} as never, res as never)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ status: 'ok', service: 'brs-api' })
  })
})

describe('readinessHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with checks when DB is reachable', async () => {
    mocks.queryRaw.mockResolvedValue([{ '?column?': 1 }])
    const res = fakeRes()
    await readinessHandler({} as never, res as never)
    expect(res.statusCode).toBe(200)
    const body = res.body as { status: string; checks: Record<string, { ok: boolean; latencyMs?: number }> }
    expect(body.status).toBe('ready')
    expect(body.checks.db.ok).toBe(true)
    expect(typeof body.checks.db.latencyMs).toBe('number')
  })

  it('returns 503 when the DB query rejects', async () => {
    mocks.queryRaw.mockRejectedValue(new Error('boom'))
    const res = fakeRes()
    await readinessHandler({} as never, res as never)
    expect(res.statusCode).toBe(503)
    const body = res.body as { status: string; checks: Record<string, { ok: boolean; error?: string }> }
    expect(body.status).toBe('not_ready')
    expect(body.checks.db.ok).toBe(false)
    expect(body.checks.db.error).toBe('boom')
    expect(mocks.warn).toHaveBeenCalled()
  })

  it('returns 503 when DB hangs longer than the timeout', async () => {
    process.env.READINESS_DB_TIMEOUT_MS = '20'
    // Re-import so the timeout env is picked up.
    vi.resetModules()
    const { readinessHandler: handler } = await import('./readiness.js')
    mocks.queryRaw.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 200)
        })
    )
    const res = fakeRes()
    await handler({} as never, res as never)
    expect(res.statusCode).toBe(503)
    const body = res.body as { checks: { db: { ok: boolean; error?: string } } }
    expect(body.checks.db.ok).toBe(false)
    expect(body.checks.db.error).toMatch(/timed out/i)
    delete process.env.READINESS_DB_TIMEOUT_MS
  })
})
