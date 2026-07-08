/**
 * Bank of Ghana customer account statement Excel export.
 * Header row: Post Date, Description, Reference, Value Date, combined "Debit Amt   Credit Amt".
 */

import { parseImportedAmount } from './amountParser.js'
import type { ParseResult } from './parser.js'

const BOG_AMOUNT = /-?[\d,]+\.\d{2}|-?[\d,]+/g
const BOG_GLUE_LINE =
  /(\d{1,2}\s+[A-Z]{3}\s+\d{2})\s+(.+?)\s+((?:TT|FT)[A-Z0-9]+).*?(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})/gi

function norm(h: string): string {
  return (h || '').toLowerCase().replace(/[\s_]+/g, ' ').trim()
}

export function looksLikeBogStatementContent(text: string): boolean {
  const flat = text.replace(/\s+/g, ' ')
  return /bank of ghana/i.test(flat) && /post date/i.test(flat) && /debit amt/i.test(flat)
}

export function isBogStatementLayout(headers: string[], rows: unknown[][]): boolean {
  const h = headers.map(norm).join(' ')
  if (/post date/.test(h) && /description/.test(h) && /debit amt/.test(h)) return true
  if (/post date/.test(h) && /description/.test(h) && /\bdebit\b/.test(h) && /\bcredit\b/.test(h)) {
    return true
  }
  const joined = rows.slice(0, 8).flat().map((c) => String(c ?? '')).join(' ')
  return looksLikeBogStatementContent(joined)
}

export function findBogTransactionHeaderRow(data: unknown[][]): number {
  for (let i = 0; i < Math.min(30, data.length); i++) {
    const row = data[i] || []
    const cells = row.map((c) => norm(String(c ?? '')))
    const hasPostDate = cells.some((c) => c === 'post date')
    const hasDesc = cells.some((c) => c === 'description')
    const hasAmt = cells.some((c) => /debit amt/.test(c) && /credit amt/.test(c))
    if (hasPostDate && hasDesc && hasAmt) return i
  }
  return -1
}

export function isBogDateValue(value: unknown): boolean {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return true
  const s = String(value ?? '').trim()
  if (!s) return false
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true
  if (/^\d{1,2}\s+[A-Z]{3}\s+\d{2}/i.test(s)) return true
  if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s/i.test(s)) return true
  return false
}

export function formatBogDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const d = value.getUTCDate().toString().padStart(2, '0')
    const m = (value.getUTCMonth() + 1).toString().padStart(2, '0')
    const y = value.getUTCFullYear()
    return `${d}/${m}/${y}`
  }
  const s = String(value ?? '').trim()
  const dmy = s.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{2,4})$/i)
  if (dmy) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    }
    const mm = months[dmy[2]!.toLowerCase()] ?? '01'
    const yearPart = dmy[3]!
    const yy = yearPart.length === 4 ? yearPart : Number(yearPart) < 50 ? `20${yearPart}` : `19${yearPart}`
    return `${dmy[1]!.padStart(2, '0')}/${mm}/${yy}`
  }
  const short = s.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{2})/i)
  if (short) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    }
    const mm = months[short[2]!.toLowerCase()] ?? '01'
    const yy = Number(short[3]!) < 50 ? `20${short[3]}` : `19${short[3]}`
    return `${short[1]!.padStart(2, '0')}/${mm}/${yy}`
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  const long = s.match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z]{3})\s+(\d{1,2})\s+(\d{4})/i)
  if (long) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    }
    const mm = months[long[1]!.toLowerCase()] ?? '01'
    return `${long[2]!.padStart(2, '0')}/${mm}/${long[3]}`
  }
  return s
}

/** Split merged "Debit Amt   Credit Amt" cell into separate amounts. */
export function splitBogAmountCell(raw: unknown): { debit: number; credit: number } {
  const s = String(raw ?? '').trim()
  if (!s) return { debit: 0, credit: 0 }
  const amounts = (s.match(BOG_AMOUNT) ?? []).map((x) => parseImportedAmount(x))
  if (amounts.length === 0) return { debit: 0, credit: 0 }
  if (amounts.length === 1) {
    const a = amounts[0]!
    if (a < 0) return { debit: Math.abs(a), credit: 0 }
    if (a > 0) return { debit: 0, credit: a }
    return { debit: 0, credit: 0 }
  }
  const first = amounts[0]!
  const second = amounts[1]!
  if (first < 0) return { debit: Math.abs(first), credit: second > 0 ? second : 0 }
  if (second < 0) return { debit: Math.abs(second), credit: first > 0 ? first : 0 }
  return { debit: 0, credit: Math.max(first, second) }
}

function isNoiseLine(line: string): boolean {
  return /^book balance/i.test(line) || /^printed on/i.test(line)
}

/** Recover transactions embedded in a single Excel cell (export overflow). */
export function parseBogGluedTransactions(text: string): Array<{
  postDate: string
  description: string
  reference: string
  debit: number
  credit: number
  balance: number
}> {
  const rows: Array<{
    postDate: string
    description: string
    reference: string
    debit: number
    credit: number
    balance: number
  }> = []
  const flat = text.replace(/\r/g, '\n')
  for (const m of flat.matchAll(BOG_GLUE_LINE)) {
    const postDate = formatBogDate(m[1])
    const description = m[2]!.replace(/\s+/g, ' ').trim()
    const reference = m[3] ?? ''
    const debitRaw = parseImportedAmount(m[4])
    const creditRaw = parseImportedAmount(m[5])
    const balance = parseImportedAmount(m[6])
    const debit = debitRaw < 0 ? Math.abs(debitRaw) : debitRaw > 0 && creditRaw <= 0 ? debitRaw : 0
    const credit = creditRaw > 0 ? creditRaw : debitRaw > 0 ? debitRaw : 0
    if (debit > 0 || credit > 0) {
      rows.push({ postDate, description, reference, debit, credit, balance })
    }
  }
  return rows
}

function colIndex(headers: string[], patterns: RegExp[]): number {
  const normHeaders = headers.map(norm)
  return normHeaders.findIndex((h) => patterns.some((p) => p.test(h)))
}

export function normalizeBogExcelTable(result: ParseResult): ParseResult {
  const matrix = [result.headers, ...result.rows]
  const headerRow = findBogTransactionHeaderRow(matrix)
  if (headerRow < 0) return result

  const headerCells = (matrix[headerRow] || []).map((c) => String(c ?? '').trim())
  const postIdx = colIndex(headerCells, [/^post date$/])
  const descIdx = colIndex(headerCells, [/^description$/])
  const refIdx = colIndex(headerCells, [/^reference$/])
  const valueIdx = colIndex(headerCells, [/^value date$/])
  const amtIdx = colIndex(headerCells, [/debit amt.*credit amt/])
  const balIdx = colIndex(headerCells, [/^col_12$/, /^balance$/])
  const balanceIdx = balIdx >= 0 ? balIdx : 12

  const headers = [
    'Post Date',
    'Description',
    'Reference',
    'Value Date',
    'Debit',
    'Credit',
    'Balance',
  ]
  const rows: unknown[][] = []

  let block: string[] = []
  let blockMeta: {
    postDate: unknown
    description: string
    reference: string
    valueDate: unknown
    amountRaw: unknown
    balance: unknown
  } | null = null

  const flush = () => {
    if (!blockMeta) {
      block = []
      return
    }
    const extra = block
      .slice(1)
      .filter((l) => l.trim())
      .filter((l) => !isNoiseLine(l))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    const description = [blockMeta.description, extra].filter(Boolean).join(' ').trim()
    const { debit, credit } = splitBogAmountCell(blockMeta.amountRaw)
    const balance = blockMeta.balance != null && String(blockMeta.balance).trim() !== ''
      ? parseImportedAmount(blockMeta.balance)
      : null

    if (debit > 0 || credit > 0) {
      rows.push([
        formatBogDate(blockMeta.postDate),
        description,
        blockMeta.reference || null,
        formatBogDate(blockMeta.valueDate),
        debit > 0 ? debit : null,
        credit > 0 ? credit : null,
        balance,
      ])
    }
    block = []
    blockMeta = null
  }

  for (const row of matrix.slice(headerRow + 1)) {
    const postCell = postIdx >= 0 ? row[postIdx] : row[0]
    const postText = String(postCell ?? '').trim()

    if (isBogDateValue(postCell)) {
      flush()
      blockMeta = {
        postDate: postCell,
        description: String((descIdx >= 0 ? row[descIdx] : row[1]) ?? '').trim(),
        reference: String((refIdx >= 0 ? row[refIdx] : row[3]) ?? '').trim(),
        valueDate: valueIdx >= 0 ? row[valueIdx] : row[8],
        amountRaw: amtIdx >= 0 ? row[amtIdx] : row[9],
        balance: row[balanceIdx],
      }
      block = [postText]
      continue
    }

    if (postText.length > 120 && /\d{1,2}\s+[A-Z]{3}\s+\d{2}/i.test(postText)) {
      flush()
      for (const glued of parseBogGluedTransactions(postText)) {
        rows.push([
          glued.postDate,
          glued.description,
          glued.reference || null,
          glued.postDate,
          glued.debit > 0 ? glued.debit : null,
          glued.credit > 0 ? glued.credit : null,
          glued.balance,
        ])
      }
      continue
    }

    if (blockMeta) {
      const line = String((descIdx >= 0 ? row[descIdx] : row[1]) ?? postText).trim()
      if (line) block.push(line)
    }
  }
  flush()

  return { ...result, headers, rows }
}
