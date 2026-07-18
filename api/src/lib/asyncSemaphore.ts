/**
 * Simple async semaphore with optional wait timeout.
 * Used to cap concurrent Tesseract OCR work on a single API process.
 */
export type SemaphoreWaiter = {
  resolve: () => void
  reject: (err: Error) => void
  timer?: ReturnType<typeof setTimeout>
}

export function createSemaphore(maxConcurrent: number) {
  const max = Math.max(1, Math.floor(maxConcurrent))
  let active = 0
  const queue: SemaphoreWaiter[] = []

  async function acquire(waitMs: number, busyError: () => Error): Promise<void> {
    if (active < max) {
      active++
      return
    }
    await new Promise<void>((resolve, reject) => {
      const entry: SemaphoreWaiter = {
        resolve: () => {
          if (entry.timer) clearTimeout(entry.timer)
          resolve()
        },
        reject,
      }
      if (waitMs > 0 && Number.isFinite(waitMs)) {
        entry.timer = setTimeout(() => {
          const idx = queue.indexOf(entry)
          if (idx >= 0) queue.splice(idx, 1)
          reject(busyError())
        }, waitMs)
      }
      queue.push(entry)
    })
    // Slot transferred from release() — already counted in `active`.
  }

  function release(): void {
    const next = queue.shift()
    if (next) {
      next.resolve()
      return
    }
    active = Math.max(0, active - 1)
  }

  function stats() {
    return { active, waiting: queue.length, max }
  }

  return { acquire, release, stats }
}
