import { describe, expect, it } from 'vitest'
import { createSemaphore } from './asyncSemaphore.js'

describe('createSemaphore', () => {
  it('allows up to max concurrent holders', async () => {
    const sem = createSemaphore(2)
    await sem.acquire(1000, () => new Error('busy'))
    await sem.acquire(1000, () => new Error('busy'))
    expect(sem.stats().active).toBe(2)
    expect(sem.stats().waiting).toBe(0)

    const third = sem.acquire(30, () => new Error('busy'))
    await expect(third).rejects.toThrow('busy')
    expect(sem.stats().waiting).toBe(0)

    sem.release()
    await sem.acquire(1000, () => new Error('busy'))
    expect(sem.stats().active).toBe(2)
    sem.release()
    sem.release()
    expect(sem.stats().active).toBe(0)
  })

  it('wakes a waiter when a slot is released', async () => {
    const sem = createSemaphore(1)
    await sem.acquire(1000, () => new Error('busy'))
    let released = false
    const waiting = sem.acquire(2000, () => new Error('busy')).then(() => {
      released = true
    })
    expect(sem.stats().waiting).toBe(1)
    sem.release()
    await waiting
    expect(released).toBe(true)
    expect(sem.stats().active).toBe(1)
    sem.release()
  })
})
