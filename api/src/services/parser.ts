import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { parse as parseCsvSync } from 'csv-parse/sync'

export interface ParseResult {
  headers: string[]
  rows: unknown[][]
  sheetNames?: string[]
  activeSheet?: string
}

export function parseExcel(filepath: string, sheetIndex = 0): ParseResult {
  const ext = path.extname(filepath).toLowerCase()
  if (!['.xlsx', '.xls'].includes(ext)) {
    throw new Error('Not an Excel file')
  }
  const buf = fs.readFileSync(filepath)
  const wb = XLSX.read(buf, { type: 'buffer' })
  const sheetNames = wb.SheetNames
  const sheetName = sheetNames[sheetIndex] || sheetNames[0]
  const ws = wb.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: false,
    defval: null,
  }) as unknown[][]
  const nonEmpty = data.filter((row) => row.some((c) => c != null && String(c).trim() !== ''))
  const headerRow = findHeaderRow(nonEmpty)
  const headerRowData = nonEmpty[headerRow] || []
  const headers = headerRowData.map((c, i) =>
    String(c ?? '').trim() || `Col_${i}`
  )
  const rows = nonEmpty.slice(headerRow + 1).filter((r) => r.some((c) => c != null && String(c).trim() !== ''))
  return { headers, rows, sheetNames, activeSheet: sheetName }
}

export function parseCsv(filepath: string): ParseResult {
  const buf = fs.readFileSync(filepath, 'utf-8')
  if (!buf.trim()) return { headers: [], rows: [] }

  const delimiter = sniffCsvDelimiter(buf)
  const data = parseCsvRows(buf, delimiter)
  const headerRow = findHeaderRow(data)
  const headers = (data[headerRow] || []).map((c, i) => String(c).trim() || `Col_${i}`)
  const rows = data.slice(headerRow + 1).filter((r) => r.some((c) => c != null && String(c).trim() !== ''))
  return { headers, rows }
}

function parseCsvRows(text: string, delimiter: ',' | ';' | '\t'): unknown[][] {
  return parseCsvSync(text, {
    delimiter,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as unknown[][]
}

/** Pick delimiter by scoring first non-empty line (handles European ;-separated exports). */
function sniffCsvDelimiter(text: string): ',' | ';' | '\t' {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) || ''
  const comma = (firstLine.match(/,/g) || []).length
  const semi = (firstLine.match(/;/g) || []).length
  const tab = (firstLine.match(/\t/g) || []).length
  if (tab >= Math.max(comma, semi, 1)) return '\t'
  if (semi > comma) return ';'
  return ','
}

function findHeaderRow(data: unknown[][]): number {
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i] || []
    const nonEmpty = row.filter((c) => c != null && String(c).trim() !== '')
    if (nonEmpty.length >= 2) return i
  }
  return 0
}

export function detectFileType(filepath: string): 'excel' | 'csv' | 'pdf' | 'image' {
  const ext = path.extname(filepath).toLowerCase()
  if (['.xlsx', '.xls'].includes(ext)) return 'excel'
  if (ext === '.csv') return 'csv'
  if (ext === '.pdf') return 'pdf'
  if (['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp'].includes(ext)) return 'image'
  throw new Error('Unsupported file type')
}
