#!/usr/bin/env node
/**
 * End-to-end test: testofacct430 → Premium project → compare with manual BRS.
 * TGL — GT Bank EUR 201/105646/430, as at 31 Dec 2018.
 *
 * Usage: API_URL=http://localhost:9101 node scripts/run-acct430-test.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA = path.join(ROOT, 'testofacct430')

const API = process.env.API_URL || 'http://localhost:9101'
const EMAIL = process.env.BRS_TEST_EMAIL || 'premium@test.com'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'

const PROJECT_NAME =
  process.env.BRS_ACCT430_PROJECT_NAME || 'TGL GT Bank EUR 430 (Dec 2018)'
const RECON_DATE = '2018-12-31T00:00:00.000Z'

/** From acct430 brs.xlsx — manual workbook tie-out. */
const MANUAL = {
  bankClosing: 83.72,
  cashBookBalance: 8977.46,
  uncredited: 8148.38,
  unpresented: 3244.63,
  bankOnlyDebits: 4209.99,
  bankOnlyCredits: 220,
}

/**
 * Cash book Sheet1: … Transaction Date(4), Description(6), Amount GHS(7), …
 * Foreign Currency Amount(11) — EUR amounts used in manual BRS.
 */
const CASH_MAP = {
  date: 4,
  name: 6,
  details: 6,
  doc_ref: 13,
  chq_no: 12,
  accode: 0,
  amt_received: 11,
  amt_paid: 11,
}

const CASH_SHEET_INDEX = 0

/** Bank Sheet1: Trans. Date(0), Debits(3), Credits(4), Remarks(7) */
const BANK_MAP_CREDITS = {
  transaction_date: 0,
  description: 7,
  credit: 4,
}

const BANK_MAP_DEBITS = {
  transaction_date: 0,
  description: 7,
  debit: 3,
}

const BANK_SHEET_INDEX = 0

const RECONCILE_LIMIT = 40_000

const GTB_REASON_RE =
  /GTB|SWIFT|FUND TRANSFER|COMMISSION|INWARD TRANSFER|TRSF|TRANSFER|Amount \+/i

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
    if (!res.ok) throw new Error(`${method} ${p} → ${res.status}: ${json.error || text.slice(0, 300)}`)
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

async function autoMatch(token, projectSlug) {
  let totalMatched = 0
  const phases = [
    ['A-safe', 0.9, 'safe'],
    ['B-patterns', 0.85, 'phaseB'],
    ['C-all', 0.75, 'all'],
    ['D-low', 0.6, 'all'],
  ]
  for (const [phase, minConf, mode] of phases) {
    for (let round = 0; round < 10; round++) {
      const rec = await api('GET', `/reconcile/${projectSlug}?limit=${RECONCILE_LIMIT}`, token)
      const paymentSug = rec.suggestions?.payments || []
      const receiptSug = rec.suggestions?.receipts || []
      const allSug = (
        mode === 'phaseB'
          ? [
              ...receiptSug.filter(
                (s) =>
                  s.confidence >= minConf &&
                  !s.duplicateWarning &&
                  GTB_REASON_RE.test(s.reason || '')
              ),
              ...paymentSug.filter(
                (s) =>
                  s.confidence >= minConf &&
                  !s.duplicateWarning &&
                  (s.ecobankPattern || GTB_REASON_RE.test(s.reason || ''))
              ),
            ]
          : [...paymentSug, ...receiptSug].filter(
              (s) => s.confidence >= minConf && (mode !== 'safe' || !s.duplicateWarning)
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
      await new Promise((r) => setTimeout(r, 300))
    }
  }
  return totalMatched
}

async function main() {
  console.log('API:', API)
  console.log('Data:', DATA)

  for (const f of ['acct430 cash book.xlsx', 'acct430 bank statement.xlsx']) {
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
      currency: 'EUR',
      reconciliationDate: RECON_DATE,
      primaryBankName: 'GT Bank',
      primaryAccountNo: '201/105646/430',
    })
    console.log('Created project:', project.name, `(${project.slug})`)
  } else {
    console.log('Using project:', project.name, `(${project.slug})`)
  }

  const proj = await api('GET', `/projects/${project.slug}`, token)
  if (!proj.documents?.length) {
    const cb = path.join(DATA, 'acct430 cash book.xlsx')
    const bank = path.join(DATA, 'acct430 bank statement.xlsx')
    const acct = 'GT Bank EUR 201/105646/430'
    const acctNo = '201/105646/430'
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

  await api('PATCH', `/projects/${project.slug}/report-comments`, token, {
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
    } else {
      sheetIndex = BANK_SHEET_INDEX
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

  console.log('\nSkipping auto-match (GT EUR BRS uses timing/bank-only schedules, not 1:1 pairs).')
  const totalMatched = 0

  const report = await api('GET', `/report/${project.slug}`, token)
  const brs = report.brsStatement || {}
  console.log('\n=== PLATFORM vs MANUAL BRS (acct 430, 31 Dec 2018) ===')
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
  console.log(
    `  ℹ Unmatched (R/P/C/D): ${report.summary?.unmatchedReceipts ?? '?'} / ${report.summary?.unmatchedPayments ?? '?'} / ${report.summary?.unmatchedCredits ?? '?'} / ${report.summary?.unmatchedDebits ?? '?'}`
  )
  console.log(`\nProject slug: ${project.slug}`)
  console.log(`Web UI: http://localhost:9100/projects/${project.slug}`)

  const allOk = checks.every(Boolean) && tieOutOk
  process.exit(allOk ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
