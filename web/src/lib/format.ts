/**
 * Display formatting for dates and amounts (DD MMM YYYY style; locale-aware where used).
 * Use across all pages and reports for consistency (DD/MM/YYYY, en-GB numbers).
 */

/** Format date for display — DD MMM YYYY (e.g. 31 Dec 2024) */
export function formatDate(
  date: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
): string {
  if (date == null) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '—'
  const hasTime =
    options.hour !== undefined ||
    options.minute !== undefined ||
    options.second !== undefined
  return hasTime
    ? d.toLocaleString('en-GB', options)
    : d.toLocaleDateString('en-GB', options)
}

/** Compact date for tables — DD MMM YY (e.g. 02 Jan 25) to reduce wrapping */
export function formatDateCompact(date: string | Date | null | undefined): string {
  if (date == null) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

function ordinalSuffixEn(day: number): string {
  if (day >= 11 && day <= 13) return 'TH'
  const m = day % 10
  if (m === 1) return 'ST'
  if (m === 2) return 'ND'
  if (m === 3) return 'RD'
  return 'TH'
}

/**
 * Formal Ghana-style BRS date for titles — e.g. `11TH DECEMBER, 2026`
 * (ordinal day, full month in caps, comma before year).
 */
export function formatBrsFormalDate(date: string | Date | null | undefined): string {
  if (date == null) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '—'
  const day = d.getDate()
  const month = d.toLocaleString('en-GB', { month: 'long' }).toUpperCase()
  const year = d.getFullYear()
  return `${day}${ordinalSuffixEn(day)} ${month}, ${year}`
}

/** Second line of formal BRS letterhead — e.g. `AS AT 11TH DECEMBER, 2026` */
export function formatBrsAsAtLine(date: string | Date | null | undefined): string {
  const inner = formatBrsFormalDate(date)
  if (inner === '—') return '—'
  return `AS AT ${inner}`
}

/** Hyphenated caps date — e.g. 31-DECEMBER-2024 (compact; not the formal letterhead line). */
export function formatDateBRSTitle(date: string | Date | null | undefined): string {
  if (date == null) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '—'
  const day = d.getDate()
  const month = d.toLocaleString('en-GB', { month: 'long' }).toUpperCase()
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
}

/** Print / PDF footer timestamp in Africa/Accra (matches server `formatGeneratedAt`). */
export function formatPrintDateAccra(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Africa/Accra',
  })
}

/** Format date for export/API — YYYY-MM-DD */
export function formatDateISO(date: string | Date | null | undefined): string {
  if (date == null) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

/** Re-export formatAmount and report-safe formatter from currency */
export { formatAmount, formatAmountNumber, getCurrencySymbol, formatAmountForReport } from './currency'
