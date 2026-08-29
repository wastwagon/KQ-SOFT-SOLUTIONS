#!/usr/bin/env node
/**
 * Recreate Lordship Ecobank Q1 2026 projects on the firm account using the
 * verified (√) face-BRS path from the updated Account901/902 workbooks.
 *
 * - Deletes existing Lordship Q1/Q2 projects for a clean slate
 * - Uploads from accountno552records / accountno095details
 * - Turns workbook netting ON (9033 face unpresented = 10,660.97)
 * - Records preparer notes for √ vs ?? working columns
 * - Verifies platform totals against √ manual lines
 *
 * Usage:
 *   API_URL=http://localhost:9101 BRS_TEST_EMAIL=firm@test.com \
 *     node scripts/bootstrap-lordship-q1-firm.mjs
 *
 * See: file2/LORDSHIP_MANUAL_MARKS_REVIEW.md
 */
import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const API = process.env.API_URL || 'http://localhost:9101'
const EMAIL = process.env.BRS_TEST_EMAIL || 'firm@test.com'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'

/** √ face BRS targets (Account901 / Account902 updated workbooks). */
const MANUAL_9033 = {
  bankClosing: 18643.29,
  cashBook: 378557.29,
  uncredited: 0,
  unpresented: 10660.97,
  bankOnlyDebits: 374054.7,
  bankOnlyCredits: 3479.73,
  tieOut: 0,
  /** Working-paper ?? companions (not face BRS unless both used together). */
  workingUnpresented: 17825.86,
  workingBankOnlyDebits: 381219.59,
  sectionAUnpresented: 8000.26,
}

const MANUAL_9035 = {
  bankClosing: 4899.28,
  cashBook: -63299.04,
  uncredited: 0,
  unpresented: 2623.18,
  bankOnlyDebits: 236614,
  bankOnlyCredits: 311018.52,
  tieOut: 8829.38,
  workingUnpresented: 28576.8,
  workingBankOnlyDebits: 271397,
}

const NOTE_9033 = [
  'Face BRS uses √ columns (workbook netting ON).',
  `Unpresented face ${MANUAL_9033.unpresented.toLocaleString('en-US', { minimumFractionDigits: 2 })} (not section A ${MANUAL_9033.sectionAUnpresented} alone, not ?? ${MANUAL_9033.workingUnpresented}).`,
  `?? path only ties if bank-only debits also use ${MANUAL_9033.workingBankOnlyDebits.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`,
  'See file2/LORDSHIP_MANUAL_MARKS_REVIEW.md.',
].join(' ')

const NOTE_9035 = [
  'Face BRS uses √ columns.',
  `Unpresented face ${MANUAL_9035.unpresented.toLocaleString('en-US', { minimumFractionDigits: 2 })} (?? working ${MANUAL_9035.workingUnpresented} is gross open path).`,
  'See file2/LORDSHIP_MANUAL_MARKS_REVIEW.md.',
].join(' ')

async function api(method, p, token, body) {
  const res = await fetch(`${API}/api/v1${p}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
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

function approx(a, b, tol = 0.02) {
  return Math.abs((a ?? 0) - (b ?? 0)) <= tol
}

function line(label, manual, platform) {
  const ok = approx(manual, platform)
  const d = Math.round(((platform ?? 0) - (manual ?? 0)) * 100) / 100
  console.log(`  ${ok ? '✓' : '✗'} ${label}: manual=${manual} platform=${platform} Δ=${d}`)
  return ok
}

function isLordshipSlugOrName(p) {
  const s = `${p.name || ''} ${p.slug || ''}`.toLowerCase()
  return (
    s.includes('lordship') ||
    s.includes('9033') ||
    s.includes('9035') ||
    s.includes('accountno552') ||
    s.includes('accountno095')
  )
}

async function deleteLordshipProjects(token) {
  const raw = await api('GET', '/projects', token)
  const projects = Array.isArray(raw) ? raw : raw.projects ?? []
  const targets = projects.filter(isLordshipSlugOrName)
  console.log(`\nDeleting ${targets.length} existing Lordship-related project(s)...`)
  for (const p of targets) {
    try {
      if (['completed', 'approved', 'submitted_for_review'].includes(p.status)) {
        try {
          await api('PATCH', `/projects/${p.slug}/reopen`, token)
        } catch {
          /* some statuses may already allow delete */
        }
      }
      await api('DELETE', `/projects/${p.slug}`, token)
      console.log(`  deleted ${p.status} ${p.slug}`)
    } catch (e) {
      console.log(`  skip ${p.slug}: ${e.message}`)
    }
  }
}

function runNode(script, env = {}) {
  const r = spawnSync('node', [path.join(ROOT, script)], {
    env: { ...process.env, API_URL: API, BRS_TEST_EMAIL: EMAIL, BRS_TEST_PASSWORD: PASSWORD, ...env },
    encoding: 'utf8',
  })
  process.stdout.write(r.stdout || '')
  if (r.stderr) process.stderr.write(r.stderr)
  if (r.status !== 0) throw new Error(`${script} failed with exit ${r.status}`)
}

async function finishProject(token, slug, manual, note, { workbookNetting = true, reportQuery = '' } = {}) {
  await api('PATCH', `/projects/${slug}/brs-settings`, token, {
    workbookNettingMode: workbookNetting ? 'on' : 'off',
  })
  await api('PATCH', `/projects/${slug}/report-comments`, token, {
    bankStatementClosingBalance: manual.bankClosing,
    preparerComment: note.slice(0, 1000),
  })

  const report = await api('GET', `/report/${slug}${reportQuery}`, token)
  const b = report.brsStatement || {}
  console.log(`\n=== √ face BRS check: ${slug} (netting=${report.reconcileProfile?.workbookNetting}) ===`)
  const checks = [
    line('Bank closing', manual.bankClosing, b.bankClosingBalance),
    line('Cash book', manual.cashBook, b.balancePerCashBook),
    line('Uncredited', manual.uncredited, b.uncreditedLodgmentsTimingTotal),
    line('Unpresented (√ face)', manual.unpresented, b.unpresentedChequesTotal),
    line('Bank-only debits (√)', manual.bankOnlyDebits, b.bankOnlyDebitsNotInCashBookTotal),
    line('Bank-only credits (√)', manual.bankOnlyCredits, b.bankOnlyCreditsNotInCashBookTotal),
    line('Tie-out', manual.tieOut, b.workbookScheduleTieOutVariance),
  ]
  if (manual.workingUnpresented != null) {
    console.log(
      `  ℹ Workbook ?? unpresented (not face): ${manual.workingUnpresented} — use only with ?? BOD ${manual.workingBankOnlyDebits}`
    )
  }
  console.log(`  Matched pairs: ${report.summary?.matchedCount ?? '—'}`)
  console.log(`  Web: http://localhost:9100/projects/${slug}`)
  return { slug, ok: checks.every(Boolean), report }
}

async function main() {
  console.log('=== Bootstrap Lordship Q1 (√ face path) ===')
  console.log('API:', API)
  console.log('Login:', EMAIL)
  console.log('Manual marks guide: file2/LORDSHIP_MANUAL_MARKS_REVIEW.md\n')

  const login = await api('POST', '/auth/login', null, { email: EMAIL, password: PASSWORD })
  const token = login.token
  console.log('Login OK')

  await deleteLordshipProjects(token)

  console.log('\n========== 9033 / Account901 ==========')
  runNode('scripts/run-accountno552-test.mjs', {
    GHANA_BRS_WORKBOOK_NETTING: '1',
    BRS_FORCE_REUPLOAD: '1',
    BRS_FORCE_REMAP: '1',
    BRS_Q1_PROJECT_NAME: 'Lordship – Ecobank 9033 Q1 2026 (√ face / netting ON)',
  })

  console.log('\n========== 9035 / Account902 ==========')
  runNode('scripts/run-accountno095-test.mjs', {
    BRS_FORCE_REUPLOAD: '1',
    BRS_FORCE_REMAP: '1',
    BRS_Q1_PROJECT_NAME: 'Lordship – Ecobank 9035 Q1 2026 (√ face)',
  })

  const raw = await api('GET', '/projects', token)
  const projects = Array.isArray(raw) ? raw : raw.projects ?? []
  // Prefer new √-named Q1 projects; ignore any leftover Q2 rollforward drafts.
  const p9033 = projects.find(
    (p) => /9033/i.test(`${p.name} ${p.slug}`) && /q1|√ face/i.test(`${p.name} ${p.slug}`) && !/q2|roll/i.test(`${p.name} ${p.slug}`)
  ) || projects.find((p) => /9033/i.test(`${p.name} ${p.slug}`) && !/q2|roll/i.test(`${p.name} ${p.slug}`))
  const p9035 = projects.find(
    (p) => /9035/i.test(`${p.name} ${p.slug}`) && /q1|√ face/i.test(`${p.name} ${p.slug}`) && !/q2|roll/i.test(`${p.name} ${p.slug}`)
  ) || projects.find((p) => /9035/i.test(`${p.name} ${p.slug}`) && !/q2|roll/i.test(`${p.name} ${p.slug}`))
  if (!p9033 || !p9035) throw new Error('Expected both Lordship Q1 projects after bootstrap')

  const r9033 = await finishProject(token, p9033.slug, MANUAL_9033, NOTE_9033, {
    workbookNetting: true,
    reportQuery: '?workbookNetting=1',
  })
  const r9035 = await finishProject(token, p9035.slug, MANUAL_9035, NOTE_9035, {
    workbookNetting: true,
    reportQuery: '',
  })

  console.log('\n========== SUMMARY ==========')
  console.log(`9033: ${r9033.ok ? '✓ ties √ manual' : '✗ MISMATCH'} → http://localhost:9100/projects/${r9033.slug}#report`)
  console.log(`9035: ${r9035.ok ? '✓ ties √ manual' : '✗ MISMATCH'} → http://localhost:9100/projects/${r9035.slug}#report`)
  console.log('\nProjects left in Reconciling (not completed) so you can review Match-by-count and report.')
  console.log('Do not treat ?? figures as face unpresented unless companion ?? bank-only debits are used.')

  process.exit(r9033.ok && r9035.ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
