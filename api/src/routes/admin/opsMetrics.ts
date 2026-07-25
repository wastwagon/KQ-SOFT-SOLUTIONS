import { Router } from 'express'
import {
  formatOpsMetricsPrometheus,
  getOpsMetricsSnapshot,
} from '../../lib/opsMetrics.js'
import { isAlertWebhookEnabled, sendAlertWebhook } from '../../lib/alertWebhook.js'

const router = Router()

/** Process-local AI / parse / match-memory counters since boot. */
router.get('/', (_req, res) => {
  res.json({
    ...getOpsMetricsSnapshot(),
    alerts: { webhookConfigured: isAlertWebhookEnabled() },
  })
})

/** Prometheus text exposition (platform admin JWT). */
router.get('/prometheus', (_req, res) => {
  res
    .type('text/plain; version=0.0.4; charset=utf-8')
    .send(formatOpsMetricsPrometheus())
})

/** Fire a one-off test alert when ALERT_WEBHOOK_URL / SLACK_WEBHOOK_URL is set. */
router.post('/test-alert', async (_req, res) => {
  if (!isAlertWebhookEnabled()) {
    return res.status(503).json({
      error: 'Alert webhook not configured. Set ALERT_WEBHOOK_URL or SLACK_WEBHOOK_URL.',
    })
  }
  const ok = await sendAlertWebhook({
    key: `test-alert:${Date.now()}`,
    title: 'KQ-SOFT test alert',
    text: 'Platform admin triggered a test alert. If you see this, Slack/Pager wiring works.',
    severity: 'info',
    cooldownMs: 0,
  })
  if (!ok) return res.status(502).json({ error: 'Webhook request failed' })
  res.json({ ok: true })
})

export default router
