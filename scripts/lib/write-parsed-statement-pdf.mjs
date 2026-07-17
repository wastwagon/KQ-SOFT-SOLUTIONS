/**
 * Render parsed bank transactions as a multi-page PDF (corrected extract for client delivery).
 */
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const require = createRequire(path.join(process.cwd(), 'api/package.json'))
const PDFDocument = require('pdfkit')

function formatCell(value) {
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

/**
 * @param {string} outPath
 * @param {{ headers: string[], rows: unknown[][] }} parsed
 * @param {{ source?: string, parseMethod?: string, sumDebit?: number, sumCredit?: number }} meta
 */
export function writeParsedStatementPdf(outPath, parsed, meta = {}) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true })

  const doc = new PDFDocument({ size: 'A4', margin: 36, layout: 'landscape' })
  const stream = fs.createWriteStream(outPath)
  doc.pipe(stream)

  const pageW = doc.page.width - 72
  const headers = parsed.headers
  const colCount = headers.length
  const weights = headers.map((h) => {
    const l = h.toLowerCase()
    if (l.includes('description') || l.includes('narration')) return 3
    if (l.includes('balance')) return 1.2
    if (l.includes('debit') || l.includes('credit') || l.includes('payment') || l.includes('receipt')) return 1.1
    return 1
  })
  const weightSum = weights.reduce((a, b) => a + b, 0)
  const colWidths = weights.map((w) => (pageW * w) / weightSum)
  const colStarts = []
  let x = 36
  for (const w of colWidths) {
    colStarts.push(x)
    x += w
  }

  const title = 'BRS corrected bank statement extract'
  const subtitleParts = [
    meta.source ? `Source: ${meta.source}` : '',
    meta.parseMethod ? `Parser: ${meta.parseMethod}` : '',
    `Exported: ${new Date().toISOString().slice(0, 10)}`,
    `Rows: ${parsed.rows.length}`,
    meta.sumDebit != null ? `Total debits: GHS ${formatCell(meta.sumDebit)}` : '',
    meta.sumCredit != null ? `Total credits: GHS ${formatCell(meta.sumCredit)}` : '',
  ].filter(Boolean)

  function drawHeader() {
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#000').text(title, 36, 36, { width: pageW })
    doc.fontSize(8).font('Helvetica').fillColor('#333').text(subtitleParts.join('  |  '), 36, doc.y + 4, {
      width: pageW,
    })
    doc.fillColor('#000')
    const y0 = doc.y + 10
    doc.fontSize(7).font('Helvetica-Bold')
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], colStarts[i], y0, { width: colWidths[i] - 4, lineBreak: false })
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

  for (const row of parsed.rows) {
    if (doc.y > doc.page.height - 48) {
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 36 })
      drawHeader()
    }
    const rowY = doc.y
    let maxH = 10
    for (let i = 0; i < colCount; i++) {
      const text = formatCell(row[i])
      const h = doc.heightOfString(text, { width: colWidths[i] - 4 })
      maxH = Math.max(maxH, h)
    }
    for (let i = 0; i < colCount; i++) {
      doc.text(formatCell(row[i]), colStarts[i], rowY, { width: colWidths[i] - 4, lineBreak: false })
    }
    doc.y = rowY + maxH + 2
  }

  doc.end()
  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(outPath))
    stream.on('error', reject)
  })
}
