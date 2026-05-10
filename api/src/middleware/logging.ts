import crypto from 'node:crypto'
import { pinoHttp, type Options as PinoHttpOptions } from 'pino-http'
import pino from 'pino'
import type { IncomingMessage } from 'node:http'

/**
 * Structured request logging.
 *
 * Why this exists:
 *   - The API previously used `console.log` from a single service file.  Any
 *     deploy or customer issue meant grepping unstructured Coolify logs.
 *   - This sets up `pino` with one log line per request, including a stable
 *     request ID we propagate to error responses so a customer ticket maps to
 *     a single log entry.
 *
 * Configuration:
 *   - LOG_LEVEL=trace|debug|info|warn|error|fatal|silent (default: info, debug in dev)
 *   - LOG_PRETTY=1 forces pretty-printed output (default: on in dev, off in prod)
 *   - The `/health` and `/healthz` probes are silenced to keep platform logs clean.
 */
const isProd = process.env.NODE_ENV === 'production'
const usePretty = process.env.LOG_PRETTY === '1' || (!isProd && process.env.LOG_PRETTY !== '0')

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  base: { service: 'brs-api' },
  redact: {
    // Avoid leaking secrets if they ever appear in logged objects.
    paths: [
      'req.headers.authorization',
      'req.headers["x-api-key"]',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
    ],
    censor: '[REDACTED]',
  },
  ...(usePretty
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, singleLine: true, ignore: 'pid,hostname,service' },
        },
      }
    : {}),
})

/** Header used to propagate a request id end-to-end (proxy, API, client). */
export const REQUEST_ID_HEADER = 'x-request-id'

const HEALTH_PROBE_PATHS = new Set(['/health', '/healthz', '/readyz'])

const baseHttpOptions: PinoHttpOptions = {
  logger,
  // Honour an upstream request id (Coolify / nginx may already set one),
  // otherwise mint a UUID so every request can be correlated.
  genReqId: (req: IncomingMessage) => {
    const incoming = req.headers[REQUEST_ID_HEADER]
    if (typeof incoming === 'string' && incoming.length > 0 && incoming.length < 200) {
      return incoming
    }
    return crypto.randomUUID()
  },
  customLogLevel: (_req, res, err) => {
    if (err) return 'error'
    if (res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} failed: ${err.message}`,
  // Health probes are noisy and don't help debugging.  Skip the per-request log
  // line for them but still allow errors to bubble up.
  autoLogging: {
    ignore: (req) => {
      const url = req.url ?? ''
      // Strip any querystring before comparison.
      const path = url.split('?')[0]
      return HEALTH_PROBE_PATHS.has(path)
    },
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
}

export const httpLogger = pinoHttp(baseHttpOptions)
