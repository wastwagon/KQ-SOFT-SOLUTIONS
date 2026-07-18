/**
 * Geometry-aware reconstruction of bank/cashbook tables from OCR words + bboxes.
 * Preserves empty debit/credit cells that whitespace line-splitting often collapses.
 */
import { parseImportedAmount } from './amountParser.js'
import { parseImportedDate } from './dateParser.js'

export type OcrWord = {
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
  confidence?: number
  page?: number
}

export type GeometryTableResult = {
  headers: string[]
  rows: unknown[][]
  /** How columns were inferred. */
  columnMode: 'header_bands' | 'gap_clusters' | 'empty'
  notes: string[]
}

type VisualRow = {
  yMid: number
  height: number
  page: number
  words: OcrWord[]
}

const HEADER_RE =
  /\b(date|txn|trans(?:action)?|posting|value|description|details|narrative|particulars|narration|amount|debit|credit|balance|ref(?:erence)?|cheque|chq|withdrawal|deposit|payment)\b/i

const DATE_CELL_RE = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/

function present(w: OcrWord): boolean {
  return Boolean(w.text && String(w.text).trim())
}

function wordMidX(w: OcrWord): number {
  return (w.x0 + w.x1) / 2
}

function wordMidY(w: OcrWord): number {
  return (w.y0 + w.y1) / 2
}

function wordHeight(w: OcrWord): number {
  return Math.max(1, w.y1 - w.y0)
}

function isAmountLike(text: string): boolean {
  const t = text.trim()
  if (!/\d/.test(t)) return false
  if (/^\d{1,2}[\/\-]\d{1,2}/.test(t)) return false
  const n = parseImportedAmount(t)
  return n !== 0 || /^(?:[-+(]?[\d,]+(?:\.\d+)?-?\)?)$/.test(t)
}

function isDateLike(text: string): boolean {
  const t = text.trim()
  if (DATE_CELL_RE.test(t)) return parseImportedDate(t) != null
  if (/^\d{1,2}-[A-Za-z]{3}-\d{2,4}$/i.test(t)) return parseImportedDate(t) != null
  return false
}

/** Flatten Tesseract page data into our word list (page-local coords). */
export function extractWordsFromTesseractPage(data: unknown, pageIndex = 0): OcrWord[] {
  const page = data as {
    words?: Array<{ text?: string; confidence?: number; bbox?: { x0: number; y0: number; x1: number; y1: number } }>
    blocks?: Array<{
      paragraphs?: Array<{
        lines?: Array<{
          words?: Array<{ text?: string; confidence?: number; bbox?: { x0: number; y0: number; x1: number; y1: number } }>
        }>
      }>
    }>
  }
  const out: OcrWord[] = []
  const push = (w: { text?: string; confidence?: number; bbox?: { x0: number; y0: number; x1: number; y1: number } }) => {
    const text = String(w.text ?? '').trim()
    if (!text || !w.bbox) return
    if (typeof w.confidence === 'number' && w.confidence < 25) return
    out.push({
      text,
      x0: w.bbox.x0,
      y0: w.bbox.y0,
      x1: w.bbox.x1,
      y1: w.bbox.y1,
      confidence: w.confidence,
      page: pageIndex,
    })
  }
  if (Array.isArray(page.words) && page.words.length) {
    for (const w of page.words) push(w)
    return out
  }
  for (const block of page.blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        for (const w of line.words || []) push(w)
      }
    }
  }
  return out
}

function clusterRows(words: OcrWord[]): VisualRow[] {
  if (!words.length) return []
  const sorted = [...words].filter(present).sort((a, b) => {
    const pageA = a.page ?? 0
    const pageB = b.page ?? 0
    if (pageA !== pageB) return pageA - pageB
    const dy = wordMidY(a) - wordMidY(b)
    if (Math.abs(dy) > 0.5) return dy
    return a.x0 - b.x0
  })

  const heights = sorted.map(wordHeight).sort((a, b) => a - b)
  const medianH = heights[Math.floor(heights.length / 2)] || 12
  const yTol = Math.max(8, medianH * 0.65)

  const rows: VisualRow[] = []
  for (const w of sorted) {
    const page = w.page ?? 0
    const yMid = wordMidY(w)
    const last = rows[rows.length - 1]
    if (last && last.page === page && Math.abs(last.yMid - yMid) <= yTol) {
      last.words.push(w)
      last.yMid = (last.yMid * (last.words.length - 1) + yMid) / last.words.length
      last.height = Math.max(last.height, wordHeight(w))
    } else {
      rows.push({ yMid, height: wordHeight(w), page, words: [w] })
    }
  }
  for (const r of rows) r.words.sort((a, b) => a.x0 - b.x0)
  return rows
}

function rowText(row: VisualRow): string {
  return row.words.map((w) => w.text).join(' ')
}

function isHeaderRow(row: VisualRow): boolean {
  const joined = rowText(row)
  if (!HEADER_RE.test(joined)) return false
  if (isDateLike(row.words[0]?.text || '')) return false
  const hits = row.words.filter((w) => HEADER_RE.test(w.text)).length
  return hits >= 2 || (hits >= 1 && row.words.length >= 3 && !row.words.some((w) => isAmountLike(w.text)))
}

function isRepeatedHeader(row: VisualRow, headers: string[]): boolean {
  if (!isHeaderRow(row)) return false
  const a = row.words.map((w) => w.text.toLowerCase()).join(' ')
  const b = headers.map((h) => h.toLowerCase()).join(' ')
  const tokensA = new Set(a.split(/\s+/).filter((t) => t.length > 2))
  const tokensB = new Set(b.split(/\s+/).filter((t) => t.length > 2))
  let inter = 0
  for (const t of tokensA) if (tokensB.has(t)) inter++
  const union = tokensA.size + tokensB.size - inter
  return union > 0 && inter / union >= 0.55
}

/** Build left edges for column bands from header word positions. */
function columnBandsFromHeader(header: VisualRow): number[] {
  const words = header.words
  if (words.length < 2) return words.map((w) => w.x0)
  const mids = words.map(wordMidX)
  const edges = [Math.min(...words.map((w) => w.x0)) - 1]
  for (let i = 0; i < mids.length - 1; i++) {
    edges.push((mids[i]! + mids[i + 1]!) / 2)
  }
  return edges
}

/**
 * Infer column left edges from horizontal gaps across many rows
 * (when header bands are weak).
 */
function columnBandsFromGaps(rows: VisualRow[], targetCols?: number): number[] {
  const gaps: number[] = []
  const starts: number[] = []
  for (const row of rows.slice(0, 60)) {
    if (row.words.length < 2) continue
    starts.push(row.words[0]!.x0)
    for (let i = 1; i < row.words.length; i++) {
      gaps.push(row.words[i]!.x0 - row.words[i - 1]!.x1)
    }
  }
  if (!gaps.length) return []
  const sortedGaps = [...gaps].sort((a, b) => a - b)
  const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)] || 8
  const gapThreshold = Math.max(18, medianGap * 2.2)

  // Collect candidate split x positions (midpoint of large gaps).
  const splitXs: number[] = []
  for (const row of rows.slice(0, 80)) {
    for (let i = 1; i < row.words.length; i++) {
      const gap = row.words[i]!.x0 - row.words[i - 1]!.x1
      if (gap >= gapThreshold) {
        splitXs.push((row.words[i - 1]!.x1 + row.words[i]!.x0) / 2)
      }
    }
  }
  if (!splitXs.length) return []

  // Cluster nearby split positions.
  splitXs.sort((a, b) => a - b)
  const clusters: number[][] = []
  for (const x of splitXs) {
    const last = clusters[clusters.length - 1]
    if (last && Math.abs(last[last.length - 1]! - x) < gapThreshold * 0.6) {
      last.push(x)
    } else {
      clusters.push([x])
    }
  }
  let edges = clusters.map((c) => c.reduce((s, v) => s + v, 0) / c.length)
  edges.sort((a, b) => a - b)

  const left = Math.min(...starts)
  const bands = [left - 1, ...edges]
  if (targetCols && bands.length > targetCols) {
    // Keep the strongest (most frequent) targetCols-1 splits — already clustered; trim extremes.
    while (bands.length > targetCols) {
      // Drop the narrowest adjacent band.
      let minW = Infinity
      let dropAt = 1
      for (let i = 1; i < bands.length - 1; i++) {
        const w = bands[i + 1]! - bands[i - 1]!
        if (w < minW) {
          minW = w
          dropAt = i
        }
      }
      bands.splice(dropAt, 1)
    }
  }
  return bands
}

function assignWordsToBands(row: VisualRow, bandLefts: number[]): string[] {
  const cols = Math.max(1, bandLefts.length)
  const buckets: string[][] = Array.from({ length: cols }, () => [])
  for (const w of row.words) {
    const mx = wordMidX(w)
    let idx = 0
    for (let i = bandLefts.length - 1; i >= 0; i--) {
      if (mx >= bandLefts[i]!) {
        idx = i
        break
      }
    }
    buckets[idx]!.push(w.text)
  }
  return buckets.map((parts) => parts.join(' ').trim())
}

/** Gap-split a single row when bands are unavailable. */
function splitRowByGaps(row: VisualRow): string[] {
  if (row.words.length === 0) return []
  if (row.words.length === 1) return [row.words[0]!.text]

  const gaps = []
  for (let i = 1; i < row.words.length; i++) {
    gaps.push(row.words[i]!.x0 - row.words[i - 1]!.x1)
  }
  const sorted = [...gaps].sort((a, b) => a - b)
  const medianGap = sorted[Math.floor(sorted.length / 2)] || 8
  const threshold = Math.max(16, medianGap * 2.0)

  const cells: string[] = []
  let cur = row.words[0]!.text
  for (let i = 1; i < row.words.length; i++) {
    const gap = gaps[i - 1]!
    if (gap >= threshold) {
      cells.push(cur.trim())
      cur = row.words[i]!.text
    } else {
      cur = `${cur} ${row.words[i]!.text}`
    }
  }
  cells.push(cur.trim())
  return cells
}

function looksLikeContinuation(cells: string[], colCount: number): boolean {
  if (!cells.length) return false
  const padded = [...cells]
  while (padded.length < colCount) padded.push('')
  const first = padded[0] || ''
  if (isDateLike(first)) return false
  const amountHits = padded.filter((c) => isAmountLike(c)).length
  const narrativeBits = padded.slice(1).filter((c) => c.trim().length > 1)
  // Continuation lines are mostly narrative, few/no amounts, no leading date.
  return amountHits <= 1 && (first.length > 0 || narrativeBits.length > 0) && amountHits + narrativeBits.length > 0
}

function mergeContinuation(prev: string[], cont: string[], descCol: number): string[] {
  const out = [...prev]
  while (out.length <= descCol) out.push('')
  const extra = cont.filter(Boolean).join(' ').trim()
  if (extra) out[descCol] = `${out[descCol] || ''} ${extra}`.trim()
  return out
}

function guessDescriptionCol(headers: string[]): number {
  const idx = headers.findIndex((h) =>
    /description|details|narrative|particulars|narration|remarks/i.test(h)
  )
  return idx >= 0 ? idx : Math.min(1, Math.max(0, headers.length - 1))
}

function normalizeHeaderLabels(cells: string[]): string[] {
  return cells.map((c, i) => {
    const t = c.trim()
    return t || `Col_${i}`
  })
}

/**
 * Reconstruct a table from OCR words with bounding boxes.
 * Pure function — unit-testable without Tesseract.
 */
export function reconstructTableFromWords(words: OcrWord[]): GeometryTableResult {
  const notes: string[] = []
  if (!words.length) {
    return { headers: [], rows: [], columnMode: 'empty', notes: ['no words'] }
  }

  const visualRows = clusterRows(words)
  if (!visualRows.length) {
    return { headers: [], rows: [], columnMode: 'empty', notes: ['no rows'] }
  }

  let headerIdx = -1
  for (let i = 0; i < Math.min(40, visualRows.length); i++) {
    if (isHeaderRow(visualRows[i]!)) {
      headerIdx = i
      break
    }
  }

  let bandLefts: number[] = []
  let columnMode: GeometryTableResult['columnMode'] = 'gap_clusters'
  let headers: string[] = []

  if (headerIdx >= 0) {
    const headerRow = visualRows[headerIdx]!
    headers = normalizeHeaderLabels(headerRow.words.map((w) => w.text))
    // Merge adjacent header tokens that are clearly one label split by OCR
    // (e.g. "Trans" "Date") when gap is tiny — already joined by row clustering spaces;
    // band edges come from individual words which is OK for Date / Debit / Credit.
    bandLefts = columnBandsFromHeader(headerRow)
    columnMode = 'header_bands'
    notes.push(`header at visual row ${headerIdx}`)
  } else {
    notes.push('no header row detected')
  }

  const dataStart = headerIdx >= 0 ? headerIdx + 1 : 0
  const candidateRows = visualRows.slice(dataStart)

  if (bandLefts.length < 2) {
    const gapBands = columnBandsFromGaps(candidateRows, headers.length || undefined)
    if (gapBands.length >= 2) {
      bandLefts = gapBands
      columnMode = 'gap_clusters'
      notes.push(`gap-inferred ${bandLefts.length} column bands`)
      if (!headers.length) {
        headers = Array.from({ length: bandLefts.length }, (_, i) => `Col_${i}`)
      }
    }
  }

  const colCount = Math.max(headers.length, bandLefts.length, 1)
  if (!headers.length) {
    headers = Array.from({ length: colCount }, (_, i) => `Col_${i}`)
  }
  while (headers.length < colCount) headers.push(`Col_${headers.length}`)
  if (headers.length > colCount && bandLefts.length) {
    headers = headers.slice(0, colCount)
  }

  const descCol = guessDescriptionCol(headers)
  const rows: string[][] = []

  for (const vrow of candidateRows) {
    if (isRepeatedHeader(vrow, headers)) continue

    let cells: string[]
    if (bandLefts.length >= 2) {
      cells = assignWordsToBands(vrow, bandLefts)
    } else {
      cells = splitRowByGaps(vrow)
    }

    // Pad / trim to header width
    while (cells.length < headers.length) cells.push('')
    if (cells.length > headers.length) {
      // Fold overflow into description
      const overflow = cells.slice(headers.length - 1).join(' ').trim()
      cells = [...cells.slice(0, headers.length - 1), overflow]
    }

    if (!cells.some((c) => c.trim())) continue

    if (rows.length && looksLikeContinuation(cells, headers.length)) {
      rows[rows.length - 1] = mergeContinuation(rows[rows.length - 1]!, cells, descCol)
      continue
    }

    rows.push(cells)
  }

  // Drop obvious non-transaction lead-in rows before first date (metadata under header)
  let firstDate = rows.findIndex((r) => r.some((c) => isDateLike(c)))
  if (firstDate > 0 && firstDate <= 5) {
    const before = rows.slice(0, firstDate)
    const mostlyMeta = before.every(
      (r) => !r.some((c) => isAmountLike(c)) || /opening|balance|brought|page|statement/i.test(r.join(' '))
    )
    if (mostlyMeta) {
      rows.splice(0, firstDate)
      notes.push(`dropped ${firstDate} metadata rows`)
    }
  }

  return { headers, rows, columnMode, notes }
}

/** Prefer geometry table when it preserves more consistent columns / amounts. */
export function shouldPreferGeometryTable(
  textTable: { headers: string[]; rows: unknown[][] },
  geometry: GeometryTableResult
): boolean {
  if (!geometry.rows.length) return false
  if (!textTable.rows.length) return true

  const geoCols = geometry.headers.length
  const textCols = textTable.headers.length

  const emptyCellRate = (rows: unknown[][], cols: number): number => {
    if (!rows.length || cols < 2) return 0
    const sample = rows.slice(0, 40)
    let empty = 0
    let total = 0
    for (const r of sample) {
      const arr = (r || []) as unknown[]
      for (let i = 0; i < cols; i++) {
        total++
        if (arr[i] == null || String(arr[i]).trim() === '') empty++
      }
    }
    return total ? empty / total : 0
  }

  const geoEmpty = emptyCellRate(geometry.rows, geoCols)
  const textEmpty = emptyCellRate(textTable.rows, textCols)

  // Geometry wins when it keeps sparse amount columns (empty cells) that text collapsed.
  if (geoCols >= 4 && textCols <= geoCols - 1 && geoEmpty > textEmpty + 0.08) return true
  if (geoCols > textCols && geometry.rows.length >= Math.floor(textTable.rows.length * 0.7)) return true

  // Or when row counts are similar but geometry has clearer date+amount structure
  const dateRate = (rows: unknown[][]): number => {
    const sample = rows.slice(0, 40)
    if (!sample.length) return 0
    let hits = 0
    for (const r of sample) {
      if ((r || []).some((c) => isDateLike(String(c ?? '')))) hits++
    }
    return hits / sample.length
  }
  if (
    geometry.rows.length >= textTable.rows.length * 0.85 &&
    dateRate(geometry.rows) > dateRate(textTable.rows) + 0.1
  ) {
    return true
  }
  return false
}
