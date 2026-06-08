#!/usr/bin/env node
/**
 * Q1 → Q2 roll-forward integration test (Ecobank 9033 / accountno552).
 *
 * 1. Reconcile Q1 from accountno552records (workbook netting on).
 * 2. Mark Q1 completed.
 * 3. Create Q2 with rollForwardFromProjectId → Q1.
 * 4. Assert brought-forward unpresented cheques on empty Q2.
 * 5. Upload minimal Q2 fixture (reissued chq + bank clearance) and assert filtering.
 *
 * Usage:
 *   API_URL=http://localhost:9011 node scripts/run-accountno552-rollforward-test.mjs
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import {
  CASH_MAP,
  MANUAL_Q1,
  Q1_ROLLFORWARD_CHQS,
  api,
  chqAmountMap,
  ensureProjectCompleted,
  ensureQ1Project,
  Q1_PROJECT_SLUG,
  login,
  normalizeChqNo,
  q1RollForwardRawTotal,
  uploadFile,
} from './lib/ecobank-9033-q1-setup.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const XLSX = require('../api/node_modules/xlsx')

process.env.GHANA_BRS_WORKBOOK_NETTING = process.env.GHANA_BRS_WORKBOOK_NETTING || '1'

const API = process.env.API_URL || 'http://localhost:9011'
const EMAIL = process.env.BRS_TEST_EMAIL || 'premium@test.com'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'

const Q2_PROJECT_NAME =
  process.env.BRS_Q2_PROJECT_NAME || 'Lordship – Ecobank 9033 Q2 2026 (accountno552 rollforward test)'
const Q2_RECON_DATE = '2026-06-30T00:00:00.000Z'

const AFTER_PARTIAL_BF = {
  926072: 650,
  926073: 4839.56,
}

function approxEq(a, b, tol = 0.02) {
  return Math.abs((a ?? 0) - (b ?? 0)) <= tol
}

function assertChqMap(label, items, expected) {
  const got = chqAmountMap(items)
  const expectedKeys = Object.keys(expected).map(normalizeChqNo).sort()
  const gotKeys = [...got.keys()].sort()
  const keysOk =
    expectedKeys.length === gotKeys.length && expectedKeys.every((k, i) => k === gotKeys[i])
  console.log(`  ${keysOk ? '✓' : '✗'} ${label} chq keys: expected [${expectedKeys.join(', ')}] got [${gotKeys.join(', ')}]`)
  let amountsOk = true
  for (const [chq, amt] of Object.entries(expected)) {
    const key = normalizeChqNo(chq)
    const g = got.get(key)
    const ok = approxEq(g, amt)
    if (!ok) amountsOk = false
    console.log(`    ${ok ? '✓' : '✗'} chq ${key}: expected ${amt} got ${g ?? '—'}`)
  }
  return keysOk && amountsOk
}

function assertTotal(label, expected, actual) {
  const ok = approxEq(expected, actual)
  console.log(`  ${ok ? '✓' : '✗'} ${label}: expected ${expected} got ${actual}`)
  return ok
}

function writeQ2FixtureFiles(dir) {
  fs.mkdirSync(dir, { recursive: true })
  const cashPath = path.join(dir, 'q2-rollforward-cash.xlsx')
  const bankPath = path.join(dir, 'q2-rollforward-bank.xlsx')

  const cashRows = [
    ['Date', 'Name', 'Details', 'Doc Ref', 'Chq No', 'Acc Code', 'Amount Received', 'Amount Paid'],
    ['2026-04-15', 'Alex Avorkpo', 'Reissued unpresented chq from Q1', 'Q2-926023', '926023', '', '', 510.7],
  ]
  const bankRows = [
    ['Date', 'Description', 'Reference', 'Debit', 'Credit'],
    [
      '2026-04-20',
      'WITHDRAWAL- EGH CHQ NO 925928 PD TO ROLLFORWARD TEST',
      'Q2-WD-925928',
      2000,
      '',
    ],
  ]

  const cashWb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(cashWb, XLSX.utils.aoa_to_sheet(cashRows), 'Payments')
  XLSX.writeFile(cashWb, cashPath)

  const bankWb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(bankWb, XLSX.utils.aoa_to_sheet(bankRows), 'Statement')
  XLSX.writeFile(bankWb, bankPath)

  return { cashPath, bankPath }
}

async function deleteProjectIfExists(API, token, name) {
  const projectsRaw = await api(API, 'GET', '/projects', token)
  const projects = Array.isArray(projectsRaw) ? projectsRaw : projectsRaw.projects ?? []
  const existing = projects.find((p) => p.name === name)
  if (!existing) return null
  await api(API, 'DELETE', `/projects/${existing.slug}`, token)
  return existing.slug
}

async function createQ2Project(API, token, q1Slug) {
  const deleted = await deleteProjectIfExists(API, token, Q2_PROJECT_NAME)
  if (deleted) console.log(`Deleted prior Q2 test project (${deleted})`)

  const project = await api(API, 'POST', '/projects', token, {
    name: Q2_PROJECT_NAME,
    currency: 'GHS',
    reconciliationDate: Q2_RECON_DATE,
    primaryBankName: 'Ecobank Tesano',
    primaryBankAccountNo: '1441001519033',
    rollForwardFromProjectId: q1Slug,
  })
  console.log('Created Q2 project:', project.name, `(${project.slug})`)
  return project
}

async function uploadAndMapQ2Fixture(API, token, project) {
  const fixtureDir = path.join(os.tmpdir(), 'kq-rollforward-9033')
  const { cashPath, bankPath } = writeQ2FixtureFiles(fixtureDir)
  const acct = 'Ecobank Tesano 1441001519033'
  const acctNo = '1441001519033'

  console.log('\nUploading Q2 roll-forward fixture...')
  console.log('  Cash:', cashPath)
  console.log('  Bank:', bankPath)

  await uploadFile(API, token, project.id, 'cash-book', cashPath, { type: 'payments' })
  await uploadFile(API, token, project.id, 'bank-statement', bankPath, {
    type: 'debits',
    accountName: acct,
    accountNo: acctNo,
  })

  const proj = await api(API, 'GET', `/projects/${project.slug}`, token)
  for (const doc of proj.documents || []) {
    const isCash = doc.type.startsWith('cash_book_')
    let mapping
    if (isCash) {
      mapping = { ...CASH_MAP }
      if (doc.type === 'cash_book_receipts') delete mapping.amt_paid
      else delete mapping.amt_received
    } else {
      const pre = await api(API, 'GET', `/documents/${doc.id}/preview`, token)
      mapping =
        doc.type === 'bank_credits'
          ? { transaction_date: 0, description: 1, credit: pre.suggestedMapping?.credit ?? 4 }
          : { transaction_date: 0, description: 1, debit: pre.suggestedMapping?.debit ?? 3 }
    }
    const mapped = await api(API, 'POST', `/documents/${doc.id}/map`, token, { mapping, sheetIndex: 0 })
    console.log(`  Mapped ${doc.type}: ${mapped.count} transactions`)
  }
}

async function fetchReport(API, token, slug) {
  return api(API, 'GET', `/report/${slug}?workbookNetting=1`, token)
}

async function main() {
  console.log('=== Ecobank 9033 Q1 → Q2 roll-forward integration ===')
  console.log('API:', API)
  console.log('Workbook netting:', process.env.GHANA_BRS_WORKBOOK_NETTING)

  const token = await login(API, EMAIL, PASSWORD)
  console.log('Login OK\n')

  console.log('--- Phase 0: Q1 reconcile ---')
  let q1
  let totalMatched = 0
  let q1Locked = false
  if (Q1_PROJECT_SLUG) {
    q1 = await api(API, 'GET', `/projects/${Q1_PROJECT_SLUG}`, token)
    q1Locked = ['completed', 'approved', 'submitted_for_review'].includes(q1.status)
    console.log(`Q1 project: ${q1.slug} (existing production: ${q1.status})`)
  } else {
    const setup = await ensureQ1Project(API, token)
    q1 = setup.project
    totalMatched = setup.totalMatched
    q1Locked = setup.locked
    console.log(
      `Q1 project: ${q1.slug}${q1Locked ? ` (locked: ${q1.status})` : ` (bulk matched ${totalMatched})`}`
    )
  }

  const q1Report = await fetchReport(API, token, q1.slug)
  const q1Brs = q1Report.brsStatement || {}
  const q1UnpresentedOk = assertTotal(
    'Q1 unpresented (pre-roll-forward baseline)',
    MANUAL_Q1.unpresented,
    q1Brs.unpresentedChequesTotal
  )
  if (!q1UnpresentedOk) {
    console.error('\nQ1 BRS does not match manual workbook — fix Q1 before roll-forward test.')
    process.exit(1)
  }

  console.log('\n--- Phase 1: complete Q1 ---')
  const q1Completed = await ensureProjectCompleted(API, token, q1.slug)
  console.log(`Q1 status: ${q1Completed.status}`)

  console.log('\n--- Phase 2: create empty Q2 (roll forward from Q1) ---')
  const q2 = await createQ2Project(API, token, q1.slug)
  const q2Empty = await fetchReport(API, token, q2.slug)

  console.log('\n=== Empty Q2 roll-forward assertions ===')
  const bfEmpty = q2Empty.broughtForwardItems || []
  const bfEmptyTotal = bfEmpty.reduce((s, t) => s + t.amount, 0)
  const checks1 = [
    assertChqMap('Brought-forward unpresented', bfEmpty, Q1_ROLLFORWARD_CHQS),
    assertTotal('Brought-forward raw total (section A)', q1RollForwardRawTotal(), bfEmptyTotal),
    assertTotal(
      'Q2 unpresented line (empty period = BF rows only)',
      bfEmptyTotal,
      q2Empty.brsStatement?.unpresentedChequesTotal
    ),
  ]
  const q1NettingDelta = MANUAL_Q1.unpresented - q1RollForwardRawTotal()
  console.log(
    `  ℹ Q1 workbook netting uplift (period-specific, not BF cheques): ${q1NettingDelta.toFixed(2)} → Q1 line ${MANUAL_Q1.unpresented}`
  )
  console.log(`  ℹ broughtForwardItems: ${bfEmpty.length}`)
  console.log(`  ℹ rollForwardFrom: ${q2Empty.rollForwardFrom?.name ?? q1.name}`)

  console.log('\n--- Phase 3: Q2 partial clearance fixture ---')
  await uploadAndMapQ2Fixture(API, token, q2)
  const q2Partial = await fetchReport(API, token, q2.slug)
  const bfPartial = q2Partial.broughtForwardItems || []

  console.log('\n=== Partial clearance roll-forward assertions ===')
  const partialTotal = Object.values(AFTER_PARTIAL_BF).reduce((s, n) => s + n, 0)
  const checks2 = [
    assertChqMap('Brought-forward after partial clearance', bfPartial, AFTER_PARTIAL_BF),
    assertTotal('Brought-forward raw total (2 cheques)', partialTotal, bfPartial.reduce((s, t) => s + t.amount, 0)),
  ]

  const dropped926023 = !bfPartial.some((t) => normalizeChqNo(t.chqNo) === '926023')
  const dropped925928 = !bfPartial.some((t) => normalizeChqNo(t.chqNo) === '925928')
  console.log(`  ${dropped926023 ? '✓' : '✗'} 926023 dropped (reappeared in Q2 cash book)`)
  console.log(`  ${dropped925928 ? '✓' : '✗'} 925928 dropped (cleared on Q2 bank statement)`)
  checks2.push(dropped926023, dropped925928)

  const allOk = [...checks1, ...checks2].every(Boolean)
  console.log(`\nQ1 slug: ${q1.slug}`)
  console.log(`Q2 slug: ${q2.slug}`)
  console.log(allOk ? '\n✓ Roll-forward integration test passed' : '\n✗ Roll-forward integration test failed')
  process.exit(allOk ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
