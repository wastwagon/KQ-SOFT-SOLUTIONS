#!/usr/bin/env node
/**
 * End-to-end test: accountno552records → Premium project → compare with manual BRS (Ecobank 9033).
 * Usage: API_URL=http://localhost:9011 node scripts/run-accountno552-test.mjs
 */
import {
  DATA,
  MANUAL_Q1 as MANUAL,
  api,
  ensureQ1Project,
  login,
} from './lib/ecobank-9033-q1-setup.mjs'

// Workbook Groups 2–3 netting is opt-in; required for Account901 unpresented alignment.
process.env.GHANA_BRS_WORKBOOK_NETTING = process.env.GHANA_BRS_WORKBOOK_NETTING || '1'

const API = process.env.API_URL || 'http://localhost:9011'
const EMAIL = process.env.BRS_TEST_EMAIL || 'premium@test.com'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'

function diff(label, manual, platform) {
  const d = Math.round((platform - manual) * 100) / 100
  const ok = Math.abs(d) < 0.02
  console.log(`  ${ok ? '✓' : '✗'} ${label}: manual=${manual} platform=${platform} Δ=${d}`)
  return ok
}

async function main() {
  console.log('API:', API)
  console.log('Data:', DATA)
  console.log('Login:', EMAIL)

  const token = await login(API, EMAIL, PASSWORD)
  console.log('Login OK\n')

  const { project, totalMatched } = await ensureQ1Project(API, token)
  console.log('Using project:', project.name, `(${project.slug})`)
  console.log(`  Total bulk matched: ${totalMatched}`)

  const rec2 = await api(API, 'GET', `/reconcile/${project.slug}`, token)
  console.log(`\nAfter auto-match:`)
  console.log(`  Matched pairs: ${rec2.matchedCount ?? rec2.matches?.length ?? '?'}`)
  console.log(`  Unmatched receipts: ${rec2.unmatched?.receipts?.length ?? '?'}`)
  console.log(`  Unmatched payments: ${rec2.unmatched?.payments?.length ?? '?'}`)
  console.log(`  Unmatched credits: ${rec2.unmatched?.credits?.length ?? '?'}`)
  console.log(`  Unmatched debits: ${rec2.unmatched?.debits?.length ?? '?'}`)

  console.log('\nGenerating report (workbook netting:', process.env.GHANA_BRS_WORKBOOK_NETTING, ')...')
  const report = await api(API, 'GET', `/report/${project.slug}?workbookNetting=1`, token)
  if (report.reconcileProfile?.workbookNetting) {
    console.log('  Ecobank workbook netting: ON')
  }
  const brs = report.brsStatement || {}
  console.log('\n=== PLATFORM vs MANUAL BRS ===')
  const checks = [
    diff('Bank closing', MANUAL.bankClosing, brs.bankClosingBalance),
    diff('Cash book balance', MANUAL.cashBookBalance, brs.balancePerCashBook),
    diff('Uncredited lodgments (timing)', MANUAL.uncredited, brs.uncreditedLodgmentsTimingTotal),
    diff('Unpresented cheques', MANUAL.unpresented, brs.unpresentedChequesTotal),
    diff('Bank-only debits', MANUAL.bankOnlyDebits, brs.bankOnlyDebitsNotInCashBookTotal),
    diff('Bank-only credits', MANUAL.bankOnlyCredits, brs.bankOnlyCreditsNotInCashBookTotal),
  ]
  const tieOut = brs.workbookScheduleTieOutVariance
  const tieOutOk = Math.abs(tieOut ?? 0) < 0.02
  console.log(
    `  ${tieOutOk ? '✓' : 'ℹ'} Tie-out variance: ${tieOut} (schedule-derived cash book ${brs.workbookScheduleDerivedCashBook})`
  )
  console.log(`  ℹ Unpresented BRS rows: ${report.unpresentedChequesForBrs?.length ?? 0}`)
  console.log(`  ℹ Unmatched payments (raw): ${report.unmatchedPayments?.length ?? 0}`)
  console.log(
    `  ℹ Additional info unpresented: ${report.additionalInformation?.asAtReconciliationPosition?.unpresentedChequesOrUnclearedPayments}`
  )
  const matchedCount = report.summary?.matchedCount ?? totalMatched
  console.log(`  ℹ Matched pairs: ${matchedCount} (manual workbook ~${MANUAL.matchedPairs})`)
  console.log(`\nProject slug: ${project.slug}`)
  console.log(`Web UI: http://localhost:9101 (log in as ${EMAIL})`)
  const allOk = checks.every(Boolean)
  process.exit(allOk ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
