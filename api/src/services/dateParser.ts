/**
 * Parse dates from imports: ISO, DD/MM/YYYY (default), MM/DD/YYYY, DD-Mon-YYYY, Excel serial.
 * Ambiguous numeric dates (both parts ≤ 12) follow locale.dateOrder; default is Ghana DMY.
 */
import type { ImportLocale } from './importLocale.js'
import { DEFAULT_IMPORT_LOCALE } from './importLocale.js'

export function parseImportedDate(v: unknown, locale: ImportLocale = DEFAULT_IMPORT_LOCALE): Date | null {
  if (!v) return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  const s = String(v).trim()
  if (!s) return null

  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (dmy) {
    const a = parseInt(dmy[1]!, 10)
    const b = parseInt(dmy[2]!, 10)
    const year = parseInt(dmy[3]!, 10)
    let day: number
    let month: number
    if (a > 12 && b <= 12) {
      day = a
      month = b
    } else if (b > 12 && a <= 12) {
      month = a
      day = b
    } else if (locale.dateOrder === 'mdy') {
      month = a
      day = b
    } else {
      day = a
      month = b
    }
    const d = new Date(
      year,
      month - 1,
      day,
      parseInt(dmy[4] || '0', 10),
      parseInt(dmy[5] || '0', 10),
      parseInt(dmy[6] || '0', 10)
    )
    return isNaN(d.getTime()) ? null : d
  }

  const dMonY = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/i)
  if (dMonY) {
    const d = new Date(`${dMonY[2]} ${dMonY[1]}, ${dMonY[3]}`)
    return isNaN(d.getTime()) ? null : d
  }

  const serial = parseFloat(s.replace(/,/g, ''))
  if (/^\d{4,6}(\.\d+)?$/.test(s.replace(/,/g, '')) && serial >= 20000 && serial <= 80000) {
    const epoch = new Date(1899, 11, 30)
    const ms = epoch.getTime() + Math.round(serial) * 86400000
    const d = new Date(ms)
    return isNaN(d.getTime()) ? null : d
  }

  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}
