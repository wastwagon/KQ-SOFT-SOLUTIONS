#!/usr/bin/env node
/**
 * Export platform BRS workbook for acct4702 and compare with manual files.
 * Usage: API_URL=http://localhost:9101 node scripts/compare-acct4702-export.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('../api/node_modules/xlsx')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA = path.join(ROOT, 'testdataforacct4702')
const OUT = path.join(DATA, 'platform-export-acct4702.xlsx')

const API = process.env.API_URL || 'http://localhost:9101'
const SLUG = process.env.BRS_ACCT4702_SLUG || 'tgl-properties-scb-4702-dec-2019'
const EMAIL = process.env.BRS_TEST_EMAIL || 'premium@test.com'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'

const MANUAL_CLOSING = 540206.03

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

  const manualBrs = readSheetRows(path.join(DATA, 'acct 4702 brs.xlsx'))
  const platformWb = XLSX.read(buf)
  console.log('\nPlatform workbook sheets:', platformWb.SheetNames.join(', '))

  const brsSheet =
    platformWb.SheetNames.find((n) => /brs/i.test(n)) || platformWb.SheetNames[0]
  const platformBrs = XLSX.utils.sheet_to_json(platformWb.Sheets[brsSheet], { header: 1, defval: '' })

  console.log(`\n--- Manual BRS (${path.basename('acct 4702 brs.xlsx')}) ---`)
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
  console.log(
    '  Manual closing 540,206.03:',
    manualNums.filter((n) => Math.abs(n - MANUAL_CLOSING) < 0.02).length ? '✓' : '✗'
  )
  console.log(
    '  Platform closing 540,206.03:',
    platformNums.filter((n) => Math.abs(n - MANUAL_CLOSING) < 0.02).length ? '✓' : '✗'
  )

  const report = await fetch(`${API}/api/v1/report/${SLUG}?workbookNetting=1`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())

  const brs = report.brsStatement || {}
  console.log('\n--- BRS line comparison ---')
  const lines = [
    ['Bank closing', MANUAL_CLOSING, brs.bankClosingBalance],
    ['Cash book', MANUAL_CLOSING, brs.balancePerCashBook],
    ['Uncredited timing', 0, brs.uncreditedLodgmentsTimingTotal],
    ['Unpresented cheques', 0, brs.unpresentedChequesTotal],
    ['Bank-only debits', 0, brs.bankOnlyDebitsNotInCashBookTotal],
    ['Bank-only credits', 0, brs.bankOnlyCreditsNotInCashBookTotal],
  ]
  for (const [label, manual, platform] of lines) {
    const ok = Math.abs((platform ?? 0) - manual) < 0.02
    console.log(`  ${ok ? '✓' : '✗'} ${label}: manual=${manual} platform=${platform ?? '?'}`)
  }

  console.log('\n--- Match detail (platform) ---')
  console.log('  Matched pairs:', report.summary?.matchedCount)
  console.log('  Receipts↔credits:', report.summary?.matchedReceiptsCreditsCount)
  console.log('  Payments↔debits:', report.summary?.matchedPaymentsDebitsCount)
  console.log(
    '  Unmatched (R/P/C/D):',
    [
      report.summary?.unmatchedReceipts,
      report.summary?.unmatchedPayments,
      report.summary?.unmatchedCredits,
      report.summary?.unmatchedDebits,
    ].join(' / ')
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
