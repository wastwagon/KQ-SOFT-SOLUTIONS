#!/usr/bin/env node
/**
 * Upload Lordship Insurance files from asdiscussed/ — one project per bank account.
 *
 * Best practice: one cash book + one bank statement per project (no mixing).
 *
 * Usage:
 *   node scripts/upload-asdiscussed.mjs           # both accounts (9033 + 9035)
 *   node scripts/upload-asdiscussed.mjs 9033      # account 9033 only
 *   node scripts/upload-asdiscussed.mjs 9035      # account 9035 only
 *   node scripts/upload-asdiscussed.mjs <slug>    # upload to existing project by slug
 *
 * Env:
 *   API_URL or VITE_API_URL — default http://localhost:9011
 *   BRS_TEST_EMAIL — default asdiscussed@test.com
 *   BRS_TEST_PASSWORD — default Test123!
 *   BRS_BANK_FORMAT — pdf (default) or xlsx for bank statements
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ASDIR = path.join(ROOT, 'asdiscussed')

const API = process.env.API_URL || process.env.VITE_API_URL || 'http://localhost:9011'
const EMAIL = process.env.BRS_TEST_EMAIL || 'asdiscussed@test.com'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'
/** pdf = fuller Ecobank FOP statements; xlsx = cleaner columns but may omit rows in some exports */
const BANK_FORMAT = (process.env.BRS_BANK_FORMAT || 'pdf').toLowerCase()

/** One BRS project per bank account */
const ACCOUNTS = [
  {
    key: '9033',
    projectName: 'Lordship – Ecobank 9033 Q1 2026',
    label: 'Ecobank 1441001519033',
    accountName: 'Ecobank Tesano 1441001519033',
    accountNo: '1441001519033',
    cashBook: 'LIBcashbk1 2026 1qtr.xlsx',
    bankPdf: '1778163944552.pdf',
    bankXlsx: '1778163944552.xlsx',
    brsReference: '2025 final brs for acct 901.xlsx',
  },
  {
    key: '9035',
    projectName: 'Lordship – Ecobank 9035 Q1 2026',
    label: 'Ecobank 1441001519035',
    accountName: 'Ecobank Tesano 1441001519035',
    accountNo: '1441001519035',
    cashBook: 'LIBcashbk2 2026 1qtr.xlsx',
    bankPdf: '1778676142095.pdf',
    bankXlsx: '1778676142095.xlsx',
    brsReference: '2025 final brs for acct 902.xlsx',
  },
]

async function login() {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`)
  return (await res.json()).token
}

async function getProjects(token) {
  const res = await fetch(`${API}/api/v1/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Projects list failed: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : data.projects ?? []
}

async function createProject(token, name) {
  const res = await fetch(`${API}/api/v1/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, currency: 'GHS' }),
  })
  if (!res.ok) throw new Error(`Create project failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function findOrCreateProject(token, projects, projectName) {
  const existing = projects.find((p) => p.name === projectName)
  if (existing) {
    console.log('  Using existing project:', existing.name, `(${existing.slug})`)
    return { id: existing.id, slug: existing.slug, name: existing.name, created: false }
  }
  const created = await createProject(token, projectName)
  console.log('  Created project:', created.name, `(${created.slug})`)
  return { id: created.id, slug: created.slug, name: created.name, created: true }
}

async function uploadCashBook(token, projectId, filePath, type) {
  const form = new FormData()
  const buf = fs.readFileSync(filePath)
  form.append('file', new Blob([buf]), path.basename(filePath))
  form.append('type', type)
  const res = await fetch(`${API}/api/v1/upload/cash-book/${projectId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Cash book (${type}) failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function uploadBankStatement(token, projectId, filePath, type, accountName, accountNo) {
  const form = new FormData()
  const buf = fs.readFileSync(filePath)
  form.append('file', new Blob([buf]), path.basename(filePath))
  form.append('type', type)
  form.append('accountName', accountName)
  if (accountNo) form.append('accountNo', accountNo)
  const res = await fetch(`${API}/api/v1/upload/bank-statement/${projectId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Bank (${type}, ${accountName}) failed: ${res.status} ${await res.text()}`)
  return res.json()
}

function requireFile(relPath) {
  const full = path.join(ASDIR, relPath)
  if (!fs.existsSync(full)) throw new Error(`Missing file: ${full}`)
  return full
}

async function uploadAccountPack(token, acct, projectId) {
  const cbPath = requireFile(acct.cashBook)
  const bankFile = BANK_FORMAT === 'xlsx' ? acct.bankXlsx : acct.bankPdf
  const bankPath = requireFile(bankFile)

  console.log('  Cash book (receipts + payments):', path.basename(cbPath))
  await uploadCashBook(token, projectId, cbPath, 'receipts')
  await uploadCashBook(token, projectId, cbPath, 'payments')

  console.log('  Bank statement (credits + debits):', path.basename(bankPath))
  await uploadBankStatement(token, projectId, bankPath, 'credits', acct.accountName, acct.accountNo)
  await uploadBankStatement(token, projectId, bankPath, 'debits', acct.accountName, acct.accountNo)
}

async function main() {
  const arg = process.argv[2]

  console.log('API:', API)
  console.log('Data dir:', ASDIR)
  console.log('Bank format:', BANK_FORMAT)
  console.log('Mode: one project per bank account (no shared cash book)')
  console.log('Logging in as', EMAIL, '...')

  const token = await login()
  console.log('Login OK\n')

  let accountsToRun = ACCOUNTS
  let useExistingSlug = null

  if (arg) {
    const byKey = ACCOUNTS.find((a) => a.key === arg)
    if (byKey) {
      accountsToRun = [byKey]
    } else {
      useExistingSlug = arg
      accountsToRun = []
    }
  }

  const projects = await getProjects(token)
  const results = []

  if (useExistingSlug) {
    const proj = projects.find((p) => p.slug === useExistingSlug)
    if (!proj) {
      console.error('Project slug not found:', useExistingSlug)
      process.exit(1)
    }
    const acct =
      ACCOUNTS.find((a) => proj.name.includes('9033') || proj.name.includes(a.key)) ??
      ACCOUNTS[0]
    console.log(`=== ${acct.label} → ${proj.name} (${proj.slug}) ===`)
    await uploadAccountPack(token, acct, proj.id)
    results.push({ account: acct.key, slug: proj.slug, name: proj.name })
  } else {
    for (const acct of accountsToRun) {
      console.log(`=== ${acct.label} ===`)
      const proj = await findOrCreateProject(token, projects, acct.projectName)
      await uploadAccountPack(token, acct, proj.id)
      results.push({ account: acct.key, slug: proj.slug, name: proj.name })
      console.log('')
    }
  }

  console.log('Done — projects ready for Map → Reconcile → Report:\n')
  for (const r of results) {
    const acct = ACCOUNTS.find((a) => a.key === r.account)
    console.log(`  ${r.account}: ${r.name}`)
    console.log(`       slug: ${r.slug}`)
    if (acct) console.log(`       Dec 2025 reference (not uploaded): ${acct.brsReference}`)
  }
  console.log('\nDeprecated: delete old combined project "Lordship Insurance – Q1 2026" if present.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
