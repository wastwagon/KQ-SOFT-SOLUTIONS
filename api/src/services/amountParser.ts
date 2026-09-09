import type { ImportLocale } from './importLocale.js'
import { DEFAULT_IMPORT_LOCALE } from './importLocale.js'

function numericBody(raw: string, decimalStyle: ImportLocale['decimalStyle']): string {
  const trimmed = raw.replace(/\s/g, '')
  if (decimalStyle === 'eu') {
    const lastComma = trimmed.lastIndexOf(',')
    const lastDot = trimmed.lastIndexOf('.')
    if (lastComma > lastDot) {
      return trimmed.replace(/\./g, '').replace(',', '.')
    }
  }
  return trimmed.replace(/,/g, '')
}

export function parseImportedAmount(
  v: unknown,
  locale: ImportLocale = DEFAULT_IMPORT_LOCALE
): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  const raw = String(v).trim()
  if (!raw) return 0
  const bracketNegative = /^\(.*\)$/.test(raw)
  let cleaned = numericBody(raw, locale.decimalStyle)
    .replace(/[^0-9.+\-()]/g, '')
    .replace(/[()]/g, '')

  let sign = bracketNegative ? -1 : 1
  if (cleaned.endsWith('-')) {
    sign *= -1
    cleaned = cleaned.slice(0, -1)
  }
  if (cleaned.startsWith('-')) {
    sign *= -1
    cleaned = cleaned.slice(1)
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1)
  }

  const n = parseFloat(cleaned)
  return Number.isNaN(n) ? 0 : sign * n
}
