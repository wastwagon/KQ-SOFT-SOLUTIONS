/** Public site origin for canonical & OG URLs (set `VITE_SITE_URL` in production). */
export function getSiteOrigin(): string {
  const env = import.meta.env.VITE_SITE_URL?.replace(/\/$/, '')
  if (env) return env
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

/** Absolute URL for a path under the Vite base (e.g. `/assets/images/foo.jpg`). */
export function absolutePublicUrl(path: string): string {
  const origin = getSiteOrigin()
  const basePrefix = import.meta.env.BASE_URL.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  if (!origin) return `${basePrefix}${p}`
  return `${origin}${basePrefix}${p}`
}
