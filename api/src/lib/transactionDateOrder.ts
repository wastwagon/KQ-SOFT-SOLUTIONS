/**
 * Display / import order for transaction lists.
 * Default: oldest date first (Jan → Dec) — Ghana cash book / BRS practice.
 * Optional: newest date first for inbox-style scanning (UI toggle).
 * Null / unparseable dates sink to the end in both modes.
 */
import { parseImportedDate } from '../services/dateParser.js'

export type TransactionDateOrder = 'oldest_first' | 'newest_first'

export function compareDatesAscending(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined
): number {
  const ta = a ? new Date(a).getTime() : NaN
  const tb = b ? new Date(b).getTime() : NaN
  const aOk = Number.isFinite(ta)
  const bOk = Number.isFinite(tb)
  if (aOk && bOk) return ta - tb
  if (aOk) return -1
  if (bOk) return 1
  return 0
}

/** Newest first — used when UI requests inbox-style order. */
export function compareDatesNewestFirst(
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

/** Alias kept for older call sites; same as newest-first. */
export const compareDatesDescending = compareDatesNewestFirst

/** Prisma / API orderBy for persisted lanes (book order). */
export const TRANSACTION_DATE_ORDER_BY = [{ date: 'asc' as const }, { rowIndex: 'asc' as const }]

const DATE_HEADER_RE =
  /^(transaction[_\s-]?date|value[_\s-]?date|booking[_\s-]?date|post(?:ing)?[_\s-]?date|operation[_\s-]?date|doc\.?\s*date|date)$/i

export function findDateColumnIndex(headers: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    if (DATE_HEADER_RE.test(String(headers[i] ?? '').trim())) return i
  }
  for (let i = 0; i < headers.length; i++) {
    if (/date/i.test(String(headers[i] ?? ''))) return i
  }
  return -1
}

/**
 * Sort parsed table rows by date column.
 * Default oldest-first; pass `newest_first` for inbox-style exports.
 * Stable for equal dates; unparseable dates go last.
 */
export function sortParsedRowsByDate<T extends unknown[]>(
  headers: string[],
  rows: T[],
  order: TransactionDateOrder = 'oldest_first'
): T[] {
  const dateCol = findDateColumnIndex(headers)
  if (dateCol < 0 || rows.length < 2) return rows
  const cmp = order === 'newest_first' ? compareDatesNewestFirst : compareDatesAscending

  return rows
    .map((row, index) => ({ row, index, date: parseImportedDate(row[dateCol]) }))
    .sort((a, b) => {
      const byDate = cmp(a.date, b.date)
      if (byDate !== 0) return byDate
      return a.index - b.index
    })
    .map((x) => x.row)
}

export function sortParsedRowsOldestFirst<T extends unknown[]>(headers: string[], rows: T[]): T[] {
  return sortParsedRowsByDate(headers, rows, 'oldest_first')
}

/** Optional inbox-style sort. */
export function sortParsedRowsNewestFirst<T extends unknown[]>(headers: string[], rows: T[]): T[] {
  return sortParsedRowsByDate(headers, rows, 'newest_first')
}

export function withParsedRowsByDateOrder<T extends { headers: string[]; rows: unknown[][] }>(
  parsed: T,
  order: TransactionDateOrder = 'oldest_first'
): T {
  return {
    ...parsed,
    rows: sortParsedRowsByDate(parsed.headers, parsed.rows, order),
  }
}

/** Default book order for cleanup / import. */
export function withParsedRowsOldestFirst<T extends { headers: string[]; rows: unknown[][] }>(
  parsed: T
): T {
  return withParsedRowsByDateOrder(parsed, 'oldest_first')
}
