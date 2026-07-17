#!/usr/bin/env node
/** One-off deliverable: corrected PDF extract for Prudential Sep 2023 specimen. */
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const { parseBankPdf } = await import('../api/src/services/documentParse.ts')
const { parseImportedAmount } = await import('../api/src/services/amountParser.ts')
const { writeParsedStatementPdf } = await import('./lib/write-parsed-statement-pdf.mjs')

const src = path.join(ROOT, 'Prudential bank(0091900180008)_sep 23[10235].pdf')
if (!fs.existsSync(src)) {
  console.error('Missing source PDF:', src)
  process.exit(1)
}

const result = await parseBankPdf(src)
const debitCol = result.headers.findIndex((h) => /^debit/i.test(String(h)))
const creditCol = result.headers.findIndex((h) => /^credit/i.test(String(h)))
const sumDebit = result.rows.reduce(
  (s, r) => s + (debitCol >= 0 ? parseImportedAmount(r[debitCol]) : 0),
  0
)
const sumCredit = result.rows.reduce(
  (s, r) => s + (creditCol >= 0 ? parseImportedAmount(r[creditCol]) : 0),
  0
)
const meta = {
  source: path.basename(src),
  parseMethod: result.parseMethod,
  sumDebit,
  sumCredit,
}

const base = 'Prudential bank(0091900180008)_sep 23[10235]'
const targets = [
  path.join(ROOT, 'corrected-bank-specimens-for-user/10-prudential/parsed-pdf', `${base} - corrected.pdf`),
  path.join(ROOT, 'prudential-bank-corrected-package/parsed-pdf', '2-CORRECTED-BANK-STATEMENT.pdf'),
  path.join(ROOT, 'prudential-bank-corrected-package', '2-CORRECTED-BANK-STATEMENT.pdf'),
]

for (const t of targets) {
  await writeParsedStatementPdf(t, result, meta)
  console.log('wrote', path.relative(ROOT, t), fs.statSync(t).size, 'bytes')
}
console.log('rows', result.rows.length, 'sumDebit', sumDebit, 'sumCredit', sumCredit)
