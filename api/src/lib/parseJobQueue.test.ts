import { describe, expect, it } from 'vitest'
import {
  parseJobConcurrency,
  parseJobInApi,
  parseJobPollIntervalMs,
  parseJobStaleMs,
} from './parseJobQueue.js'
import { shouldUseBullmq } from './parseJobBullmq.js'

describe('parseJobQueue config', () => {
  it('uses sensible defaults', () => {
    expect(parseJobPollIntervalMs()).toBeGreaterThanOrEqual(1000)
    expect(parseJobStaleMs()).toBeGreaterThanOrEqual(60_000)
    expect(parseJobConcurrency()).toBeGreaterThanOrEqual(1)
    expect(parseJobConcurrency()).toBeLessThanOrEqual(4)
    expect(typeof parseJobInApi()).toBe('boolean')
    expect(typeof shouldUseBullmq()).toBe('boolean')
  })
})
