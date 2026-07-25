#!/usr/bin/env node
/**
 * Compare MyTrial (production clean-tool exports) vs local parsed-output vs re-parse of originals.
 */
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const require = createRequire(path.join(ROOT, 'api/package.json'))
const XLSX = require('xlsx')

const { parseBankPdf } = await import('../api/src/services/documentParse.ts')
const { parseImportedAmount } = await import('../api/src/services/amountParser.ts')

const DIR = path.join(ROOT, 'New Prudential ')
const CASES = [
  {
    label: 'Account 0091900180008',
    original: path.join(DIR, 'Prudential bank(0091900180008)_sep 23[10235] (2).pdf'),
    parsed: path.join(
      DIR,
      'parsed-output/Prudential_bank(0091900180008)_sep_23[10235]_(2)-parsed.xlsx'
    ),
    trial: path.join(
      DIR,
      'MyTrial/Prudential bank(0091900180008)_sep 23[10235] (2)-bank-statement-cleaned.xlsx'
    ),
  },
  {
    label: 'Account 0091900183015',
    original: path.join(DIR, 'Prudential bank(0091900183015)_sep 23[10240].pdf'),
    parsed: path.join(
      DIR,
      'parsed-output/Prudential_bank(0091900183015)_sep_23[10240]-parsed.xlsx'
    ),
    trial: path.join(
      DIR,
      'MyTrial/Prudential bank(0091900183015)_sep 23[10240]-bank-statement-cleaned.xlsx'
    ),
  },
]

function amountCol(headers, side) {
  const pats =
    side === 'debit'
      ? [/^(debit|debits)$/i, /amt\s*paid/i]
      : [/^(credit|credits)$/i, /amt\s*received/i]
  for (const re of pats) {
    const i = headers.findIndex((h) => re.test(String(h)))
    if (i >= 0) return i
  }
  return -1
}

function loadXlsx(file) {
  const wb = XLSX.readFile(file)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
  let headerIdx = rows.findIndex(
    (r) =>
      Array.isArray(r) &&
      r.some((c) => /^debit$/i.test(String(c || ''))) &&
      r.some((c) => /^credit$/i.test(String(c || '')))
  )
  if (headerIdx < 0) {
    headerIdx = rows.findIndex(
      (r) => Array.isArray(r) && r.some((c) => /transaction.?date/i.test(String(c || '')))
    )
  }
  if (headerIdx < 0) throw new Error('No header in ' + file)
  const headers = rows[headerIdx].map((h) => String(h ?? ''))
  const data = rows
    .slice(headerIdx + 1)
    .filter((r) => Array.isArray(r) && r.some((c) => c != null && String(c).trim() !== ''))
  return { headers, rows: data, metaRows: rows.slice(0, headerIdx) }
}

function summarize(headers, rows) {
  const d = amountCol(headers, 'debit')
  const c = amountCol(headers, 'credit')
  const sumDebit = rows.reduce((s, r) => s + (d >= 0 ? parseImportedAmount(r[d]) : 0), 0)
  const sumCredit = rows.reduce((s, r) => s + (c >= 0 ? parseImportedAmount(r[c]) : 0), 0)
  return { rowCount: rows.length, sumDebit, sumCredit }
}

function money(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

function normalizeRow(headers, row) {
  const dateI = headers.findIndex((h) => /transaction.?date/i.test(h))
  const descI = headers.findIndex((h) => /desc/i.test(h))
  const d = amountCol(headers, 'debit')
  const c = amountCol(headers, 'credit')
  return {
    date: String(row[dateI] ?? '').trim(),
    desc: String(row[descI] ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80),
    debit: round2(d >= 0 ? parseImportedAmount(row[d]) : 0),
    credit: round2(c >= 0 ? parseImportedAmount(row[c]) : 0),
  }
}

function key(r) {
  return `${r.date}|${r.debit}|${r.credit}|${r.desc}`
}

function compareMultiset(aRows, bRows) {
  const aMap = new Map()
  for (const r of aRows) aMap.set(key(r), (aMap.get(key(r)) || 0) + 1)
  const bMap = new Map()
  for (const r of bRows) bMap.set(key(r), (bMap.get(key(r)) || 0) + 1)
  let matched = 0
  const onlyA = []
  const onlyB = []
  for (const [k, n] of aMap) {
    const m = bMap.get(k) || 0
    matched += Math.min(n, m)
    if (n > m) onlyA.push({ k, extra: n - m })
  }
  for (const [k, n] of bMap) {
    const m = aMap.get(k) || 0
    if (n > m) onlyB.push({ k, extra: n - m })
  }
  return { matched, onlyA, onlyB }
}

function compareCase(label, trial, local, fresh) {
  console.log('\n' + '='.repeat(72))
  console.log(label)
  console.log('='.repeat(72))

  const sTrial = summarize(trial.headers, trial.rows)
  const sLocal = summarize(local.headers, local.rows)
  const sFresh = summarize(fresh.headers, fresh.rows)

  console.log('\n--- Totals ---')
  console.log('Source          | Rows | Sum Debit         | Sum Credit')
  console.log(
    'MyTrial (prod)  |',
    String(sTrial.rowCount).padStart(4),
    '|',
    money(sTrial.sumDebit).padStart(17),
    '|',
    money(sTrial.sumCredit).padStart(17)
  )
  console.log(
    'parsed-output   |',
    String(sLocal.rowCount).padStart(4),
    '|',
    money(sLocal.sumDebit).padStart(17),
    '|',
    money(sLocal.sumCredit).padStart(17)
  )
  console.log(
    'Re-parse now    |',
    String(sFresh.rowCount).padStart(4),
    '|',
    money(sFresh.sumDebit).padStart(17),
    '|',
    money(sFresh.sumCredit).padStart(17)
  )

  const meta = trial.metaRows.filter((r) => r && r[0]).slice(0, 8)
  if (meta.length) {
    console.log('\nMyTrial Excel meta:')
    for (const r of meta) console.log(' ', r.filter(Boolean).join(': '))
  }

  const normTrial = trial.rows.map((r) => normalizeRow(trial.headers, r))
  const normLocal = local.rows.map((r) => normalizeRow(local.headers, r))
  const normFresh = fresh.rows.map((r) => normalizeRow(fresh.headers, r))

  const vsLocal = compareMultiset(normTrial, normLocal)
  const vsFresh = compareMultiset(normTrial, normFresh)

  console.log('\n--- MyTrial vs parsed-output ---')
  console.log('Exact row matches (date+amt+desc):', vsLocal.matched)
  console.log('Only in MyTrial:', vsLocal.onlyA.reduce((s, x) => s + x.extra, 0))
  console.log('Only in parsed-output:', vsLocal.onlyB.reduce((s, x) => s + x.extra, 0))

  console.log('\n--- MyTrial vs re-parse of original PDF ---')
  console.log('Exact row matches:', vsFresh.matched)
  console.log('Only in MyTrial:', vsFresh.onlyA.reduce((s, x) => s + x.extra, 0))
  console.log('Only in re-parse:', vsFresh.onlyB.reduce((s, x) => s + x.extra, 0))
  console.log('Sum debit delta (MyTrial - reparse):', money(sTrial.sumDebit - sFresh.sumDebit))
  console.log('Sum credit delta (MyTrial - reparse):', money(sTrial.sumCredit - sFresh.sumCredit))

  if (vsLocal.onlyA.length) {
    console.log('\nSample only in MyTrial vs parsed-output:')
    for (const x of vsLocal.onlyA.slice(0, 5)) console.log(' ', x.k)
  }
  if (vsLocal.onlyB.length) {
    console.log('\nSample only in parsed-output:')
    for (const x of vsLocal.onlyB.slice(0, 5)) console.log(' ', x.k)
  }

  const n = Math.min(normTrial.length, normLocal.length)
  let posDiff = 0
  const posSamples = []
  for (let i = 0; i < n; i++) {
    const a = normTrial[i]
    const b = normLocal[i]
    if (a.date !== b.date || a.debit !== b.debit || a.credit !== b.credit || a.desc !== b.desc) {
      posDiff++
      if (posSamples.length < 5) posSamples.push({ i, a, b })
    }
  }
  console.log('\nPositional diffs vs parsed-output (aligned by index):', posDiff, '/', n)
  for (const s of posSamples) {
    console.log(`  #${s.i}`)
    console.log('    MyTrial:', s.a.date, s.a.desc.slice(0, 50), 'Dr', s.a.debit, 'Cr', s.a.credit)
    console.log('    local:  ', s.b.date, s.b.desc.slice(0, 50), 'Dr', s.b.debit, 'Cr', s.b.credit)
  }

  const perfectLocal =
    vsLocal.matched === normTrial.length &&
    vsLocal.matched === normLocal.length &&
    Math.abs(sTrial.sumDebit - sLocal.sumDebit) < 0.02 &&
    Math.abs(sTrial.sumCredit - sLocal.sumCredit) < 0.02
  const perfectFresh =
    vsFresh.matched === normTrial.length &&
    vsFresh.matched === normFresh.length &&
    Math.abs(sTrial.sumDebit - sFresh.sumDebit) < 0.02 &&
    Math.abs(sTrial.sumCredit - sFresh.sumCredit) < 0.02

  console.log('\nVERDICT MyTrial == parsed-output:', perfectLocal ? 'YES' : 'NO')
  console.log('VERDICT MyTrial == re-parse original:', perfectFresh ? 'YES' : 'NO')
  return { perfectLocal, perfectFresh, sTrial, sLocal, sFresh }
}

async function main() {
  for (const c of CASES) {
    for (const p of [c.original, c.parsed, c.trial]) {
      if (!fs.existsSync(p)) throw new Error('Missing: ' + p)
    }
    console.log('\nRe-parsing original:', path.basename(c.original))
    const fresh = await parseBankPdf(c.original)
    const trial = loadXlsx(c.trial)
    const local = loadXlsx(c.parsed)
    compareCase(c.label, trial, local, fresh)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
