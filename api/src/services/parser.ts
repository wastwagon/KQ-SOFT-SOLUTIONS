import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { parse as parseCsvSync } from 'csv-parse/sync'
import {
  findCashBookTransactionHeaderRow,
  findErpGlCashBookHeaderRow,
  isErpGlCashBookLayout,
  isTglErpCashBookLayout,
  normalizeErpGlCashBookTable,
  normalizeTglErpCashBookTable,
} from './cashBookExcel.js'
import { findEcobankTransactionHeaderRow, normalizeEcobankExcelTable } from './ecobankStatement.js'
import {
  findBankOfAfricaTransactionHeaderRow,
  normalizeBankOfAfricaExcelTable,
} from './bankOfAfricaStatement.js'
import { findBogTransactionHeaderRow, normalizeBogExcelTable } from './bogStatement.js'
import {
  findStanbicTransactionHeaderRow,
  normalizeStanbicExcelTable,
} from './stanbicStatement.js'

export interface ParseResult {
  headers: string[]
  rows: unknown[][]
  sheetNames?: string[]
  activeSheet?: string
}

export function parseExcel(filepath: string, sheetIndex = 0): ParseResult {
  const ext = path.extname(filepath).toLowerCase()
  if (!['.xlsx', '.xls', '.xlsm'].includes(ext)) {
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
  const ecobankHeaderRow = findEcobankTransactionHeaderRow(nonEmpty)
  const bogHeaderRow = ecobankHeaderRow < 0 ? findBogTransactionHeaderRow(nonEmpty) : -1
  const stanbicHeaderRow =
    ecobankHeaderRow < 0 && bogHeaderRow < 0 ? findStanbicTransactionHeaderRow(nonEmpty) : -1
  const boaHeaderRow =
    ecobankHeaderRow < 0 && bogHeaderRow < 0 && stanbicHeaderRow < 0
      ? findBankOfAfricaTransactionHeaderRow(nonEmpty)
      : -1
  const erpGlHeaderRow =
    ecobankHeaderRow < 0 && bogHeaderRow < 0 && stanbicHeaderRow < 0 && boaHeaderRow < 0
      ? findErpGlCashBookHeaderRow(nonEmpty)
      : -1
  const cashBookHeaderRow =
    ecobankHeaderRow < 0 &&
    bogHeaderRow < 0 &&
    stanbicHeaderRow < 0 &&
    boaHeaderRow < 0 &&
    erpGlHeaderRow < 0
      ? findCashBookTransactionHeaderRow(nonEmpty)
      : -1
  const headerRow =
    ecobankHeaderRow >= 0
      ? ecobankHeaderRow
      : bogHeaderRow >= 0
        ? bogHeaderRow
        : stanbicHeaderRow >= 0
          ? stanbicHeaderRow
          : boaHeaderRow >= 0
            ? boaHeaderRow
            : erpGlHeaderRow >= 0
              ? erpGlHeaderRow
              : cashBookHeaderRow >= 0
                ? cashBookHeaderRow
                : findHeaderRow(nonEmpty)
  const headerRowData = nonEmpty[headerRow] || []
  const headers = headerRowData.map((c, i) =>
    String(c ?? '').trim() || `Col_${i}`
  )
  const rows = nonEmpty.slice(headerRow + 1).filter((r) => r.some((c) => c != null && String(c).trim() !== ''))
  let result: ParseResult = { headers, rows, sheetNames, activeSheet: sheetName }
  if (ecobankHeaderRow >= 0) {
    result = normalizeEcobankExcelTable(result)
  } else if (bogHeaderRow >= 0) {
    result = normalizeBogExcelTable(result)
  } else if (stanbicHeaderRow >= 0) {
    result = normalizeStanbicExcelTable(result)
  } else if (boaHeaderRow >= 0) {
    result = normalizeBankOfAfricaExcelTable(result)
  } else if (erpGlHeaderRow >= 0 && isErpGlCashBookLayout(headers)) {
    result = normalizeErpGlCashBookTable(result)
  } else if (cashBookHeaderRow >= 0 && isTglErpCashBookLayout(headers)) {
    result = normalizeTglErpCashBookTable(result)
  }
  return result
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
  if (['.xlsx', '.xls', '.xlsm'].includes(ext)) return 'excel'
  if (ext === '.csv') return 'csv'
  if (ext === '.pdf') return 'pdf'
  if (['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp'].includes(ext)) return 'image'
  throw new Error('Unsupported file type')
}
