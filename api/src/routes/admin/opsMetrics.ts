import { Router } from 'express'
import {
  formatOpsMetricsPrometheus,
  getOpsMetricsSnapshot,
} from '../../lib/opsMetrics.js'

const router = Router()

/** Process-local AI / parse / match-memory counters since boot. */
router.get('/', (_req, res) => {
  res.json(getOpsMetricsSnapshot())
})

/** Prometheus text exposition (platform admin JWT). */
router.get('/prometheus', (_req, res) => {
  res
    .type('text/plain; version=0.0.4; charset=utf-8')
    .send(formatOpsMetricsPrometheus())
})

export default router
