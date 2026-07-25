/**
 * Optional browser error tracking — enabled when VITE_SENTRY_DSN is set.
 */
import * as Sentry from '@sentry/react'

export function initWebSentry(): void {
  const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim()
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) || import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.05'),
    sendDefaultPii: false,
  })
}
