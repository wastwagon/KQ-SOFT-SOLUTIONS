/**
 * Parse dates from imports: ISO, DD/MM/YYYY, DD-Mon-YYYY, Excel serial numbers.
 */
export function parseImportedDate(v: unknown): Date | null {
  if (!v) return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  const s = String(v).trim()
  if (!s) return null

  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (dmy) {
    const [, day, month, year, hh, mm, ss] = dmy
    const d = new Date(
      parseInt(year!, 10),
      parseInt(month!, 10) - 1,
      parseInt(day!, 10),
      parseInt(hh || '0', 10),
      parseInt(mm || '0', 10),
      parseInt(ss || '0', 10)
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
