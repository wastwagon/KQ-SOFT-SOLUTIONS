#!/usr/bin/env node
/**
 * Export platform BRS workbook for acct002 and compare with manual files.
 * Usage: API_URL=http://localhost:9101 node scripts/compare-acct002-export.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('../api/node_modules/xlsx')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA = path.join(ROOT, 'testdataandresultsforacct002')
const OUT = path.join(DATA, 'platform-export-acct002.xlsx')

const API = process.env.API_URL || 'http://localhost:9101'
const SLUG = process.env.BRS_ACCT002_SLUG || 'grace-baptist-academy-ecobank-acct-2-aug-2018'
const EMAIL = process.env.BRS_TEST_EMAIL || 'premium@test.com'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'

function readSheetRows(filePath, sheetName) {
  const wb = XLSX.readFile(filePath)
  const name = sheetName || wb.SheetNames[0]
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })
}

function numericCells(rows) {
  const out = []
  for (const row of rows) {
    for (const cell of row) {
      const n = typeof cell === 'number' ? cell : parseFloat(String(cell).replace(/,/g, ''))
      if (!Number.isNaN(n) && Math.abs(n) > 0.001) out.push(Math.round(n * 100) / 100)
    }
  }
  return [...new Set(out)].sort((a, b) => a - b)
}

async function main() {
  const login = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!login.ok) throw new Error(`Login failed: ${login.status}`)
  const { token } = await login.json()

  const url = `${API}/api/v1/report/${SLUG}/export?format=excel&workbookNetting=1`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Export failed: ${res.status} ${t.slice(0, 200)}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(OUT, buf)
  console.log('Saved platform export:', OUT)

  const manualBrs = readSheetRows(path.join(DATA, 'brs acct 2.xlsx'))
  const platformWb = XLSX.read(buf)
  console.log('\nPlatform workbook sheets:', platformWb.SheetNames.join(', '))

  const brsSheet =
    platformWb.SheetNames.find((n) => /brs/i.test(n)) || platformWb.SheetNames[0]
  const platformBrs = XLSX.utils.sheet_to_json(platformWb.Sheets[brsSheet], { header: 1, defval: '' })

  console.log(`\n--- Manual BRS (${path.basename('brs acct 2.xlsx')}) ---`)
  manualBrs.forEach((r, i) => {
    if (r.some((c) => c !== '' && c != null)) console.log(`  ${i}: ${JSON.stringify(r)}`)
  })

  console.log(`\n--- Platform BRS sheet: ${brsSheet} (first 25 non-empty rows) ---`)
  let shown = 0
  for (let i = 0; i < platformBrs.length && shown < 25; i++) {
    const r = platformBrs[i]
    if (!r.some((c) => c !== '' && c != null)) continue
    console.log(`  ${i}: ${JSON.stringify(r.slice(0, 6))}`)
    shown++
  }

  const manualNums = numericCells(manualBrs)
  const platformNums = numericCells(platformBrs)
  console.log('\n--- Key amounts ---')
  console.log('  Manual amounts found:', manualNums.join(', ') || '(none)')
  console.log('  Platform BRS amounts (sample):', platformNums.filter((n) => n === 490.74 || n < 10000).slice(0, 20).join(', '))

  const manualClosing = manualNums.filter((n) => Math.abs(n - 490.74) < 0.02)
  const platformClosing = platformNums.filter((n) => Math.abs(n - 490.74) < 0.02)
  console.log(
    `\n  ${manualClosing.length ? '✓' : '✗'} Manual shows 490.74: ${manualClosing.length} occurrence(s)`
  )
  console.log(
    `  ${platformClosing.length ? '✓' : '✗'} Platform BRS shows 490.74: ${platformClosing.length} occurrence(s)`
  )

  const report = await fetch(`${API}/api/v1/report/${SLUG}?workbookNetting=1`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())

  console.log('\n--- Match detail (platform) ---')
  console.log('  Matched pairs:', report.summary?.matchedCount)
  console.log('  Receipts↔credits:', report.summary?.matchedReceiptsCreditsCount)
  console.log('  Payments↔debits:', report.summary?.matchedPaymentsDebitsCount)
  console.log('  Unmatched (all lanes):', [
    report.summary?.unmatchedReceipts,
    report.summary?.unmatchedPayments,
    report.summary?.unmatchedCredits,
    report.summary?.unmatchedDebits,
  ].join(' / '))

  if (report.matches?.length) {
    console.log('\n--- Sample matched pairs (first 5) ---')
    for (const m of report.matches.slice(0, 5)) {
      const cb = m.cashBookTransaction || m.cashBookTx
      const bank = m.bankTransaction || m.bankTx
      console.log(
        `  ${cb?.date?.slice?.(0, 10) || '?'} | CB ${cb?.amount} | Bank ${bank?.amount} | ${(cb?.details || bank?.description || '').slice(0, 50)}`
      )
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
