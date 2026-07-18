/**
 * Durable deferred parse/auto-map queue.
 *
 * - Always persists work via Document.parseStatus = pending
 * - Prefer BullMQ when REDIS_URL + PARSE_JOB_USE_BULLMQ (default on)
 * - Else LPUSH wake list; DB poller always recovers pending + stale processing
 * - Set PARSE_JOB_IN_API=0 and run `npm run worker:parse` for a dedicated worker
 */
import { Redis } from 'ioredis'
import { prisma } from './prisma.js'
import { logger } from '../middleware/logging.js'
import { markDocumentParseFailed } from './documentParseJob.js'
import { incOpsMetric } from './opsMetrics.js'
import {
  enqueueParseJobBullmq,
  shouldUseBullmq,
  startParseBullmqWorker,
} from './parseJobBullmq.js'
import type { Worker } from 'bullmq'

const REDIS_LIST_KEY = 'brs:parse-jobs'

export function parseJobPollIntervalMs(): number {
  const n = parseInt(process.env.PARSE_JOB_POLL_MS || '5000', 10)
  return Number.isFinite(n) && n >= 1000 ? n : 5000
}

/** Re-queue documents stuck in processing longer than this (default 15 min). */
export function parseJobStaleMs(): number {
  const n = parseInt(process.env.PARSE_JOB_STALE_MS || String(15 * 60 * 1000), 10)
  return Number.isFinite(n) && n >= 60_000 ? n : 15 * 60 * 1000
}

export function parseJobConcurrency(): number {
  const n = parseInt(process.env.PARSE_JOB_CONCURRENCY || '1', 10)
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 4) : 1
}

/** When false, the API process only enqueues — run `worker:parse` separately. */
export function parseJobInApi(): boolean {
  const v = (process.env.PARSE_JOB_IN_API || '1').trim().toLowerCase()
  return v !== '0' && v !== 'false' && v !== 'off'
}

let redis: Redis | null | undefined
let redisDisabled = false

function getRedis(): Redis | null {
  if (redisDisabled) return null
  if (redis !== undefined) return redis
  const url = (process.env.REDIS_URL || '').trim()
  if (!url) {
    redis = null
    return null
  }
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    })
    redis.on('error', (err: Error) => {
      logger.warn({ err }, 'parse job Redis error')
    })
    return redis
  } catch (err) {
    logger.warn({ err }, 'parse job Redis init failed — DB poller only')
    redisDisabled = true
    redis = null
    return null
  }
}

export type EnqueueParseResult = 'bullmq' | 'redis' | 'db'

/** Enqueue a document for deferred parse (BullMQ → list → DB poller). */
export async function enqueueParseJob(documentId: string): Promise<EnqueueParseResult> {
  if (shouldUseBullmq()) {
    try {
      const ok = await enqueueParseJobBullmq(documentId)
      if (ok) {
        incOpsMetric('parse.job_enqueued_bullmq', { detail: { documentId }, log: false })
        return 'bullmq'
      }
    } catch (err) {
      // Duplicate jobId while active/waiting is fine — already queued.
      const msg = err instanceof Error ? err.message : String(err)
      if (/already exists|Job is already/i.test(msg)) {
        incOpsMetric('parse.job_enqueued_bullmq', {
          detail: { documentId, deduped: true },
          log: false,
        })
        return 'bullmq'
      }
      logger.warn({ err, documentId }, 'parse job BullMQ add failed — falling back')
    }
  }

  const client = getRedis()
  if (client) {
    try {
      if (client.status !== 'ready') {
        await client.connect().catch(() => undefined)
      }
      await client.lpush(REDIS_LIST_KEY, documentId)
      incOpsMetric('parse.job_enqueued_redis', { detail: { documentId }, log: false })
      return 'redis'
    } catch (err) {
      logger.warn({ err, documentId }, 'parse job Redis LPUSH failed — relying on DB poller')
    }
  }
  incOpsMetric('parse.job_enqueued_db', { detail: { documentId }, log: false })
  return 'db'
}

async function reclaimStaleProcessing(): Promise<number> {
  const cutoff = new Date(Date.now() - parseJobStaleMs())
  const result = await prisma.document.updateMany({
    where: {
      parseStatus: 'processing',
      parseStartedAt: { lt: cutoff },
    },
    data: {
      parseStatus: 'pending',
      parseStartedAt: null,
      parseFinishedAt: null,
      parseStatusMessage: 'Re-queued after stale processing',
    },
  })
  if (result.count > 0) {
    logger.warn({ count: result.count }, 'reclaimed stale parse jobs')
    incOpsMetric('parse.job_reclaimed_stale', { detail: { count: result.count } })
  }
  return result.count
}

/** Atomically claim one pending document (FIFO). */
export async function claimNextParseJob(): Promise<string | null> {
  await reclaimStaleProcessing()
  const next = await prisma.document.findFirst({
    where: { parseStatus: 'pending' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!next) return null
  return (await claimParseDocument(next.id)) ? next.id : null
}

/** Claim a specific document if still pending. */
export async function claimParseDocument(documentId: string): Promise<boolean> {
  const claimed = await prisma.document.updateMany({
    where: { id: documentId, parseStatus: 'pending' },
    data: {
      parseStatus: 'processing',
      parseStartedAt: new Date(),
      parseFinishedAt: null,
      parseStatusMessage: 'Parsing document…',
    },
  })
  return claimed.count > 0
}

export async function runParseJob(documentId: string): Promise<void> {
  try {
    const { tryAutoMapDocument } = await import('../services/autoMapDocument.js')
    await tryAutoMapDocument(documentId)
    incOpsMetric('parse.job_completed', { detail: { documentId }, log: false })
  } catch (err) {
    logger.error({ err, documentId }, 'parse job failed')
    await markDocumentParseFailed(
      documentId,
      err instanceof Error ? err.message : 'Parse job failed'
    ).catch(() => undefined)
    incOpsMetric('parse.job_failed', { detail: { documentId } })
  }
}

/**
 * Process a BullMQ (or wake) signal for a document:
 * claim if pending, then run auto-map. No-op if already claimed/done.
 */
export async function processParseDocumentJob(documentId: string): Promise<void> {
  const claimed = await claimParseDocument(documentId)
  if (!claimed) {
    // Another worker may already be processing; or status is ready/failed.
    return
  }
  await runParseJob(documentId)
}

let workerStarted = false
let active = 0
let stopping = false
let bullmqWorker: Worker | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

async function drainOnce(): Promise<void> {
  const max = parseJobConcurrency()
  while (!stopping && active < max) {
    const documentId = await claimNextParseJob()
    if (!documentId) break
    active++
    void runParseJob(documentId).finally(() => {
      active--
    })
  }
}

async function redisListConsumerLoop(): Promise<void> {
  if (shouldUseBullmq()) return // BullMQ worker handles Redis jobs
  const client = getRedis()
  if (!client) return
  try {
    if (client.status !== 'ready') {
      await client.connect()
    }
  } catch (err) {
    logger.warn({ err }, 'parse job Redis list consumer not started')
    return
  }
  logger.info('parse job Redis list consumer started')
  while (!stopping) {
    try {
      const result = await client.brpop(REDIS_LIST_KEY, 2)
      if (result) {
        await drainOnce()
      }
    } catch (err) {
      if (stopping) break
      logger.warn({ err }, 'parse job Redis BRPOP error')
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
}

/**
 * Start DB poller (+ BullMQ or list consumer). Safe to call once at boot.
 */
export function startParseJobWorker(): void {
  if (workerStarted) return
  workerStarted = true
  stopping = false

  const interval = parseJobPollIntervalMs()
  const concurrency = parseJobConcurrency()
  const bullmq = shouldUseBullmq()

  logger.info(
    {
      pollMs: interval,
      staleMs: parseJobStaleMs(),
      concurrency,
      bullmq,
      redis: Boolean(getRedis()),
    },
    'parse job worker started'
  )

  if (bullmq) {
    bullmqWorker = startParseBullmqWorker(processParseDocumentJob, concurrency)
  } else {
    void redisListConsumerLoop()
  }

  // DB poller always runs as safety net (stale reclaim + missed enqueues).
  void drainOnce()
  pollTimer = setInterval(() => {
    void drainOnce()
  }, interval)
  if (typeof pollTimer.unref === 'function') pollTimer.unref()
}

export async function stopParseJobWorkerForTests(): Promise<void> {
  stopping = true
  workerStarted = false
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (bullmqWorker) {
    await bullmqWorker.close().catch(() => undefined)
    bullmqWorker = null
  }
}
