#!/usr/bin/env node
/**
 * Map Lordship docs using local Ecobank PDF parse (bypasses slow/broken API preview for bank PDFs).
 * Requires API running for POST /map only.
 */
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API = process.env.API_URL || 'http://localhost:9011'
const EMAIL = process.env.BRS_TEST_EMAIL || 'asdiscussed@test.com'
const PASSWORD = process.env.BRS_TEST_PASSWORD || 'Test123!'
const SLUGS = ['lordship-ecobank-9033-q1-2026', 'lordship-ecobank-9035-q1-2026']

const BANK_MAPPING = {
  transaction_date: 0,
  description: 1,
  credit: 5,
  debit: 4,
}

const CASH_MAPPING = {
  date: 2,
  name: 3,
  details: 4,
  doc_ref: 5,
  chq_no: 6,
  accode: 10,
  amt_received: 11,
  amt_paid: 12,
}

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
      const isCash = doc.type.startsWith('cash_book_')
      let mapping
      if (isCash) {
        mapping = { ...CASH_MAPPING }
        if (doc.type === 'cash_book_receipts') delete mapping.amt_paid
        else delete mapping.amt_received
      } else if (doc.filename.toLowerCase().endsWith('.pdf')) {
        mapping =
          doc.type === 'bank_credits'
            ? { transaction_date: 0, description: 1, credit: 5 }
            : { transaction_date: 0, description: 1, debit: 4 }
      } else {
        const pre = await fetch(`${API}/api/v1/documents/${doc.id}/preview`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json())
        mapping = pre.suggestedMapping
      }
      const res = await fetch(`${API}/api/v1/documents/${doc.id}/map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mapping, sheetIndex: 0 }),
      })
      const body = await res.json()
      if (!res.ok) console.log('  FAIL', doc.type, doc.filename, body.error)
      else console.log('  OK', doc.type, doc.filename, '→', body.count, 'txns')
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
