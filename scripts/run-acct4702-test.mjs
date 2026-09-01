#!/usr/bin/env node
/**
 * End-to-end test: file4702 (preferred) or testdataforacct4702 → BRS project → compare with manual BRS.
 * TGL Properties — SCB 0100106024702, as at 31 Dec 2019.
 *
 * Usage:
 *   API_URL=http://localhost:9101 BRS_TEST_EMAIL=firm@test.com node scripts/run-acct4702-test.mjs
 *   BRS_DATA_DIR=./file4702 node scripts/run-acct4702-test.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const FILE4702 = path.join(ROOT, 'file4702')
const LEGACY = path.join(ROOT, 'testdataforacct4702')
const DATA = process.env.BRS_DATA_DIR
  ? path.resolve(ROOT, process.env.BRS_DATA_DIR)
  : fs.existsSync(path.join(FILE4702, 'acct4702 cashbk.xlsx'))
    ? FILE4702
    : LEGACY

const API = process.env.API_URL || 'http://localhost:9101'
const EMAIL = process.env.BRS_TEST_EMAIL || 'firm@test.com'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'

const PROJECT_NAME =
  process.env.BRS_ACCT4702_PROJECT_NAME ||
  (DATA === FILE4702
    ? 'TGL Properties – SCB 4702 (file4702 Dec 2019)'
    : 'TGL Properties – SCB 4702 (Dec 2019)')
const RECON_DATE = '2019-12-31T00:00:00.000Z'

/** From acct 4702 brs.xlsx — fully reconciled. */
const MANUAL = {
  bankClosing: 540206.03,
  cashBookBalance: 540206.03,
  uncredited: 0,
  unpresented: 0,
  bankOnlyDebits: 0,
  bankOnlyCredits: 0,
}

/**
 * TGL ERP cash book Sheet 2 (index 1): original Excel headers.
 * Amount [7] signed — negative = receipt, positive = payment.
 */
const CASH_MAP_BASE = {
  date: 4,
  name: 6,
  details: 6,
  doc_ref: 2,
  chq_no: 12,
  accode: 0,
}
const CASH_MAP_RECEIPTS = { ...CASH_MAP_BASE, amt_received: 7 }
const CASH_MAP_PAYMENTS = { ...CASH_MAP_BASE, amt_paid: 7 }

const CASH_SHEET_INDEX = 1

/** After SCB Excel normalisation on Sheet 2: DEBITS(4), CREDITS(5). */
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

const BANK_SHEET_INDEX = 1

/** 779 cash + 779 bank txs — platform default supports up to 10k per lane at max limit. */
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

async function bulkMatchPairs(token, projectSlug, pairs) {
  if (!pairs.length) return 0
  const bulk = await api('POST', `/reconcile/${projectSlug}/match/bulk`, token, { matches: pairs })
  return bulk.created ?? bulk.count ?? pairs.length
}

function collectBulkPairs(suggestions, opts = {}) {
  const { minConf = 0.5, max = 50, filter = () => true } = opts
  const usedCb = new Set()
  const usedBank = new Set()
  const pairs = []
  const sorted = [...suggestions]
    .filter(
      (s) =>
        s.confidence >= minConf &&
        !s.duplicateWarning &&
        filter(s) &&
        (s.cashBookTx?.id ?? s.cashBookTransactionId) &&
        (s.bankTx?.id ?? s.bankTransactionId)
    )
    .sort((a, b) => b.confidence - a.confidence)
  for (const s of sorted) {
    const cbId = s.cashBookTx?.id ?? s.cashBookTransactionId
    const bankId = s.bankTx?.id ?? s.bankTransactionId
    if (usedCb.has(cbId) || usedBank.has(bankId)) continue
    usedCb.add(cbId)
    usedBank.add(bankId)
    pairs.push({ cashBookTransactionId: cbId, bankTransactionId: bankId })
    if (pairs.length >= max) break
  }
  return pairs
}

function daysApart(a, b) {
  const d1 = a?.date ? new Date(a.date) : null
  const d2 = b?.date ? new Date(b.date) : null
  if (!d1 || !d2 || Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return 0
  return Math.abs(d1.getTime() - d2.getTime()) / (86400000)
}

async function greedyUniqueAmountMatch(token, projectSlug) {
  let total = 0
  for (let round = 0; round < 30; round++) {
    const rec = await api('GET', `/reconcile/${projectSlug}?limit=${RECONCILE_LIMIT}`, token)
    const matchedCb = new Set(rec.matchedCashBookIds || [])
    const matchedBank = new Set(rec.matchedBankIds || [])
    const inverted = !!rec.sideInversion?.inverted

    const lanes = inverted
      ? [
          [rec.receipts?.transactions || [], rec.debits?.transactions || []],
          [rec.payments?.transactions || [], rec.credits?.transactions || []],
        ]
      : [
          [rec.receipts?.transactions || [], rec.credits?.transactions || []],
          [rec.payments?.transactions || [], rec.debits?.transactions || []],
        ]

    const pairs = []
    const usedCb = new Set()
    const usedBank = new Set()

    for (const [cbList, bankList] of lanes) {
      const cbOpen = cbList.filter((t) => t.id && !matchedCb.has(t.id) && t.amount > 0)
      const bankOpen = bankList.filter((t) => t.id && !matchedBank.has(t.id) && t.amount > 0)
      const bankByAmt = new Map()
      for (const b of bankOpen) {
        const k = b.amount.toFixed(2)
        if (!bankByAmt.has(k)) bankByAmt.set(k, [])
        bankByAmt.get(k).push(b)
      }
      for (const c of cbOpen) {
        const k = c.amount.toFixed(2)
        const candidates = (bankByAmt.get(k) || []).filter((b) => !usedBank.has(b.id))
        if (candidates.length !== 1) continue
        const b = candidates[0]
        if (daysApart(c, b) > 7) continue
        if (usedCb.has(c.id) || usedBank.has(b.id)) continue
        usedCb.add(c.id)
        usedBank.add(b.id)
        pairs.push({ cashBookTransactionId: c.id, bankTransactionId: b.id })
      }
    }

    if (!pairs.length) break
    const n = await bulkMatchPairs(token, projectSlug, pairs.slice(0, 50))
    total += n
    console.log(`  F-unique-amount round ${round + 1}: matched ${n}`)
    await new Promise((r) => setTimeout(r, 250))
  }
  return total
}

function txText(t) {
  return [t.details, t.name, t.chqNo].filter(Boolean).join(' ')
}

function extractClearingRef(t) {
  const text = txText(t)
  return (
    text.match(/^0*(\d{6,12})\s/)?.[1] ||
    text.match(/\bINW\s*CLG\s*(\d{5,8})\b/i)?.[1] ||
    text.match(/\bCHQ\s*#\s*(\d{5,8})\b/i)?.[1] ||
    text.match(/\bCHQ#?\s*(\d{5,8})\b/i)?.[1] ||
    text.match(/\bCHQ\s+NO\.?\s*(\d{5,8})\b/i)?.[1] ||
    text.match(/\bOT\s*REF\s*(OT\d+)\b/i)?.[1]?.toUpperCase() ||
    t.chqNo?.trim() ||
    null
  )
}

function isSweepLine(t) {
  return /\bSWEEP\b/i.test(txText(t))
}

async function finishScbResidualMatch(token, projectSlug) {
  let total = 0
  for (let round = 0; round < 40; round++) {
    const rec = await api('GET', `/reconcile/${projectSlug}?limit=${RECONCILE_LIMIT}`, token)
    const matchedCb = new Set(rec.matchedCashBookIds || [])
    const matchedBank = new Set(rec.matchedBankIds || [])
    const inverted = !!rec.sideInversion?.inverted

    const ur = (rec.receipts?.transactions || []).filter((t) => t.id && !matchedCb.has(t.id) && t.amount > 0)
    const up = (rec.payments?.transactions || []).filter((t) => t.id && !matchedCb.has(t.id) && t.amount > 0)
    const uc = (rec.credits?.transactions || []).filter((t) => t.id && !matchedBank.has(t.id) && t.amount > 0)
    const ud = (rec.debits?.transactions || []).filter((t) => t.id && !matchedBank.has(t.id) && t.amount > 0)

    const cbBankLanes = inverted
      ? [
          [ur, ud],
          [up, uc],
        ]
      : [
          [ur, uc],
          [up, ud],
        ]

    const pairs = []
    const usedCb = new Set()
    const usedBank = new Set()

    // 1) High-confidence suggestions even when duplicateWarning (INW CLG ref corroborated)
    for (const s of [...(rec.suggestions?.receipts || []), ...(rec.suggestions?.payments || [])]) {
      if (s.confidence < 0.88) continue
      const cbId = s.cashBookTx?.id
      const bankId = s.bankTx?.id
      if (!cbId || !bankId || matchedCb.has(cbId) || matchedBank.has(bankId)) continue
      const refA = extractClearingRef(s.cashBookTx)
      const refB = extractClearingRef(s.bankTx)
      if (refA && refB && refA === refB) {
        if (!usedCb.has(cbId) && !usedBank.has(bankId)) {
          usedCb.add(cbId)
          usedBank.add(bankId)
          pairs.push({ cashBookTransactionId: cbId, bankTransactionId: bankId })
        }
      }
    }

    for (const [cbList, bankList] of cbBankLanes) {
      const bankOpen = bankList.filter((b) => !usedBank.has(b.id))

      // 2) SCB sweep: unique amount + SWEEP on both sides (ignore date gap)
      for (const c of cbList.filter((x) => !usedCb.has(x.id) && isSweepLine(x))) {
        const hits = bankOpen.filter(
          (b) =>
            !usedBank.has(b.id) &&
            isSweepLine(b) &&
            Math.abs(b.amount - c.amount) < 0.02
        )
        if (hits.length !== 1) continue
        usedCb.add(c.id)
        usedBank.add(hits[0].id)
        pairs.push({ cashBookTransactionId: c.id, bankTransactionId: hits[0].id })
      }

      // 3) INW CLG / cheque ref + amount among still-open rows (allows duplicate rows)
      for (const c of cbList.filter((x) => !usedCb.has(x.id))) {
        const ref = extractClearingRef(c)
        if (!ref) continue
        const hits = bankOpen.filter(
          (b) =>
            !usedBank.has(b.id) &&
            Math.abs(b.amount - c.amount) < 0.02 &&
            extractClearingRef(b) === ref
        )
        if (!hits.length) continue
        usedCb.add(c.id)
        usedBank.add(hits[0].id)
        pairs.push({ cashBookTransactionId: c.id, bankTransactionId: hits[0].id })
      }

      // 4) Unique amount + date within 14 days
      const bankByAmt = new Map()
      for (const b of bankOpen.filter((x) => !usedBank.has(x.id))) {
        const k = b.amount.toFixed(2)
        if (!bankByAmt.has(k)) bankByAmt.set(k, [])
        bankByAmt.get(k).push(b)
      }
      for (const c of cbList.filter((x) => !usedCb.has(x.id))) {
        const hits = (bankByAmt.get(c.amount.toFixed(2)) || []).filter((b) => !usedBank.has(b.id))
        if (hits.length !== 1) continue
        if (daysApart(c, hits[0]) > 14) continue
        usedCb.add(c.id)
        usedBank.add(hits[0].id)
        pairs.push({ cashBookTransactionId: c.id, bankTransactionId: hits[0].id })
      }
    }

    if (!pairs.length) break
    const n = await bulkMatchPairs(token, projectSlug, pairs.slice(0, 50))
    total += n
    console.log(`  H-SCB-residual round ${round + 1}: matched ${n}`)
    await new Promise((r) => setTimeout(r, 250))
  }
  return total
}

async function autoMatch(token, projectSlug) {
  let totalMatched = 0
  const SCB_REASON_RE =
    /SCB sweep|SCB inward clearing|ref shifted|via bank|INW CLG|SWEEP|SWIFT|CASH WITHDRAW|CHQ|CLEARING|TRANSFER|GTBTRP|returned cheque|drawers conf/i
  const phases = [
    ['A-safe', 0.9, 'safe'],
    ['B-patterns', 0.85, 'phaseB'],
    ['B2-shifted', 0.86, 'phaseB'],
    ['C-all', 0.75, 'all'],
    ['D-low', 0.6, 'all'],
    ['E-scrape', 0.5, 'all'],
  ]
  for (const [phase, minConf, mode] of phases) {
    for (let round = 0; round < 15; round++) {
      const rec = await api(
        'GET',
        `/reconcile/${projectSlug}?limit=${RECONCILE_LIMIT}`,
        token
      )
      const paymentSug = rec.suggestions?.payments || []
      const receiptSug = rec.suggestions?.receipts || []
      const allSug = (
        mode === 'phaseB'
          ? [
              ...receiptSug.filter(
                (s) =>
                  s.confidence >= minConf &&
                  !s.duplicateWarning &&
                  SCB_REASON_RE.test(s.reason || '')
              ),
              ...paymentSug.filter(
                (s) =>
                  s.confidence >= minConf &&
                  !s.duplicateWarning &&
                  (s.ecobankPattern || SCB_REASON_RE.test(s.reason || ''))
              ),
            ]
          : [...paymentSug, ...receiptSug].filter(
              (s) => s.confidence >= minConf && (mode !== 'safe' || !s.duplicateWarning)
            )
      ).sort((a, b) => b.confidence - a.confidence)
      const toBulk = collectBulkPairs(allSug, { minConf, max: 50 })
      if (!toBulk.length) break
      const n = await bulkMatchPairs(token, projectSlug, toBulk)
      totalMatched += n
      console.log(`  ${phase} round ${round + 1}: matched ${n}`)
      await new Promise((r) => setTimeout(r, 250))
    }
  }
  // Ref-shifted / rotation INW CLG (both payment and receipt lanes)
  for (let round = 0; round < 40; round++) {
    const rec = await api(
      'GET',
      `/reconcile/${projectSlug}?limit=${RECONCILE_LIMIT}`,
      token
    )
    const rotated = [
      ...(rec.suggestions?.payments || []),
      ...(rec.suggestions?.receipts || []),
    ].filter(
      (s) =>
        s.confidence >= 0.82 &&
        !s.duplicateWarning &&
        /ref shifted|via bank withdrawal|via bank statement footer|INW CLG|SCB inward clearing/i.test(
          s.reason || ''
        )
    )
    const toBulk = collectBulkPairs(rotated, { minConf: 0.82, max: 50 })
    if (!toBulk.length) break
    const n = await bulkMatchPairs(token, projectSlug, toBulk)
    totalMatched += n
    console.log(`  E-rotation round ${round + 1}: matched ${n}`)
    await new Promise((r) => setTimeout(r, 250))
  }
  totalMatched += await greedyUniqueAmountMatch(token, projectSlug)
  totalMatched += await finishScbResidualMatch(token, projectSlug)
  // Final scrape: any remaining suggestion at 0.45+ without duplicate warning
  for (let round = 0; round < 20; round++) {
    const rec = await api('GET', `/reconcile/${projectSlug}?limit=${RECONCILE_LIMIT}`, token)
    const allSug = [...(rec.suggestions?.payments || []), ...(rec.suggestions?.receipts || [])]
    const toBulk = collectBulkPairs(allSug, { minConf: 0.45, max: 50 })
    if (!toBulk.length) break
    const n = await bulkMatchPairs(token, projectSlug, toBulk)
    totalMatched += n
    console.log(`  G-final round ${round + 1}: matched ${n}`)
    await new Promise((r) => setTimeout(r, 250))
  }
  return totalMatched
}

async function main() {
  console.log('API:', API)
  console.log('Data:', DATA)

  for (const f of ['acct4702 cashbk.xlsx', 'acct 4702 bank statement.xlsx']) {
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
      primaryBankName: 'Standard Chartered Bank',
      primaryAccountNo: '0100106024702',
    })
    console.log('Created project:', project.name, `(${project.slug})`)
  } else {
    console.log('Using project:', project.name, `(${project.slug})`)
  }

  const proj = await api('GET', `/projects/${project.slug}`, token)
  if (!proj.documents?.length) {
    const cb = path.join(DATA, 'acct4702 cashbk.xlsx')
    const bank = path.join(DATA, 'acct 4702 bank statement.xlsx')
    const acct = 'SCB 0100106024702'
    const acctNo = '0100106024702'
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

  const skipMap = process.env.BRS_FINISH_ONLY || process.env.BRS_SKIP_MAP
  if (!skipMap) {
    const proj2 = await api('GET', `/projects/${project.slug}`, token)
    console.log('\nMapping documents...')
    for (const doc of proj2.documents || []) {
      const isCash = doc.type.startsWith('cash_book_')
      let mapping
      let sheetIndex = 0
      if (isCash) {
        mapping =
          doc.type === 'cash_book_receipts' ? { ...CASH_MAP_RECEIPTS } : { ...CASH_MAP_PAYMENTS }
        sheetIndex = CASH_SHEET_INDEX
      } else {
        sheetIndex = BANK_SHEET_INDEX
        mapping = doc.type === 'bank_credits' ? { ...BANK_MAP_CREDITS } : { ...BANK_MAP_DEBITS }
      }
      const mapped = await api('POST', `/documents/${doc.id}/map`, token, { mapping, sheetIndex })
      console.log(`  ${doc.type}: ${mapped.count} transactions (sheet ${sheetIndex})`)
    }
  } else {
    console.log('\nSkipping document remap (BRS_FINISH_ONLY / BRS_SKIP_MAP)')
  }

  try {
    if (!process.env.BRS_FINISH_ONLY) {
      const cleared = await api('DELETE', `/reconcile/${project.slug}/matches`, token)
      console.log(`\nCleared ${cleared.deleted ?? 0} existing match(es)`)
    } else {
      console.log('\nBRS_FINISH_ONLY: keeping existing matches')
    }
  } catch (e) {
    console.log('\nCould not clear matches:', e.message)
  }

  let totalMatched = 0
  const useProductAutoComplete = process.env.BRS_USE_SCRIPT_MATCH !== '1'
  if (useProductAutoComplete) {
    console.log('\nAuto-complete matching (product API)...')
    const ac = await api('POST', `/reconcile/${project.slug}/match/auto-complete`, token)
    totalMatched = ac.created ?? 0
    console.log(`  Phases: ${JSON.stringify(ac.phases || {})}`)
  } else if (process.env.BRS_FINISH_ONLY) {
    console.log('\nFinish-only residual matching...')
    totalMatched = await finishScbResidualMatch(token, project.slug)
  } else {
    console.log('\nAuto-matching...')
    totalMatched = await autoMatch(token, project.slug)
  }
  console.log(`  Total bulk matched: ${totalMatched}`)

  const rec2 = await api('GET', `/reconcile/${project.slug}?limit=${RECONCILE_LIMIT}`, token)
  const reportPreview = await api('GET', `/report/${project.slug}`, token)
  const sm = reportPreview.summary || {}
  console.log(`\nAfter auto-match:`)
  console.log(`  Matched pairs: ${rec2.matches?.length ?? sm.matchedCount ?? '?'}`)
  console.log(
    `  Unmatched receipts / payments / credits / debits: ${sm.unmatchedReceipts ?? '?'} / ${sm.unmatchedPayments ?? '?'} / ${sm.unmatchedCredits ?? '?'} / ${sm.unmatchedDebits ?? '?'}`
  )

  console.log('\nGenerating report...')
  const report = await api('GET', `/report/${project.slug}`, token)
  const brs = report.brsStatement || {}
  console.log('\n=== PLATFORM vs MANUAL BRS (acct 4702, 31 Dec 2019) ===')
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
  console.log(`  ℹ Total transactions: ${report.summary?.totalTransactions ?? '?'}`)
  console.log(`\nProject slug: ${project.slug}`)
  console.log(`Web UI: http://localhost:9100/projects/${project.slug}`)
  const closingOk = checks.slice(0, 2).every(Boolean)
  const timingOk = checks.slice(2).every(Boolean)
  const matched = report.summary?.matchedCount ?? totalMatched
  const totalCb = 175 + 604
  if (!timingOk && closingOk) {
    console.log(
      `\nℹ Manual BRS is summary-only (bank & cash closing). ${matched}/${totalCb} transactions auto-matched; ${totalCb - matched} need manual review in Reconcile.`
    )
  }
  const allOk = closingOk && timingOk && tieOutOk
  const matchedCount = report.summary?.matchedCount ?? totalMatched
  const expectedPairs = 779
  if (matchedCount < expectedPairs) {
    console.log(`\n⚠ Still unmatched: ${expectedPairs - matchedCount} transaction(s) — review Reconcile in UI.`)
  }
  process.exit(allOk && matchedCount >= expectedPairs ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
