#!/usr/bin/env node
/**
 * End-to-end test: accountno552records → Premium project → compare with manual BRS (Ecobank 9033).
 * Usage: API_URL=http://localhost:9011 node scripts/run-accountno552-test.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA = path.join(ROOT, 'accountno552records')

// Workbook Groups 2–3 netting is opt-in; required for Account901 unpresented alignment.
process.env.GHANA_BRS_WORKBOOK_NETTING = process.env.GHANA_BRS_WORKBOOK_NETTING || '1'

const API = process.env.API_URL || 'http://localhost:9011'
const EMAIL = process.env.BRS_TEST_EMAIL || 'premium@test.com'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'

const PROJECT_NAME = 'Lordship – Ecobank 9033 Q1 2026 (accountno552)'
const RECON_DATE = '2026-03-31T00:00:00.000Z'

/** From Account901 brs as at 31.3.2026.xlsx — Ecobank 1441001519033 */
const MANUAL = {
  bankClosing: 18643.29,
  cashBookBalance: 378557.29,
  uncredited: 0,
  /** Derived from manual schedule arithmetic (bank + timing − unpresented + debits − credits = cash book). */
  unpresented: 10660.97,
  bankOnlyDebits: 374054.7,
  bankOnlyCredits: 3479.73,
  matchedPairs: 54,
}

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
  const d = Math.round((platform - manual) * 100) / 100
  const ok = Math.abs(d) < 0.02
  console.log(`  ${ok ? '✓' : '✗'} ${label}: manual=${manual} platform=${platform} Δ=${d}`)
  return ok
}

async function main() {
  console.log('API:', API)
  console.log('Data:', DATA)
  console.log('Login:', EMAIL)

  for (const f of ['LIBcashbk1 2026 1qtr.xlsx', '1778163944552 dated 4.6.26.xlsx']) {
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
      primaryBankName: 'Ecobank Tesano',
      primaryBankAccountNo: '1441001519033',
    })
    console.log('Created project:', project.name, `(${project.slug})`)
  } else {
    await api('PATCH', `/projects/${project.slug}`, token, {
      reconciliationDate: RECON_DATE,
      primaryBankName: 'Ecobank Tesano',
      primaryBankAccountNo: '1441001519033',
      bankStatementClosingBalance: MANUAL.bankClosing,
    })
    console.log('Using project:', project.name, `(${project.slug})`)
  }

  const proj = await api('GET', `/projects/${project.slug}`, token)
  if (!proj.documents?.length) {
    const cb = path.join(DATA, 'LIBcashbk1 2026 1qtr.xlsx')
    const bank = path.join(DATA, '1778163944552 dated 4.6.26.xlsx')
    const acct = 'Ecobank Tesano 1441001519033'
    const acctNo = '1441001519033'
    console.log('\nUploading cash book...')
    await uploadFile(token, proj.id, 'cash-book', cb, { type: 'receipts' })
    await uploadFile(token, proj.id, 'cash-book', cb, { type: 'payments' })
    console.log('Uploading bank statement (xlsx)...')
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
    bankStatementClosingBalance: MANUAL.bankClosing,
  })

  const proj2 = await api('GET', `/projects/${project.slug}`, token)
  console.log('\nMapping documents...')
  for (const doc of proj2.documents || []) {
    const isCash = doc.type.startsWith('cash_book_')
    let mapping
    if (isCash) {
      mapping = { ...CASH_MAP }
      if (doc.type === 'cash_book_receipts') delete mapping.amt_paid
      else delete mapping.amt_received
    } else {
      const pre = await api('GET', `/documents/${doc.id}/preview`, token)
      mapping =
        doc.type === 'bank_credits'
          ? { transaction_date: 0, description: 1, credit: pre.suggestedMapping?.credit ?? 5 }
          : { transaction_date: 0, description: 1, debit: pre.suggestedMapping?.debit ?? 4 }
    }
    const mapped = await api('POST', `/documents/${doc.id}/map`, token, { mapping, sheetIndex: 0 })
    console.log(`  ${doc.type}: ${mapped.count} transactions`)
  }

  try {
    const cleared = await api('DELETE', `/reconcile/${project.slug}/matches`, token)
    console.log(`\nCleared ${cleared.deleted ?? 0} existing match(es)`)
  } catch (e) {
    console.log('\nCould not clear matches:', e.message)
  }

  const safeOnly = process.env.SAFE_MATCH_ONLY === '1'
  console.log(
    safeOnly
      ? '\nAuto-matching (phase A only: 90%+ safe, skip duplicates)...'
      : '\nAuto-matching (phase A: 90%+ safe, phase B: receipts + Ecobank patterns 85%+)...'
  )
  let totalMatched = 0
  const ECOBANK_REASON_RE =
    /Ecobank clearing|Ecobank transfer|Ecobank withdrawal|Ecobank statutory deposit/i
  const phases = safeOnly
    ? [['A-safe', 0.9, 'safe']]
    : [
        ['A-safe', 0.9, 'safe'],
        ['B-ecobank+receipts', 0.85, 'phaseB'],
      ]
  for (const [phase, minConf, mode] of phases) {
    for (let round = 0; round < 8; round++) {
      const rec = await api('GET', `/reconcile/${project.slug}`, token)
      if (totalMatched === 0 && rec.duplicateChequeWarnings?.length) {
        console.log(
          '  Duplicate chq warnings:',
          rec.duplicateChequeWarnings.map((w) => `${w.chqNo}×${w.count}`).join(', ')
        )
      }
      if (totalMatched === 0 && rec.reconcileProfile?.ghanaBrs) {
        console.log(`  Ecobank Ghana profile active (clearing window ${rec.reconcileProfile.clearingDateWindowDays}d)`)
      }
      const clearingCount = rec.suggestions?.clearingPayments?.length ?? 0
      if (totalMatched === 0 && clearingCount) console.log(`  Ecobank clearing suggestions: ${clearingCount}`)
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
      const bulk = await api('POST', `/reconcile/${project.slug}/match/bulk`, token, { matches: toBulk })
      const n = bulk.created ?? bulk.count ?? toBulk.length
      totalMatched += n
      console.log(`  ${phase} round ${round + 1}: matched ${n} pairs`)
    }
  }
  console.log(`  Total bulk matched: ${totalMatched}`)

  const rec2 = await api('GET', `/reconcile/${project.slug}`, token)
  console.log(`\nAfter auto-match:`)
  console.log(`  Matched pairs: ${rec2.matchedCount ?? rec2.matches?.length ?? '?'}`)
  console.log(`  Unmatched receipts: ${rec2.unmatched?.receipts?.length ?? '?'}`)
  console.log(`  Unmatched payments: ${rec2.unmatched?.payments?.length ?? '?'}`)
  console.log(`  Unmatched credits: ${rec2.unmatched?.credits?.length ?? '?'}`)
  console.log(`  Unmatched debits: ${rec2.unmatched?.debits?.length ?? '?'}`)

  console.log('\nGenerating report (workbook netting:', process.env.GHANA_BRS_WORKBOOK_NETTING, ')...')
  const report = await api('GET', `/report/${project.slug}?workbookNetting=1`, token)
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
  console.log(`  ℹ Additional info unpresented: ${report.additionalInformation?.asAtReconciliationPosition?.unpresentedChequesOrUnclearedPayments}`)
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
