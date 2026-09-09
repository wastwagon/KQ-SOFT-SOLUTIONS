/**
 * Import locale for statement dates and amounts.
 * Defaults match Ghana practice so existing specimens stay unchanged.
 */
export type DateFormatOrder = 'dmy' | 'mdy'
export type DecimalStyle = 'us' | 'eu'

export type ImportLocale = {
  dateOrder: DateFormatOrder
  decimalStyle: DecimalStyle
}

export const DEFAULT_IMPORT_LOCALE: ImportLocale = {
  dateOrder: 'dmy',
  decimalStyle: 'us',
}

export function parseImportLocale(raw: unknown): ImportLocale {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_IMPORT_LOCALE }
  const o = raw as Record<string, unknown>
  return {
    dateOrder: o.dateOrder === 'mdy' ? 'mdy' : 'dmy',
    decimalStyle: o.decimalStyle === 'eu' ? 'eu' : 'us',
  }
}
