import { describe, expect, it } from 'vitest'
import { currentPeriod, usagePeriodBounds } from './usagePeriod.js'

describe('usage calendar period', () => {
  it('keys the meter as YYYY-MM', () => {
    expect(currentPeriod(new Date(2026, 8, 9))).toBe('2026-09')
    expect(currentPeriod(new Date(2026, 9, 1))).toBe('2026-10')
  })

  it('resets bounds at the first of the next calendar month', () => {
    const { startsAt, endsAt } = usagePeriodBounds('2026-09')
    expect(startsAt.getFullYear()).toBe(2026)
    expect(startsAt.getMonth()).toBe(8)
    expect(startsAt.getDate()).toBe(1)
    expect(endsAt.getFullYear()).toBe(2026)
    expect(endsAt.getMonth()).toBe(9)
    expect(endsAt.getDate()).toBe(1)
  })
})
