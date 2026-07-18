/**
 * BullMQ-backed parse job transport (optional when REDIS_URL is set).
 * Document.parseStatus remains the source of truth; BullMQ wakes workers.
 */
import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq'
import { logger } from '../middleware/logging.js'

export const PARSE_QUEUE_NAME = 'brs-parse-jobs'

export type ParseJobPayload = {
  documentId: string
}

export function shouldUseBullmq(): boolean {
  if (!(process.env.REDIS_URL || '').trim()) return false
  const v = (process.env.PARSE_JOB_USE_BULLMQ || '1').trim().toLowerCase()
  return v !== '0' && v !== 'false' && v !== 'off'
}

function bullmqConnection(): ConnectionOptions {
  const url = (process.env.REDIS_URL || '').trim()
  if (!url) throw new Error('REDIS_URL required for BullMQ')
  return {
    url,
    // BullMQ requires null for blocking connections (workers / Queue events).
    maxRetriesPerRequest: null,
  }
}

let queue: Queue<ParseJobPayload> | null = null

export function getParseQueue(): Queue<ParseJobPayload> | null {
  if (!shouldUseBullmq()) return null
  if (queue) return queue
  try {
    queue = new Queue<ParseJobPayload>(PARSE_QUEUE_NAME, {
      connection: bullmqConnection(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
      },
    })
    queue.on('error', (err) => {
      logger.warn({ err }, 'parse BullMQ queue error')
    })
    return queue
  } catch (err) {
    logger.warn({ err }, 'parse BullMQ queue init failed')
    return null
  }
}

/** Enqueue (or dedupe) a document parse job. jobId = documentId. */
export async function enqueueParseJobBullmq(documentId: string): Promise<boolean> {
  const q = getParseQueue()
  if (!q) return false
  await q.add(
    'parse',
    { documentId },
    {
      // Unique per enqueue so remaps after complete always wake a worker.
      // Document.parseStatus claim prevents double-processing.
      jobId: `${documentId}-${Date.now()}`,
    }
  )
  return true
}

export type ParseJobProcessor = (documentId: string) => Promise<void>

/** Start a BullMQ worker that calls processor(documentId). */
export function startParseBullmqWorker(
  processor: ParseJobProcessor,
  concurrency: number
): Worker<ParseJobPayload> | null {
  if (!shouldUseBullmq()) return null
  try {
    const worker = new Worker<ParseJobPayload>(
      PARSE_QUEUE_NAME,
      async (job: Job<ParseJobPayload>) => {
        const documentId = job.data?.documentId
        if (!documentId) return
        await processor(documentId)
      },
      {
        connection: bullmqConnection(),
        concurrency: Math.max(1, concurrency),
      }
    )
    worker.on('failed', (job, err) => {
      logger.warn(
        { err, documentId: job?.data?.documentId, jobId: job?.id },
        'parse BullMQ job failed'
      )
    })
    worker.on('error', (err) => {
      logger.warn({ err }, 'parse BullMQ worker error')
    })
    logger.info({ concurrency }, 'parse BullMQ worker started')
    return worker
  } catch (err) {
    logger.warn({ err }, 'parse BullMQ worker init failed')
    return null
  }
}

export async function closeParseBullmq(): Promise<void> {
  if (queue) {
    await queue.close().catch(() => undefined)
    queue = null
  }
}
