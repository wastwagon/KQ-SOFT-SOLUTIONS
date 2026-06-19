#!/usr/bin/env node
/**
 * Export platform BRS workbook for acct430 and compare with manual files.
 * Usage: API_URL=http://localhost:9101 node scripts/compare-acct430-export.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('../api/node_modules/xlsx')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA = path.join(ROOT, 'testofacct430')
const OUT = path.join(DATA, 'platform-export-acct430.xlsx')

const API = process.env.API_URL || 'http://localhost:9101'
const SLUG = process.env.BRS_ACCT430_SLUG || 'tgl-gt-bank-eur-430-dec-2018'
const EMAIL = process.env.BRS_TEST_EMAIL || 'premium@test.com'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'

const MANUAL = {
  bankClosing: 83.72,
  cashBookBalance: 8977.46,
  uncredited: 8148.38,
  unpresented: 3244.63,
  bankOnlyDebits: 4209.99,
  bankOnlyCredits: 220,
}

function readSheetRows(filePath, sheetName) {
  const wb = XLSX.readFile(filePath)
  const name = sheetName || wb.SheetNames[0]
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })
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

  const manualBrs = readSheetRows(path.join(DATA, 'acct430 brs.xlsx'))
  const platformWb = XLSX.read(buf)
  console.log('\nPlatform workbook sheets:', platformWb.SheetNames.join(', '))

  const report = await fetch(`${API}/api/v1/report/${SLUG}?workbookNetting=1`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())

  const brs = report.brsStatement || {}
  console.log('\n--- BRS line comparison ---')
  const lines = [
    ['Bank closing', MANUAL.bankClosing, brs.bankClosingBalance],
    ['Cash book', MANUAL.cashBookBalance, brs.balancePerCashBook],
    ['Uncredited timing', MANUAL.uncredited, brs.uncreditedLodgmentsTimingTotal],
    ['Unpresented cheques', MANUAL.unpresented, brs.unpresentedChequesTotal],
    ['Bank-only debits', MANUAL.bankOnlyDebits, brs.bankOnlyDebitsNotInCashBookTotal],
    ['Bank-only credits', MANUAL.bankOnlyCredits, brs.bankOnlyCreditsNotInCashBookTotal],
  ]
  let ok = true
  for (const [label, manual, platform] of lines) {
    const pass = Math.abs((platform ?? 0) - manual) < 0.02
    if (!pass) ok = false
    console.log(`  ${pass ? '✓' : '✗'} ${label}: manual=${manual} platform=${platform ?? '?'}`)
  }

  console.log('\n--- Manual BRS excerpt (first 20 non-empty rows) ---')
  let shown = 0
  for (let i = 0; i < manualBrs.length && shown < 20; i++) {
    const r = manualBrs[i]
    if (!r.some((c) => c !== '' && c != null)) continue
    console.log(`  ${i}: ${JSON.stringify(r.slice(0, 7))}`)
    shown++
  }

  console.log('\n--- Match detail (platform) ---')
  console.log('  Matched pairs:', report.summary?.matchedCount)
  console.log(
    '  Unmatched (R/P/C/D):',
    [
      report.summary?.unmatchedReceipts,
      report.summary?.unmatchedPayments,
      report.summary?.unmatchedCredits,
      report.summary?.unmatchedDebits,
    ].join(' / ')
  )
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
