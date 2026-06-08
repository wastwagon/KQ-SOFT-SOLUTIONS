/**
 * Shared Ecobank 9033 Q1 setup: upload accountno552records, map, auto-match.
 * Used by run-accountno552-test.mjs and run-accountno552-rollforward-test.mjs.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.join(__dirname, '../..')
export const DATA = path.join(ROOT, 'accountno552records')

export const Q1_PROJECT_NAME =
  process.env.BRS_Q1_PROJECT_NAME || 'Lordship – Ecobank 9033 Q1 2026 (accountno552)'
export const Q1_PROJECT_SLUG = process.env.BRS_Q1_SLUG || null
export const Q1_RECON_DATE = '2026-03-31T00:00:00.000Z'

/** From Account901 brs as at 31.3.2026.xlsx — Ecobank 1441001519033 */
export const MANUAL_Q1 = {
  bankClosing: 18643.29,
  cashBookBalance: 378557.29,
  uncredited: 0,
  unpresented: 10660.97,
  bankOnlyDebits: 374054.7,
  bankOnlyCredits: 3479.73,
  matchedPairs: 54,
}

export const CASH_MAP = {
  date: 0,
  name: 1,
  details: 2,
  doc_ref: 3,
  chq_no: 4,
  accode: 5,
  amt_received: 6,
  amt_paid: 7,
}

export const ECOBANK_REASON_RE =
  /Ecobank clearing|Ecobank transfer|Ecobank withdrawal|Ecobank statutory deposit/i

/** Section A unpresented rows carried at roll-forward (before workbook group netting on Q2 line). */
export const Q1_ROLLFORWARD_CHQS = {
  925928: 2000,
  926023: 510.7,
  926072: 650,
  926073: 4839.56,
}

export function q1RollForwardRawTotal() {
  return Object.values(Q1_ROLLFORWARD_CHQS).reduce((s, n) => s + n, 0)
}

export function normalizeChqNo(chq) {
  const digits = String(chq || '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/^0+/, '') || '0'
}

export function chqAmountMap(items) {
  const map = new Map()
  for (const item of items || []) {
    const key = normalizeChqNo(item.chqNo)
    if (!key) continue
    map.set(key, (map.get(key) || 0) + item.amount)
  }
  return map
}

export async function api(API, method, p, token, body) {
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

export async function login(API, email, password) {
  const data = await api(API, 'POST', '/auth/login', null, { email, password })
  return data.token
}

export async function uploadFile(API, token, projectId, route, filePath, fields) {
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

export async function mapAllDocuments(API, token, projectSlug) {
  const proj = await api(API, 'GET', `/projects/${projectSlug}`, token)
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
          ? { transaction_date: 0, description: 1, credit: pre.suggestedMapping?.credit ?? 5 }
          : { transaction_date: 0, description: 1, debit: pre.suggestedMapping?.debit ?? 4 }
    }
    await api(API, 'POST', `/documents/${doc.id}/map`, token, { mapping, sheetIndex: 0 })
  }
  return proj
}

export async function autoMatchEcobank(API, token, projectSlug, { safeOnly = false } = {}) {
  let totalMatched = 0
  const phases = safeOnly
    ? [['A-safe', 0.9, 'safe']]
    : [
        ['A-safe', 0.9, 'safe'],
        ['B-ecobank+receipts', 0.85, 'phaseB'],
      ]
  for (const [phase, minConf, mode] of phases) {
    for (let round = 0; round < 8; round++) {
      const rec = await api(API, 'GET', `/reconcile/${projectSlug}`, token)
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
      const bulk = await api(API, 'POST', `/reconcile/${projectSlug}/match/bulk`, token, { matches: toBulk })
      const n = bulk.created ?? bulk.count ?? toBulk.length
      totalMatched += n
      if (process.env.VERBOSE_MATCH) console.log(`  ${phase} round ${round + 1}: matched ${n}`)
    }
  }
  return totalMatched
}

const LOCKED_Q1_STATUSES = new Set(['completed', 'approved', 'submitted_for_review'])

export async function ensureQ1Project(API, token) {
  for (const f of ['LIBcashbk1 2026 1qtr.xlsx', '1778163944552 dated 4.6.26.xlsx']) {
    if (!fs.existsSync(path.join(DATA, f))) throw new Error(`Missing ${f} in ${DATA}`)
  }

  const projectsRaw = await api(API, 'GET', '/projects', token)
  const projects = Array.isArray(projectsRaw) ? projectsRaw : projectsRaw.projects ?? []
  let project = projects.find((p) => p.name === Q1_PROJECT_NAME)
  if (!project) {
    project = await api(API, 'POST', '/projects', token, {
      name: Q1_PROJECT_NAME,
      currency: 'GHS',
      reconciliationDate: Q1_RECON_DATE,
      primaryBankName: 'Ecobank Tesano',
      primaryBankAccountNo: '1441001519033',
    })
  } else if (!LOCKED_Q1_STATUSES.has(project.status)) {
    await api(API, 'PATCH', `/projects/${project.slug}`, token, {
      reconciliationDate: Q1_RECON_DATE,
      primaryBankName: 'Ecobank Tesano',
      primaryBankAccountNo: '1441001519033',
      bankStatementClosingBalance: MANUAL_Q1.bankClosing,
    })
  }

  const proj = await api(API, 'GET', `/projects/${project.slug}`, token)
  if (LOCKED_Q1_STATUSES.has(proj.status)) {
    return { project: proj, totalMatched: 0, locked: true }
  }
  if (!proj.documents?.length) {
    const cb = path.join(DATA, 'LIBcashbk1 2026 1qtr.xlsx')
    const bank = path.join(DATA, '1778163944552 dated 4.6.26.xlsx')
    const acct = 'Ecobank Tesano 1441001519033'
    const acctNo = '1441001519033'
    await uploadFile(API, token, proj.id, 'cash-book', cb, { type: 'receipts' })
    await uploadFile(API, token, proj.id, 'cash-book', cb, { type: 'payments' })
    await uploadFile(API, token, proj.id, 'bank-statement', bank, {
      type: 'credits',
      accountName: acct,
      accountNo: acctNo,
    })
    await uploadFile(API, token, proj.id, 'bank-statement', bank, {
      type: 'debits',
      accountName: acct,
      accountNo: acctNo,
    })
  }

  await api(API, 'PATCH', `/projects/${project.slug}`, token, {
    bankStatementClosingBalance: MANUAL_Q1.bankClosing,
  })

  await mapAllDocuments(API, token, project.slug)

  try {
    await api(API, 'DELETE', `/reconcile/${project.slug}/matches`, token)
  } catch {
    /* no matches yet */
  }

  const totalMatched = await autoMatchEcobank(API, token, project.slug, {
    safeOnly: process.env.SAFE_MATCH_ONLY === '1',
  })

  return { project, totalMatched }
}

export async function ensureProjectCompleted(API, token, projectSlug) {
  const proj = await api(API, 'GET', `/projects/${projectSlug}`, token)
  if (proj.status === 'completed') return proj
  if (proj.status === 'submitted_for_review') {
    await api(API, 'PATCH', `/projects/${projectSlug}/approve`, token)
    return api(API, 'GET', `/projects/${projectSlug}`, token)
  }
  if (proj.status !== 'reconciling' && proj.status !== 'mapping' && proj.status !== 'draft') {
    await api(API, 'PATCH', `/projects/${projectSlug}/reopen`, token)
  }
  await api(API, 'PATCH', `/projects/${projectSlug}/submit`, token)
  await api(API, 'PATCH', `/projects/${projectSlug}/approve`, token)
  return api(API, 'GET', `/projects/${projectSlug}`, token)
}
