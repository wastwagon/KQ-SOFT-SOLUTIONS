#!/usr/bin/env node
/**
 * Delete acct430 project, recreate with cashbook.xlsx only, verify auto-map,
 * suggested mapping, reconcile profile UI flags, count-match, and report BRS.
 *
 * Usage: API_URL=http://localhost:9101 node scripts/verify-acct430-full.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA = fs.existsSync(path.join(ROOT, 'acct430', 'cashbook.xlsx'))
  ? path.join(ROOT, 'acct430')
  : path.join(ROOT, 'testofacct430')

const API = process.env.API_URL || 'http://localhost:9101'
const EMAIL = process.env.BRS_TEST_EMAIL || 'firm@test.com'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'
const PROJECT_NAME = process.env.BRS_ACCT430_PROJECT_NAME || 'TGL GT Bank EUR 430 (Dec 2018)'

const MANUAL = {
  bankClosing: 83.72,
  cashBookBalance: 8977.46,
  uncredited: 8148.38,
  unpresented: 3244.63,
  bankOnlyDebits: 4209.99,
  bankOnlyCredits: 220,
}

async function api(method, p, token, body) {
  const res = await fetch(`${API}/api/v1${p}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status}: ${json.error || text.slice(0, 300)}`)
  return json
}

async function uploadFile(token, projectId, route, filePath, fields) {
  const form = new FormData()
  form.append('file', new Blob([fs.readFileSync(filePath)]), path.basename(filePath))
  for (const [k, v] of Object.entries(fields)) form.append(k, v)
  const res = await fetch(`${API}/api/v1/upload/${route}/${projectId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Upload failed: ${json.error}`)
  return json
}

async function waitForParse(token, projectSlug, maxMs = 120_000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const proj = await api('GET', `/projects/${projectSlug}`, token)
    const docs = proj.documents || []
    const pending = docs.some((d) => d.parseStatus === 'pending' || d.parseStatus === 'processing')
    const failed = docs.filter((d) => d.parseStatus === 'failed')
    if (failed.length) throw new Error(`Parse failed: ${failed.map((d) => d.filename).join(', ')}`)
    if (docs.length >= 4 && !pending) return proj
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error('Parse timeout')
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`)
}

function diff(label, manual, platform) {
  const d = Math.round(((platform ?? 0) - (manual ?? 0)) * 100) / 100
  const ok = Math.abs(d) < 0.02
  console.log(`  ${ok ? '✓' : '✗'} ${label}: manual=${manual} platform=${platform} Δ=${d}`)
  return ok
}

async function main() {
  const cashFile = fs.existsSync(path.join(DATA, 'cashbook.xlsx')) ? 'cashbook.xlsx' : 'acct430 cash book.xlsx'
  const bankFile = 'acct430 bank statement.xlsx'
  for (const f of [cashFile, bankFile]) {
    assert(fs.existsSync(path.join(DATA, f)), `Missing ${f}`)
  }

  console.log('=== acct430 full verification ===')
  console.log('API:', API)
  console.log('Cash book:', cashFile)

  const { token } = await api('POST', '/auth/login', null, { email: EMAIL, password: PASSWORD })
  console.log('Login OK\n')

  const projectsRaw = await api('GET', '/projects', token)
  const projects = Array.isArray(projectsRaw) ? projectsRaw : projectsRaw.projects ?? []
  let project = projects.find((p) => p.name === PROJECT_NAME)

  if (project) {
    if (['completed', 'approved', 'submitted_for_review'].includes(project.status)) {
      try {
        await api('PATCH', `/projects/${project.slug}/reopen`, token)
      } catch {
        /* ignore */
      }
    }
    await api('DELETE', `/projects/${project.slug}`, token)
    console.log('Deleted project:', project.slug)
  }

  project = await api('POST', '/projects', token, {
    name: PROJECT_NAME,
    currency: 'EUR',
    reconciliationDate: '2018-12-31T00:00:00.000Z',
    primaryBankName: 'GT Bank',
    primaryAccountNo: '201/105646/430',
  })
  console.log('Created project:', project.slug)

  const cb = path.join(DATA, cashFile)
  const bank = path.join(DATA, bankFile)
  console.log('\nUploading files (auto-map on upload expected)...')
  await uploadFile(token, project.id, 'cash-book', cb, { type: 'receipts' })
  await uploadFile(token, project.id, 'cash-book', cb, { type: 'payments' })
  await uploadFile(token, project.id, 'bank-statement', bank, {
    type: 'credits',
    accountName: 'GT Bank EUR 201/105646/430',
    accountNo: '201/105646/430',
  })
  await uploadFile(token, project.id, 'bank-statement', bank, {
    type: 'debits',
    accountName: 'GT Bank EUR 201/105646/430',
    accountNo: '201/105646/430',
  })

  console.log('Waiting for auto-map parse jobs...')
  const proj = await waitForParse(token, project.slug)
  console.log('\n--- Document counts after auto-map ---')
  const counts = {}
  for (const doc of proj.documents || []) {
    const n = doc._count?.transactions ?? doc.transactionCount ?? '?'
    counts[doc.type] = n
    console.log(`  ${doc.type}: ${n} tx (${doc.parseStatusMessage || doc.parseStatus})`)
  }

  assert(counts.cash_book_receipts === 20, `Expected 20 receipts, got ${counts.cash_book_receipts}`)
  assert(counts.cash_book_payments === 9, `Expected 9 payments, got ${counts.cash_book_payments}`)
  assert(counts.bank_credits === 2, `Expected 2 bank credits, got ${counts.bank_credits}`)
  assert(counts.bank_debits === 8, `Expected 8 bank debits, got ${counts.bank_debits}`)

  const cashDoc = proj.documents.find((d) => d.type === 'cash_book_receipts')
  const preview = await api('GET', `/documents/${cashDoc.id}/preview`, token)
  console.log('\n--- Preview / suggested mapping (receipts doc) ---')
  console.log('  sheets:', preview.sheetNames?.length ?? 1, preview.sheetNames)
  console.log('  sheetIndex:', preview.sheetIndex)
  console.log('  suggested amt_received col:', preview.suggestedMapping?.amt_received, '→', preview.headers?.[preview.suggestedMapping?.amt_received])
  assert(preview.sheetNames?.length === 1 || preview.sheetIndex === 1, 'Single sheet or Sheet2 index')
  assert(
    preview.headers?.[preview.suggestedMapping?.amt_received] === 'dr' ||
      preview.headers?.[preview.suggestedMapping?.amt_received] === 'Foreign Currency Amount',
    'Suggested receipts amount should be dr or Foreign Currency Amount'
  )

  await api('PATCH', `/projects/${project.slug}/report-comments`, token, {
    bankStatementClosingBalance: MANUAL.bankClosing,
    cashBookClosingBalance: MANUAL.cashBookBalance,
  })

  const rec = await api('GET', `/reconcile/${project.slug}?limit=500`, token)
  console.log('\n--- Reconcile profile (UI parity) ---')
  const rp = rec.reconcileProfile || {}
  console.log('  bankFormat:', rp.bankFormat)
  console.log('  showCountMatch:', rp.showCountMatch)
  console.log('  encourageAutoMatch:', rp.encourageAutoMatch)
  console.log('  scheduleBrs:', rp.scheduleBrs)
  assert(rp.bankFormat === 'gt_bank_eur', 'GT Bank EUR profile')
  assert(rp.showCountMatch === true, 'showCountMatch should be true')
  assert(rp.encourageAutoMatch === true, 'encourageAutoMatch should be true')

  const sugCount =
    (rec.suggestions?.receipts?.length ?? 0) + (rec.suggestions?.payments?.length ?? 0)
  console.log('\n--- Suggestions ---')
  console.log('  receipt + payment suggestions:', sugCount)

  const cm = await api('GET', `/reconcile/${project.slug}/count-match`, token)
  console.log('\n--- Count-match panel ---')
  console.log('  onlyCashBookReceived rows:', cm.brsDetails?.onlyCashBookReceived?.length ?? 0)
  console.log('  cancel_recv rows:', cm.brsDetails?.cancelReceived?.length ?? 0)
  assert(cm.brsDetails != null, 'count-match diagnostic should load')

  const report = await api('GET', `/report/${project.slug}`, token)
  const brs = report.brsStatement || {}
  console.log('\n--- Report vs manual BRS ---')
  const checks = [
    diff('Bank closing', MANUAL.bankClosing, brs.bankClosingBalance),
    diff('Cash book balance', MANUAL.cashBookBalance, brs.balancePerCashBook),
    diff('Uncredited timing', MANUAL.uncredited, brs.uncreditedLodgmentsTimingTotal),
    diff('Unpresented cheques', MANUAL.unpresented, brs.unpresentedChequesTotal),
    diff('Bank-only debits', MANUAL.bankOnlyDebits, brs.bankOnlyDebitsNotInCashBookTotal),
    diff('Bank-only credits', MANUAL.bankOnlyCredits, brs.bankOnlyCreditsNotInCashBookTotal),
  ]
  const tieOut = brs.workbookScheduleTieOutVariance
  const tieOk = Math.abs(tieOut ?? 0) < 0.02
  console.log(`  ${tieOk ? '✓' : '✗'} Tie-out variance: ${tieOut}`)

  console.log(`\nProject: http://localhost:9100/projects/${project.slug}`)
  assert(checks.every(Boolean) && tieOk, 'BRS tie-out failed')
  console.log('\n=== ALL CHECKS PASSED ===')
}

main().catch((e) => {
  console.error('\nFAILED:', e.message)
  process.exit(1)
})
