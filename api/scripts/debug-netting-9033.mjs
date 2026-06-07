import { computeWorkbookNettedUnpresented } from '../src/services/ghanaBrsWorkbookNetting.ts'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isRound2BlockBank(line) {
  const text = [line.details, line.name].filter(Boolean).join(' ').toUpperCase()
  const a = line.amount
  if (Math.abs(a - 3000) <= 0.01 && /WITHDRAWAL/i.test(text)) return true
  if (
    (Math.abs(a - 3214.89) <= 0.01 || Math.abs(a - 3214.9) <= 0.01) &&
    /INWARD|RECEIVED\s+FROM\s+CLEARING|CHEQUE\s+CLEARING/i.test(text)
  ) {
    return true
  }
  return false
}

const API = process.env.API_URL || 'http://localhost:9011'

async function main() {
  const login = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'premium@test.com', password: 'Test123!' }),
  })
  const { token } = await login.json()
  const rec = await (
    await fetch(`${API}/api/v1/reconcile/lordship-ecobank-9033-q1-2026-accountno552`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json()

  const debits = rec.debits.transactions
  const credits = rec.credits.transactions
  const payments = rec.payments.transactions
  const matchedCb = new Set(rec.matchedCashBookIds)
  const matchedBank = new Set(rec.matchedBankIds)
  const receiptIds = new Set(rec.receipts.transactions.map((x) => x.id))
  const debitIds = new Set(debits.map((d) => d.id))
  const creditIds = new Set(credits.map((c) => c.id))
  const unmatchedPayments = payments.filter((p) => !matchedCb.has(p.id))
  const unmatchedDebits = debits.filter((d) => !matchedBank.has(d.id))
  const unmatchedCredits = credits.filter((c) => !matchedBank.has(c.id))
  const matched = []
  for (const m of rec.matches) {
    const cb = m.cbTx
    const bank = m.bankTx
    if (receiptIds.has(cb.id)) continue
    if (!debitIds.has(bank.id) && !creditIds.has(bank.id)) continue
    matched.push({ payment: cb, bankDebit: bank })
  }

  const noMatched = computeWorkbookNettedUnpresented(
    unmatchedPayments,
    unmatchedDebits,
    unmatchedCredits,
    debits,
    credits,
    0,
    0.01,
    payments,
    []
  )
  const withMatched = computeWorkbookNettedUnpresented(
    unmatchedPayments,
    unmatchedDebits,
    unmatchedCredits,
    debits,
    credits,
    0,
    0.01,
    payments,
    matched
  )

  const withMatchedFull = withMatched
  console.log('round2 bank total (engine)', withMatched.round2BankTotal)
  console.log(
    'round2 pairs',
    withMatched.round2Pairs.length,
    withMatched.round2Pairs.reduce((s, p) => s + p.amount, 0)
  )
  const payById = new Map(payments.map((p) => [p.id, p]))
  const bankById = new Map([...debits, ...credits].map((b) => [b.id, b]))
  for (const p of withMatched.round1Pairs) {
    const pay = payById.get(p.paymentId)
    const bank = bankById.get(p.bankId)
    console.log('r1', pay?.chqNo, pay?.amount, '->', bank?.amount, (bank?.details || '').slice(0, 40))
  }
  for (const p of withMatched.round2Pairs) {
    const pay = payById.get(p.paymentId)
    const bank = bankById.get(p.bankId)
    console.log('r2', pay?.chqNo, pay?.amount, '->', bank?.amount, (bank?.details || '').slice(0, 40))
  }
  const r2payIds = new Set(withMatched.round2Pairs.map((p) => p.paymentId))
  for (const pay of payments.filter((p) => Math.abs(p.amount - 3000) <= 0.01 || Math.abs(p.amount - 3214.89) <= 0.02)) {
    if (!r2payIds.has(pay.id)) console.log('r2 MISSING', pay.chqNo, pay.amount)
  }

  for (const [label, r] of [
    ['without matched', noMatched],
    ['with matched', withMatched],
  ]) {
    console.log(label, {
      sectionA: r.sectionATotal,
      sectionB1: r.sectionB1Total,
      matchedB1: r.matchedB1Add,
      matchedC: r.matchedCAdd,
      c: r.sectionCOffsetTotal,
      g2: r.group2Net,
      g3off: r.group3OffsetTotal,
      g3: r.group3Net,
      unpresented: r.unpresentedChequesTotal,
      r1: r.round1Pairs.length,
      rm: r.round1MatchedPairs.length,
    })
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
