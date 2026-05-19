/**
 * Apply mapping directly via Prisma (no HTTP). Run from api/: npx tsx scripts/apply-lordship-map.ts
 */
import { PrismaClient, type DocumentType } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { parseExcel, detectFileType } from '../src/services/parser.js'
import { parseBankPdf } from '../src/services/documentParse.js'
import { normalizeEcobankExcelTable } from '../src/services/ecobankStatement.js'
import { parseImportedDate } from '../src/services/dateParser.js'
import { parseImportedAmount } from '../src/services/amountParser.js'
import { extractChqNoFromDescription } from '../src/services/ghanaBankParsers.js'

const prisma = new PrismaClient()
const SLUGS = ['lordship-ecobank-9033-q1-2026', 'lordship-ecobank-9035-q1-2026']
const ASDISCUSSED = path.join(process.cwd(), '..', 'asdiscussed')
const PDF_TO_XLSX: Record<string, string> = {
  '1778163944552.pdf': path.join(ASDISCUSSED, '1778163944552.xlsx'),
  '1778676142095.pdf': path.join(ASDISCUSSED, '1778676142095.xlsx'),
}

async function parseDoc(filepath: string, docType: DocumentType, filename: string) {
  const ft = detectFileType(filepath)
  if (ft === 'excel') return parseExcel(filepath, 0)
  if (ft === 'pdf') {
    if (docType.startsWith('cash_book_')) {
      return (await import('../src/services/ocr.js')).parsePdf(filepath)
    }
    let result = await parseBankPdf(filepath)
    const normalized =
      result.headers.includes('Debit') && result.headers.includes('Credit')
    if (!normalized || result.rows.length < 30) {
      const xlsx = PDF_TO_XLSX[path.basename(filename)]
      if (xlsx && fs.existsSync(xlsx)) {
        const raw = parseExcel(xlsx, 0)
        result = normalizeEcobankExcelTable(raw)
        console.log('    (used Ecobank xlsx fallback:', path.basename(xlsx), '→', result.rows.length, 'rows)')
      }
    }
    return result
  }
  throw new Error(`Unsupported type ${ft}`)
}

async function mapDocument(doc: { id: string; type: DocumentType; filepath: string }) {
  const result = await parseDoc(doc.filepath, doc.type, doc.filename)
  const isCashBook = doc.type.startsWith('cash_book_')
  const dateField = isCashBook ? 'date' : 'transaction_date'
  const amountField = isCashBook
    ? doc.type === 'cash_book_receipts'
      ? 'amt_received'
      : 'amt_paid'
    : doc.type === 'bank_credits'
      ? 'credit'
      : 'debit'

  const mapping: Record<string, number> = isCashBook
    ? { date: 2, name: 3, details: 4, doc_ref: 5, chq_no: 6, accode: 10, amt_received: 11, amt_paid: 12 }
    : doc.type === 'bank_credits'
      ? { transaction_date: 0, description: 1, credit: 5 }
      : { transaction_date: 0, description: 1, debit: 4 }

  if (!isCashBook) {
    if (doc.type === 'bank_credits') delete (mapping as Record<string, number>).debit
    else delete (mapping as Record<string, number>).credit
  } else {
    if (doc.type === 'cash_book_receipts') delete (mapping as Record<string, number>).amt_paid
    else delete (mapping as Record<string, number>).amt_received
  }

  const transactions: {
    rowIndex: number
    date: Date | null
    name: string | null
    details: string | null
    docRef: string | null
    chqNo: string | null
    accode: number | null
    amount: number
  }[] = []

  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows[i] as unknown[]
    const getVal = (field: string) => {
      const col = mapping[field]
      if (col == null) return null
      const v = row[col]
      return v != null && String(v).trim() !== '' ? v : null
    }
    const amount = parseImportedAmount(getVal(amountField))
    if (Math.abs(amount) <= 0) continue
    let details = getVal('details') != null ? String(getVal('details')) : null
    if (!details && getVal('description')) details = String(getVal('description'))
    let chqNo = getVal('chq_no') != null ? String(getVal('chq_no')) : null
    if (!chqNo && !isCashBook && details) {
      chqNo = extractChqNoFromDescription(details)
    }
    transactions.push({
      rowIndex: i + 1,
      date: parseImportedDate(getVal(dateField)),
      name: getVal('name') != null ? String(getVal('name')) : null,
      details,
      docRef: getVal('doc_ref') != null ? String(getVal('doc_ref')) : null,
      chqNo,
      accode: null,
      amount,
    })
  }

  await prisma.transaction.deleteMany({ where: { documentId: doc.id } })
  if (transactions.length > 0) {
    await prisma.transaction.createMany({
      data: transactions.map((t) => ({ documentId: doc.id, ...t })),
    })
  }
  return { headers: result.headers, count: transactions.length, totalRows: result.rows.length }
}

async function main() {
  for (const slug of SLUGS) {
    console.log('\n===', slug, '===')
    const project = await prisma.project.findFirst({
      where: { slug },
      include: { documents: true },
    })
    if (!project) {
      console.log('Project not found')
      continue
    }
    for (const doc of project.documents) {
      if (!fs.existsSync(doc.filepath)) {
        console.log('  MISSING FILE', doc.filename)
        continue
      }
      try {
        const r = await mapDocument(doc)
        console.log('  OK', doc.type, doc.filename, '→', r.count, 'txns (parsed', r.totalRows, 'rows)')
      } catch (e) {
        console.log('  FAIL', doc.type, doc.filename, (e as Error).message)
      }
    }
    await prisma.project.update({ where: { id: project.id }, data: { status: 'mapping' } })
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
