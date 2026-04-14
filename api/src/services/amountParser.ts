export function parseImportedAmount(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  const raw = String(v).trim()
  if (!raw) return 0
  const bracketNegative = /^\(.*\)$/.test(raw)
  let cleaned = raw
    .replace(/[,\s]/g, '')
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
