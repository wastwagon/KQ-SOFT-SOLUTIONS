import { describe, expect, it } from 'vitest'
import { isParseJobInFlight } from './documentParseJob.js'

describe('documentParseJob', () => {
  it('detects in-flight parse statuses', () => {
    expect(isParseJobInFlight('pending')).toBe(true)
    expect(isParseJobInFlight('processing')).toBe(true)
    expect(isParseJobInFlight('ready')).toBe(false)
    expect(isParseJobInFlight('failed')).toBe(false)
    expect(isParseJobInFlight(null)).toBe(false)
  })
})
