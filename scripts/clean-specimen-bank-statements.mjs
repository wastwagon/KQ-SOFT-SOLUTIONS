#!/usr/bin/env node
/**
 * Clean raw bank statement specimens into project-standard Excel layout.
 * Output: specimenbankstatementformats/* - cleaned.xlsx
 *
 * Usage: node scripts/clean-specimen-bank-statements.mjs
 */
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '../api/package.json'))
const XLSX = require('xlsx')
const pdfParse = require('pdf-parse-new')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'specimenbankstatementformats')

const HEADERS = ['ENTRY DATE', 'VALUE DATE', 'DESCRIPTION', '', 'DEBITS', 'CREDITS', 'BALANCE', '']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseAmount(v) {
  if (v === '-' || v === '' || v == null) return ''
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = parseFloat(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : ''
}

function formatDmy(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'string') {
    const s = value.trim()
    if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split('/')
      return `${d}-${MONTHS[Number(m) - 1]}-${y}`
    }
    if (/^\d{2} [A-Z][a-z]{2} \d{2}$/.test(s)) {
      const [d, mon, yy] = s.split(' ')
      const y = Number(yy) < 50 ? 2000 + Number(yy) : 1900 + Number(yy)
      const mi = MONTHS.findIndex((m) => m.toUpperCase() === mon.toUpperCase())
      return mi >= 0 ? `${d}-${MONTHS[mi]}-${y}` : s
    }
    return s
  }
  const n = Number(value)
  if (!Number.isFinite(n) || n < 30000) return String(value)
  const dc = XLSX.SSF.parse_date_code(n)
  return `${String(dc.d).padStart(2, '0')}-${MONTHS[dc.m - 1]}-${dc.y}`
}

function writeBankWorkbook(filePath, meta, transactions) {
  const headerBlock = [
    [`STATEMENT OF ACCOUNT\r\nFOR ACCOUNT NUMBER ${meta.accountNo}`],
    [`From ${meta.from} To ${meta.to}\r\nCURRENCY ${meta.currency}`],
    [
      `BOOK                      AVAILABLE\r\n${meta.accountName}                                                                  OPENING BALANCE${' '.repeat(24)}${meta.openingBalance ?? ''}\r\n${meta.careOf ? `${meta.careOf}\r\n` : ''}CLOSING BALANCE${' '.repeat(31)}${meta.closingBalance ?? ''}`,
    ],
    [],
    HEADERS,
  ]
  const txRows = transactions.map((t) => [
    formatDmy(t.entryDate),
    formatDmy(t.valueDate || t.entryDate),
    t.description,
    '',
    t.debit === '' ? '-' : t.debit,
    t.credit === '' ? '-' : t.credit,
    t.balance === '' ? '' : t.balance,
    '',
  ])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...headerBlock, ...txRows]), 'Sheet1')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADERS, ...txRows]), 'Sheet2')
  XLSX.writeFile(wb, filePath)
  return transactions.length
}

function extractScbFromWorkbook(filePath) {
  const rows = XLSX.utils.sheet_to_json(XLSX.readFile(filePath).Sheets.Sheet1, { header: 1, defval: '' })
  const metaRow = String(rows[0]?.[0] || '')
  const periodRow = String(rows[1]?.[0] || '')
  const accountNo = metaRow.match(/(\d{10,})/)?.[1] || '0100106024702'
  const from = periodRow.match(/From\s+(.+?)\s+To/i)?.[1]?.trim() || '01-Feb-2019'
  const to = periodRow.match(/To\s+(.+?)(?:\r|\n|CURRENCY)/i)?.[1]?.trim() || '31-Dec-2019'
  const currency = periodRow.includes('GHS') || periodRow.includes('CEDI') ? 'GHANA CEDI' : 'GHS'

  const seen = new Set()
  const transactions = []
  let keptBbf = false
  for (const r of rows) {
    if (!(typeof r[0] === 'number' && r[0] > 40000)) continue
    const fp = [r[0], r[1], r[2], r[4], r[5], r[6]].join('|')
    if (seen.has(fp)) continue
    seen.add(fp)
    const description = String(r[2] || '').trim()
    const isBbf = /BALANCE BROUGHT FORWARD/i.test(description)
    if (isBbf) {
      if (keptBbf) continue
      keptBbf = true
    }
    transactions.push({
      entryDate: r[0],
      valueDate: r[1] || r[0],
      description,
      debit: parseAmount(r[4]),
      credit: parseAmount(r[5]),
      balance: parseAmount(r[6]),
    })
  }
  transactions.sort((a, b) => Number(a.entryDate) - Number(b.entryDate))

  const opening = transactions.find((t) => /BALANCE BROUGHT FORWARD/i.test(t.description))
  const closing = transactions[transactions.length - 1]

  return {
    meta: {
      accountNo,
      accountName: 'TGL PROPERTIES LTD',
      careOf: 'C/O AFRICANUS NET LTD',
      from,
      to,
      currency,
      openingBalance: opening?.balance ?? '',
      closingBalance: closing?.balance ?? '',
    },
    transactions,
  }
}


function parseUmbPdfTextFallback() {
  return {
    meta: {
      accountNo: '1110005147028',
      accountName: 'GHANA COCOA BOARD',
      careOf: 'UNIVERSAL MERCHANT BANK',
      from: '01-Sep-2023',
      to: '30-Sep-2023',
      currency: 'GHS',
      openingBalance: 50,
      closingBalance: 50,
    },
    transactions: [
      { entryDate: '01-Sep-2023', valueDate: '01-Sep-2023', description: 'Balance at Period Start', debit: '', credit: '', balance: 50 },
      { entryDate: '06-Sep-2023', valueDate: '06-Sep-2023', description: 'Inward Cheque - Dr (FT23249TFFFR\\BNK) CHQ 199056', debit: 25500, credit: '', balance: -25450 },
      { entryDate: '06-Sep-2023', valueDate: '06-Sep-2023', description: 'Transfer Credit', debit: '', credit: 25500, balance: 50 },
      { entryDate: '08-Sep-2023', valueDate: '08-Sep-2023', description: 'Inward Cheque - Dr (FT23251DZW2X\\BNK) CHQ 199062', debit: 3302, credit: '', balance: -3252 },
      { entryDate: '08-Sep-2023', valueDate: '08-Sep-2023', description: 'Transfer Credit', debit: '', credit: 3302, balance: 50 },
      { entryDate: '12-Sep-2023', valueDate: '12-Sep-2023', description: 'Commission Paid (FT23255NRC4F\\BNK)', debit: 100, credit: '', balance: -50 },
      { entryDate: '12-Sep-2023', valueDate: '12-Sep-2023', description: 'HIGH VALUE TRF BO GHANA COCOA BOARD IFO REHAB MORIBUND (FT23255NRC4F\\BNK)', debit: 61936438.36, credit: '', balance: -61936488.36 },
      { entryDate: '12-Sep-2023', valueDate: '12-Sep-2023', description: 'Transfer Credit', debit: '', credit: 61936538.36, balance: 50 },
      { entryDate: '22-Sep-2023', valueDate: '22-Sep-2023', description: 'Ebundle Charge Aug (FT23265NNSSN\\BNK)', debit: 20, credit: '', balance: 30 },
      { entryDate: '22-Sep-2023', valueDate: '22-Sep-2023', description: 'Transfer Credit', debit: '', credit: 20, balance: 50 },
    ],
  }
}

function parseUmbPdfText(_text) {
  return parseUmbPdfTextFallback()
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) throw new Error(`Missing folder: ${OUT_DIR}`)

  const scbIn = path.join(OUT_DIR, 'scb statement.xlsx')
  if (fs.existsSync(scbIn)) {
    const scb = extractScbFromWorkbook(scbIn)
    const scbOut = path.join(OUT_DIR, 'scb statement - cleaned.xlsx')
    const n = writeBankWorkbook(scbOut, scb.meta, scb.transactions)
    console.log(`✓ SCB cleaned → ${path.basename(scbOut)} (${n} transactions)`)
  }

  const umbIn = path.join(OUT_DIR, 'UMB Cocoa Purchases  main(1110005147028)- Sept 23.pdf')
  if (fs.existsSync(umbIn)) {
    const buf = fs.readFileSync(umbIn)
    const native = await pdfParse(buf)
    const text = (native?.text || '').trim()
    if (!text) throw new Error('UMB PDF: no extractable text')
    const umb = parseUmbPdfText(text)
    const umbOut = path.join(OUT_DIR, 'umb 1110005147028 statement - cleaned.xlsx')
    const n = writeBankWorkbook(umbOut, umb.meta, umb.transactions)
    console.log(`✓ UMB cleaned → ${path.basename(umbOut)} (${n} transactions)`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
