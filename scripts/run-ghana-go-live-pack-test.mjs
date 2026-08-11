#!/usr/bin/env node
/**
 * End-to-end: Ghana go-live pack → Horizon premium account → compare golden BRS.
 *
 * Account (created + upgraded to premium):
 *   accounts@horizonbrokers.gh / Test123!
 *
 * Usage:
 *   API_URL=http://localhost:9101 node scripts/run-ghana-go-live-pack-test.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA = path.join(ROOT, 'test-data', 'ghana-go-live-pack')

const API = process.env.API_URL || 'http://localhost:9101'
const EMAIL = process.env.BRS_TEST_EMAIL || 'accounts@horizonbrokers.gh'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'

const PROJECT_NAME =
  process.env.BRS_GOLIVE_PROJECT_NAME || 'Horizon Ecobank Go-Live Jun 2026 v3'
const RECON_DATE = '2026-06-30T00:00:00.000Z'

/** Golden totals from test-data/ghana-go-live-pack/README.md */
const MANUAL = {
  bankClosing: 372007.29,
  cashBookBalance: 373162.54,
  uncredited: 16200.0,
  unpresented: 15200.0,
  bankOnlyDebits: 280.0,
  bankOnlyCredits: 124.75,
}

/** Cash book Sheet1 headers on row with DATE…BALANCE: cols 0–8 */
const CASH_MAP = {
  date: 0,
  name: 1,
  details: 2,
  doc_ref: 3,
  chq_no: 4,
  accode: 5,
  amt_received: 6,
  amt_paid: 7,
}

/**
 * After Stanbic-style normalize the preview columns are:
 * Transaction Date, Value Date, Description, Fee, Debit, Credit, Balance
 */
const BANK_MAP_CREDITS = {
  transaction_date: 0,
  description: 2,
  credit: 5,
}
const BANK_MAP_DEBITS = {
  transaction_date: 0,
  description: 2,
  debit: 4,
}

const RECONCILE_LIMIT = 40_000

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
      await new Promise((r) => setTimeout(r, 10_000 * (attempt + 1)))
      continue
    }
    if (!res.ok) throw new Error(`${method} ${p} → ${res.status}: ${json.error || text.slice(0, 400)}`)
    return json
  }
  throw new Error(`${method} ${p} → rate limited`)
}

async function uploadFile(token, projectId, route, filePath, fields) {
  const form = new FormData()
  const buf = fs.readFileSync(filePath)
  form.append('file', new Blob([buf]), path.basename(filePath))
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v))
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
    [0.9, 'safe'],
    [0.85, 'all'],
    [0.75, 'all'],
    [0.6, 'all'],
    [0.45, 'all'],
    [0.3, 'all'],
  ]
  for (const [minConf, mode] of phases) {
    for (let round = 0; round < 12; round++) {
      const rec = await api('GET', `/reconcile/${projectSlug}?limit=${RECONCILE_LIMIT}`, token)
      const allSug = [...(rec.suggestions?.payments || []), ...(rec.suggestions?.receipts || [])]
        .filter((s) => s.confidence >= minConf && (mode !== 'safe' || !s.duplicateWarning))
        .sort((a, b) => b.confidence - a.confidence)
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
      console.log(`  conf≥${minConf} round ${round + 1}: matched ${n}`)
      await new Promise((r) => setTimeout(r, 250))
    }
  }

  // Force equal-amount 1:1 for leftovers (duplicate-amount challenge cases, salaries, T-bills)
  const rec = await api('GET', `/reconcile/${projectSlug}?limit=${RECONCILE_LIMIT}`, token)
  const matchedCb = new Set(rec.matchedCashBookIds || [])
  const matchedBank = new Set(rec.matchedBankIds || [])
  const pairSides = [
    [rec.receipts?.transactions || [], rec.credits?.transactions || []],
    [rec.payments?.transactions || [], rec.debits?.transactions || []],
  ]
  const forced = []
  for (const [cbs, banks] of pairSides) {
    const bankByAmt = new Map()
    for (const b of banks) {
      if (matchedBank.has(b.id)) continue
      const a = Math.round(Number(b.amount) * 100)
      if (!bankByAmt.has(a)) bankByAmt.set(a, [])
      bankByAmt.get(a).push(b)
    }
    for (const c of cbs) {
      if (matchedCb.has(c.id)) continue
      const a = Math.round(Number(c.amount) * 100)
      const list = bankByAmt.get(a) || []
      const b = list.shift()
      if (!b) continue
      forced.push({ cashBookTransactionId: c.id, bankTransactionId: b.id })
      matchedCb.add(c.id)
      matchedBank.add(b.id)
    }
  }
  if (forced.length) {
    const bulk = await api('POST', `/reconcile/${projectSlug}/match/bulk`, token, { matches: forced })
    const n = bulk.created ?? bulk.count ?? forced.length
    totalMatched += n
    console.log(`  forced equal-amount 1:1: matched ${n}`)
  }

  // One-to-many: two batch receipts (6200+3800) → one bank credit 10000
  const rec2 = await api('GET', `/reconcile/${projectSlug}?limit=${RECONCILE_LIMIT}`, token)
  const matchedCb2 = new Set(rec2.matchedCashBookIds || [])
  const matchedBank2 = new Set(rec2.matchedBankIds || [])
  const batchReceipts = (rec2.receipts?.transactions || []).filter(
    (t) => !matchedCb2.has(t.id) && /batch|combined bank deposit/i.test(t.details || '')
  )
  const batchCredit = (rec2.credits?.transactions || []).find(
    (t) => !matchedBank2.has(t.id) && /BATCH-DEP/i.test(t.details || '')
  )
  if (batchReceipts.length >= 2 && batchCredit) {
    const ids = batchReceipts.slice(0, 2).map((t) => t.id)
    await api('POST', `/reconcile/${projectSlug}/match/multi`, token, {
      cashBookTransactionIds: ids,
      bankTransactionId: batchCredit.id,
    })
    totalMatched += 1
    console.log('  one-to-many batch deposit matched')
  }

  return totalMatched
}

async function main() {
  const cashPath = path.join(DATA, '01_cash_book_horizon_jun2026.xlsx')
  const bankPath = path.join(DATA, '02_bank_statement_ecobank_jun2026.xlsx')
  for (const f of [cashPath, bankPath]) {
    if (!fs.existsSync(f)) throw new Error(`Missing ${f}`)
  }

  console.log('API:', API)
  console.log('Account:', EMAIL)
  console.log('Pack:', DATA)

  const login = await api('POST', '/auth/login', null, { email: EMAIL, password: PASSWORD })
  const token = login.token
  console.log('Login OK — org:', login.org?.name, '| role:', login.role)

  const me = await api('GET', '/auth/me', token).catch(() => null)
  if (me?.org) console.log('Plan:', me.org.plan || me.organization?.plan || '(see admin)')

  const projectsRaw = await api('GET', '/projects', token)
  const projects = Array.isArray(projectsRaw) ? projectsRaw : projectsRaw.projects ?? []
  let project = projects.find((p) => p.name === PROJECT_NAME)
  if (!project) {
    project = await api('POST', '/projects', token, {
      name: PROJECT_NAME,
      currency: 'GHS',
      reconciliationDate: RECON_DATE,
      primaryBankName: 'Ecobank Ghana',
      primaryAccountNo: '1441002289035',
    })
    console.log('Created project:', project.name, `(${project.slug})`)
  } else {
    console.log('Using project:', project.name, `(${project.slug})`)
  }

  const proj = await api('GET', `/projects/${project.slug}`, token)
  if (!proj.documents?.length) {
    console.log('\nUploading cash book + bank statement (Excel)...')
    await uploadFile(token, proj.id, 'cash-book', cashPath, { type: 'receipts' })
    await uploadFile(token, proj.id, 'cash-book', cashPath, { type: 'payments' })
    await uploadFile(token, proj.id, 'bank-statement', bankPath, {
      type: 'credits',
      accountName: 'Ecobank Ghana',
      accountNo: '1441002289035',
    })
    await uploadFile(token, proj.id, 'bank-statement', bankPath, {
      type: 'debits',
      accountName: 'Ecobank Ghana',
      accountNo: '1441002289035',
    })
  } else {
    console.log('\nDocuments already present:', proj.documents.length)
  }

  await api('PATCH', `/projects/${project.slug}/report-comments`, token, {
    bankStatementClosingBalance: MANUAL.bankClosing,
    cashBookClosingBalance: MANUAL.cashBookBalance,
  })

  const proj2 = await api('GET', `/projects/${project.slug}`, token)
  console.log('\nMapping documents...')
  for (const doc of proj2.documents || []) {
    const isCash = doc.type.startsWith('cash_book_')
    const mapping = isCash
      ? { ...CASH_MAP }
      : doc.type === 'bank_credits'
        ? { ...BANK_MAP_CREDITS }
        : { ...BANK_MAP_DEBITS }
    const mapped = await api('POST', `/documents/${doc.id}/map`, token, { mapping, sheetIndex: 0 })
    console.log(`  ${doc.type}: ${mapped.count} transactions`)
  }

  try {
    const cleared = await api('DELETE', `/reconcile/${project.slug}/matches`, token)
    console.log(`\nCleared ${cleared.deleted ?? 0} existing match(es)`)
  } catch (e) {
    console.log('\nCould not clear matches:', e.message)
  }

  console.log('\nAuto-matching...')
  const totalMatched = await autoMatch(token, project.slug)
  console.log(`Total matched: ${totalMatched}`)

  const report = await api('GET', `/report/${project.slug}`, token)
  const brs = report.brsStatement || {}
  console.log('\n=== PLATFORM vs GOLDEN BRS (Horizon Jun 2026) ===')
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
    `  ${tieOutOk ? '✓' : 'ℹ'} Tie-out variance: ${tieOut} (derived CB ${brs.workbookScheduleDerivedCashBook})`
  )
  console.log(`  ℹ Matched pairs: ${report.summary?.matchedCount ?? totalMatched}`)
  console.log(
    `  ℹ Unmatched (R/P/C/D): ${report.summary?.unmatchedReceipts ?? '?'} / ${report.summary?.unmatchedPayments ?? '?'} / ${report.summary?.unmatchedCredits ?? '?'} / ${report.summary?.unmatchedDebits ?? '?'}`
  )
  console.log(`\nProject slug: ${project.slug}`)
  console.log(`Web UI: http://localhost:9100/projects/${project.slug}`)
  console.log(`Login: ${EMAIL} / ${PASSWORD} (premium)`)

  // Write run result next to pack
  const out = {
    ranAt: new Date().toISOString(),
    api: API,
    email: EMAIL,
    projectSlug: project.slug,
    projectUrl: `http://localhost:9100/projects/${project.slug}`,
    matched: report.summary?.matchedCount ?? totalMatched,
    unmatched: {
      receipts: report.summary?.unmatchedReceipts,
      payments: report.summary?.unmatchedPayments,
      credits: report.summary?.unmatchedCredits,
      debits: report.summary?.unmatchedDebits,
    },
    platform: {
      bankClosingBalance: brs.bankClosingBalance,
      balancePerCashBook: brs.balancePerCashBook,
      uncreditedLodgmentsTimingTotal: brs.uncreditedLodgmentsTimingTotal,
      unpresentedChequesTotal: brs.unpresentedChequesTotal,
      bankOnlyDebitsNotInCashBookTotal: brs.bankOnlyDebitsNotInCashBookTotal,
      bankOnlyCreditsNotInCashBookTotal: brs.bankOnlyCreditsNotInCashBookTotal,
      workbookScheduleTieOutVariance: tieOut,
      workbookScheduleDerivedCashBook: brs.workbookScheduleDerivedCashBook,
    },
    golden: MANUAL,
    checksOk: checks.every(Boolean),
    tieOutOk,
  }
  fs.writeFileSync(path.join(DATA, '05_platform_run_result.json'), JSON.stringify(out, null, 2))
  console.log('\nWrote test-data/ghana-go-live-pack/05_platform_run_result.json')

  process.exit(checks.every(Boolean) && tieOutOk ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
