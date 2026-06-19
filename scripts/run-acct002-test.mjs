#!/usr/bin/env node
/**
 * End-to-end test: testdataandresultsforacct002 → Premium project → compare with manual BRS.
 * Grace Baptist Academy — Ecobank acct 2, as at 31 Aug 2018.
 *
 * Usage: API_URL=http://localhost:9101 node scripts/run-acct002-test.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA = path.join(ROOT, 'testdataandresultsforacct002')

const API = process.env.API_URL || 'http://localhost:9101'
const EMAIL = process.env.BRS_TEST_EMAIL || 'premium@test.com'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'

const PROJECT_NAME =
  process.env.BRS_ACCT002_PROJECT_NAME || 'Grace Baptist Academy - Ecobank acct 2 (Aug 2018)'
const RECON_DATE = '2018-08-31T00:00:00.000Z'

/** From brs acct 2.xlsx / PDF — fully reconciled (no timing differences). */
const MANUAL = {
  bankClosing: 490.74,
  cashBookBalance: 490.74,
  uncredited: 0,
  unpresented: 0,
  bankOnlyDebits: 0,
  bankOnlyCredits: 0,
}

/**
 * Cash book Sheet2: month, date, name, details, term, doc ref, chq, student, accode, rec, paid, balance
 * Bank statement: s/no, TRANS. DATE, details, ..., REF, VALUE DATE, , DEBIT, CREDIT, BALANCE
 */
const CASH_MAP = {
  date: 1,
  name: 2,
  details: 3,
  doc_ref: 5,
  chq_no: 6,
  accode: 8,
  amt_received: 9,
  amt_paid: 10,
}

const CASH_SHEET_INDEX = 1

const BANK_MAP_CREDITS = {
  transaction_date: 1,
  description: 2,
  credit: 11,
}

const BANK_MAP_DEBITS = {
  transaction_date: 1,
  description: 2,
  debit: 10,
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
  if (!res.ok) throw new Error(`Upload ${path.basename(filePath)} failed: ${json.error || text}`)
  return json
}

function diff(label, manual, platform) {
  const m = manual ?? 0
  const p = platform ?? 0
  const d = Math.round((p - m) * 100) / 100
  const ok = Math.abs(d) < 0.02
  console.log(`  ${ok ? '✓' : '✗'} ${label}: manual=${m} platform=${p} Δ=${d}`)
  return ok
}

async function autoMatch(API, token, projectSlug) {
  let totalMatched = 0
  const ECOBANK_REASON_RE =
    /Ecobank|OUTWARD CLEARING|CHEQUE WITHDRAWAL|CASH DEPOSIT|DEBIT TRANSFER|SERVICE CHARGES/i
  const phases = [
    ['A-safe', 0.9, 'safe'],
    ['B-ecobank+receipts', 0.85, 'phaseB'],
    ['C-all', 0.75, 'all'],
  ]
  for (const [phase, minConf, mode] of phases) {
    for (let round = 0; round < 10; round++) {
      const rec = await api('GET', `/reconcile/${projectSlug}`, token)
      const paymentSug = rec.suggestions?.payments || []
      const receiptSug = rec.suggestions?.receipts || []
      const allSug = (
        mode === 'phaseB'
          ? [
              ...receiptSug.filter((s) => s.confidence >= minConf && !s.duplicateWarning),
              ...paymentSug.filter(
                (s) =>
                  s.confidence >= minConf &&
                  !s.duplicateWarning &&
                  (s.ecobankPattern || ECOBANK_REASON_RE.test(s.reason || ''))
              ),
            ]
          : [...paymentSug, ...receiptSug].filter(
              (s) =>
                s.confidence >= minConf &&
                (mode !== 'safe' || !s.duplicateWarning)
            )
      ).sort((a, b) => b.confidence - a.confidence)
      if (!allSug.length) break
      const usedCb = new Set()
      const usedBank = new Set()
      const toBulk = []
      for (const s of allSug) {
        const cbId = s.cashBookTx?.id ?? s.cashBookTransactionId
        const bankId = s.bankTx?.id ?? s.bankTransactionId
        if (!cbId || !bankId) continue
        if (usedCb.has(cbId) || usedBank.has(bankId)) continue
        usedCb.add(cbId)
        usedBank.add(bankId)
        toBulk.push({ cashBookTransactionId: cbId, bankTransactionId: bankId })
        if (toBulk.length >= 50) break
      }
      if (!toBulk.length) break
      const bulk = await api('POST', `/reconcile/${projectSlug}/match/bulk`, token, { matches: toBulk })
      const n = bulk.created ?? bulk.count ?? toBulk.length
      totalMatched += n
      console.log(`  ${phase} round ${round + 1}: matched ${n}`)
    }
  }
  return totalMatched
}

async function main() {
  console.log('API:', API)
  console.log('Data:', DATA)

  for (const f of ['cash book acct 2.xlsx', 'bs acct 2.xlsx']) {
    if (!fs.existsSync(path.join(DATA, f))) throw new Error(`Missing ${f}`)
  }

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
      primaryBankName: 'Ecobank',
      primaryAccountNo: '0055500330003',
    })
    console.log('Created project:', project.name, `(${project.slug})`)
  } else {
    console.log('Using project:', project.name, `(${project.slug})`)
  }

  const proj = await api('GET', `/projects/${project.slug}`, token)
  if (!proj.documents?.length) {
    const cb = path.join(DATA, 'cash book acct 2.xlsx')
    const bank = path.join(DATA, 'bs acct 2.xlsx')
    const acct = 'Ecobank 0055500330003'
    const acctNo = '0055500330003'
    console.log('\nUploading cash book...')
    await uploadFile(token, proj.id, 'cash-book', cb, { type: 'receipts' })
    await uploadFile(token, proj.id, 'cash-book', cb, { type: 'payments' })
    console.log('Uploading bank statement...')
    await uploadFile(token, proj.id, 'bank-statement', bank, {
      type: 'credits',
      accountName: acct,
      accountNo: acctNo,
    })
    await uploadFile(token, proj.id, 'bank-statement', bank, {
      type: 'debits',
      accountName: acct,
      accountNo: acctNo,
    })
  } else {
    console.log('\nDocuments already uploaded:', proj.documents.length)
  }

  await api('PATCH', `/projects/${project.slug}`, token, {
    reconciliationDate: RECON_DATE,
    bankStatementClosingBalance: MANUAL.bankClosing,
  })

  const proj2 = await api('GET', `/projects/${project.slug}`, token)
  console.log('\nMapping documents...')
  for (const doc of proj2.documents || []) {
    const isCash = doc.type.startsWith('cash_book_')
    let mapping
    let sheetIndex = 0
    if (isCash) {
      mapping = { ...CASH_MAP }
      sheetIndex = CASH_SHEET_INDEX
      if (doc.type === 'cash_book_receipts') delete mapping.amt_paid
      else delete mapping.amt_received
    } else {
      mapping = doc.type === 'bank_credits' ? { ...BANK_MAP_CREDITS } : { ...BANK_MAP_DEBITS }
    }
    const mapped = await api('POST', `/documents/${doc.id}/map`, token, { mapping, sheetIndex })
    console.log(`  ${doc.type}: ${mapped.count} transactions (sheet ${sheetIndex})`)
  }

  try {
    const cleared = await api('DELETE', `/reconcile/${project.slug}/matches`, token)
    console.log(`\nCleared ${cleared.deleted ?? 0} existing match(es)`)
  } catch (e) {
    console.log('\nCould not clear matches:', e.message)
  }

  console.log('\nAuto-matching...')
  const totalMatched = await autoMatch(API, token, project.slug)
  console.log(`  Total bulk matched: ${totalMatched}`)

  const rec2 = await api('GET', `/reconcile/${project.slug}`, token)
  console.log(`\nAfter auto-match:`)
  console.log(`  Matched pairs: ${rec2.matchedCount ?? rec2.matches?.length ?? '?'}`)
  console.log(`  Unmatched receipts: ${rec2.unmatched?.receipts?.length ?? '?'}`)
  console.log(`  Unmatched payments: ${rec2.unmatched?.payments?.length ?? '?'}`)
  console.log(`  Unmatched credits: ${rec2.unmatched?.credits?.length ?? '?'}`)
  console.log(`  Unmatched debits: ${rec2.unmatched?.debits?.length ?? '?'}`)

  console.log('\nGenerating report...')
  const report = await api('GET', `/report/${project.slug}?workbookNetting=1`, token)
  const brs = report.brsStatement || {}
  console.log('\n=== PLATFORM vs MANUAL BRS (acct 2, 31 Aug 2018) ===')
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
  console.log(`  ℹ Matched pairs: ${report.summary?.matchedCount ?? totalMatched}`)
  console.log(`  ℹ Unpresented BRS rows: ${report.unpresentedChequesForBrs?.length ?? 0}`)
  console.log(`\nProject slug: ${project.slug}`)
  console.log(`Web UI: http://localhost:9100/projects/${project.slug}`)
  const allOk = checks.every(Boolean) && tieOutOk
  process.exit(allOk ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
