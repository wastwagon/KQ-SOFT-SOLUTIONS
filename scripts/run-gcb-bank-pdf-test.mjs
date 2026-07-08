#!/usr/bin/env node
/**
 * End-to-end test: GCB corporate PDF bank statement upload → parse → auto-map.
 * Specimen: gcbstatementformat/gcb republic house corporate(1061130000070)-sept.2023.pdf
 *
 * Usage: API_URL=http://localhost:9101 node scripts/run-gcb-bank-pdf-test.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA = path.join(ROOT, 'gcbstatementformat')
const BANK_PDF = path.join(
  DATA,
  'gcb republic house corporate(1061130000070)-sept.2023.pdf'
)

const API = process.env.API_URL || 'http://localhost:9101'
const EMAIL = process.env.BRS_TEST_EMAIL || 'premium@test.com'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'

const PROJECT_NAME =
  process.env.BRS_GCB_PROJECT_NAME ||
  'GCB Republic House 1061130000070 (Sep 2023 PDF test)'
const RECON_DATE = '2023-09-30T00:00:00.000Z'

/** From PDF account summary */
const EXPECTED = {
  accountNo: '1061130000070',
  openingBalance: 2363.41,
  closingBalance: 11373.41,
  minTransactions: 285,
  maxTransactions: 295,
  totalDebits: 5191022.26,
  totalCredits: 5200032.26,
}

/** Parsed GCB PDF table: Transaction Date, Description, Reference, Value Date, Debit, Credit, Balance, Chq No */
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
  console.log('=== GCB Bank PDF — upload & parse test ===\n')
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
      primaryBankName: 'GCB Bank',
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
        primaryBankName: 'GCB Bank',
        primaryAccountNo: EXPECTED.accountNo,
      })
      console.log('Recreated project:', project.name, `(${project.slug})`)
    } catch (e) {
      console.log('Could not reset project:', e.message)
    }
  }

  const proj = await api('GET', `/projects/${project.slug}`, token)
  const acct = `GCB ${EXPECTED.accountNo}`

  console.log('\nUploading GCB bank PDF (credits)...')
  const upCr = await uploadFile(token, proj.id, 'bank-statement', BANK_PDF, {
    type: 'credits',
    accountName: acct,
    accountNo: EXPECTED.accountNo,
  })
  console.log('  autoMap:', JSON.stringify(upCr.autoMap ?? upCr))

  console.log('Uploading GCB bank PDF (debits)...')
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
  let lastBalance = null

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
      ok(`${doc.type} parseMethod is gcb_pdf`, preview.parseMethod === 'gcb_pdf') && allPass

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
        `${doc.type} transaction count in range`,
        mapped.count >= 100 && mapped.count <= 180,
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
      totalTx >= EXPECTED.minTransactions && totalTx <= EXPECTED.maxTransactions * 2,
      String(totalTx)
    ) && allPass
  allPass = ok('Bank closing balance', Math.abs((brs.bankClosingBalance ?? 0) - EXPECTED.closingBalance) < 1, `${brs.bankClosingBalance}`) && allPass
  allPass = ok('Sum debits plausible', sumDebit > 4_000_000, sumDebit.toFixed(2)) && allPass
  allPass = ok('Sum credits plausible', sumCredit > 4_000_000, sumCredit.toFixed(2)) && allPass

  console.log(`\nProject slug: ${project.slug}`)
  console.log(`Web UI: http://localhost:9100/projects/${project.slug}`)
  console.log(allPass ? '\n✅ GCB PDF upload test PASSED' : '\n❌ GCB PDF upload test FAILED')
  process.exit(allPass ? 0 : 1)
}

main().catch((e) => {
  console.error('\nFatal:', e.message)
  process.exit(1)
})
