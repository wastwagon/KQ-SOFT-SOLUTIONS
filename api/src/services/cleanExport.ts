/**
 * Standalone clean-export helpers: turn a parse result into Excel / PDF buffers
 * for download without creating a reconciliation project.
 *
 * Sample mode truncates rows and watermarks files so prospects can validate
 * parsers without receiving ops-ready full extracts (those use plan quota).
 */
import PDFDocument from 'pdfkit'
import * as XLSX from 'xlsx'
import { parseImportedAmount } from './amountParser.js'
import {
  withParsedRowsByDateOrder,
  type TransactionDateOrder,
} from '../lib/transactionDateOrder.js'
import type { ParseResult } from './parser.js'

export type CleanExportKind = 'bank_statement' | 'cash_book'
export type CleanExportMode = 'sample' | 'full'
export type { TransactionDateOrder as CleanDateOrder }

/** Rows included in sample Excel/PDF downloads (preview JSON stays smaller). */
export const CLEAN_SAMPLE_ROW_LIMIT = 25
export const CLEAN_SAMPLE_WATERMARK = 'BRS DEMO — NOT FOR OPERATIONAL USE'

export interface CleanExportMeta {
  source?: string
  parseMethod?: string
  kind: CleanExportKind
  sumDebit: number
  sumCredit: number
  rowCount: number
  mode?: CleanExportMode
  totalRowCount?: number
  truncated?: boolean
  watermark?: string
}

function amountColumnIndex(headers: string[], side: 'debit' | 'credit'): number {
  const debitRes = [/^(debit|debits)$/i, /amt\s*paid/i, /^payment$/i]
  const creditRes = [/^(credit|credits)$/i, /amt\s*received/i, /^receipt$/i]
  const patterns = side === 'debit' ? debitRes : creditRes
  for (const re of patterns) {
    const i = headers.findIndex((h) => re.test(String(h)))
    if (i >= 0) return i
  }
  return -1
}

export function summarizeParsed(parsed: Pick<ParseResult, 'headers' | 'rows'>): {
  sumDebit: number
  sumCredit: number
  rowCount: number
} {
  const debitCol = amountColumnIndex(parsed.headers, 'debit')
  const creditCol = amountColumnIndex(parsed.headers, 'credit')
  const sumDebit = parsed.rows.reduce(
    (s, r) => s + (debitCol >= 0 ? parseImportedAmount(r[debitCol]) : 0),
    0
  )
  const sumCredit = parsed.rows.reduce(
    (s, r) => s + (creditCol >= 0 ? parseImportedAmount(r[creditCol]) : 0),
    0
  )
  return { sumDebit, sumCredit, rowCount: parsed.rows.length }
}

function rowOrderLabel(order: TransactionDateOrder): string {
  return order === 'newest_first'
    ? 'Newest transaction date first'
    : 'Oldest transaction date first'
}

/** Sort by chosen date order, then optional sample truncation. Full-file sums stay on total rows. */
export function prepareCleanExportRows(
  parsed: Pick<ParseResult, 'headers' | 'rows'>,
  mode: CleanExportMode,
  dateOrder: TransactionDateOrder = 'oldest_first'
): {
  ordered: Pick<ParseResult, 'headers' | 'rows'>
  exportRows: Pick<ParseResult, 'headers' | 'rows'>
  totalRowCount: number
  truncated: boolean
  fullSums: { sumDebit: number; sumCredit: number; rowCount: number }
  dateOrder: TransactionDateOrder
} {
  const ordered = withParsedRowsByDateOrder(parsed, dateOrder)
  const fullSums = summarizeParsed(ordered)
  const truncated = mode === 'sample' && ordered.rows.length > CLEAN_SAMPLE_ROW_LIMIT
  const exportRows =
    mode === 'sample'
      ? { headers: ordered.headers, rows: ordered.rows.slice(0, CLEAN_SAMPLE_ROW_LIMIT) }
      : ordered
  return {
    ordered,
    exportRows,
    totalRowCount: fullSums.rowCount,
    truncated,
    fullSums,
    dateOrder,
  }
}

function titleFor(kind: CleanExportKind, mode: CleanExportMode): string {
  const base =
    kind === 'cash_book' ? 'BRS cleaned cash book extract' : 'BRS cleaned bank statement extract'
  return mode === 'sample' ? `${base} (SAMPLE)` : base
}

export function buildParsedExcelBuffer(
  parsed: Pick<ParseResult, 'headers' | 'rows'>,
  meta: Omit<CleanExportMeta, 'sumDebit' | 'sumCredit' | 'rowCount'> &
    Partial<Pick<CleanExportMeta, 'sumDebit' | 'sumCredit' | 'rowCount'>>,
  mode: CleanExportMode = 'full',
  dateOrder: TransactionDateOrder = 'oldest_first'
): { buffer: Buffer; meta: CleanExportMeta } {
  const prepared = prepareCleanExportRows(parsed, mode, dateOrder)
  const exportSums = summarizeParsed(prepared.exportRows)
  const fullMeta: CleanExportMeta = {
    kind: meta.kind,
    source: meta.source,
    parseMethod: meta.parseMethod,
    sumDebit: meta.sumDebit ?? prepared.fullSums.sumDebit,
    sumCredit: meta.sumCredit ?? prepared.fullSums.sumCredit,
    rowCount: meta.rowCount ?? exportSums.rowCount,
    mode,
    totalRowCount: prepared.totalRowCount,
    truncated: prepared.truncated,
    watermark: mode === 'sample' ? CLEAN_SAMPLE_WATERMARK : undefined,
  }
  const metaRows: unknown[][] = [
    [titleFor(meta.kind, mode)],
    ...(mode === 'sample'
      ? [
          ['Watermark', CLEAN_SAMPLE_WATERMARK],
          [
            'Sample notice',
            `Showing ${exportSums.rowCount} of ${prepared.totalRowCount} rows. Upgrade / use Full download for the complete extract.`,
          ],
        ]
      : []),
    ['Source', meta.source || ''],
    ['Parse method', meta.parseMethod || ''],
    ['Exported', new Date().toISOString()],
    ['Row order', rowOrderLabel(dateOrder)],
    ['Export mode', mode],
    ['Rows in file', fullMeta.rowCount],
    ...(mode === 'sample' ? [['Total rows in source', prepared.totalRowCount]] : []),
    ['Sum debits / payments (full file)', fullMeta.sumDebit || ''],
    ['Sum credits / receipts (full file)', fullMeta.sumCredit || ''],
    [],
    prepared.exportRows.headers,
    ...prepared.exportRows.rows,
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaRows), 'Transactions')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return { buffer, meta: fullMeta }
}

function formatCell(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  const s = String(value).trim()
  const n = Number(s.replace(/,/g, ''))
  if (s !== '' && /^-?\d+(\.\d+)?$/.test(s.replace(/,/g, ''))) {
    return n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return s
}

function drawPdfWatermark(doc: InstanceType<typeof PDFDocument>) {
  const { width, height } = doc.page
  doc.save()
  doc.fillColor('#cc0000').opacity(0.12)
  doc.font('Helvetica-Bold').fontSize(28)
  doc.rotate(-28, { origin: [width / 2, height / 2] })
  doc.text(CLEAN_SAMPLE_WATERMARK, 48, height / 2 - 20, {
    width: width - 96,
    align: 'center',
    lineBreak: false,
  })
  doc.restore()
  doc.fillColor('#000').opacity(1)
}

export function buildParsedPdfBuffer(
  parsed: Pick<ParseResult, 'headers' | 'rows'>,
  meta: CleanExportMeta,
  mode: CleanExportMode = 'full',
  dateOrder: TransactionDateOrder = 'oldest_first'
): Promise<Buffer> {
  const prepared = prepareCleanExportRows(parsed, mode, dateOrder)
  const exportMeta: CleanExportMeta = {
    ...meta,
    mode,
    rowCount: prepared.exportRows.rows.length,
    totalRowCount: prepared.totalRowCount,
    truncated: prepared.truncated,
    watermark: mode === 'sample' ? CLEAN_SAMPLE_WATERMARK : undefined,
    sumDebit: meta.sumDebit,
    sumCredit: meta.sumCredit,
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36, layout: 'landscape' })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageW = doc.page.width - 72
    const headers = prepared.exportRows.headers
    const colCount = headers.length
    const weights = headers.map((h) => {
      const l = String(h).toLowerCase()
      if (l.includes('description') || l.includes('narration')) return 3
      if (l.includes('balance')) return 1.2
      if (
        l.includes('debit') ||
        l.includes('credit') ||
        l.includes('payment') ||
        l.includes('receipt')
      ) {
        return 1.1
      }
      return 1
    })
    const weightSum = weights.reduce((a, b) => a + b, 0) || 1
    const colWidths = weights.map((w) => (pageW * w) / weightSum)
    const colStarts: number[] = []
    let x = 36
    for (const w of colWidths) {
      colStarts.push(x)
      x += w
    }

    const title = titleFor(exportMeta.kind, mode)
    const subtitleParts = [
      mode === 'sample' ? CLEAN_SAMPLE_WATERMARK : '',
      mode === 'sample'
        ? `Sample: ${exportMeta.rowCount} of ${exportMeta.totalRowCount} rows`
        : '',
      exportMeta.source ? `Source: ${exportMeta.source}` : '',
      exportMeta.parseMethod ? `Parser: ${exportMeta.parseMethod}` : '',
      `Exported: ${new Date().toISOString().slice(0, 10)}`,
      mode === 'full' ? `Rows: ${prepared.exportRows.rows.length}` : '',
      `Order: ${dateOrder === 'newest_first' ? 'newest date first' : 'oldest date first'}`,
      `Total debits: GHS ${formatCell(exportMeta.sumDebit)}`,
      `Total credits: GHS ${formatCell(exportMeta.sumCredit)}`,
    ].filter(Boolean)

    function drawHeader() {
      if (mode === 'sample') drawPdfWatermark(doc)
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#000').text(title, 36, 36, { width: pageW })
      if (mode === 'sample') {
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor('#990000')
          .text(CLEAN_SAMPLE_WATERMARK, 36, doc.y + 2, { width: pageW })
        doc.fillColor('#000')
      }
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#333')
        .text(subtitleParts.join('  |  '), 36, doc.y + 4, { width: pageW })
      doc.fillColor('#000')
      const y0 = doc.y + 10
      doc.fontSize(7).font('Helvetica-Bold')
      for (let i = 0; i < headers.length; i++) {
        doc.text(String(headers[i]), colStarts[i]!, y0, { width: colWidths[i]! - 4, lineBreak: false })
      }
      doc
        .strokeColor('#999')
        .moveTo(36, y0 + 12)
        .lineTo(36 + pageW, y0 + 12)
        .stroke()
      doc.y = y0 + 16
      doc.font('Helvetica').fontSize(6.5)
    }

    drawHeader()

    for (const row of prepared.exportRows.rows) {
      if (doc.y > doc.page.height - 48) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 36 })
        drawHeader()
      }
      const rowY = doc.y
      let maxH = 10
      for (let i = 0; i < colCount; i++) {
        const text = formatCell(row[i])
        const h = doc.heightOfString(text, { width: colWidths[i]! - 4 })
        maxH = Math.max(maxH, h)
      }
      for (let i = 0; i < colCount; i++) {
        doc.text(formatCell(row[i]), colStarts[i]!, rowY, {
          width: colWidths[i]! - 4,
          lineBreak: false,
        })
      }
      doc.y = rowY + maxH + 2
    }

    doc.end()
  })
}
