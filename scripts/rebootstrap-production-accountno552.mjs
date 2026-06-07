#!/usr/bin/env node
/**
 * Rebuild a production (or any) Ecobank 9033 project from accountno552records xlsx.
 * Deletes existing slug, recreates, uploads, maps, sets BRS notes, clears matches, auto-matches.
 *
 * Usage:
 *   API_URL=https://api.kqsoftwaresolutions.com node scripts/rebootstrap-production-accountno552.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA = path.join(ROOT, 'accountno552records')

const API = process.env.API_URL || 'https://api.kqsoftwaresolutions.com'
const EMAIL = process.env.BRS_TEST_EMAIL || 'premium@test.com'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'
const PROJECT_SLUG = process.env.BRS_PROJECT_SLUG || 'lordship-ecobank-9033-q1-2026'
const PROJECT_NAME = process.env.BRS_PROJECT_NAME || 'Lordship – Ecobank 9033 Q1 2026'
const RECON_DATE = '2026-03-31T00:00:00.000Z'
const BANK_CLOSING = 18643.29

/** From Account901 brs as at 31.3.2026.xlsx — Ecobank 1441001519033 */
const MANUAL = {
  bankClosing: 18643.29,
  cashBookBalance: 378557.29,
  uncredited: 0,
  unpresented: 10660.97,
  bankOnlyDebits: 374054.7,
  bankOnlyCredits: 3479.73,
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

const ECOBANK_REASON_RE =
  /Ecobank clearing|Ecobank transfer|Ecobank withdrawal|Ecobank statutory deposit/i

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

async function autoMatch(token, slug) {
  let totalMatched = 0
  const phases = [
    ['A-safe', 0.9, 'safe'],
    ['B-ecobank+receipts', 0.85, 'phaseB'],
  ]
  for (const [phase, minConf, mode] of phases) {
    for (let round = 0; round < 8; round++) {
      const rec = await api('GET', `/reconcile/${slug}`, token)
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
      const bulk = await api('POST', `/reconcile/${slug}/match/bulk`, token, { matches: toBulk })
      const n = bulk.created ?? bulk.count ?? toBulk.length
      totalMatched += n
      console.log(`  ${phase} round ${round + 1}: matched ${n} pairs`)
    }
  }
  return totalMatched
}

async function main() {
  console.log('API:', API)
  console.log('Account:', EMAIL)
  console.log('Target slug:', PROJECT_SLUG)

  for (const f of ['LIBcashbk1 2026 1qtr.xlsx', '1778163944552 dated 4.6.26.xlsx']) {
    if (!fs.existsSync(path.join(DATA, f))) throw new Error(`Missing ${f} in accountno552records/`)
  }

  const token = await login()
  console.log('Login OK')

  try {
    await api('DELETE', `/projects/${PROJECT_SLUG}`, token)
    console.log(`Deleted existing project: ${PROJECT_SLUG}`)
  } catch (e) {
    console.log(`No project to delete (${PROJECT_SLUG}):`, e.message)
  }

  const project = await api('POST', '/projects', token, {
    name: PROJECT_NAME,
    currency: 'GHS',
    reconciliationDate: RECON_DATE,
    primaryBankName: 'Ecobank Tesano',
    primaryAccountNo: '1441001519033',
  })
  console.log('Created project:', project.name, `(${project.slug})`)

  const acct = 'Ecobank Tesano 1441001519033'
  const acctNo = '1441001519033'
  const cb = path.join(DATA, 'LIBcashbk1 2026 1qtr.xlsx')
  const bank = path.join(DATA, '1778163944552 dated 4.6.26.xlsx')

  console.log('\nUploading cash book + bank xlsx...')
  await uploadFile(token, project.id, 'cash-book', cb, { type: 'receipts' })
  await uploadFile(token, project.id, 'cash-book', cb, { type: 'payments' })
  await uploadFile(token, project.id, 'bank-statement', bank, { type: 'credits', accountName: acct, accountNo: acctNo })
  await uploadFile(token, project.id, 'bank-statement', bank, { type: 'debits', accountName: acct, accountNo: acctNo })

  const proj = await api('GET', `/projects/${project.slug}`, token)
  console.log('\nMapping documents...')
  for (const doc of proj.documents || []) {
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

  await api('PATCH', `/projects/${project.slug}/report-comments`, token, {
    bankStatementClosingBalance: BANK_CLOSING,
  })
  console.log(`\nSet bank closing balance: ${BANK_CLOSING}`)

  console.log('\nAuto-matching (phase A + B)...')
  const totalMatched = await autoMatch(token, project.slug)
  console.log(`Total bulk matched: ${totalMatched}`)

  const report = await api('GET', `/report/${project.slug}?workbookNetting=1`, token)
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
  console.log(`\nMatched pairs: ${report.summary?.matchedCount ?? totalMatched}`)
  console.log(`Unpresented BRS rows: ${report.unpresentedChequesForBrs?.length ?? 0}`)
  console.log(`Reconciliation date: ${report.project?.reconciliationDate}`)
  console.log(`Web: https://kqsoftwaresolutions.com/projects/${project.slug}`)
  process.exit(checks.every(Boolean) ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
