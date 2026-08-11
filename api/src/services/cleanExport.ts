/**
 * Standalone clean-export helpers: turn a parse result into Excel / PDF buffers
 * for download without creating a reconciliation project.
 */
import PDFDocument from 'pdfkit'
import * as XLSX from 'xlsx'
import { parseImportedAmount } from './amountParser.js'
import { withParsedRowsNewestFirst } from '../lib/transactionDateOrder.js'
import type { ParseResult } from './parser.js'

export type CleanExportKind = 'bank_statement' | 'cash_book'

export interface CleanExportMeta {
  source?: string
  parseMethod?: string
  kind: CleanExportKind
  sumDebit: number
  sumCredit: number
  rowCount: number
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

export function buildParsedExcelBuffer(
  parsed: Pick<ParseResult, 'headers' | 'rows'>,
  meta: Omit<CleanExportMeta, 'sumDebit' | 'sumCredit' | 'rowCount'> &
    Partial<Pick<CleanExportMeta, 'sumDebit' | 'sumCredit' | 'rowCount'>>
): { buffer: Buffer; meta: CleanExportMeta } {
  const ordered = withParsedRowsNewestFirst(parsed)
  const sums = summarizeParsed(ordered)
  const fullMeta: CleanExportMeta = {
    kind: meta.kind,
    source: meta.source,
    parseMethod: meta.parseMethod,
    sumDebit: meta.sumDebit ?? sums.sumDebit,
    sumCredit: meta.sumCredit ?? sums.sumCredit,
    rowCount: meta.rowCount ?? sums.rowCount,
  }
  const title =
    meta.kind === 'cash_book'
      ? 'BRS cleaned cash book extract'
      : 'BRS cleaned bank statement extract'
  const metaRows: unknown[][] = [
    [title],
    ['Source', meta.source || ''],
    ['Parse method', meta.parseMethod || ''],
    ['Exported', new Date().toISOString()],
    ['Row order', 'Newest transaction date first'],
    ['Row count', fullMeta.rowCount],
    ['Sum debits / payments', fullMeta.sumDebit || ''],
    ['Sum credits / receipts', fullMeta.sumCredit || ''],
    [],
    ordered.headers,
    ...ordered.rows,
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

export function buildParsedPdfBuffer(
  parsed: Pick<ParseResult, 'headers' | 'rows'>,
  meta: CleanExportMeta
): Promise<Buffer> {
  const ordered = withParsedRowsNewestFirst(parsed)
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36, layout: 'landscape' })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageW = doc.page.width - 72
    const headers = ordered.headers
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

    const title =
      meta.kind === 'cash_book'
        ? 'BRS cleaned cash book extract'
        : 'BRS cleaned bank statement extract'
    const subtitleParts = [
      meta.source ? `Source: ${meta.source}` : '',
      meta.parseMethod ? `Parser: ${meta.parseMethod}` : '',
      `Exported: ${new Date().toISOString().slice(0, 10)}`,
      `Rows: ${ordered.rows.length}`,
      'Order: newest date first',
      `Total debits: GHS ${formatCell(meta.sumDebit)}`,
      `Total credits: GHS ${formatCell(meta.sumCredit)}`,
    ].filter(Boolean)

    function drawHeader() {
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#000').text(title, 36, 36, { width: pageW })
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

    for (const row of ordered.rows) {
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
