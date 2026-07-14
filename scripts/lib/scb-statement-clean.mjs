/**
 * Re-export SCB normalizer from API (canonical implementation).
 * Run clean/export scripts with tsx so TypeScript imports resolve.
 */
import { extractScbMeta } from '../../api/src/services/scbStatement.ts'

export {
  extractScbMeta,
  extractScbTransactions,
  extractScbClosingBalance,
  isScbGluedRow,
  isScbStatementLayout,
  normalizeScbExcelTable,
  parseScbGluedRow,
} from '../../api/src/services/scbStatement.ts'

export function parseAmount(v) {
  if (v === '-' || v === '' || v == null) return ''
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = parseFloat(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : ''
}

export function extractScbFromWorkbook(XLSX, filePath) {
  const rows = XLSX.utils.sheet_to_json(XLSX.readFile(filePath).Sheets.Sheet1, { header: 1, defval: '' })
  const meta = extractScbMeta(rows)
  return {
    meta: {
      accountNo: meta.accountNo,
      accountName: 'TGL PROPERTIES LTD',
      careOf: 'C/O AFRICANUS NET LTD',
      from: meta.from,
      to: meta.to,
      currency: meta.currency,
      openingBalance: meta.openingBalance,
      closingBalance: meta.closingBalance,
    },
    transactions: meta.transactions,
  }
}
