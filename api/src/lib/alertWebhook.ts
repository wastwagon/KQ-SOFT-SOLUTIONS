/**
 * Optional outbound alerts (Slack Incoming Webhook, Discord, generic Pager webhooks).
 * Enabled when ALERT_WEBHOOK_URL (or SLACK_WEBHOOK_URL) is set.
 */
import { logger } from '../middleware/logging.js'

const lastSent = new Map<string, number>()

export function getAlertWebhookUrl(): string | undefined {
  const url = (process.env.ALERT_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL || '').trim()
  return url || undefined
}

export function isAlertWebhookEnabled(): boolean {
  return !!getAlertWebhookUrl()
}

type AlertPayload = {
  /** Dedup key — same key won't fire again within cooldownMs */
  key: string
  title: string
  text: string
  severity?: 'info' | 'warning' | 'critical'
  fields?: Record<string, string | number | boolean | null | undefined>
  cooldownMs?: number
}

/**
 * Fire-and-forget webhook alert. Never throws to callers.
 * Slack-compatible: posts `{ text }` (and Block Kit-lite attachment fields when present).
 */
export async function sendAlertWebhook(payload: AlertPayload): Promise<boolean> {
  const url = getAlertWebhookUrl()
  if (!url) return false

  const cooldown = payload.cooldownMs ?? 15 * 60_000
  const last = lastSent.get(payload.key) ?? 0
  if (Date.now() - last < cooldown) return false

  const severity = payload.severity ?? 'warning'
  const fieldLines = payload.fields
    ? Object.entries(payload.fields)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `• *${k}:* ${String(v)}`)
        .join('\n')
    : ''
  const text = [`*[${severity.toUpperCase()}]* ${payload.title}`, payload.text, fieldLines]
    .filter(Boolean)
    .join('\n')

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        username: 'KQ-SOFT Ops',
        icon_emoji: severity === 'critical' ? ':rotating_light:' : ':warning:',
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      logger.warn({ status: res.status, body: body.slice(0, 200) }, 'alert webhook failed')
      return false
    }
    lastSent.set(payload.key, Date.now())
    logger.info({ key: payload.key, severity }, 'alert webhook sent')
    return true
  } catch (err) {
    logger.warn({ err }, 'alert webhook error')
    return false
  }
}
