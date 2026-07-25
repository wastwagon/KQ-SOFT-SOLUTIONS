#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const require = createRequire(path.join(ROOT, 'api/package.json'))
const pdfParse = require('pdf-parse-new')
const XLSX = require('xlsx')

const { parseBankPdf } = await import('../api/src/services/documentParse.ts')
const { parsePrudentialPdfText } = await import('../api/src/services/prudentialStatement.ts')
const { parseImportedAmount } = await import('../api/src/services/amountParser.ts')

const DIR = path.join(ROOT, 'New Prudential ')
const files = [
  'Prudential bank(0091900180008)_sep 23[10235] (2).pdf',
  'Prudential bank(0091900183015)_sep 23[10240].pdf',
]

function money(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function inspect(name) {
  const pdfPath = path.join(DIR, name)
  const buf = fs.readFileSync(pdfPath)
  const data = await pdfParse(buf)
  const text = data.text
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const result = await parseBankPdf(pdfPath)
  const fromText = parsePrudentialPdfText(text)

  const amountLines = lines.filter((l) => {
    const core = l.replace(/DR$/i, '').trim()
    const amts = core.match(/[\d,]+\.\d{2}/g)
    return amts && amts.length >= 2 && l.length <= 90
  })

  const dCol = result.headers.findIndex((h) => /^debit$/i.test(h))
  const cCol = result.headers.findIndex((h) => /^credit$/i.test(h))
  const sumD = result.rows.reduce((s, r) => s + (Number(r[dCol]) || 0), 0)
  const sumC = result.rows.reduce((s, r) => s + (Number(r[cCol]) || 0), 0)

  // Opening balance is NOT a transaction — find it
  const opening = lines.find((l) => /balance brought|opening bal/i.test(l))
  const openingAmt = text.match(/01-SEP-23\s*([\d,]+\.\d{2})\s*DR/i)

  console.log('\n===' , name, '===')
  console.log('PDF pages:', data.numpages)
  console.log('Parsed rows:', result.rows.length, '| method:', result.parseMethod)
  console.log('parsePrudentialPdfText rows:', fromText.rows.length)
  console.log('Amount+balance lines in native PDF text:', amountLines.length)
  console.log('Delta amount-lines vs parsed rows:', amountLines.length - result.rows.length)
  console.log('Sum debit:', money(sumD), '| Sum credit:', money(sumC))
  console.log('Opening marker:', opening || '(none)')
  if (openingAmt) console.log('Opening bal (DR):', openingAmt[1], '(not counted as a txn)')

  // Footer totals if any
  for (const l of lines) {
    if (/total\s+(credits?|debits?)/i.test(l) || /^current bal/i.test(l) || /^closing/i.test(l) || /^avail/i.test(l)) {
      console.log('FOOTER:', l)
    }
  }

  // Tiny fee rows still present?
  const fees45 = result.rows.filter((r) => Number(r[dCol]) === 4.5).length
  console.log('Commission 4.50 debit rows kept:', fees45)

  // Descriptions truncated to 240 chars?
  const longDesc = result.rows.filter((r) => String(r[1] || '').length >= 240).length
  console.log('Descriptions hitting 240-char cap:', longDesc)

  // Sample amount lines that did NOT become rows? Compare count only —
  // if amountLines === rows (+ maybe opening glued line), we're complete.
  // Opening: "01-SEP-23265.00DR" is noise-filtered / not a txn amount line with 2 amounts in some cases
  const gluedOpening = lines.filter((l) => /^\d{2}-[A-Z]{3}-\d{2}[\d,]+\.\d{2}DR$/i.test(l))
  console.log('Opening glued date+bal DR lines (excluded as noise):', gluedOpening.length, gluedOpening.slice(0, 2))

  // Expected: amountLines should equal txn rows if opening isn't double-counted
  if (amountLines.length === result.rows.length) {
    console.log('COMPLETE: every amount line became a transaction row')
  } else if (amountLines.length === result.rows.length + 1 && gluedOpening.length) {
    console.log('COMPLETE: amount lines = rows + opening balance line')
  } else {
    console.log('CHECK: amount-line count differs from row count — possible drop')
  }
}

// Also compare Grace Academy reference workbook row counts if present
function checkGraceRef() {
  const receipts = path.join(ROOT, 'grace-academy-brs-as-at-3oth-sept-2023-bank-statement-receipts.xlsx')
  const payments = path.join(ROOT, 'grace-academy-brs-as-at-3oth-sept-2023-bank-statement-payments.xlsx')
  if (!fs.existsSync(receipts) || !fs.existsSync(payments)) return
  const r = XLSX.readFile(receipts)
  const p = XLSX.readFile(payments)
  const rRows = XLSX.utils.sheet_to_json(r.Sheets[r.SheetNames[0]], { header: 1 }).slice(1).filter((x) => x[0])
  const pRows = XLSX.utils.sheet_to_json(p.Sheets[p.SheetNames[0]], { header: 1 }).slice(1).filter((x) => x[0])
  console.log('\n=== Grace Academy manual BRS workbooks (reference, not source of truth) ===')
  console.log('Receipts workbook rows:', rRows.length)
  console.log('Payments workbook rows:', pRows.length)
  console.log('Manual combined ~', rRows.length + pRows.length, 'vs our 400 rows on account 180008')
  if (p.SheetNames.includes('Sheet1')) {
    const miss = XLSX.utils.sheet_to_json(p.Sheets.Sheet1, { header: 1 })
    console.log('Payments Sheet1 note (PDF rows missing from their excel):', miss[0]?.[1] || miss[0])
    console.log('Listed missing count (data rows):', miss.filter((x, i) => i > 2 && x[0]).length)
  }
}

for (const f of files) await inspect(f)
checkGraceRef()
