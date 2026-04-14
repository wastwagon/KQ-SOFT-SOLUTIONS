#!/usr/bin/env node
/**
 * Upload sample cash book and bank statement (complex/combined) to a BRS project.
 * Usage: node scripts/upload-sample-docs.mjs [projectSlug]
 * Requires: API running (e.g. npm run dev in api/), samples in samples/
 * Login: premium@test.com / Test123! (from seed)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API = process.env.VITE_API_URL || process.env.API_URL || 'http://localhost:9001'
const EMAIL = process.env.BRS_TEST_EMAIL || 'premium@test.com'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'

async function login() {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Login failed: ${res.status} ${t}`)
  }
  const data = await res.json()
  return data.token
}

async function getProjects(token) {
  const res = await fetch(`${API}/api/v1/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Projects list failed: ${res.status}`)
  return res.json()
}

async function createProject(token, name) {
  const res = await fetch(`${API}/api/v1/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`Create project failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function uploadCashBook(token, projectId, filePath, type) {
  const form = new FormData()
  const buf = fs.readFileSync(filePath)
  const name = path.basename(filePath)
  form.append('file', new Blob([buf]), name)
  form.append('type', type)
  const res = await fetch(`${API}/api/v1/upload/cash-book/${projectId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Cash book upload (${type}) failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function uploadBankStatement(token, projectId, filePath, type, accountName) {
  const form = new FormData()
  const buf = fs.readFileSync(filePath)
  const name = path.basename(filePath)
  form.append('file', new Blob([buf]), name)
  form.append('type', type)
  if (accountName) form.append('accountName', accountName)
  const res = await fetch(`${API}/api/v1/upload/bank-statement/${projectId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Bank statement upload (${type}) failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function main() {
  const projectSlug = process.argv[2]
  const samplesDir = path.join(__dirname, '..', 'samples')
  const cashBookPath = path.join(samplesDir, 'cashbook_combined_Jan2025.csv')
  const bankPath = path.join(samplesDir, 'bank_statement_combined_Ecobank_Jan2025.csv')

  if (!fs.existsSync(cashBookPath)) {
    console.error('Missing', cashBookPath)
    process.exit(1)
  }
  if (!fs.existsSync(bankPath)) {
    console.error('Missing', bankPath)
    process.exit(1)
  }

  console.log('API:', API)
  console.log('Logging in as', EMAIL, '...')
  const token = await login()
  console.log('Login OK')

  let projectId = null
  let slug = projectSlug

  if (slug) {
    const list = await getProjects(token)
    const proj = list.find((p) => p.slug === slug)
    if (!proj) {
      console.error('Project with slug', slug, 'not found. Create it in the app or omit slug to create one.')
      process.exit(1)
    }
    projectId = proj.id
    console.log('Using project:', proj.name, '(' + slug + ')')
  } else {
    const list = await getProjects(token)
    const existing = list[0]
    if (existing) {
      projectId = existing.id
      slug = existing.slug
      console.log('Using first project:', existing.name, '(' + slug + ')')
    } else {
      const created = await createProject(token, 'OceanCyber BRS 2026')
      projectId = created.id
      slug = created.slug
      console.log('Created project:', created.name, '(' + slug + ')')
    }
  }

  console.log('Uploading cash book (both receipts + payments)...')
  await uploadCashBook(token, projectId, cashBookPath, 'receipts')
  await uploadCashBook(token, projectId, cashBookPath, 'payments')
  console.log('Cash book uploaded (receipts and payments).')

  console.log('Uploading bank statement (both credits + debits)...')
  await uploadBankStatement(token, projectId, bankPath, 'credits', 'Ecobank Main')
  await uploadBankStatement(token, projectId, bankPath, 'debits', 'Ecobank Main')
  console.log('Bank statement uploaded (credits and debits).')

  console.log('\nDone. Open the app, go to project', slug, '→ Upload step to see 1 cash book + 1 bank doc (each used as Both).')
  console.log('Then go to Map to map columns for each document.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
