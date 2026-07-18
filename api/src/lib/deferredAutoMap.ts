import { logger } from '../middleware/logging.js'
import {
  markDocumentParseFailed,
  markDocumentParsePending,
} from './documentParseJob.js'
import { enqueueParseJob, parseJobInApi } from './parseJobQueue.js'
import { prisma } from './prisma.js'

/**
 * Defer parse/map after upload by default so the HTTP response is not blocked by OCR.
 * Set DEFER_AUTO_MAP_ON_UPLOAD=0 (or false) to wait for auto-map on the upload request.
 */
export function shouldDeferAutoMapOnUpload(): boolean {
  const v = (process.env.DEFER_AUTO_MAP_ON_UPLOAD || '1').trim().toLowerCase()
  return v !== '0' && v !== 'false' && v !== 'off'
}

/**
 * Mark pending and enqueue for the parse job worker (BullMQ / Redis / DB poller).
 * When PARSE_JOB_IN_API=1, also kicks an in-process claim for low latency.
 */
export function scheduleDeferredAutoMap(documentId: string): void {
  void enqueueParseJob(documentId).catch((err) => {
    logger.warn({ err, documentId }, 'enqueue parse job failed')
  })

  if (!parseJobInApi()) {
    // Dedicated worker process will claim via BullMQ / DB poller.
    return
  }

  setImmediate(() => {
    void (async () => {
      try {
        const claimed = await prisma.document.updateMany({
          where: { id: documentId, parseStatus: 'pending' },
          data: {
            parseStatus: 'processing',
            parseStartedAt: new Date(),
            parseFinishedAt: null,
            parseStatusMessage: 'Parsing document…',
          },
        })
        if (claimed.count === 0) return
        const { tryAutoMapDocument } = await import('../services/autoMapDocument.js')
        await tryAutoMapDocument(documentId)
      } catch (err) {
        logger.error({ err, documentId }, 'deferred auto-map failed')
        await markDocumentParseFailed(
          documentId,
          err instanceof Error ? err.message : 'Deferred auto-map failed'
        ).catch(() => undefined)
      }
    })()
  })
}

export async function autoMapAfterUpload(documentId: string) {
  if (shouldDeferAutoMapOnUpload()) {
    await markDocumentParsePending(documentId)
    scheduleDeferredAutoMap(documentId)
    return { deferred: true as const, parseStatus: 'pending' as const }
  }
  const { tryAutoMapDocument } = await import('../services/autoMapDocument.js')
  const outcome = await tryAutoMapDocument(documentId)
  return { ...outcome, deferred: false as const }
}
