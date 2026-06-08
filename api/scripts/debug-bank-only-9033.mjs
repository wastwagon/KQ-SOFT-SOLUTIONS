const API = process.env.API_URL || 'http://localhost:9011'

async function main() {
  const login = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'premium@test.com', password: 'Test123!' }),
  })
  const { token } = await login.json()
  const report = await (
    await fetch(
      `${API}/api/v1/report/lordship-ecobank-9033-q1-2026-accountno552?workbookNetting=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
  ).json()

  const brs = report.brsStatement
  const rows = report.bankOnlyDebits || []
  console.log('bank-only debits total', brs.bankOnlyDebitsNotInCashBookTotal)
  console.log('row count', rows.length)
  let sum = 0
  const byType = { withdrawal: 0, clearing: 0, ft: 0, other: 0 }
  for (const r of rows) {
    sum += r.amount
    const text = (r.description || r.name || '').toUpperCase()
    if (/WITHDRAWAL/.test(text)) byType.withdrawal += r.amount
    else if (/CHEQUE CLEARING|INWARD/.test(text)) byType.clearing += r.amount
    else if (/FT CONSOLIDATION|SDMC/.test(text)) byType.ft += r.amount
    else byType.other += r.amount
  }
  console.log('sum rows', sum, 'byType', byType)
  console.log('\nTop withdrawal/clearing lines:')
  rows
    .filter((r) => /WITHDRAWAL|CLEARING|INWARD/i.test(r.description || ''))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 20)
    .forEach((r) => console.log(r.amount, (r.description || '').slice(0, 70)))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
