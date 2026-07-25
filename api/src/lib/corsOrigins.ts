/**
 * Resolve browser CORS allow-list from env.
 * Production must allow the SPA origin(s); empty allow-list → browser "CORS" failures
 * (often after the proxy returns 503 when the API crash-loops on bad config).
 */

const PROD_FALLBACK_ORIGINS = [
  'https://kqsoftwaresolutions.com',
  'https://www.kqsoftwaresolutions.com',
]

/** Strip whitespace and trailing slash so https://app.com/ matches https://app.com */
export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '')
}

/** If apex is listed, also allow www (and vice versa) for the same host. */
export function expandWwwVariants(origins: string[]): string[] {
  const out = new Set<string>()
  for (const raw of origins) {
    const o = normalizeOrigin(raw)
    if (!o) continue
    out.add(o)
    try {
      const u = new URL(o)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue
      if (u.hostname.startsWith('www.')) {
        const apex = new URL(o)
        apex.hostname = u.hostname.slice(4)
        out.add(normalizeOrigin(apex.origin))
      } else if (u.hostname.includes('.')) {
        const www = new URL(o)
        www.hostname = `www.${u.hostname}`
        out.add(normalizeOrigin(www.origin))
      }
    } catch {
      /* ignore invalid */
    }
  }
  return [...out]
}

export type ResolveCorsOriginsOptions = {
  corsOriginEnv?: string
  appUrlEnv?: string
  isProd?: boolean
  /** Extra origins always merged (e.g. local Vite ports in development). */
  extraOrigins?: string[]
}

/**
 * Build the final allow-list.
 * Priority: CORS_ORIGIN → APP_URL → production fallbacks (prod only).
 */
export function resolveCorsOrigins(opts: ResolveCorsOriginsOptions = {}): {
  origins: string[]
  source: 'cors_origin' | 'app_url' | 'prod_fallback' | 'dev_only' | 'empty'
} {
  const isProd = opts.isProd ?? process.env.NODE_ENV === 'production'
  const fromCors = (opts.corsOriginEnv ?? process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean)
  const appUrl = normalizeOrigin(opts.appUrlEnv ?? process.env.APP_URL ?? '')
  const extra = (opts.extraOrigins || []).map(normalizeOrigin).filter(Boolean)

  if (fromCors.length > 0) {
    return {
      origins: expandWwwVariants([...fromCors, ...extra]),
      source: 'cors_origin',
    }
  }

  if (appUrl) {
    return {
      origins: expandWwwVariants([appUrl, ...extra]),
      source: 'app_url',
    }
  }

  if (isProd) {
    return {
      origins: expandWwwVariants([...PROD_FALLBACK_ORIGINS, ...extra]),
      source: 'prod_fallback',
    }
  }

  if (extra.length > 0) {
    return { origins: expandWwwVariants(extra), source: 'dev_only' }
  }

  return { origins: [], source: 'empty' }
}
