import type { ErrorRequestHandler, RequestHandler } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { REQUEST_ID_HEADER } from './logging.js'

/**
 * Central error handler.  Replaces the inline handler in `index.ts` and adds:
 *
 *   - Zod validation errors → 400 with structured `details`.
 *   - Known Prisma errors (P2002 unique, P2025 not-found) → 400 / 404 with a
 *     friendly message instead of leaking a Prisma stack trace.
 *   - Multer file-size and file-type rejections → 413 / 400 (preserved).
 *   - Every error response carries the `requestId` so support can map a
 *     customer screenshot to a single log entry.
 *   - In production, we never echo the underlying Prisma error message — those
 *     can include column names and SQL fragments that aren't useful to clients
 *     and slightly leak schema info.
 */
const isProd = process.env.NODE_ENV === 'production'

const PRISMA_PUBLIC_MESSAGES: Record<string, { status: number; message: string }> = {
  P2002: { status: 409, message: 'A record with these unique values already exists.' },
  P2025: { status: 404, message: 'The requested record does not exist.' },
  P2003: { status: 400, message: 'The request references another record that no longer exists.' },
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Express may have started writing the response before the error fired.
  // In that case there's nothing useful we can do; let express finish.
  if (res.headersSent) {
    return
  }

  const requestId =
    (req as unknown as { id?: string | number }).id?.toString() ||
    (req.headers[REQUEST_ID_HEADER] as string | undefined) ||
    undefined

  // Multer / upload errors — preserved from the original handler.
  const code =
    err && typeof err === 'object' && 'code' in err
      ? (err as { code?: string }).code
      : undefined
  if (code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: `File too large. Max ${process.env.MAX_UPLOAD_SIZE_MB || '10'}MB.`,
      requestId,
    })
  }

  // Zod schema validation.
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Invalid request',
      details: err.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
      requestId,
    })
  }

  // Known Prisma errors — translate to friendly status codes.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = PRISMA_PUBLIC_MESSAGES[err.code]
    if (mapped) {
      return res.status(mapped.status).json({ error: mapped.message, requestId })
    }
    return res.status(400).json({
      error: 'Database request failed.',
      ...(isProd ? {} : { code: err.code, detail: err.message }),
      requestId,
    })
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      error: 'Invalid database query.',
      ...(isProd ? {} : { detail: err.message }),
      requestId,
    })
  }

  // Anything else — fall back to the legacy heuristic so existing throws
  // (e.g. multer file-type errors via `Error('File type ... not allowed')`)
  // keep their previous status codes.
  const message = err instanceof Error ? err.message : 'Request failed'
  let status = 500
  if (/file type|not allowed/i.test(message)) status = 400
  else if (code === 'LIMIT_FILE_SIZE' || /too large/i.test(message)) status = 413

  res.status(status).json({
    error: status >= 500 && isProd ? 'Internal server error' : message,
    requestId,
  })
}

/** 404 handler for unknown routes — gives clients the same shape as errors. */
export const notFoundHandler: RequestHandler = (req, res) => {
  const requestId =
    (req as unknown as { id?: string | number }).id?.toString() ||
    (req.headers[REQUEST_ID_HEADER] as string | undefined) ||
    undefined
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}`, requestId })
}
