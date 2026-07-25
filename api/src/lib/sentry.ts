/**
 * Optional Sentry error tracking — enabled when SENTRY_DSN is set.
 */
import { logger } from '../middleware/logging.js'

let sentryReady = false

export async function initSentry(serviceName: string): Promise<void> {
  const dsn = (process.env.SENTRY_DSN || '').trim()
  if (!dsn) return
  try {
    const Sentry = await import('@sentry/node')
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE || undefined,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.05'),
      serverName: serviceName,
    })
    sentryReady = true
    logger.info({ serviceName }, 'Sentry initialized')
  } catch (err) {
    logger.warn({ err }, 'Sentry init failed (is @sentry/node installed?)')
  }
}

export async function captureException(err: unknown, context?: Record<string, unknown>): Promise<void> {
  if (!sentryReady) return
  try {
    const Sentry = await import('@sentry/node')
    Sentry.withScope((scope) => {
      if (context) {
        for (const [k, v] of Object.entries(context)) {
          scope.setExtra(k, v)
        }
      }
      Sentry.captureException(err)
    })
  } catch {
    /* ignore */
  }
}

export function isSentryEnabled(): boolean {
  return sentryReady
}
