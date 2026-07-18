/**
 * Optional Prometheus scrape endpoint (no JWT).
 * Enabled only when METRICS_SCRAPE_TOKEN is set.
 * Auth: Authorization: Bearer <token>  or  ?token=<token>
 */
import { Router } from 'express'
import { formatOpsMetricsPrometheus } from '../lib/opsMetrics.js'

const router = Router()

function scrapeToken(): string {
  return (process.env.METRICS_SCRAPE_TOKEN || '').trim()
}

function providedToken(req: { headers: Record<string, unknown>; query: Record<string, unknown> }): string {
  const auth = String(req.headers.authorization || '')
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim()
  }
  const q = req.query.token
  return typeof q === 'string' ? q.trim() : ''
}

router.get('/', (req, res) => {
  const expected = scrapeToken()
  if (!expected) {
    return res.status(404).json({ error: 'Metrics scrape disabled' })
  }
  if (providedToken(req) !== expected) {
    return res.status(401).json({ error: 'Invalid metrics token' })
  }
  res
    .type('text/plain; version=0.0.4; charset=utf-8')
    .send(formatOpsMetricsPrometheus())
})

export default router
