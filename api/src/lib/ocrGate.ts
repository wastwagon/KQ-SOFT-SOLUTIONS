/**
 * Process-wide OCR gate: concurrency cap + per-call timeout around Tesseract.
 *
 * Env:
 *   OCR_CONCURRENCY     max parallel recognize calls (default 1)
 *   OCR_TIMEOUT_MS      per-page/image timeout (default 180000 = 3 min)
 *   OCR_QUEUE_WAIT_MS   max wait for a semaphore slot (default 120000)
 */
import Tesseract from 'tesseract.js'
import { createSemaphore } from './asyncSemaphore.js'
import { incOpsMetric } from './opsMetrics.js'

export class OcrGateError extends Error {
  readonly code: 'OCR_BUSY' | 'OCR_TIMEOUT'
  readonly statusCode: number

  constructor(code: 'OCR_BUSY' | 'OCR_TIMEOUT', message: string) {
    super(message)
    this.name = 'OcrGateError'
    this.code = code
    this.statusCode = code === 'OCR_BUSY' ? 503 : 504
    incOpsMetric(code === 'OCR_BUSY' ? 'ocr.busy' : 'ocr.timeout', {
      detail: { message },
    })
  }
}

export function isOcrGateError(err: unknown): err is OcrGateError {
  return err instanceof OcrGateError
}

function readPositiveInt(env: string | undefined, fallback: number, min: number): number {
  const n = parseInt(env || '', 10)
  if (!Number.isFinite(n) || n < min) return fallback
  return n
}

export function ocrConcurrency(): number {
  return readPositiveInt(process.env.OCR_CONCURRENCY, 1, 1)
}

export function ocrTimeoutMs(): number {
  return readPositiveInt(process.env.OCR_TIMEOUT_MS, 180_000, 1_000)
}

export function ocrQueueWaitMs(): number {
  return readPositiveInt(process.env.OCR_QUEUE_WAIT_MS, 120_000, 50)
}

const gate = createSemaphore(ocrConcurrency())

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new OcrGateError('OCR_TIMEOUT', message))
    }, ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

/** Run Tesseract.recognize under the process OCR semaphore + timeout. */
export async function recognizeWithOcrGate(
  image: Parameters<typeof Tesseract.recognize>[0],
  lang: string
): Promise<Tesseract.RecognizeResult> {
  await gate.acquire(
    ocrQueueWaitMs(),
    () =>
      new OcrGateError(
        'OCR_BUSY',
        'OCR is busy processing other documents. Please try again in a minute.'
      )
  )
  try {
    return await withTimeout(
      Tesseract.recognize(image, lang, { logger: () => {} }),
      ocrTimeoutMs(),
      `OCR timed out after ${Math.round(ocrTimeoutMs() / 1000)}s. Try a smaller PDF or lower PDF_OCR_SCALE.`
    )
  } finally {
    gate.release()
  }
}

/** Test helper — exposes live semaphore stats. */
export function ocrGateStats() {
  return gate.stats()
}
