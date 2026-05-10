import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

vi.mock('./logging.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  REQUEST_ID_HEADER: 'x-request-id',
}))

import { errorHandler, notFoundHandler } from './errorHandler.js'

interface FakeRes {
  statusCode: number
  body: unknown
  headersSent: boolean
  status(code: number): FakeRes
  json(payload: unknown): FakeRes
}

function fakeRes(headersSent = false): FakeRes {
  return {
    statusCode: 200,
    body: undefined,
    headersSent,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    },
  }
}

function makeReq(overrides: Partial<{ id: string; headers: Record<string, string> }> = {}) {
  return {
    id: overrides.id,
    headers: overrides.headers ?? {},
    method: 'POST',
    path: '/api/v1/widgets',
  } as never
}

const ORIGINAL_NODE_ENV = process.env.NODE_ENV

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'test'
  })

  afterAll(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV
  })

  it('does nothing when headers were already sent', () => {
    const res = fakeRes(true)
    const next = vi.fn()
    errorHandler(new Error('late'), makeReq(), res as never, next)
    expect(res.body).toBeUndefined()
    expect(next).not.toHaveBeenCalled()
  })

  it('translates ZodError to 400 with structured details and echoes the request id', () => {
    const schema = z.object({ email: z.string().email(), age: z.number().int().positive() })
    let zodErr: unknown
    try {
      schema.parse({ email: 'not-an-email', age: -1 })
    } catch (e) {
      zodErr = e
    }
    const res = fakeRes()
    errorHandler(zodErr, makeReq({ id: 'req-1' }), res as never, vi.fn())
    expect(res.statusCode).toBe(400)
    const body = res.body as {
      error: string
      details: { path: string; message: string }[]
      requestId?: string
    }
    expect(body.error).toBe('Invalid request')
    expect(body.requestId).toBe('req-1')
    const paths = body.details.map((d) => d.path).sort()
    expect(paths).toContain('email')
    expect(paths).toContain('age')
  })

  it('falls back to the x-request-id header when req.id is absent', () => {
    const schema = z.string().min(5)
    let zodErr: unknown
    try {
      schema.parse('hi')
    } catch (e) {
      zodErr = e
    }
    const res = fakeRes()
    errorHandler(
      zodErr,
      makeReq({ headers: { 'x-request-id': 'header-id' } }),
      res as never,
      vi.fn()
    )
    expect((res.body as { requestId?: string }).requestId).toBe('header-id')
  })

  it('maps Prisma P2002 (unique violation) to 409 with a friendly message', () => {
    const err = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: 'test',
    })
    const res = fakeRes()
    errorHandler(err, makeReq({ id: 'req-2' }), res as never, vi.fn())
    expect(res.statusCode).toBe(409)
    expect(res.body).toMatchObject({
      error: 'A record with these unique values already exists.',
      requestId: 'req-2',
    })
  })

  it('maps Prisma P2025 (not found) to 404', () => {
    const err = new Prisma.PrismaClientKnownRequestError('not found', {
      code: 'P2025',
      clientVersion: 'test',
    })
    const res = fakeRes()
    errorHandler(err, makeReq(), res as never, vi.fn())
    expect(res.statusCode).toBe(404)
    expect(res.body).toMatchObject({ error: 'The requested record does not exist.' })
  })

  it('returns 400 (not 500) for unmapped Prisma known errors', () => {
    const err = new Prisma.PrismaClientKnownRequestError('schema mismatch', {
      code: 'P2099',
      clientVersion: 'test',
    })
    const res = fakeRes()
    errorHandler(err, makeReq(), res as never, vi.fn())
    expect(res.statusCode).toBe(400)
    expect(res.body).toMatchObject({ error: 'Database request failed.' })
  })

  it('translates multer LIMIT_FILE_SIZE to 413 with friendly message', () => {
    const err = Object.assign(new Error('file too large'), { code: 'LIMIT_FILE_SIZE' })
    process.env.MAX_UPLOAD_SIZE_MB = '7'
    const res = fakeRes()
    errorHandler(err, makeReq(), res as never, vi.fn())
    expect(res.statusCode).toBe(413)
    expect(res.body).toMatchObject({ error: 'File too large. Max 7MB.' })
    delete process.env.MAX_UPLOAD_SIZE_MB
  })

  it('translates "File type not allowed" Errors to 400', () => {
    const res = fakeRes()
    errorHandler(new Error('File type pdf is not allowed'), makeReq(), res as never, vi.fn())
    expect(res.statusCode).toBe(400)
  })

  it('returns a generic 500 in production for unknown errors (no stack leak)', async () => {
    // The handler captures `isProd` at module load, so we must re-import after
    // flipping NODE_ENV to exercise the production code path.
    process.env.NODE_ENV = 'production'
    vi.resetModules()
    const { errorHandler: prodErrorHandler } = await import('./errorHandler.js')
    const res = fakeRes()
    prodErrorHandler(
      new Error('boom: connection refused 127.0.0.1:5432'),
      makeReq(),
      res as never,
      vi.fn()
    )
    expect(res.statusCode).toBe(500)
    expect(res.body).toMatchObject({ error: 'Internal server error' })
  })

  it('echoes the underlying message in non-prod environments', () => {
    process.env.NODE_ENV = 'development'
    const res = fakeRes()
    errorHandler(new Error('something specific'), makeReq(), res as never, vi.fn())
    expect(res.statusCode).toBe(500)
    expect((res.body as { error: string }).error).toBe('something specific')
  })
})

describe('notFoundHandler', () => {
  it('returns 404 with the method and path and the request id', () => {
    const res = fakeRes()
    notFoundHandler(makeReq({ id: 'req-x' }), res as never, vi.fn())
    expect(res.statusCode).toBe(404)
    expect(res.body).toMatchObject({
      error: 'Not found: POST /api/v1/widgets',
      requestId: 'req-x',
    })
  })
})
