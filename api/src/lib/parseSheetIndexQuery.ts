/**
 * Parses `?sheetIndex=` for Excel document preview/map.
 * Non-negative integers only; invalid or missing input → 0.
 */
export function parseSheetIndexQuery(raw: unknown): number {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v === undefined || v === null || v === '') return 0
  const n = parseInt(String(v), 10)
  return !Number.isNaN(n) && n >= 0 ? n : 0
}
