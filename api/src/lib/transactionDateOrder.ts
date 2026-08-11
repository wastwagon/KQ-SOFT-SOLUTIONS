/**
 * Display / import order for transaction lists: newest date first (descending).
 * Example: 30 Dec 2026 at top … 1 Jan 2026 at bottom. Null dates sink to the end.
 */
import { parseImportedDate } from '../services/dateParser.js'

export function compareDatesDescending(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined
): number {
  const ta = a ? new Date(a).getTime() : NaN
  const tb = b ? new Date(b).getTime() : NaN
  const aOk = Number.isFinite(ta)
  const bOk = Number.isFinite(tb)
  if (aOk && bOk) return tb - ta
  if (aOk) return -1
  if (bOk) return 1
  return 0
}

/** Prisma / API orderBy for transaction lanes and document lists. */
export const TRANSACTION_DATE_ORDER_BY = [{ date: 'desc' as const }, { rowIndex: 'desc' as const }]

const DATE_HEADER_RE =
  /^(transaction[_\s-]?date|value[_\s-]?date|booking[_\s-]?date|post(?:ing)?[_\s-]?date|operation[_\s-]?date|doc\.?\s*date|date)$/i

export function findDateColumnIndex(headers: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    if (DATE_HEADER_RE.test(String(headers[i] ?? '').trim())) return i
  }
  // Soft fallback: first header containing "date"
  for (let i = 0; i < headers.length; i++) {
    if (/date/i.test(String(headers[i] ?? ''))) return i
  }
  return -1
}

/**
 * Sort parsed table rows newest-first by the date column (for cleanup export/preview).
 * Stable for equal dates; rows with unparseable dates go last.
 */
export function sortParsedRowsNewestFirst<T extends unknown[]>(
  headers: string[],
  rows: T[]
): T[] {
  const dateCol = findDateColumnIndex(headers)
  if (dateCol < 0 || rows.length < 2) return rows

  return rows
    .map((row, index) => ({ row, index, date: parseImportedDate(row[dateCol]) }))
    .sort((a, b) => {
      const byDate = compareDatesDescending(a.date, b.date)
      if (byDate !== 0) return byDate
      return a.index - b.index
    })
    .map((x) => x.row)
}

export function withParsedRowsNewestFirst<T extends { headers: string[]; rows: unknown[][] }>(
  parsed: T
): T {
  return {
    ...parsed,
    rows: sortParsedRowsNewestFirst(parsed.headers, parsed.rows),
  }
}
