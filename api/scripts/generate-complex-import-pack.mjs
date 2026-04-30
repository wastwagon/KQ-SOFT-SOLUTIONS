import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'
import XLSX from 'xlsx'
import { pdf as pdfToImg } from 'pdf-to-img'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.resolve(scriptDir, '../../test-data/complex-import-pack')
fs.mkdirSync(outputDir, { recursive: true })

const openingCash = 125000.0
const openingBank = 123800.0

const cashRows = []
const bankRows = []
const references = []

let cashBal = openingCash
let bankBal = openingBank

function fmtDate(day) {
  return `2026-04-${String(day).padStart(2, '0')}`
}

function addCash({ day, ref, chqNo = '', narration, amount, note = '' }) {
  cashBal += amount
  cashRows.push({
    Date: fmtDate(day),
    RefDocNo: ref,
    ChqNo: chqNo,
    Narration: narration,
    AmountSigned: Number(amount.toFixed(2)),
    Receipt: amount > 0 ? Number(amount.toFixed(2)) : '',
    Payment: amount < 0 ? Number(Math.abs(amount).toFixed(2)) : '',
    RunningBalance: Number(cashBal.toFixed(2)),
    Note: note,
  })
}

function addBank({ day, valueDay = day, ref, description, signedAmount, note = '' }) {
  bankBal += signedAmount
  bankRows.push({
    Date: fmtDate(day),
    ValueDate: fmtDate(valueDay),
    Reference: ref,
    Description: description,
    Debit: signedAmount < 0 ? Number(Math.abs(signedAmount).toFixed(2)) : '',
    Credit: signedAmount > 0 ? Number(signedAmount.toFixed(2)) : '',
    SignedAmount: Number(signedAmount.toFixed(2)),
    RunningBalance: Number(bankBal.toFixed(2)),
    Note: note,
  })
}

function mapRef(cashRef, bankRef, status, comment = '') {
  references.push({ cashRef, bankRef, status, comment })
}

// Baseline monthly operations (mostly matchable)
for (let i = 1; i <= 16; i++) {
  const receipt = 1500 + i * 215
  const payment = 900 + i * 120
  const day = i
  const receiptRef = `RCPT-APR-${String(i).padStart(3, '0')}`
  const paymentRef = `PYMT-APR-${String(i).padStart(3, '0')}`
  addCash({
    day,
    ref: receiptRef,
    narration: `Client receipt - invoice INV-${3100 + i}`,
    amount: receipt,
  })
  addCash({
    day: Math.min(day + 1, 28),
    ref: paymentRef,
    chqNo: `${1050 + i}`,
    narration: `Supplier payment CHQ ${1050 + i}`,
    amount: -payment,
  })

  // Same-day or +1 posting with slight narration/reference differences
  addBank({
    day: Math.min(day + (i % 2), 28),
    valueDay: Math.min(day + (i % 2), 28),
    ref: i % 3 === 0 ? `MOMO:${receiptRef}` : receiptRef,
    description: i % 4 === 0 ? `Transfer credit ${receiptRef}` : `Receipt ${receiptRef}`,
    signedAmount: receipt,
  })
  addBank({
    day: Math.min(day + 1 + (i % 3 === 0 ? 1 : 0), 29),
    valueDay: Math.min(day + 1, 29),
    ref: i % 5 === 0 ? `CHQ#${1050 + i}` : paymentRef,
    description: i % 5 === 0 ? `Cheque ${1050 + i}` : `Payment ${paymentRef}`,
    signedAmount: -payment,
  })

  mapRef(receiptRef, i % 3 === 0 ? `MOMO:${receiptRef}` : receiptRef, 'Matched', 'Narration/reference variant')
  mapRef(paymentRef, i % 5 === 0 ? `CHQ#${1050 + i}` : paymentRef, 'Matched', 'Cheque formatting variant')
}

// Deliberate complex cases
addCash({ day: 17, ref: 'RCPT-APR-017A', narration: 'Deposit slip DS-8891', amount: 9800, note: 'Batch deposit' })
addCash({ day: 17, ref: 'RCPT-APR-017B', narration: 'Deposit slip DS-8892', amount: 4200, note: 'Batch deposit' })
addBank({
  day: 19,
  valueDay: 18,
  ref: 'BATCH-DEP-APR17',
  description: 'Combined deposit DS-8891/8892',
  signedAmount: 14000,
  note: 'One-to-many against two cash entries',
})
mapRef('RCPT-APR-017A', 'BATCH-DEP-APR17', 'Partial', 'One-to-many')
mapRef('RCPT-APR-017B', 'BATCH-DEP-APR17', 'Partial', 'One-to-many')

addCash({ day: 20, ref: 'PYMT-APR-CHQ1045', chqNo: '1045', narration: 'Cheque issued to Vendor A', amount: -2750, note: 'Unpresented cheque' })
mapRef('PYMT-APR-CHQ1045', '', 'Unpresented cheque', 'Present in cash book only')

addCash({ day: 22, ref: 'RCPT-APR-LDG2001', narration: 'Lodgement pending bank credit', amount: 5300, note: 'Uncredited lodgement' })
mapRef('RCPT-APR-LDG2001', '', 'Uncredited lodgement', 'Present in cash book only')

addBank({ day: 23, ref: 'BANK-CHARGE-APR23', description: 'Bank service charge', signedAmount: -185, note: 'Bank-only charge' })
addBank({ day: 24, ref: 'INTEREST-APR24', description: 'Interest credit', signedAmount: 94.5, note: 'Bank-only interest' })
mapRef('', 'BANK-CHARGE-APR23', 'Bank-only', 'Charge absent in cash book')
mapRef('', 'INTEREST-APR24', 'Bank-only', 'Interest absent in cash book')

addCash({ day: 25, ref: 'PYMT-REV-5102', narration: 'Erroneous transfer to reverse', amount: -3600, note: 'Reversal expected' })
addCash({ day: 26, ref: 'PYMT-REV-5102-R', narration: 'Reversal posted in cash book', amount: 3600, note: 'Reversal pair' })
addBank({ day: 25, ref: 'TRF-5102-OUT', description: 'Online transfer out', signedAmount: -3600, note: 'Reversal pair' })
addBank({ day: 27, ref: 'TRF-5102-IN', description: 'Transfer reversal in', signedAmount: 3600, note: 'Reversal pair' })
mapRef('PYMT-REV-5102', 'TRF-5102-OUT', 'Matched', 'Reversal leg 1')
mapRef('PYMT-REV-5102-R', 'TRF-5102-IN', 'Matched', 'Reversal leg 2')

addCash({ day: 27, ref: 'RCPT-DUP-7731', narration: 'Customer payment ref 7731', amount: 2500, note: 'Duplicate amount case' })
addCash({ day: 28, ref: 'RCPT-DUP-7732', narration: 'Customer payment ref 7732', amount: 2500, note: 'Duplicate amount case' })
addBank({ day: 28, ref: 'CUST-7732', description: 'Credit received', signedAmount: 2500 })
addBank({ day: 29, ref: 'CUST-7731', description: 'Credit received delayed', signedAmount: 2500 })
mapRef('RCPT-DUP-7731', 'CUST-7731', 'Matched', 'Out-of-order posting')
mapRef('RCPT-DUP-7732', 'CUST-7732', 'Matched', 'Out-of-order posting')

addCash({ day: 29, ref: 'PYMT-APR-VOID111', chqNo: '1111', narration: 'Void cheque not presented', amount: -1450, note: 'Remains outstanding' })
mapRef('PYMT-APR-VOID111', '', 'Unpresented cheque', 'Void cheque still in cash book')

// Helpers
function toAoa(rows, columns) {
  return [columns, ...rows.map((r) => columns.map((c) => r[c]))]
}

function writeXlsx(filePath, sheets) {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(toAoa(s.rows, s.columns))
    XLSX.utils.book_append_sheet(wb, ws, s.name)
  }
  XLSX.writeFile(wb, filePath)
}

function writeTablePdf(filePath, title, subtitle, columns, rows) {
  const doc = new PDFDocument({ size: 'A4', margin: 28 })
  const stream = fs.createWriteStream(filePath)
  doc.pipe(stream)

  const colWidths = columns.map((c) => c.width)
  const colStarts = []
  let x = 28
  for (const w of colWidths) {
    colStarts.push(x)
    x += w
  }

  function header() {
    doc.fontSize(14).font('Helvetica-Bold').text(title)
    doc.moveDown(0.25)
    doc.fontSize(9).font('Helvetica').fillColor('#444').text(subtitle)
    doc.fillColor('#000')
    doc.moveDown(0.5)
    doc.fontSize(7).font('Helvetica-Bold')
    for (let i = 0; i < columns.length; i++) doc.text(columns[i].label, colStarts[i], doc.y, { width: colWidths[i] - 2 })
    doc.moveDown(0.6)
    doc.strokeColor('#D0D7DE').moveTo(28, doc.y).lineTo(565, doc.y).stroke()
    doc.moveDown(0.3)
    doc.font('Helvetica').fontSize(7)
  }

  header()
  for (const row of rows) {
    if (doc.y > 790) {
      doc.addPage()
      header()
    }
    for (let i = 0; i < columns.length; i++) {
      const key = columns[i].key
      const raw = row[key]
      const value = typeof raw === 'number' ? raw.toFixed(2) : String(raw ?? '')
      doc.text(value, colStarts[i], doc.y, { width: colWidths[i] - 2, ellipsis: true })
    }
    doc.moveDown(0.15)
  }
  doc.end()
  return new Promise((resolve) => stream.on('finish', resolve))
}

async function pdfToPngPages(pdfPath, prefix) {
  const buf = fs.readFileSync(pdfPath)
  const doc = await pdfToImg(buf, { scale: 2 })
  const total = Math.min(doc.length, 3)
  for (let i = 0; i < total; i++) {
    const page = await doc.getPage(i + 1)
    fs.writeFileSync(path.join(outputDir, `${prefix}_page${i + 1}.png`), page)
  }
}

const cashClosing = Number(cashBal.toFixed(2))
const bankClosing = Number(bankBal.toFixed(2))
const uncreditedTotal = references.filter((r) => r.status === 'Uncredited lodgement').reduce((s, r) => {
  const row = cashRows.find((c) => c.RefDocNo === r.cashRef)
  return s + (row?.AmountSigned || 0)
}, 0)
const unpresentedTotal = references.filter((r) => r.status === 'Unpresented cheque').reduce((s, r) => {
  const row = cashRows.find((c) => c.RefDocNo === r.cashRef)
  return s + Math.abs(row?.AmountSigned || 0)
}, 0)
const bankOnlyCharge = bankRows.filter((r) => String(r.Reference).includes('BANK-CHARGE')).reduce((s, r) => s + Math.abs(r.SignedAmount), 0)
const bankOnlyInterest = bankRows.filter((r) => String(r.Reference).includes('INTEREST')).reduce((s, r) => s + r.SignedAmount, 0)

const cashXlsx = path.join(outputDir, 'cash_book_complex.xlsx')
const bankXlsx = path.join(outputDir, 'bank_statement_complex.xlsx')
const manualXlsx = path.join(outputDir, 'manual_reconciliation_reference.xlsx')
const cashPdf = path.join(outputDir, 'cash_book_complex.pdf')
const bankPdf = path.join(outputDir, 'bank_statement_complex.pdf')
const readme = path.join(outputDir, 'README_TEST_PACK.md')

writeXlsx(cashXlsx, [
  { name: 'CashBook', columns: ['Date', 'RefDocNo', 'ChqNo', 'Narration', 'AmountSigned', 'Receipt', 'Payment', 'RunningBalance', 'Note'], rows: cashRows },
])

writeXlsx(bankXlsx, [
  { name: 'BankStatement', columns: ['Date', 'ValueDate', 'Reference', 'Description', 'Debit', 'Credit', 'SignedAmount', 'RunningBalance', 'Note'], rows: bankRows },
])

const summaryRows = [
  { Metric: 'Opening cash book balance', Value: openingCash },
  { Metric: 'Opening bank balance', Value: openingBank },
  { Metric: 'Closing cash book balance', Value: cashClosing },
  { Metric: 'Closing bank statement balance', Value: bankClosing },
  { Metric: 'Total uncredited lodgements (cash only receipts)', Value: Number(uncreditedTotal.toFixed(2)) },
  { Metric: 'Total unpresented cheques (cash only payments)', Value: Number(unpresentedTotal.toFixed(2)) },
  { Metric: 'Bank-only charges', Value: Number(bankOnlyCharge.toFixed(2)) },
  { Metric: 'Bank-only interest', Value: Number(bankOnlyInterest.toFixed(2)) },
  { Metric: 'Expected adjusted bank (bank + uncredited - unpresented)', Value: Number((bankClosing + uncreditedTotal - unpresentedTotal).toFixed(2)) },
]

writeXlsx(manualXlsx, [
  { name: 'ReferenceMap', columns: ['cashRef', 'bankRef', 'status', 'comment'], rows: references },
  { name: 'Summary', columns: ['Metric', 'Value'], rows: summaryRows },
  { name: 'CashExtract', columns: ['Date', 'RefDocNo', 'AmountSigned', 'RunningBalance', 'Note'], rows: cashRows },
  { name: 'BankExtract', columns: ['Date', 'Reference', 'SignedAmount', 'RunningBalance', 'Note'], rows: bankRows },
])

await writeTablePdf(
  cashPdf,
  'KQ-SOFT Complex Cash Book Test Data (April 2026)',
  `Opening balance: ${openingCash.toFixed(2)} | Closing balance: ${cashClosing.toFixed(2)} | Rows: ${cashRows.length}`,
  [
    { key: 'Date', label: 'Date', width: 55 },
    { key: 'RefDocNo', label: 'Ref', width: 86 },
    { key: 'ChqNo', label: 'Chq', width: 34 },
    { key: 'Narration', label: 'Narration', width: 170 },
    { key: 'AmountSigned', label: 'Signed', width: 58 },
    { key: 'RunningBalance', label: 'Balance', width: 62 },
    { key: 'Note', label: 'Note', width: 90 },
  ],
  cashRows
)

await writeTablePdf(
  bankPdf,
  'KQ-SOFT Complex Bank Statement Test Data (April 2026)',
  `Opening balance: ${openingBank.toFixed(2)} | Closing balance: ${bankClosing.toFixed(2)} | Rows: ${bankRows.length}`,
  [
    { key: 'Date', label: 'Date', width: 52 },
    { key: 'ValueDate', label: 'Value', width: 52 },
    { key: 'Reference', label: 'Reference', width: 92 },
    { key: 'Description', label: 'Description', width: 160 },
    { key: 'SignedAmount', label: 'Signed', width: 58 },
    { key: 'RunningBalance', label: 'Balance', width: 62 },
    { key: 'Note', label: 'Note', width: 89 },
  ],
  bankRows
)

await pdfToPngPages(cashPdf, 'cash_book_complex')
await pdfToPngPages(bankPdf, 'bank_statement_complex')

const readmeText = `# Complex Import Pack (KQ-SOFT)

This folder contains a high-complexity import dataset for reconciliation testing.

## Files
- \`cash_book_complex.xlsx\`
- \`bank_statement_complex.xlsx\`
- \`cash_book_complex.pdf\`
- \`bank_statement_complex.pdf\`
- \`cash_book_complex_page1.png\` (and page2/page3)
- \`bank_statement_complex_page1.png\` (and page2/page3)
- \`manual_reconciliation_reference.xlsx\`

## Complexity Included
- Mixed signed amounts (single signed column + debit/credit breakout)
- Date posting lags and value-date differences
- Narration/reference variants (\`CHQ 1055\` vs \`CHQ#1055\`)
- One-to-many combined deposit
- Unpresented cheques
- Uncredited lodgement
- Bank-only charges and interest
- Reversal pair in both books
- Duplicate-amount transactions with different references

## Quick Manual Checks
- Opening cash balance: ${openingCash.toFixed(2)}
- Closing cash balance: ${cashClosing.toFixed(2)}
- Opening bank balance: ${openingBank.toFixed(2)}
- Closing bank balance: ${bankClosing.toFixed(2)}
- Uncredited lodgements total: ${uncreditedTotal.toFixed(2)}
- Unpresented cheques total: ${unpresentedTotal.toFixed(2)}
- Bank-only charges: ${bankOnlyCharge.toFixed(2)}
- Bank-only interest: ${bankOnlyInterest.toFixed(2)}
- Adjusted bank (bank + uncredited - unpresented): ${(bankClosing + uncreditedTotal - unpresentedTotal).toFixed(2)}

Use \`manual_reconciliation_reference.xlsx\` for exact mapping and expected statuses.
`

fs.writeFileSync(readme, readmeText, 'utf8')

console.log('Generated complex import pack at:', outputDir)
