import 'dotenv/config'
import { logger } from '../middleware/logging.js'
import { startParseJobWorker } from '../lib/parseJobQueue.js'
import { shouldUseBullmq } from '../lib/parseJobBullmq.js'
import { initSentry, captureException } from '../lib/sentry.js'
import { startParseQueueLagReporter } from '../lib/parseQueueLag.js'

/**
 * Dedicated parse/OCR worker process.
 *
 * Usage:
 *   npm run worker:parse
 *   PARSE_JOB_IN_API=0 on the API so HTTP workers only enqueue.
 *
 * Requires DATABASE_URL; REDIS_URL recommended (BullMQ).
 */
void initSentry('brs-parse-worker').then(() => startParseQueueLagReporter())

logger.info(
  {
    bullmq: shouldUseBullmq(),
    redis: Boolean((process.env.REDIS_URL || '').trim()),
    concurrency: process.env.PARSE_JOB_CONCURRENCY || '1',
  },
  'starting dedicated parse worker'
)

startParseJobWorker()

function shutdown(signal: string) {
  logger.info({ signal }, 'parse worker shutting down')
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException in parse worker')
  void captureException(err, { source: 'uncaughtException' })
})
process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'unhandledRejection in parse worker')
  void captureException(err, { source: 'unhandledRejection' })
})
