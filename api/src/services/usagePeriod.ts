/** Calendar month key `YYYY-MM` — Ghana is UTC+0 so local month matches billing month. */
export function currentPeriod(at = new Date()): string {
  const year = at.getFullYear()
  const month = String(at.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/** Inclusive start and exclusive end of a `YYYY-MM` usage period. */
export function usagePeriodBounds(period: string): { startsAt: Date; endsAt: Date } {
  const [yearRaw, monthRaw] = period.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  if (!year || !month || month < 1 || month > 12) {
    return usagePeriodBounds(currentPeriod())
  }
  return {
    startsAt: new Date(year, month - 1, 1, 0, 0, 0, 0),
    endsAt: new Date(year, month, 1, 0, 0, 0, 0),
  }
}
