import { logger } from '../middleware/logging.js'

/** When DEFER_AUTO_MAP_ON_UPLOAD=1, parse/map runs after the HTTP response (non-blocking). */
export function shouldDeferAutoMapOnUpload(): boolean {
  return process.env.DEFER_AUTO_MAP_ON_UPLOAD === '1'
}

export function scheduleDeferredAutoMap(documentId: string): void {
  setImmediate(() => {
    void (async () => {
      try {
        const { tryAutoMapDocument } = await import('../services/autoMapDocument.js')
        await tryAutoMapDocument(documentId)
      } catch (err) {
        logger.error({ err, documentId }, 'deferred auto-map failed')
      }
    })()
  })
}

export async function autoMapAfterUpload(documentId: string) {
  if (shouldDeferAutoMapOnUpload()) {
    scheduleDeferredAutoMap(documentId)
    return { deferred: true as const }
  }
  const { tryAutoMapDocument } = await import('../services/autoMapDocument.js')
  return tryAutoMapDocument(documentId)
}
