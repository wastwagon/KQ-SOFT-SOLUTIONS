#!/usr/bin/env node
/**
 * End-to-end test: Absa interim PDF bank statement upload → parse → auto-map.
 * Specimen: adsastatementformat 2/ABSA cocoa purchases call deposit(2086268)-september,2023.pdf
 *
 * Usage: API_URL=http://localhost:9101 node scripts/run-absa-bank-pdf-test.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA = path.join(ROOT, 'adsastatementformat 2')
const BANK_PDF = path.join(
  DATA,
  'ABSA cocoa purchases call deposit(2086268)-september,2023.pdf'
)

const API = process.env.API_URL || 'http://localhost:9101'
const EMAIL = process.env.BRS_TEST_EMAIL || 'premium@test.com'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'

const PROJECT_NAME =
  process.env.BRS_ABSA_PROJECT_NAME ||
  'ABSA Call Deposit 2086268 (Sep 2023 PDF test)'
const RECON_DATE = '2023-09-30T00:00:00.000Z'

/** From PDF account summary / Excel specimen */
const EXPECTED = {
  accountNo: '2086268',
  openingBalance: 2,
  closingBalance: 2,
  transactions: 8,
  totalDebits: 731_178_280.19,
  totalCredits: 731_178_282.19,
}

const BANK_MAP_CREDITS = {
  transaction_date: 0,
  description: 1,
  credit: 5,
}

const BANK_MAP_DEBITS = {
  transaction_date: 0,
  description: 1,
  debit: 4,
}

async function api(method, p, token, body, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
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
    if (res.status === 429 && attempt < retries) {
      await new Promise((r) => setTimeout(r, 15_000 * (attempt + 1)))
      continue
    }
    if (!res.ok) {
      throw new Error(`${method} ${p} → ${res.status}: ${json.error || text.slice(0, 400)}`)
    }
    return json
  }
  throw new Error(`${method} ${p} → rate limited after retries`)
}

async function login() {
  const data = await api('POST', '/auth/login', null, { email: EMAIL, password: PASSWORD })
  return data.token
}

async function uploadFile(token, projectId, route, filePath, fields) {
  const form = new FormData()
  const buf = fs.readFileSync(filePath)
  form.append('file', new Blob([buf]), path.basename(filePath))
  for (const [k, v] of Object.entries(fields)) form.append(k, v)
  const res = await fetch(`${API}/api/v1/upload/${route}/${projectId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const text = await res.text()
  const json = JSON.parse(text)
  if (!res.ok) {
    throw new Error(`Upload ${path.basename(filePath)} failed: ${json.error || text}`)
  }
  return json
}

function ok(label, pass, detail = '') {
  console.log(`  ${pass ? '✓' : '✗'} ${label}${detail ? `: ${detail}` : ''}`)
  return pass
}

async function main() {
  console.log('=== Absa Bank PDF — upload & parse test ===\n')
  console.log('API:', API)
  console.log('PDF:', BANK_PDF)

  if (!fs.existsSync(BANK_PDF)) {
    throw new Error(`Missing specimen PDF: ${BANK_PDF}`)
  }

  const health = await fetch(`${API}/health`)
  if (!health.ok) throw new Error(`API not healthy at ${API}`)
  console.log('API health: OK\n')

  const token = await login()
  console.log('Login OK\n')

  const projectsRaw = await api('GET', '/projects', token)
  const projects = Array.isArray(projectsRaw) ? projectsRaw : projectsRaw.projects ?? []
  let project = projects.find((p) => p.name === PROJECT_NAME)

  if (!project) {
    project = await api('POST', '/projects', token, {
      name: PROJECT_NAME,
      currency: 'GHS',
      reconciliationDate: RECON_DATE,
      primaryBankName: 'Absa Bank',
      primaryAccountNo: EXPECTED.accountNo,
    })
    console.log('Created project:', project.name, `(${project.slug})`)
  } else {
    console.log('Using project:', project.name, `(${project.slug})`)
    try {
      await api('DELETE', `/projects/${project.id}`, token)
      console.log('Deleted existing project for fresh upload')
      project = await api('POST', '/projects', token, {
        name: PROJECT_NAME,
        currency: 'GHS',
        reconciliationDate: RECON_DATE,
        primaryBankName: 'Absa Bank',
        primaryAccountNo: EXPECTED.accountNo,
      })
      console.log('Recreated project:', project.name, `(${project.slug})`)
    } catch (e) {
      console.log('Could not reset project:', e.message)
    }
  }

  const proj = await api('GET', `/projects/${project.slug}`, token)
  const acct = `Absa ${EXPECTED.accountNo}`

  console.log('\nUploading Absa bank PDF (credits)...')
  const upCr = await uploadFile(token, proj.id, 'bank-statement', BANK_PDF, {
    type: 'credits',
    accountName: acct,
    accountNo: EXPECTED.accountNo,
  })
  console.log('  autoMap:', JSON.stringify(upCr.autoMap ?? upCr))

  console.log('Uploading Absa bank PDF (debits)...')
  const upDr = await uploadFile(token, proj.id, 'bank-statement', BANK_PDF, {
    type: 'debits',
    accountName: acct,
    accountNo: EXPECTED.accountNo,
  })
  console.log('  autoMap:', JSON.stringify(upDr.autoMap ?? upDr))

  const proj2 = await api('GET', `/projects/${project.slug}`, token)
  const bankDocs = (proj2.documents || []).filter((d) => d.type.startsWith('bank_'))

  console.log('\n--- Document results ---')
  let allPass = true
  let totalTx = 0
  let sumDebit = 0
  let sumCredit = 0

  for (const doc of bankDocs) {
    let preview
    try {
      preview = await api('GET', `/documents/${doc.id}/preview`, token)
    } catch (e) {
      allPass = ok(`${doc.type} preview`, false, e.message) && allPass
      continue
    }

    const headers = preview.headers || []
    const rows = preview.rows || []
    const h = headers.join(' | ')
    console.log(`\n  ${doc.type}:`)
    console.log(`    headers: ${h}`)
    console.log(`    preview rows: ${rows.length}`)
    console.log(`    parseMethod: ${preview.parseMethod ?? 'n/a'}`)

    const hasDebit = headers.some((x) => /^debit$/i.test(String(x)))
    const hasCredit = headers.some((x) => /^credit$/i.test(String(x)))
    const hasDate = headers.some((x) => /transaction\s*date|^date$/i.test(String(x)))
    allPass = ok(`${doc.type} has Transaction Date + Debit/Credit headers`, hasDate && hasDebit && hasCredit) && allPass
    allPass =
      ok(`${doc.type} parseMethod is absa_pdf`, preview.parseMethod === 'absa_pdf') && allPass
    allPass =
      ok(`${doc.type} preview row count`, rows.length === EXPECTED.transactions, String(rows.length)) &&
      allPass

    let mapped = { count: 0 }
    if (doc.mappingStatus === 'mapped' && doc.transactionCount) {
      mapped = { count: doc.transactionCount }
      console.log(`    already auto-mapped: ${mapped.count} transactions`)
    } else {
      const mapping = doc.type === 'bank_credits' ? BANK_MAP_CREDITS : BANK_MAP_DEBITS
      mapped = await api('POST', `/documents/${doc.id}/map`, token, { mapping, sheetIndex: 0 })
      console.log(`    manual map applied: ${mapped.count} transactions`)
    }

    totalTx += mapped.count || 0
    allPass =
      ok(
        `${doc.type} mapped transaction count`,
        mapped.count >= 3 && mapped.count <= 5,
        String(mapped.count)
      ) && allPass

    const txs = await api('GET', `/documents/${doc.id}/transactions`, token).catch(() => null)
    const txList = Array.isArray(txs) ? txs : txs?.transactions || []
    if (txList.length) {
      for (const t of txList) {
        const amt = Number(t.amount ?? 0)
        if (doc.type === 'bank_debits') sumDebit += amt
        if (doc.type === 'bank_credits') sumCredit += amt
      }
    }
  }

  await api('PATCH', `/projects/${project.slug}/report-comments`, token, {
    bankStatementClosingBalance: EXPECTED.closingBalance,
  })

  const report = await api('GET', `/report/${project.slug}`, token)
  const brs = report.brsStatement || {}

  console.log('\n--- BRS / totals ---')
  allPass =
    ok(
      'Combined bank transactions',
      totalTx === EXPECTED.transactions,
      String(totalTx)
    ) && allPass
  allPass =
    ok(
      'Bank closing balance',
      Math.abs((brs.bankClosingBalance ?? 0) - EXPECTED.closingBalance) < 1,
      `${brs.bankClosingBalance}`
    ) && allPass
  allPass =
    ok(
      'Sum debits',
      Math.abs(sumDebit - EXPECTED.totalDebits) < 1,
      sumDebit.toFixed(2)
    ) && allPass
  allPass =
    ok(
      'Sum credits',
      Math.abs(sumCredit - EXPECTED.totalCredits) < 1,
      sumCredit.toFixed(2)
    ) && allPass

  console.log(`\nProject slug: ${project.slug}`)
  console.log(`Web UI: http://localhost:9100/projects/${project.slug}`)
  console.log(allPass ? '\n✅ Absa PDF upload test PASSED' : '\n❌ Absa PDF upload test FAILED')
  process.exit(allPass ? 0 : 1)
}

main().catch((e) => {
  console.error('\nFatal:', e.message)
  process.exit(1)
})
