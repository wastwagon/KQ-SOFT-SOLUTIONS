import helmet, { type HelmetOptions } from 'helmet'
import type { RequestHandler } from 'express'

/**
 * Production-grade HTTP security headers via helmet.
 *
 * Notes on the CSP:
 *   - The API does not serve HTML to browsers; the only HTML responses are
 *     errors from express defaults, which we don't want any inline scripts in.
 *   - Branding logos are served at `/api/v1/uploads/branding/...` and must be
 *     embeddable from the SPA hosted on a different origin (or from the same
 *     origin behind Coolify).  We therefore allow `img-src 'self'`.
 *   - We disable the upgrade-insecure-requests directive so that local docker
 *     compose stacks (HTTP between containers) don't break.
 */
export function securityMiddleware(): RequestHandler {
  const isProd = process.env.NODE_ENV === 'production'

  // CSP can be disabled with HELMET_DISABLE_CSP=1 if you discover a deployment
  // that needs to embed assets from an unexpected origin.
  const disableCsp = process.env.HELMET_DISABLE_CSP === '1'

  const csp: HelmetOptions['contentSecurityPolicy'] = disableCsp
    ? false
    : {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"], // API responses should never be framed
          imgSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          scriptSrc: ["'none'"], // API never serves scripts
          styleSrc: ["'self'", "'unsafe-inline'"], // express's default error page uses inline styles
          // Don't auto-rewrite http -> https; Coolify terminates TLS upstream
          // and inter-container traffic stays on http.
          upgradeInsecureRequests: null,
        },
      }

  return helmet({
    contentSecurityPolicy: csp,
    // The API is sometimes accessed from a different origin (the SPA in
    // production deployments where web and api have separate sub-domains).
    // CORP "same-origin" would block those legitimate cross-origin reads of
    // logos and other static assets we serve through the API.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginEmbedderPolicy: false,
    // HSTS only when running behind TLS — Coolify terminates TLS upstream so
    // we want the header on responses leaving the proxy.
    strictTransportSecurity: isProd
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
      : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
}
