import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import type { AuthRequest } from './auth.js'

const WINDOW_MS = 60 * 1000
const MAX_PER_ORG = Number(process.env.HEAVY_ROUTE_LIMIT_PER_MIN) || 30

/** Per-org limiter for report/reconcile/export (CPU + DB heavy). */
export const heavyOrgRouteLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_PER_ORG,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many report/reconcile requests. Please wait a minute and try again.',
    code: 'RATE_LIMIT_HEAVY',
  },
  keyGenerator: (req) => {
    const orgId = (req as AuthRequest).auth?.orgId
    return orgId ? `heavy:${orgId}` : `heavy:ip:${ipKeyGenerator(req.ip ?? '')}`
  },
  skip: (req) => {
    const q = req.query.summaryOnly
    return q === '1' || q === 'true'
  },
})
