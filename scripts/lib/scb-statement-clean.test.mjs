import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import {
  extractScbFromWorkbook,
  isScbGluedRow,
  parseScbGluedRow,
  parseAmount,
} from './scb-statement-clean.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '../..')
const require = createRequire(path.join(ROOT, 'api/package.json'))
const XLSX = require('xlsx')

const SCB_RAW = path.join(ROOT, 'specimenbankstatementformats/scb statement.xlsx')

test('parseScbGluedRow reads first-page Feb 2019 transactions', () => {
  if (!fs.existsSync(SCB_RAW)) return
  const rows = XLSX.utils.sheet_to_json(XLSX.readFile(SCB_RAW).Sheets.Sheet1, { header: 1, defval: '' })
  const page1 = rows.find(isScbGluedRow)
  assert.ok(page1, 'expected glued first page row')
  const txs = parseScbGluedRow(page1)
  assert.ok(txs.some((t) => /FAB CHQ# 484623/i.test(t.description)))
  assert.ok(txs.some((t) => /FUNDS TRANSFER FROM 0100106024701/i.test(t.description)))
  assert.equal(parseAmount(txs.find((t) => /DEBIT INTEREST/i.test(t.description))?.balance), 60886.51)
})

test('extractScbFromWorkbook includes first page and closing balance 540,206.03', () => {
  if (!fs.existsSync(SCB_RAW)) return
  const { meta, transactions } = extractScbFromWorkbook(XLSX, SCB_RAW)
  assert.equal(meta.closingBalance, 540206.03)
  assert.ok(transactions.some((t) => /FAB CHQ# 484623/i.test(String(t.description))))
  assert.ok(transactions.some((t) => /INW CLG 702823/i.test(String(t.description))))
  assert.ok(transactions.length > 780)
  const lastBal = transactions[transactions.length - 1]?.balance
  assert.equal(lastBal, 540206.03)
})
