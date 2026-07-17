#!/usr/bin/env node
/**
 * Export all fixed bank/cashbook specimens into one deliverable folder:
 *   corrected-bank-specimens-for-user/
 *     <bank>/
 *       original/     — source PDF/Excel unchanged
 *       parsed-excel/ — transaction table produced by BRS parsers (upload-ready layout)
 *   README.md + manifest.json
 *
 * Usage: node scripts/export-corrected-specimens.mjs
 */
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '../api/package.json'))
const XLSX = require('xlsx')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUT_ROOT = path.join(ROOT, 'corrected-bank-specimens-for-user')

const { parseBankPdf } = await import('../api/src/services/documentParse.ts')
const { parseExcel } = await import('../api/src/services/parser.ts')
const { parseImportedAmount } = await import('../api/src/services/amountParser.ts')
const { clean9035CashBookDuplicates } = await import('./lib/clean-9035-cashbook.mjs')
const { writeParsedStatementPdf } = await import('./lib/write-parsed-statement-pdf.mjs')

function safeName(name) {
  return name.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim()
}

function copyOriginal(src, destDir) {
  if (!fs.existsSync(src)) return null
  fs.mkdirSync(destDir, { recursive: true })
  const dest = path.join(destDir, path.basename(src))
  fs.copyFileSync(src, dest)
  return dest
}

function amountColumnIndex(headers, side) {
  const debitRes = [/^(debit|debits)$/i, /amt\s*paid/i, /^payment$/i]
  const creditRes = [/^(credit|credits)$/i, /amt\s*received/i, /^receipt$/i]
  const patterns = side === 'debit' ? debitRes : creditRes
  for (const re of patterns) {
    const i = headers.findIndex((h) => re.test(String(h)))
    if (i >= 0) return i
  }
  return -1
}

function writeParsedExcel(outPath, parsed, meta = {}) {
  const debitCol = amountColumnIndex(parsed.headers, 'debit')
  const creditCol = amountColumnIndex(parsed.headers, 'credit')
  const sumDebit = parsed.rows.reduce((s, r) => s + (debitCol >= 0 ? parseImportedAmount(r[debitCol]) : 0), 0)
  const sumCredit = parsed.rows.reduce((s, r) => s + (creditCol >= 0 ? parseImportedAmount(r[creditCol]) : 0), 0)

  const metaRows = [
    ['BRS corrected export'],
    ['Source', meta.source || ''],
    ['Parse method', meta.parseMethod || 'excel'],
    ['Exported', new Date().toISOString()],
    ['Row count', parsed.rows.length],
    ['Sum debits / payments', sumDebit || ''],
    ['Sum credits / receipts', sumCredit || ''],
    [],
    parsed.headers,
    ...parsed.rows,
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaRows), 'Transactions')
  XLSX.writeFile(wb, outPath)
  return { rowCount: parsed.rows.length, sumDebit, sumCredit, parseMethod: meta.parseMethod }
}

async function exportPdf(srcPath, bankDir, label) {
  const base = safeName(path.basename(srcPath, path.extname(srcPath)))
  const originalDir = path.join(bankDir, 'original')
  const parsedDir = path.join(bankDir, 'parsed-excel')
  const parsedPdfDir = path.join(bankDir, 'parsed-pdf')
  copyOriginal(srcPath, originalDir)
  const result = await parseBankPdf(srcPath)
  const meta = {
    source: path.relative(ROOT, srcPath),
    parseMethod: result.parseMethod,
  }
  const stats = writeParsedExcel(path.join(parsedDir, `${base} - parsed.xlsx`), result, meta)
  await writeParsedStatementPdf(path.join(parsedPdfDir, `${base} - corrected.pdf`), result, {
    ...meta,
    sumDebit: stats.sumDebit,
    sumCredit: stats.sumCredit,
  })
  return { label, file: path.basename(srcPath), type: 'pdf', status: 'ok', ...stats }
}

function exportExcel(srcPath, bankDir, label, sheetIndex = 0) {
  const base = safeName(path.basename(srcPath, path.extname(srcPath)))
  const originalDir = path.join(bankDir, 'original')
  const parsedDir = path.join(bankDir, 'parsed-excel')
  copyOriginal(srcPath, originalDir)
  const result = parseExcel(srcPath, sheetIndex)
  const stats = writeParsedExcel(path.join(parsedDir, `${base} - parsed.xlsx`), result, {
    source: path.relative(ROOT, srcPath),
    parseMethod: 'excel',
  })
  return { label, file: path.basename(srcPath), type: 'excel', status: 'ok', ...stats }
}

function noteOnly(srcPath, bankDir, label, note) {
  const originalDir = path.join(bankDir, 'original')
  copyOriginal(srcPath, originalDir)
  return { label, file: path.basename(srcPath), type: path.extname(srcPath), status: 'reference-only', note }
}

function exportCleaned9035Cashbook(srcPath, bankDir, label) {
  const base = safeName(path.basename(srcPath, path.extname(srcPath)))
  const originalDir = path.join(bankDir, 'original')
  const parsedDir = path.join(bankDir, 'parsed-excel')
  copyOriginal(srcPath, originalDir)
  const cleanedPath = path.join(parsedDir, `${base} - duplicates removed.xlsx`)
  const { removed } = clean9035CashBookDuplicates(srcPath, cleanedPath)
  const result = parseExcel(cleanedPath, 0)
  const stats = writeParsedExcel(path.join(parsedDir, `${base} - parsed.xlsx`), result, {
    source: path.relative(ROOT, srcPath),
    parseMethod: 'excel',
  })
  return {
    label,
    file: path.basename(srcPath),
    type: 'excel',
    status: 'ok',
    correction: `Removed ${removed} duplicate payment row(s)`,
    ...stats,
  }
}

const SPECS = [
  {
    id: '01-ecobank',
    name: 'Ecobank (Lordship)',
    items: [
      { kind: 'pdf', path: 'ecobankstatementformats/1778163944552 (acct1).pdf', label: 'Bank statement acct 9033' },
      { kind: 'pdf', path: 'ecobankstatementformats/1778676142095 (acct 2).pdf', label: 'Bank statement acct 9035' },
      { kind: 'excel', path: 'ecobankstatementformats/Lordship cash bk 1.xlsx', label: 'Cash book 1' },
      { kind: 'excel', path: 'ecobankstatementformats/Lordship cash bk 2.xlsx', label: 'Cash book 2' },
      {
        kind: 'note',
        path: 'ecobankstatementformats/2025 final brs for acct 901 (acct 1).xlsx',
        label: 'BRS summary acct 901',
        note: 'Reference BRS workbook — not a bank upload format',
      },
      {
        kind: 'note',
        path: 'ecobankstatementformats/2025 final brs for acct 902 (acct 2).xlsx',
        label: 'BRS summary acct 902',
        note: 'Reference BRS workbook — not a bank upload format',
      },
    ],
  },
  {
    id: '02-nib',
    name: 'NIB',
    items: [
      { kind: 'pdf', path: 'nibbankstatementformat/NIB(1102037505201)[10535].pdf', label: 'Bank statement PDF' },
      {
        kind: 'excel',
        path: 'nibbankstatementformat/NIB cash bk.xlsx',
        label: 'NIB cash book (ERP G/L — different GL account from PDF)',
      },
    ],
  },
  {
    id: '03-adb',
    name: 'ADB',
    items: [
      {
        kind: 'pdf',
        path: 'adbstatementsformat/ADB COCOA BOD PURCHASE ACC CALL[1061810015800001]-september,2023.pdf',
        label: 'Call deposit statement',
      },
      {
        kind: 'pdf',
        path: 'adbstatementsformat/adb COCOA BOD PURCHASE ACC[1061020015800001]-september,2023.pdf',
        label: 'Purchase account statement',
      },
      { kind: 'excel', path: 'adbstatementsformat/ADB cash bk.xlsx', label: 'ERP cash book (GLPTLS1)' },
    ],
  },
  {
    id: '04-gcb',
    name: 'GCB',
    items: [
      {
        kind: 'pdf',
        path: 'gcbstatementformat/gcb republic house corporate(1061130000070)-sept.2023.pdf',
        label: 'Republic House corporate statement',
      },
      {
        kind: 'excel',
        path: 'gcbstatementformat/GCB REPUBLIC HOUSE CASHBOOK CURRENT (100-026-024)-September,2023Q.xls',
        label: 'Republic House cash book (ERP)',
      },
    ],
  },
  {
    id: '05-absa',
    name: 'Absa',
    items: [
      {
        kind: 'pdf',
        path: 'adsastatementformat 2/ABSA cocoa purchases call deposit(2086268)-september,2023.pdf',
        label: 'Call deposit statement PDF',
      },
      {
        kind: 'excel',
        path: 'adsastatementformat 2/ABSA cocoa purchases call deposit(2086268)-september,2023.xlsx',
        label: 'Call deposit statement Excel',
      },
    ],
  },
  {
    id: '06-bank-of-africa',
    name: 'Bank of Africa',
    items: [
      { kind: 'excel', path: 'bankofafricastatementformat/bank of africa.xlsm', label: 'Bank statement xlsm' },
      {
        kind: 'excel',
        path: 'bankofafricastatementformat/Excel Statement - COCOBOD CURRENT (1).xlsm',
        label: 'COCOBOD current xlsm',
      },
    ],
  },
  {
    id: '07-umb',
    name: 'UMB',
    items: [
      {
        kind: 'pdf',
        path: 'specimenbankstatementformats/UMB Cocoa Purchases  main(1110005147028)- Sept 23.pdf',
        label: 'Cocoa Purchases statement PDF',
      },
      {
        kind: 'excel',
        path: 'specimenbankstatementformats/umb 1110005147028 statement - cleaned.xlsx',
        label: 'UMB cleaned Excel (manual layout)',
      },
    ],
  },
  {
    id: '08-scb',
    name: 'Standard Chartered (SCB)',
    items: [
      { kind: 'excel', path: 'specimenbankstatementformats/scb statement.xlsx', label: 'SCB statement raw' },
      {
        kind: 'excel',
        path: 'specimenbankstatementformats/scb statement - cleaned.xlsx',
        label: 'SCB statement cleaned',
      },
    ],
  },
  {
    id: '09-tgl-acct4702',
    name: 'TGL acct 4702 cash book',
    items: [{ kind: 'excel', path: 'specimenbankstatementformats/acct4702 cashbk.xlsx', label: 'TGL ERP cash book' }],
  },
  {
    id: '10-prudential',
    name: 'Prudential Bank',
    items: [
      {
        kind: 'pdf',
        path: 'Prudential bank(0091900180008)_sep 23[10235].pdf',
        label: 'September 2023 statement',
      },
    ],
  },
  {
    id: '11-lordship-9033-q1-2026',
    name: 'Lordship Ecobank 9033 Q1 2026',
    items: [
      { kind: 'excel', path: 'accountno552records/LIBcashbk1 2026 1qtr.xlsx', label: 'Cash book Q1 2026' },
      {
        kind: 'excel',
        path: 'accountno552records/1778163944552 dated 4.6.26.xlsx',
        label: 'Bank statement Q1 2026 (Excel upload)',
      },
      { kind: 'pdf', path: 'accountno552records/1778163944552.pdf', label: 'Bank statement Q1 2026 (PDF)' },
      {
        kind: 'note',
        path: 'accountno552records/Account901 brs as at 31.3.2026.xlsx',
        label: 'Manual BRS workbook',
        note: 'Manual reconciliation target — compare platform report against this',
      },
      {
        kind: 'note',
        path: 'accountno552records/platform-export-acct552.xlsx',
        label: 'Platform export snapshot',
        note: 'BRS platform output for comparison',
      },
      {
        kind: 'note',
        path: 'accountno552records/BRS-9033-Questions-for-Manual-Preparer.pdf',
        label: 'Preparer questions PDF',
        note: 'Reference notes from manual review',
      },
      {
        kind: 'note',
        path: 'updatedbrsforaccts033and035/Account901 brs as at31.3.2026 updated.xlsx',
        label: 'Updated manual BRS (Jul 2026)',
        note: 'Latest preparer workbook with pairing marks — same totals as prior manual BRS',
      },
    ],
  },
  {
    id: '12-lordship-9035-q1-2026',
    name: 'Lordship Ecobank 9035 Q1 2026',
    items: [
      {
        kind: 'clean9035',
        path: 'accountno095details/LIBcashbk2 2026 1qtr.xlsx',
        label: 'Cash book Q1 2026 (duplicates removed)',
      },
      {
        kind: 'excel',
        path: 'accountno095details/1778676142095 dated 4.6.26.xlsx',
        label: 'Bank statement Q1 2026 (Excel upload)',
      },
      { kind: 'pdf', path: 'accountno095details/1778676142095.pdf', label: 'Bank statement Q1 2026 (PDF)' },
      {
        kind: 'note',
        path: 'accountno095details/Account902 brs as at 31.3.2026.xlsx',
        label: 'Manual BRS workbook',
        note: 'Manual reconciliation target — compare platform report against this',
      },
      {
        kind: 'note',
        path: 'accountno095details/platform-export-acct095.xlsx',
        label: 'Platform export snapshot',
        note: 'BRS platform output for comparison',
      },
      {
        kind: 'note',
        path: 'updatedbrsforaccts033and035/Account902 brs as at 31.3.2026 updated.xlsx',
        label: 'Updated manual BRS (Jul 2026)',
        note: 'Latest preparer workbook — flags 3 duplicate cash-book payments removed on upload',
      },
    ],
  },
  {
    id: '13-bog',
    name: 'Bank of Ghana (BOG)',
    items: [
      {
        kind: 'excel',
        path: 'BOG COCOBOD GHS ADV OPERATIONAL EXP ACCT(01102022-30092023).xlsx',
        label: 'COCOBOD operational account statement',
      },
    ],
  },
  {
    id: '14-acct002-test-data',
    name: 'Account 002 test data',
    items: [
      { kind: 'excel', path: 'testdataandresultsforacct002/cash book acct 2.xlsx', label: 'Cash book' },
      { kind: 'excel', path: 'testdataandresultsforacct002/bs acct 2.xlsx', label: 'Bank statement' },
      {
        kind: 'note',
        path: 'testdataandresultsforacct002/brs acct 2.xlsx',
        label: 'Manual BRS',
        note: 'Reference manual BRS workbook',
      },
      {
        kind: 'note',
        path: 'testdataandresultsforacct002/platform-export-acct002.xlsx',
        label: 'Platform export',
        note: 'BRS platform output for comparison',
      },
      {
        kind: 'pdf',
        path: 'testdataandresultsforacct002/platform-export-acct002.pdf',
        label: 'Platform export PDF',
      },
    ],
  },
  {
    id: '15-acct4702-test-data',
    name: 'Account 4702 test data',
    items: [
      { kind: 'excel', path: 'testdataforacct4702/acct 4702 bank statement.xlsx', label: 'Bank statement' },
      { kind: 'excel', path: 'testdataforacct4702/acct4702 cashbk.xlsx', label: 'Cash book (copy)' },
      {
        kind: 'note',
        path: 'testdataforacct4702/acct 4702 brs.xlsx',
        label: 'Manual BRS',
        note: 'Reference manual BRS workbook',
      },
      {
        kind: 'note',
        path: 'testdataforacct4702/platform-export-acct4702.xlsx',
        label: 'Platform export',
        note: 'BRS platform output for comparison',
      },
    ],
  },
  {
    id: '16-acct430-test-data',
    name: 'Account 430 test data',
    items: [
      { kind: 'excel', path: 'testofacct430/acct430 bank statement.xlsx', label: 'Bank statement' },
      { kind: 'excel', path: 'testofacct430/acct430 cash book.xlsx', label: 'Cash book' },
      {
        kind: 'note',
        path: 'testofacct430/acct430 brs.xlsx',
        label: 'Manual BRS',
        note: 'Reference manual BRS workbook',
      },
      {
        kind: 'note',
        path: 'testofacct430/platform-export-acct430.xlsx',
        label: 'Platform export',
        note: 'BRS platform output for comparison',
      },
    ],
  },
]

async function main() {
  if (fs.existsSync(OUT_ROOT)) {
    fs.rmSync(OUT_ROOT, { recursive: true, force: true })
  }
  fs.mkdirSync(OUT_ROOT, { recursive: true })

  const manifest = { exportedAt: new Date().toISOString(), banks: [] }

  for (const bank of SPECS) {
    const bankDir = path.join(OUT_ROOT, bank.id)
    fs.mkdirSync(path.join(bankDir, 'original'), { recursive: true })
    fs.mkdirSync(path.join(bankDir, 'parsed-excel'), { recursive: true })
    fs.mkdirSync(path.join(bankDir, 'parsed-pdf'), { recursive: true })

    const bankEntry = { id: bank.id, name: bank.name, files: [] }

    for (const item of bank.items) {
      const fullPath = path.join(ROOT, item.path)
      try {
        if (!fs.existsSync(fullPath)) {
          bankEntry.files.push({ ...item, status: 'missing' })
          continue
        }
        if (item.kind === 'pdf') {
          bankEntry.files.push(await exportPdf(fullPath, bankDir, item.label))
        } else if (item.kind === 'excel') {
          bankEntry.files.push(exportExcel(fullPath, bankDir, item.label))
        } else if (item.kind === 'note') {
          bankEntry.files.push(noteOnly(fullPath, bankDir, item.label, item.note))
        } else if (item.kind === 'clean9035') {
          bankEntry.files.push(exportCleaned9035Cashbook(fullPath, bankDir, item.label))
        }
      } catch (e) {
        bankEntry.files.push({
          label: item.label,
          file: path.basename(fullPath),
          status: 'error',
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }
    manifest.banks.push(bankEntry)
  }

  const readme = `# Corrected bank statement specimens (BRS upload-ready)

Exported: ${manifest.exportedAt}

This folder packages every bank/cashbook specimen we fixed in the BRS platform. Each bank subfolder contains:

- **original/** — your source PDF or Excel file (unchanged)
- **parsed-excel/** — transaction table extracted by the BRS parser (what the system now reads on upload)
- **parsed-pdf/** — same corrected transactions as a printable PDF extract (for PDF bank sources only)

## How to compare

1. Open the **parsed-excel** file — this is the corrected transaction layout (dates, descriptions, debits, credits).
2. Compare totals in row 7–8 of the Excel export (sum debits / sum credits) against your PDF statement footers.
3. Upload the **original** file in BRS — it should auto-map without manual column mapping.

## Banks included

${manifest.banks
  .map((b) => {
    const lines = b.files
      .map((f) => {
        if (f.status === 'ok') {
          const fix = f.correction ? ` — ${f.correction}` : ''
          return `  - ${f.label}: ${f.rowCount} rows, debits/payments ${f.sumDebit?.toLocaleString?.() ?? f.sumDebit}, credits/receipts ${f.sumCredit?.toLocaleString?.() ?? f.sumCredit} (${f.parseMethod})${fix}`
        }
        if (f.status === 'reference-only') return `  - ${f.label}: ${f.note}`
        if (f.status === 'error') return `  - ${f.label}: ERROR — ${f.error}`
        return `  - ${f.label}: ${f.status}`
      })
      .join('\n')
    return `### ${b.name} (\`${b.id}/\`)\n${lines}`
  })
  .join('\n\n')}

## Notes

- **Ecobank PDFs**: page-break duplicates removed; footer totals match exactly.
- **Lordship 9035 cash book**: 3 duplicate payment rows removed before upload (see \`parsed-excel/*duplicates removed.xlsx\`).
- **Cash books (TGL ERP / GLPTLS1)**: ERP exports normalized to AMT RECEIVED / AMT PAID columns.
- **NIB cash book**: ERP G/L export — different GL account from the NIB PDF specimen.
- **BRS / platform-export xlsx**: manual targets and platform snapshots for reconciliation comparison — not bank upload formats.
- **BOG**: Excel statement with glued overflow cells recovered by parser.

Generated by \`scripts/export-corrected-specimens.mjs\`
`

  fs.writeFileSync(path.join(OUT_ROOT, 'README.md'), readme)
  fs.writeFileSync(path.join(OUT_ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2))

  console.log(`✓ Exported to ${OUT_ROOT}`)
  for (const b of manifest.banks) {
    console.log(`  ${b.id}: ${b.files.filter((f) => f.status === 'ok').length} parsed, ${b.files.filter((f) => f.status !== 'ok').length} other`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
