import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseExcel } from '../src/services/parser.ts'
import { parseBankPdf } from '../src/services/documentParse.ts'
import { detectGhanaBankFormat } from '../src/services/ghanaBankParsers.ts'
import { buildSuggestedMappingForDocument, canAutoMap } from '../src/services/autoMapDocument.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIR = path.resolve(__dirname, '../../specimenbankstatementformats')

for (const file of fs.readdirSync(DIR).sort()) {
  const fp = path.join(DIR, file)
  console.log(`\n=== ${file} ===`)
  try {
    if (file.endsWith('.pdf')) {
      const r = await parseBankPdf(fp)
      const fmt = detectGhanaBankFormat(r.headers, r.rows.slice(0, 3))
      const cr = buildSuggestedMappingForDocument('bank_credits', r.headers, fmt)
      const dr = buildSuggestedMappingForDocument('bank_debits', r.headers, fmt)
      const sumDr = r.rows.reduce((s, row) => s + (Number(row[4]) || 0), 0)
      const sumCr = r.rows.reduce((s, row) => s + (Number(row[5]) || 0), 0)
      console.log({
        method: r.parseMethod,
        rows: r.rows.length,
        headers: r.headers,
        format: fmt,
        autoCr: canAutoMap('bank_credits', r.headers, cr),
        autoDr: canAutoMap('bank_debits', r.headers, dr),
        sumDr,
        sumCr,
      })
    } else if (/\.xlsx?$/i.test(file)) {
      const r = parseExcel(fp)
      const fmt = detectGhanaBankFormat(r.headers, r.rows.slice(0, 3))
      console.log({
        rows: r.rows.length,
        headers: r.headers,
        format: fmt,
        bankCr: canAutoMap(
          'bank_credits',
          r.headers,
          buildSuggestedMappingForDocument('bank_credits', r.headers, fmt)
        ),
        bankDr: canAutoMap(
          'bank_debits',
          r.headers,
          buildSuggestedMappingForDocument('bank_debits', r.headers, fmt)
        ),
        cashCr: canAutoMap(
          'cash_book_receipts',
          r.headers,
          buildSuggestedMappingForDocument('cash_book_receipts', r.headers, fmt)
        ),
        cashDr: canAutoMap(
          'cash_book_payments',
          r.headers,
          buildSuggestedMappingForDocument('cash_book_payments', r.headers, fmt)
        ),
      })
    }
  } catch (e) {
    console.log('ERR', e instanceof Error ? e.message : e)
  }
}
