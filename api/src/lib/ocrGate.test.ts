import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('tesseract.js', () => ({
  default: {
    recognize: vi.fn(async () => ({
      data: { text: 'hello', words: [], blocks: [], paragraphs: [], lines: [] },
    })),
  },
}))

describe('ocrGate', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.OCR_CONCURRENCY
    delete process.env.OCR_TIMEOUT_MS
    delete process.env.OCR_QUEUE_WAIT_MS
  })

  it('runs recognize under the gate', async () => {
    process.env.OCR_CONCURRENCY = '1'
    process.env.OCR_TIMEOUT_MS = '5000'
    process.env.OCR_QUEUE_WAIT_MS = '1000'
    const { recognizeWithOcrGate, isOcrGateError } = await import('./ocrGate.js')
    const Tesseract = (await import('tesseract.js')).default
    const result = await recognizeWithOcrGate(Buffer.from('x'), 'eng')
    expect(result.data.text).toBe('hello')
    expect(Tesseract.recognize).toHaveBeenCalledOnce()
    expect(isOcrGateError(new Error('nope'))).toBe(false)
  })

  it('rejects with OCR_BUSY when the queue wait expires', async () => {
    process.env.OCR_CONCURRENCY = '1'
    process.env.OCR_QUEUE_WAIT_MS = '80'
    process.env.OCR_TIMEOUT_MS = '60000'
    const Tesseract = (await import('tesseract.js')).default as unknown as {
      recognize: ReturnType<typeof vi.fn>
    }
    let releaseHold: (() => void) | undefined
    Tesseract.recognize.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseHold = () =>
            resolve({
              data: { text: 'done', words: [], blocks: [], paragraphs: [], lines: [] },
            })
        })
    )
    const { recognizeWithOcrGate } = await import('./ocrGate.js')
    const first = recognizeWithOcrGate(Buffer.from('a'), 'eng')
    await new Promise((r) => setTimeout(r, 15))
    await expect(recognizeWithOcrGate(Buffer.from('b'), 'eng')).rejects.toMatchObject({
      code: 'OCR_BUSY',
      statusCode: 503,
    })
    releaseHold?.()
    await first
  }, 10_000)
})
