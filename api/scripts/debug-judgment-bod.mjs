import {
  ecobankClearingLineHasPaymentCounterpart,
  clearingCreditHasPaymentCounterpart,
  isEcobankClearingCredit,
  isCreditReclassifiedAsDebit,
  debitHasPaymentCounterpart,
} from '../src/services/ecobankClearingMatcher.ts'

const API = process.env.API_URL || 'http://localhost:9011'

async function main() {
  const login = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'premium@test.com', password: 'Test123!' }),
  })
  const { token } = await login.json()
  const rec = await fetch(`${API}/api/v1/reconcile/lordship-ecobank-9033-q1-2026-accountno552`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())

  const toLine = (t) => ({
    id: t.id,
    amount: t.amount,
    chqNo: t.chqNo,
    name: t.name,
    details: t.details || t.description,
  })
  const matchedBank = new Set(rec.matchedBankIds || [])
  const matchedCb = new Set(rec.matchedCashBookIds || [])
  const paymentTxs = rec.payments?.transactions || []
  const debitTxs = rec.debits?.transactions || []
  const creditTxs = rec.credits?.transactions || []
  const pays = paymentTxs.filter((p) => !matchedCb.has(p.id)).map(toLine)
  const allPays = paymentTxs.map(toLine)
  const lines = [...debitTxs, ...creditTxs]
    .filter((t) => !matchedBank.has(t.id))
    .map(toLine)
  const targets = lines.filter((l) => Math.abs(l.amount - 2500) < 0.02 || Math.abs(l.amount - 785) < 0.02)
  const ctx = { workbookNetting: true }
  for (const line of targets) {
    console.log('\nline', line.id, line.amount, JSON.stringify(line.details?.slice(0, 80)))
    console.log('  isEcobankClearingCredit', isEcobankClearingCredit(line))
    console.log('  isCreditReclassifiedAsDebit', isCreditReclassifiedAsDebit(line))
    console.log('  ecobankClearing (unmatched pays)', ecobankClearingLineHasPaymentCounterpart(line, pays, 0.01, ctx))
    console.log('  ecobankClearing (all pays)', ecobankClearingLineHasPaymentCounterpart(line, allPays, 0.01, ctx))
    console.log('  clearingCreditHasPaymentCounterpart', clearingCreditHasPaymentCounterpart(line, pays, 0.01, ctx))
    console.log('  debitHasPaymentCounterpart', debitHasPaymentCounterpart(line, pays, 0.01, undefined, ctx))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
