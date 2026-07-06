/**
 * Remove cash-book rows flagged "duplication. Delete in cash book" in the
 * updated Account902 BRS (9035). Keeps the hyphen / legacy narration lines that
 * pair with bank clearing (marked ** in the manual workbook).
 */
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../api/package.json'))
const XLSX = require('xlsx')

/** Formal duplicate payments — same chq/amount as hyphen rows below them in manual BRS. */
const SKIP_PAYMENT_ROWS = [
  {
    dateSerial: 46028,
    chqNo: '002066',
    amount: 1327.31,
    nameIncludes: 'Helina Yeboah',
    detailsIncludes: 'sanitation',
  },
  {
    dateSerial: 46030,
    chqNo: '002065',
    amount: 7605,
    nameIncludes: 'Fred-Leon',
    detailsIncludes: 'Finders Fees',
  },
  {
    dateSerial: 46034,
    chqNo: '002059',
    amount: 9978.21,
    nameIncludes: 'Cocobod',
    detailsIncludes: 'finders fee',
  },
]

function excelDateSerial(cell) {
  if (typeof cell === 'number') return cell
  const n = Number(cell)
  return Number.isFinite(n) ? n : null
}

function rowPaidAmount(row) {
  const paid = Math.abs(Number(row[7]) || 0)
  return paid > 0 ? paid : 0
}

function shouldSkipRow(row) {
  const dateSerial = excelDateSerial(row[0])
  const chq = String(row[4] ?? '').replace(/\D/g, '')
  const amount = rowPaidAmount(row)
  const name = String(row[1] ?? '')
  const details = String(row[2] ?? '')
  return SKIP_PAYMENT_ROWS.some(
    (rule) =>
      dateSerial === rule.dateSerial &&
      chq.endsWith(rule.chqNo.replace(/^0+/, '')) &&
      Math.abs(amount - rule.amount) < 0.02 &&
      name.includes(rule.nameIncludes.split(' ')[0]) &&
      details.toLowerCase().includes(rule.detailsIncludes.toLowerCase())
  )
}

/**
 * @param {string} sourcePath absolute path to LIBcashbk2 xlsx
 * @param {string} [destPath] optional output path (defaults to sourcePath)
 * @returns {{ removed: number, destPath: string }}
 */
export function clean9035CashBookDuplicates(sourcePath, destPath = sourcePath) {
  const wb = XLSX.readFile(sourcePath)
  const sheetName = wb.SheetNames[0]
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' })
  let removed = 0
  const kept = rows.filter((row, idx) => {
    if (idx === 0) return true
    if (shouldSkipRow(row)) {
      removed++
      return false
    }
    return true
  })
  wb.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(kept)
  XLSX.writeFile(wb, destPath)
  return { removed, destPath }
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const target =
    process.argv[2] ||
    path.join(process.cwd(), 'accountno095details', 'LIBcashbk2 2026 1qtr.xlsx')
  const result = clean9035CashBookDuplicates(target)
  console.log(`Removed ${result.removed} duplicate payment row(s) → ${result.destPath}`)
}
