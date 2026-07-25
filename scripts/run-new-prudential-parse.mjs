#!/usr/bin/env node
/**
 * Parse PDFs in "New Prudential /" with the app's bank PDF parser and write Excel + summary.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DIR = path.join(ROOT, 'New Prudential ')
const OUT = path.join(DIR, 'parsed-output')

const require = createRequire(path.join(ROOT, 'api/package.json'))
const XLSX = require('xlsx')

const { parseBankPdf } = await import('../api/src/services/documentParse.ts')
const { buildSuggestedMappingForDocument, canAutoMap } = await import(
  '../api/src/services/autoMapDocument.ts'
)
const { resolveDetectedBankFormat } = await import('../api/src/services/ghanaBankParsers.ts')

function money(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function parseOne(file) {
  const src = path.join(DIR, file)
  console.log('\n' + '='.repeat(72))
  console.log('FILE:', file)
  console.log('='.repeat(72))

  const t0 = Date.now()
  const result = await parseBankPdf(src)
  const ms = Date.now() - t0

  const debitCol = result.headers.findIndex((h) => /^debit/i.test(String(h)))
  const creditCol = result.headers.findIndex((h) => /^credit/i.test(String(h)))
  const balCol = result.headers.findIndex((h) => /^balance/i.test(String(h)))
  const descCol = result.headers.findIndex((h) => /desc/i.test(String(h)))
  const dateCol = result.headers.findIndex((h) => /transaction.?date/i.test(String(h)))

  const sumDebit = result.rows.reduce((s, r) => s + (Number(r[debitCol]) || 0), 0)
  const sumCredit = result.rows.reduce((s, r) => s + (Number(r[creditCol]) || 0), 0)
  const debitRows = result.rows.filter((r) => Number(r[debitCol]) > 0).length
  const creditRows = result.rows.filter((r) => Number(r[creditCol]) > 0).length
  const both = result.rows.filter((r) => Number(r[debitCol]) > 0 && Number(r[creditCol]) > 0).length
  const neither = result.rows.filter(
    (r) => !(Number(r[debitCol]) > 0) && !(Number(r[creditCol]) > 0)
  ).length

  const crMap = buildSuggestedMappingForDocument('bank_credits', result.headers, 'prudential')
  const drMap = buildSuggestedMappingForDocument('bank_debits', result.headers, 'prudential')
  const bankFormat = resolveDetectedBankFormat(
    result.headers,
    result.rows.slice(0, 5),
    result.parseMethod
  )

  console.log('parseMethod:', result.parseMethod)
  console.log('parseQualityScore:', result.parseQualityScore)
  console.log('headers:', result.headers.join(' | '))
  console.log('rows:', result.rows.length, `(${ms}ms)`)
  console.log(
    `debit rows: ${debitRows}  credit rows: ${creditRows}  both: ${both}  neither: ${neither}`
  )
  console.log('sumDebit:', money(sumDebit))
  console.log('sumCredit:', money(sumCredit))
  console.log('bankFormat:', bankFormat)
  console.log('canAutoMap credits:', canAutoMap('bank_credits', result.headers, crMap))
  console.log('canAutoMap debits:', canAutoMap('bank_debits', result.headers, drMap))
  if (result.rows.length) {
    console.log('first balance:', result.rows[0][balCol])
    console.log('last balance:', result.rows[result.rows.length - 1][balCol])
  }

  const dates = result.rows.map((r) => String(r[dateCol] || '')).filter(Boolean).sort()
  if (dates.length) console.log('date range:', dates[0], '→', dates[dates.length - 1])

  const printRow = (r) => {
    const d = r[dateCol]
    const desc = String(r[descCol] || '').slice(0, 55).padEnd(55)
    const dr = r[debitCol] != null && Number(r[debitCol]) > 0 ? money(r[debitCol]).padStart(14) : ''.padStart(14)
    const cr =
      r[creditCol] != null && Number(r[creditCol]) > 0 ? money(r[creditCol]).padStart(14) : ''.padStart(14)
    const bal = r[balCol] != null ? money(r[balCol]).padStart(16) : ''.padStart(16)
    console.log(`${d} | ${desc} | Dr ${dr} | Cr ${cr} | Bal ${bal}`)
  }

  console.log('\n--- First 15 transactions ---')
  result.rows.slice(0, 15).forEach(printRow)
  console.log('\n--- Last 10 transactions ---')
  result.rows.slice(-10).forEach(printRow)

  const byCredit = [...result.rows]
    .filter((r) => Number(r[creditCol]) > 0)
    .sort((a, b) => Number(b[creditCol]) - Number(a[creditCol]))
    .slice(0, 5)
  const byDebit = [...result.rows]
    .filter((r) => Number(r[debitCol]) > 0)
    .sort((a, b) => Number(b[debitCol]) - Number(a[debitCol]))
    .slice(0, 5)
  console.log('\n--- Top 5 credits ---')
  for (const r of byCredit) {
    console.log(`  ${r[dateCol]} ${String(r[descCol]).slice(0, 50)} = ${money(r[creditCol])}`)
  }
  console.log('--- Top 5 debits ---')
  for (const r of byDebit) {
    console.log(`  ${r[dateCol]} ${String(r[descCol]).slice(0, 50)} = ${money(r[debitCol])}`)
  }

  fs.mkdirSync(OUT, { recursive: true })
  const safe = file
    .replace(/\.pdf$/i, '')
    .replace(/[^\w.\-()\[\]]+/g, '_')
    .slice(0, 80)
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([result.headers, ...result.rows])
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions')
  const outPath = path.join(OUT, `${safe}-parsed.xlsx`)
  XLSX.writeFile(wb, outPath)
  console.log('\nWrote:', path.relative(ROOT, outPath))

  const summary = {
    file,
    parseMethod: result.parseMethod,
    parseQualityScore: result.parseQualityScore,
    headers: result.headers,
    rowCount: result.rows.length,
    debitRows,
    creditRows,
    both,
    neither,
    sumDebit,
    sumCredit,
    bankFormat,
    canAutoMapCredits: canAutoMap('bank_credits', result.headers, crMap),
    canAutoMapDebits: canAutoMap('bank_debits', result.headers, drMap),
    firstBalance: result.rows[0]?.[balCol] ?? null,
    lastBalance: result.rows[result.rows.length - 1]?.[balCol] ?? null,
    dateRange: dates.length ? [dates[0], dates[dates.length - 1]] : null,
    ms,
  }
  fs.writeFileSync(path.join(OUT, `${safe}-summary.json`), JSON.stringify(summary, null, 2))
  return summary
}

async function main() {
  if (!fs.existsSync(DIR)) {
    throw new Error(`Missing folder: ${DIR}`)
  }
  const files = fs
    .readdirSync(DIR)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .sort()
  console.log('=== New Prudential PDF parse test ===')
  console.log('Folder:', DIR)
  console.log('Found PDFs:', files)
  if (!files.length) throw new Error('No PDFs found')

  const summaries = []
  for (const file of files) {
    summaries.push(await parseOne(file))
  }

  console.log('\n' + '='.repeat(72))
  console.log('SUMMARY')
  console.log('='.repeat(72))
  for (const s of summaries) {
    console.log(
      `${s.file}\n  method=${s.parseMethod} rows=${s.rowCount} Dr=${money(s.sumDebit)} Cr=${money(s.sumCredit)} autoMap=${s.canAutoMapCredits && s.canAutoMapDebits}`
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
