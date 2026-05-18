/** Ghana workbook sign-off grid — PDF/Excel export helpers (mirrors web/src/lib/brsSignOff.ts). */

export const BRS_SIGN_OFF_ROW_LABELS = ['NAME', 'SIGNATURE', 'DATE'] as const
export const BRS_SIGN_OFF_COLUMN_HEADERS = ['Prepared By', 'Checked By', 'Approved By'] as const

export interface BrsSignOffPerson {
  name?: string | null
  email?: string | null
}

export interface BrsSignOffColumn {
  header: (typeof BRS_SIGN_OFF_COLUMN_HEADERS)[number]
  name: string
  date: string
}

export interface BrsSignOffProjectInput {
  preparedBy?: BrsSignOffPerson | null
  preparedAt?: Date | string | null
  reviewedBy?: BrsSignOffPerson | null
  reviewedAt?: Date | string | null
  approvedBy?: BrsSignOffPerson | null
  approvedAt?: Date | string | null
}

function displaySignatoryName(person: BrsSignOffPerson | null | undefined): string {
  if (!person) return ''
  const name = (person.name || '').trim()
  if (name) return name
  return (person.email || '').trim()
}

export function formatBrsSignOffDate(date: Date | string | null | undefined): string {
  if (date == null) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function buildBrsSignOffColumns(project: BrsSignOffProjectInput | null | undefined): BrsSignOffColumn[] {
  const p = project ?? {}
  return [
    {
      header: 'Prepared By',
      name: displaySignatoryName(p.preparedBy),
      date: formatBrsSignOffDate(p.preparedAt),
    },
    {
      header: 'Checked By',
      name: displaySignatoryName(p.reviewedBy),
      date: formatBrsSignOffDate(p.reviewedAt),
    },
    {
      header: 'Approved By',
      name: displaySignatoryName(p.approvedBy),
      date: formatBrsSignOffDate(p.approvedAt),
    },
  ]
}

/** Rows for Excel AOA: header row + NAME / SIGNATURE / DATE rows (4 columns). */
export function brsSignOffRowsForExcel(project: BrsSignOffProjectInput | null | undefined): (string | number)[][] {
  const cols = buildBrsSignOffColumns(project)
  return [
    [],
    ['', ...cols.map((c) => c.header)],
    ['NAME', ...cols.map((c) => c.name)],
    ['SIGNATURE', '', '', ''],
    ['DATE', ...cols.map((c) => c.date)],
  ]
}

export interface PdfKitLike {
  dash(length: number, options?: { space?: number }): PdfKitLike
  undash(): PdfKitLike
  moveTo(x: number, y: number): PdfKitLike
  lineTo(x: number, y: number): PdfKitLike
  strokeColor(color: string): PdfKitLike
  lineWidth(n: number): PdfKitLike
  stroke(): PdfKitLike
  font(name: string): PdfKitLike
  fontSize(n: number): PdfKitLike
  fillColor(color: string): PdfKitLike
  text(text: string, x: number, y: number, options?: Record<string, unknown>): PdfKitLike
}

/** Draw dashed GCAA-style sign-off grid; returns Y below the block. */
export function drawBrsWorkbookSignOffPdf(
  doc: PdfKitLike,
  opts: {
    pageRight: number
    startY: number
    blockWidth?: number
    project: BrsSignOffProjectInput | null | undefined
  }
): number {
  const cols = buildBrsSignOffColumns(opts.project)
  const blockWidth = opts.blockWidth ?? 360
  const blockLeft = opts.pageRight - blockWidth
  const rowLabelW = 52
  const colW = (blockWidth - rowLabelW) / cols.length
  const headerH = 20
  const rowH = 24
  const rows = BRS_SIGN_OFF_ROW_LABELS.length
  const totalH = headerH + rows * rowH
  let y = opts.startY

  const strokeDashed = () => {
    doc.dash(3, { space: 2 }).strokeColor('#64748b').lineWidth(0.75)
  }
  const endStroke = () => {
    doc.stroke().undash()
  }

  const hLine = (yPos: number) => {
    strokeDashed()
    doc.moveTo(blockLeft, yPos).lineTo(blockLeft + blockWidth, yPos)
    endStroke()
  }
  const vLine = (xPos: number, y0: number, y1: number) => {
    strokeDashed()
    doc.moveTo(xPos, y0).lineTo(xPos, y1)
    endStroke()
  }

  hLine(y)
  hLine(y + totalH)
  vLine(blockLeft, y, y + totalH)
  vLine(blockLeft + rowLabelW, y, y + totalH)
  vLine(blockLeft + blockWidth, y, y + totalH)
  hLine(y + headerH)
  for (let r = 1; r <= rows; r++) {
    hLine(y + headerH + r * rowH)
  }
  for (let c = 1; c < cols.length; c++) {
    const x = blockLeft + rowLabelW + c * colW
    vLine(x, y, y + totalH)
  }

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a')
  cols.forEach((col, i) => {
    const x = blockLeft + rowLabelW + i * colW
    doc.text(col.header, x, y + 5, { width: colW, align: 'center', lineBreak: false })
  })

  doc.font('Helvetica-Bold').fontSize(7).fillColor('#334155')
  BRS_SIGN_OFF_ROW_LABELS.forEach((rowLabel, ri) => {
    const rowY = y + headerH + ri * rowH
    doc.text(rowLabel, blockLeft + 4, rowY + 7, { width: rowLabelW - 8, align: 'left', lineBreak: false })
  })

  doc.font('Helvetica').fontSize(8).fillColor('#0f172a')
  BRS_SIGN_OFF_ROW_LABELS.forEach((rowLabel, ri) => {
    const rowY = y + headerH + ri * rowH
    cols.forEach((col, ci) => {
      const value = rowLabel === 'NAME' ? col.name : rowLabel === 'DATE' ? col.date : ''
      if (!value) return
      const x = blockLeft + rowLabelW + ci * colW
      doc.text(value, x + 4, rowY + 7, { width: colW - 8, align: 'left', lineBreak: false })
    })
  })

  doc.fillColor('#000000')
  return y + totalH + 8
}
