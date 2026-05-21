/**
 * Export reconcile Cash Book / Bank Statement tables (Excel + PDF).
 * Heavy libs are loaded on demand so the reconcile page still loads if Docker node_modules is stale.
 */
import { amountColumnHeader, getCurrencySymbol } from './currency'
import { formatAmountNumber, formatDateCompact } from './format'
import type { ReconcileView, Tx } from '../components/reconcile/types'

export type ReconcileExportSide = 'cash_book' | 'bank_statement'

type CbRow = Tx & { _type?: 'receipt' | 'payment' }
type BankRow = Tx & { _type?: 'credit' | 'debit' }

export type ReconcileExportInput = {
  side: ReconcileExportSide
  view: ReconcileView
  currency: string
  projectSlug: string
  projectName?: string
  receipts: Tx[]
  payments: Tx[]
  credits: Tx[]
  debits: Tx[]
  matchedCbIds: Set<string>
  matchedBankIds: Set<string>
}

const sortByDate = (a: Tx, b: Tx) => {
  const da = a.date ? new Date(a.date).getTime() : 0
  const db = b.date ? new Date(b.date).getTime() : 0
  return da - db
}

function safeFilenamePart(s: string): string {
  return s.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'export'
}

function getUnmatchedReason(t: Tx, isCashBook: boolean, view: ReconcileView): string {
  if (isCashBook) {
    if (view === 'receipts') return 'Uncredited — no matching bank credit'
    return t.chqNo?.trim()
      ? 'Unpresented cheque — no bank debit with same amount/ref'
      : 'Unpresented — no matching bank debit'
  }
  if (view === 'receipts') return 'No matching cash book receipt'
  return 'No matching cash book payment'
}

function buildCashBookRows(input: ReconcileExportInput): { headers: string[]; rows: (string | number)[][] } {
  const { view, currency, receipts, payments, matchedCbIds } = input
  const amt = amountColumnHeader(currency)
  const balSym = getCurrencySymbol(currency)

  let txs: CbRow[]
  if (view === 'all') {
    txs = [
      ...receipts.map((t) => ({ ...t, _type: 'receipt' as const })),
      ...payments.map((t) => ({ ...t, _type: 'payment' as const })),
    ].sort(sortByDate)
  } else {
    txs = view === 'receipts' ? [...receipts] : [...payments]
  }

  let running = 0
  const dataRows: (string | number)[][] = []

  for (const t of txs) {
    const isReceipt = view === 'all' ? t._type === 'receipt' : view === 'receipts'
    running += isReceipt ? Number(t.amount) : -Number(t.amount)
    const matched = matchedCbIds.has(t.id)
    const note = matched ? '' : getUnmatchedReason(t, true, view === 'all' ? (isReceipt ? 'receipts' : 'payments') : view)

    if (view === 'all') {
      dataRows.push([
        isReceipt ? 'Receipt' : 'Payment',
        formatDateCompact(t.date),
        t.name || '',
        t.details || '',
        t.chqNo || '',
        t.docRef || '',
        isReceipt ? Number(t.amount) : '',
        !isReceipt ? Number(t.amount) : '',
        running,
        matched ? 'Matched' : 'Unmatched',
        note,
      ])
    } else {
      dataRows.push([
        formatDateCompact(t.date),
        t.name || '',
        t.details || '',
        t.chqNo || '',
        t.docRef || '',
        Number(t.amount),
        running,
        matched ? 'Matched' : 'Unmatched',
        note,
      ])
    }
  }

  const headers =
    view === 'all'
      ? ['Type', 'Date', 'Name', 'Description', 'Chq no.', 'Ref. Doc. No.', `${amt} (receipt)`, `${amt} (payment)`, `Balance (${balSym})`, 'Status', 'Note']
      : ['Date', 'Name', 'Description', 'Chq no.', 'Ref. Doc. No.', amt, `Balance (${balSym})`, 'Status', 'Note']

  return { headers, rows: dataRows }
}

function buildBankRows(input: ReconcileExportInput): { headers: string[]; rows: (string | number)[][] } {
  const { view, currency, credits, debits, matchedBankIds } = input
  const amt = amountColumnHeader(currency)
  const balSym = getCurrencySymbol(currency)

  let txs: BankRow[]
  if (view === 'all') {
    txs = [
      ...credits.map((t) => ({ ...t, _type: 'credit' as const })),
      ...debits.map((t) => ({ ...t, _type: 'debit' as const })),
    ].sort(sortByDate)
  } else {
    txs = view === 'receipts' ? [...credits] : [...debits]
  }

  let running = 0
  const dataRows: (string | number)[][] = []

  for (const t of txs) {
    const amtVal = Number(t.amount)
    const isCredit = view === 'all' ? t._type === 'credit' : view === 'receipts'
    running += isCredit ? amtVal : -amtVal
    const matched = matchedBankIds.has(t.id)
    const note = matched ? '' : getUnmatchedReason(t, false, view === 'all' ? (isCredit ? 'receipts' : 'payments') : view)
    const desc = t.name || t.details || ''

    if (view === 'all') {
      dataRows.push([
        isCredit ? 'Credit' : 'Debit',
        formatDateCompact(t.date),
        desc,
        t.chqNo || '',
        t.docRef || '',
        !isCredit ? amtVal : '',
        isCredit ? amtVal : '',
        running,
        matched ? 'Matched' : 'Unmatched',
        note,
      ])
    } else if (view === 'receipts') {
      dataRows.push([
        formatDateCompact(t.date),
        desc,
        t.chqNo || '',
        t.docRef || '',
        amtVal,
        running,
        matched ? 'Matched' : 'Unmatched',
        note,
      ])
    } else {
      dataRows.push([
        formatDateCompact(t.date),
        desc,
        t.chqNo || '',
        t.docRef || '',
        amtVal,
        running,
        matched ? 'Matched' : 'Unmatched',
        note,
      ])
    }
  }

  const headers =
    view === 'all'
      ? ['Type', 'Date', 'Description', 'Chq no.', 'Ref. Doc. No.', `${amt} (debit)`, `${amt} (credit)`, `Balance (${balSym})`, 'Status', 'Note']
      : view === 'receipts'
        ? ['Date', 'Description', 'Chq no.', 'Ref. Doc. No.', `${amt} (credit)`, `Balance (${balSym})`, 'Status', 'Note']
        : ['Date', 'Description', 'Chq no.', 'Ref. Doc. No.', `${amt} (debit)`, `Balance (${balSym})`, 'Status', 'Note']

  return { headers, rows: dataRows }
}

function buildTable(input: ReconcileExportInput) {
  return input.side === 'cash_book' ? buildCashBookRows(input) : buildBankRows(input)
}

function baseFilename(input: ReconcileExportInput, ext: string): string {
  const side = input.side === 'cash_book' ? 'cash-book' : 'bank-statement'
  const view = input.view === 'all' ? 'all' : input.view
  return `${safeFilenamePart(input.projectSlug)}-${side}-${view}.${ext}`
}

export async function exportReconcileTableExcel(input: ReconcileExportInput): Promise<void> {
  const XLSX = await import('xlsx')
  const { headers, rows } = buildTable(input)
  const sheetName = input.side === 'cash_book' ? 'Cash Book' : 'Bank Statement'
  const aoa = [headers, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, baseFilename(input, 'xlsx'))
}

export async function exportReconcileTablePdf(input: ReconcileExportInput): Promise<void> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = autoTableModule.default
  const { headers, rows } = buildTable(input)
  const title = input.side === 'cash_book' ? 'Cash Book' : 'Bank Statement'
  const subtitle = [input.projectName || input.projectSlug, `View: ${input.view}`].filter(Boolean).join(' · ')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFontSize(14)
  doc.text(title, 40, 36)
  doc.setFontSize(9)
  doc.setTextColor(80)
  doc.text(subtitle, 40, 52)
  doc.setTextColor(0)

  const body = rows.map((row) =>
    row.map((cell) =>
      cell === '' || cell == null ? '' : typeof cell === 'number' ? formatAmountNumber(cell) : String(cell)
    )
  )

  autoTable(doc, {
    head: [headers],
    body,
    startY: 62,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [55, 65, 81], textColor: 255 },
    margin: { left: 24, right: 24 },
  })

  doc.save(baseFilename(input, 'pdf'))
}
