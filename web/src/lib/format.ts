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

/** Format date for BRS title — e.g. 31-DECEMBER-2024 */
export function formatDateBRSTitle(date: string | Date | null | undefined): string {
  if (date == null) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '—'
  const day = d.getDate()
  const month = d.toLocaleString('en-GB', { month: 'long' }).toUpperCase()
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
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
