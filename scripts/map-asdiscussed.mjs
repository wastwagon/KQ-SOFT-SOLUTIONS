#!/usr/bin/env node
/**
 * Apply suggested column mapping to all documents in Lordship projects.
 * Usage: API_URL=http://localhost:9011 node scripts/map-asdiscussed.mjs
 */

const API = process.env.API_URL || process.env.VITE_API_URL || 'http://localhost:9011'
const EMAIL = process.env.BRS_TEST_EMAIL || 'asdiscussed@test.com'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'
const SLUGS = ['lordship-ecobank-9033-q1-2026', 'lordship-ecobank-9035-q1-2026']

async function login() {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`Login failed: ${res.status}`)
  return (await res.json()).token
}

async function main() {
  const token = await login()
  for (const slug of SLUGS) {
    console.log('\n===', slug, '===')
    const proj = await fetch(`${API}/api/v1/projects/${slug}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json())
    for (const doc of proj.documents || []) {
      const pre = await fetch(`${API}/api/v1/documents/${doc.id}/preview`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json())
      if (pre.error) {
        console.log('  SKIP', doc.type, doc.filename, '-', pre.error)
        continue
      }
      const headers = pre.headers || []
      const colCount = headers.length
      if (colCount < 2) {
        console.log('  SKIP', doc.type, doc.filename, '- only', colCount, 'column(s); re-upload or use Excel bank export')
        continue
      }
      const dateIdx =
        pre.suggestedMapping?.transaction_date ?? pre.suggestedMapping?.date
      if (dateIdx == null || typeof dateIdx !== 'number') {
        console.log('  SKIP', doc.type, doc.filename, '- no date mapping')
        continue
      }
      const isCash = doc.type.startsWith('cash_book_')
      const mapping = {}
      for (const [field, idx] of Object.entries(pre.suggestedMapping || {})) {
        if (typeof idx === 'number' && idx >= 0 && idx < colCount) mapping[field] = idx
      }
      if (isCash) {
        if (doc.type === 'cash_book_receipts' && mapping.amt_received == null) continue
        if (doc.type === 'cash_book_payments' && mapping.amt_paid == null) continue
      } else {
        if (doc.type === 'bank_credits' && mapping.credit == null) continue
        if (doc.type === 'bank_debits' && mapping.debit == null) continue
      }
      const res = await fetch(`${API}/api/v1/documents/${doc.id}/map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mapping, sheetIndex: pre.sheetIndex ?? 0 }),
      })
      const body = await res.json()
      if (!res.ok) {
        console.log('  FAIL', doc.type, doc.filename, body.error || res.status)
      } else {
        console.log('  OK', doc.type, doc.filename, '→', body.count, 'transactions')
      }
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
