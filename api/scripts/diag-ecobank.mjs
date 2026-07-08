import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse-new')
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const { parseEcobankPdfText } = await import('../src/services/ecobankStatement.ts')

const DIR = path.resolve(__dirname, '../../ecobankstatementformats')

for (const [label, file] of [
  ['acct1', '1778163944552 (acct1).pdf'],
  ['acct2', '1778676142095 (acct 2).pdf'],
]) {
  const PDF = path.join(DIR, file)
  const text = (await pdfParse(fs.readFileSync(PDF))).text
  const footerDr = Number(text.match(/Total\s+Debit[s]?\s*GHS\s*([\d,]+\.\d{2})/i)?.[1]?.replace(/,/g, ''))
  const footerCr = Number(text.match(/Total\s+Credit[s]?\s*GHS\s*([\d,]+\.\d{2})/i)?.[1]?.replace(/,/g, ''))
  const r = parseEcobankPdfText(text)
  const sumDr = r.rows.reduce((s, row) => s + (Number(row[4]) || 0), 0)
  const sumCr = r.rows.reduce((s, row) => s + (Number(row[5]) || 0), 0)
  console.log(
    label,
    'rows',
    r.rows.length,
    'parsedDr',
    sumDr,
    'footerDr',
    footerDr,
    'diff',
    sumDr - footerDr,
    'parsedCr',
    sumCr,
    'footerCr',
    footerCr,
    'diff',
    sumCr - footerCr
  )
  const opening = Number(text.match(/Opening\s+Balance\s*GHS\s*([\d,]+\.\d{2})/i)?.[1]?.replace(/,/g, ''))
  const wrong = []
  for (let i = 0; i < r.rows.length; i++) {
    const dr = Number(r.rows[i][4]) || 0
    const cr = Number(r.rows[i][5]) || 0
    const amt = dr || cr
    const bal = Number(r.rows[i][6]) || 0
    const prev = i < r.rows.length - 1 ? Number(r.rows[i + 1][6]) || 0 : opening
    const creditFit = amt > 0 && Math.abs(bal - amt - prev) < 0.02
    const debitFit = amt > 0 && Math.abs(bal + amt - prev) < 0.02
    if (dr > 0 && creditFit && !debitFit) wrong.push({ side: 'dr->cr', amt, desc: String(r.rows[i][1]).slice(0, 70) })
    if (cr > 0 && debitFit && !creditFit) wrong.push({ side: 'cr->dr', amt, desc: String(r.rows[i][1]).slice(0, 70) })
  }
  console.log('  balance-mismatch', wrong.length, 'total', wrong.reduce((s, m) => s + m.amt, 0))
  wrong.forEach((m) => console.log('   ', m.side, m.amt, m.desc))

  const debits = r.rows.filter((row) => Number(row[4]) > 0)
  const keyCount = new Map()
  for (const row of debits) {
    const k = [row[0], row[4], row[6], String(row[1]).slice(0, 40)].join('|')
    keyCount.set(k, (keyCount.get(k) || 0) + 1)
  }
  const dups = [...keyCount.entries()].filter(([, c]) => c > 1)
  console.log('  duplicate debit keys', dups.length)
  dups.slice(0, 8).forEach(([k, c]) => console.log('   dup x' + c, k))

  const diff = sumDr - footerDr
  const near = debits.filter(
    (row) =>
      Math.abs(Number(row[4]) - diff) < 0.02 ||
      Math.abs(Number(row[4]) - diff / 2) < 0.02 ||
      Math.abs(Number(row[4]) - diff / 3) < 0.02
  )
  console.log(
    '  debits near excess diff',
    diff,
    near.map((row) => [row[4], String(row[1]).slice(0, 80)])
  )

  const needle = label === 'acct1' ? '926103' : '002131'
  const hits = r.rows.filter((row) => String(row[1]).includes(needle))
  console.log('  rows mentioning', needle, hits.length)
  hits.forEach((row) =>
    console.log('   ', row[0], row[4], row[5], row[6], String(row[1]).slice(0, 70), row[2])
  )
}
