/**
 * Parse Lordship-style manual BRS workbooks (Account901/902 layout).
 * Used by Ecobank 9033/9035 verification scripts.
 */
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../api/package.json'))
const XLSX = require('xlsx')

function normLabel(v) {
  return String(v ?? '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function numAt(row, ...cols) {
  for (const c of cols) {
    const v = row[c]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return null
}

/**
 * @param {string} filePath
 * @returns {{
 *   accountNo: string | null
 *   bankClosing: number | null
 *   cashBookBalance: number | null
 *   uncredited: number
 *   unpresentedSection: number | null
 *   bankOnlyDebits: number | null
 *   bankOnlyCredits: number | null
 * }}
 */
export function parseManualBrsXlsx(filePath) {
  const wb = XLSX.readFile(filePath)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })

  let accountNo = null
  let bankClosing = null
  let cashBookBalance = null
  let uncredited = 0
  let unpresentedSection = null
  let bankOnlyDebits = null
  let bankOnlyCredits = null
  let inUncredited = false
  let section = null

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const label = normLabel(r[1])
    const joined = String(r.join(' '))

    if (/1441001519033/.test(joined)) accountNo = '1441001519033'
    if (/1441001519035/.test(joined)) accountNo = '1441001519035'

    if (/CLOSING BALANCE PER BANK STATEMENT/.test(label)) {
      bankClosing = numAt(r, 5, 4)
    }
    if (/BALANCE PER CASH BOOK AT END OF THE PERIOD/.test(label)) {
      cashBookBalance = numAt(r, 5, 4)
    }
    if (/UNCREDITED LODGMENTS/.test(label)) {
      inUncredited = true
      section = 'uncredited'
    }
    if (/UNPRESENTED CHEQUES/.test(label)) {
      inUncredited = false
      section = 'unpresented'
    }
    if (/UNMATCHED PAYMENTS IN CASH BOOK/.test(label)) section = 'unmatched_payments'
    if (/UNMATCHED DEBITS IN BANK STATEMENT/.test(label)) section = 'unmatched_debits'
    if (/DEBITS IN BANK STATEMENT NOT IN CASH BOOK/.test(label)) section = 'bank_only_debits'
    if (/CREDITS IN BANK STATEMENT NOT IN CASH BOOK/.test(label)) section = 'bank_only_credits'

    if (inUncredited && typeof r[4] === 'number' && r[4] > 0 && !/DATE|NAME|DOC/.test(label)) {
      uncredited += r[4]
    }

    if (r[3] === 'TOTAL' && typeof r[4] === 'number') {
      if (section === 'unpresented') unpresentedSection = r[4]
      if (section === 'bank_only_debits') bankOnlyDebits = r[4]
      if (section === 'bank_only_credits') bankOnlyCredits = r[4]
    }
  }

  return {
    accountNo,
    bankClosing,
    cashBookBalance,
    uncredited,
    unpresentedSection,
    bankOnlyDebits,
    bankOnlyCredits,
  }
}

/** Ghana Ecobank 9033: final BRS unpresented uses workbook netting, not section A total alone. */
export function manualTargets9033(parsed) {
  return {
    bankClosing: parsed.bankClosing,
    cashBookBalance: parsed.cashBookBalance,
    uncredited: parsed.uncredited,
    unpresented: 10660.97,
    bankOnlyDebits: parsed.bankOnlyDebits,
    bankOnlyCredits: parsed.bankOnlyCredits,
    matchedPairs: 54,
  }
}

/** Ghana Ecobank 9035: unpresented section total is the BRS line. */
export function manualTargets9035(parsed) {
  return {
    bankClosing: parsed.bankClosing,
    cashBookBalance: parsed.cashBookBalance,
    uncredited: parsed.uncredited,
    unpresented: parsed.unpresentedSection,
    bankOnlyDebits: parsed.bankOnlyDebits,
    bankOnlyCredits: parsed.bankOnlyCredits,
    matchedPairs: 27,
    intrinsicTieOutVariance: 8829.38,
  }
}
