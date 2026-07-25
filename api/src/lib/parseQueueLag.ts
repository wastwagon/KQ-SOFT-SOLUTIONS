/**
 * Refresh parse-queue lag gauges for Prometheus / admin ops metrics.
 * Call on an interval from the API and/or parse-worker.
 */
import { prisma } from './prisma.js'
import { setOpsGauge } from './opsMetrics.js'
import { getParseQueue, shouldUseBullmq } from './parseJobBullmq.js'
import { logger } from '../middleware/logging.js'
import { sendAlertWebhook } from './alertWebhook.js'

export async function refreshParseQueueLagMetrics(): Promise<void> {
  try {
    const now = Date.now()
    const pending = await prisma.document.count({
      where: { parseStatus: { in: ['pending', 'processing'] } },
    })
    setOpsGauge('parse.queue_pending_docs', pending)

    const oldest = await prisma.document.findFirst({
      where: { parseStatus: { in: ['pending', 'processing'] } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, parseStartedAt: true },
    })
    if (oldest) {
      const anchor = oldest.parseStartedAt || oldest.createdAt
      const lagSec = Math.max(0, Math.round((now - anchor.getTime()) / 1000))
      setOpsGauge('parse.queue_oldest_lag_sec', lagSec)
      const warnSec = Number(process.env.PARSE_QUEUE_LAG_WARN_SEC || '300')
      if (lagSec >= warnSec) {
        logger.warn(
          { evt: 'parse_queue_lag', lagSec, pending, warnSec },
          'parse queue lag exceeded warning threshold'
        )
        void sendAlertWebhook({
          key: 'parse_queue_lag',
          title: 'Parse queue lag warning',
          text: `Oldest pending/processing document is ${lagSec}s behind (threshold ${warnSec}s).`,
          severity: lagSec >= warnSec * 2 ? 'critical' : 'warning',
          fields: { lagSec, pending, warnSec },
          cooldownMs: 15 * 60_000,
        })
      }
    } else {
      setOpsGauge('parse.queue_oldest_lag_sec', 0)
    }

    if (shouldUseBullmq()) {
      const queue = getParseQueue()
      if (queue) {
        const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed')
        setOpsGauge('parse.bullmq_waiting', counts.waiting || 0)
        setOpsGauge('parse.bullmq_active', counts.active || 0)
        setOpsGauge('parse.bullmq_failed', counts.failed || 0)
      }
    }
  } catch (err) {
    logger.debug({ err }, 'refreshParseQueueLagMetrics failed')
  }
}

/** Start periodic lag refresh (no-op if already started in this process). */
let lagTimer: ReturnType<typeof setInterval> | null = null

export function startParseQueueLagReporter(intervalMs = 60_000): void {
  if (lagTimer) return
  const ms = Number(process.env.PARSE_QUEUE_LAG_INTERVAL_MS || intervalMs)
  void refreshParseQueueLagMetrics()
  lagTimer = setInterval(() => {
    void refreshParseQueueLagMetrics()
  }, Number.isFinite(ms) && ms >= 10_000 ? ms : 60_000)
  if (typeof lagTimer.unref === 'function') lagTimer.unref()
}
