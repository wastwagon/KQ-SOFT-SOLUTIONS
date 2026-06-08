#!/usr/bin/env node
/**
 * Generic Ecobank BRS production rebootstrap.
 *
 * Usage:
 *   BRS_DATA_DIR=accountno552records \
 *   BRS_CASH_FILE="LIBcashbk1 2026 1qtr.xlsx" \
 *   BRS_BANK_FILE="1778163944552 dated 4.6.26.xlsx" \
 *   BRS_PROJECT_SLUG=lordship-ecobank-9033-q1-2026 \
 *   BRS_PROJECT_NAME="Lordship – Ecobank 9033 Q1 2026" \
 *   BRS_BANK_ACCOUNT_NO=1441001519033 \
 *   BRS_BANK_CLOSING=18643.29 \
 *   BRS_MANUAL_JSON='{"unpresented":10660.97,"bankOnlyDebits":374054.7}' \
 *   API_URL=https://api.kqsoftwaresolutions.com node scripts/rebootstrap-ecobank-brs.mjs
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const DATA = process.env.BRS_DATA_DIR || 'accountno552records'
const CASH = process.env.BRS_CASH_FILE || 'LIBcashbk1 2026 1qtr.xlsx'
const BANK = process.env.BRS_BANK_FILE || '1778163944552 dated 4.6.26.xlsx'
const SLUG = process.env.BRS_PROJECT_SLUG || 'lordship-ecobank-9033-q1-2026'
const NAME = process.env.BRS_PROJECT_NAME || 'Lordship – Ecobank 9033 Q1 2026'
const ACCT_NO = process.env.BRS_BANK_ACCOUNT_NO || '1441001519033'
const BANK_CLOSING = process.env.BRS_BANK_CLOSING || '18643.29'

let manual = {}
if (process.env.BRS_MANUAL_JSON) {
  try {
    manual = JSON.parse(process.env.BRS_MANUAL_JSON)
  } catch (e) {
    console.error('Invalid BRS_MANUAL_JSON:', e.message)
    process.exit(1)
  }
}

process.env.GHANA_BRS_WORKBOOK_NETTING = process.env.GHANA_BRS_WORKBOOK_NETTING || '1'

console.log('Generic Ecobank BRS rebootstrap')
console.log('  API:', process.env.API_URL || 'https://api.kqsoftwaresolutions.com')
console.log('  Data:', path.join(ROOT, DATA))
console.log('  Slug:', SLUG)
if (Object.keys(manual).length) console.log('  Manual checks:', manual)

const child = spawn(
  process.execPath,
  [path.join(ROOT, 'scripts/rebootstrap-production-accountno552.mjs')],
  {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      BRS_DATA_DIR: DATA,
      BRS_CASH_FILE: CASH,
      BRS_BANK_FILE: BANK,
      BRS_PROJECT_SLUG: SLUG,
      BRS_PROJECT_NAME: NAME,
      BRS_BANK_ACCOUNT_NO: ACCT_NO,
      BRS_BANK_CLOSING: BANK_CLOSING,
    },
  }
)

child.on('exit', (code) => process.exit(code ?? 1))
