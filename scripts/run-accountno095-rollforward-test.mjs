#!/usr/bin/env node
/**
 * Q1 → Q2 roll-forward: Ecobank 9035 / accountno095 (Lordship acct 902).
 *
 * 1. Reconcile Q1 from accountno095details.
 * 2. Mark Q1 completed.
 * 3. Create empty Q2 with rollForwardFromProjectId → Q1.
 * 4. Assert brought-forward unpresented cheques (manual BRS section).
 *
 * Usage:
 *   API_URL=http://localhost:9101 BRS_TEST_EMAIL=firm@test.com node scripts/run-accountno095-rollforward-test.mjs
 */
import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const API = process.env.API_URL || 'http://localhost:9101'
const EMAIL = process.env.BRS_TEST_EMAIL || 'firm@test.com'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'

const Q1_SLUG = 'lordship-ecobank-9035-q1-2026-accountno095'
const Q2_PROJECT_NAME =
  process.env.BRS_Q2_PROJECT_NAME || 'Lordship – Ecobank 9035 Q2 2026 (accountno095 rollforward)'
const Q2_RECON_DATE = '2026-06-30T00:00:00.000Z'

/** From Account902 BRS unpresented section as at 31.3.2026 */
const Q1_ROLLFORWARD_CHQS = {
  '002079': 944,
  '002101': 710,
  '002117': 969.18,
}

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

function normalizeChqNo(chq) {
  const digits = String(chq || '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/^0+/, '') || '0'
}

function approxEq(a, b, tol = 0.02) {
  return Math.abs((a ?? 0) - (b ?? 0)) <= tol
}

async function ensureCompleted(token, slug) {
  const proj = await api('GET', `/projects/${slug}`, token)
  if (proj.status === 'completed') return proj
  if (proj.status === 'submitted_for_review') {
    await api('PATCH', `/projects/${slug}/approve`, token)
    return api('GET', `/projects/${slug}`, token)
  }
  if (!['reconciling', 'mapping', 'draft'].includes(proj.status)) {
    try {
      await api('PATCH', `/projects/${slug}/reopen`, token)
    } catch {
      /* ignore */
    }
  }
  await api('PATCH', `/projects/${slug}/submit`, token)
  await api('PATCH', `/projects/${slug}/approve`, token)
  return api('GET', `/projects/${slug}`, token)
}

async function main() {
  console.log('=== Ecobank 9035 Q1 → Q2 roll-forward ===')
  console.log('API:', API)

  console.log('\n--- Phase 0: Q1 reconcile ---')
  const run = spawnSync('node', [path.join(ROOT, 'scripts/run-accountno095-test.mjs')], {
    env: {
      ...process.env,
      API_URL: API,
      BRS_TEST_EMAIL: EMAIL,
      BRS_TEST_PASSWORD: PASSWORD,
    },
    encoding: 'utf8',
  })
  process.stdout.write(run.stdout || '')
  if (run.status !== 0) {
    process.stderr.write(run.stderr || '')
    throw new Error('Q1 reconcile failed')
  }

  const login = await api('POST', '/auth/login', null, { email: EMAIL, password: PASSWORD })
  const token = login.token

  console.log('\n--- Phase 1: complete Q1 ---')
  const q1 = await ensureCompleted(token, Q1_SLUG)
  console.log(`Q1 status: ${q1.status} (${q1.slug})`)

  console.log('\n--- Phase 2: create empty Q2 (roll forward from Q1) ---')
  const projectsRaw = await api('GET', '/projects', token)
  const projects = Array.isArray(projectsRaw) ? projectsRaw : projectsRaw.projects ?? []
  const existing = projects.find((p) => p.name === Q2_PROJECT_NAME)
  if (existing) {
    await api('DELETE', `/projects/${existing.slug}`, token)
    console.log(`Deleted prior Q2 (${existing.slug})`)
  }

  const q2 = await api('POST', '/projects', token, {
    name: Q2_PROJECT_NAME,
    currency: 'GHS',
    reconciliationDate: Q2_RECON_DATE,
    primaryBankName: 'Ecobank Tesano',
    primaryBankAccountNo: '1441001519035',
    rollForwardFromProjectId: q1.slug,
  })
  console.log('Created Q2:', q2.name, `(${q2.slug})`)

  const report = await api('GET', `/report/${q2.slug}`, token)
  const bf = report.broughtForwardItems || []
  const bfTotal = bf.reduce((s, t) => s + Number(t.amount), 0)

  console.log('\n=== Empty Q2 roll-forward assertions ===')
  let ok = true
  for (const [chq, amt] of Object.entries(Q1_ROLLFORWARD_CHQS)) {
    const hit = bf.find((t) => normalizeChqNo(t.chqNo) === normalizeChqNo(chq))
    const match = hit && approxEq(Number(hit.amount), amt)
    console.log(`  ${match ? '✓' : '✗'} chq ${chq}: expected ${amt} got ${hit ? Number(hit.amount) : '—'}`)
    if (!match) ok = false
  }
  const totalOk = approxEq(bfTotal, 2623.18)
  console.log(`  ${totalOk ? '✓' : '✗'} BF total: expected 2623.18 got ${bfTotal}`)
  const lineOk = approxEq(report.brsStatement?.unpresentedChequesTotal, bfTotal)
  console.log(
    `  ${lineOk ? '✓' : '✗'} Q2 unpresented line (= BF): ${report.brsStatement?.unpresentedChequesTotal}`
  )
  ok = ok && totalOk && lineOk

  console.log(`\nQ1 slug: ${q1.slug}`)
  console.log(`Q2 slug: ${q2.slug}`)
  console.log(`Web: http://localhost:9100/projects/${q2.slug}`)
  console.log(ok ? '\n✓ 9035 roll-forward passed' : '\n✗ 9035 roll-forward failed')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
