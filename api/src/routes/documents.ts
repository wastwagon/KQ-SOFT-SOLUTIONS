import { Router } from 'express'
import { z } from 'zod'
import fs from 'fs'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { canMapDocuments, isProjectEditable } from '../lib/permissions.js'
import { parseExcel, parseCsv, detectFileType } from '../services/parser.js'
import { parsePdf, parseImage } from '../services/ocr.js'
import {
  detectGhanaBankFormat,
  getSuggestedBankMapping,
  extractChqNoFromDescription,
  type GhanaBankFormat,
} from '../services/ghanaBankParsers.js'
import { canAddTransactions, incrementTransactions } from '../services/usage.js'
import { logAudit } from '../services/audit.js'
import { classifyBySourceSign, summarizeSignBuckets, type SourceDocumentType } from '../services/signClassifier.js'
import { parseImportedAmount } from '../services/amountParser.js'

const router = Router()
router.use(authMiddleware)

const CANONICAL_CASH_BOOK = ['s_no', 'date', 'name', 'details', 'doc_ref', 'chq_no', 'accode', 'amt_received', 'amt_paid']
const CANONICAL_BANK = ['transaction_date', 'description', 'credit', 'debit']
type MappingConfidence = 'high' | 'medium' | 'low'

function normHeader(h: string): string {
  return (h || '').toLowerCase().replace(/[\s_]+/g, ' ').trim()
}

function buildSmartSuggestedMapping(
  headers: string[],
  isCashBook: boolean,
  existingSuggested: Record<string, number> = {}
): Record<string, number> {
  const out = { ...existingSuggested }
  const normalized = headers.map(normHeader)

  const find = (patterns: RegExp[]): number => {
    const idx = normalized.findIndex((h) => patterns.some((p) => p.test(h)))
    return idx >= 0 ? idx : -1
  }

  if (isCashBook) {
    if (out.date == null) {
      const i = find([/^date$/, /transaction\s*date/, /value\s*date/, /txn\s*date/, /posting\s*date/, /transaction_date/])
      if (i >= 0) out.date = i
    }
    if (out.name == null) {
      const i = find([/^name$/, /description/, /particulars/, /narrative/, /payee/, /party/])
      if (i >= 0) out.name = i
    }
    if (out.details == null) {
      const i = find([/^details$/, /particulars/, /narrative/, /memo/, /remarks/])
      if (i >= 0) out.details = i
    }
    if (out.doc_ref == null) {
      const i = find([/^doc ref$/, /^doc_ref$/, /^ref$/, /reference/, /voucher/, /receipt\s*no/])
      if (i >= 0) out.doc_ref = i
    }
    if (out.chq_no == null) {
      const i = find([/^chq no$/, /^chq_no$/, /chq\s*no/, /cheque\s*no/, /cheque\s*number/, /chq$/])
      if (i >= 0) out.chq_no = i
    }
    if (out.accode == null) {
      const i = find([/^accode$/, /account\s*code/, /ac\s*code/, /^code$/])
      if (i >= 0) out.accode = i
    }
    if (out.amt_received == null) {
      const i = find([/amt\s*received/, /amount\s*received/, /receipts?/, /^received$/, /credit/, /\bcr\b/, /deposit/])
      if (i >= 0) out.amt_received = i
    }
    if (out.amt_paid == null) {
      const i = find([/amt\s*paid/, /amount\s*paid/, /payments?/, /^paid$/, /debit/, /\bdr\b/, /withdrawal/])
      if (i >= 0) out.amt_paid = i
    }
    if (out.amt_received == null && out.amt_paid == null) {
      const i = find([/^amount$/, /^amt$/, /total/])
      if (i >= 0) {
        out.amt_received = i
        out.amt_paid = i
      }
    }
  } else {
    if (out.transaction_date == null) {
      const i = find([/^date$/, /transaction\s*date/, /value\s*date/, /txn\s*date/, /posting\s*date/, /transaction_date/])
      if (i >= 0) out.transaction_date = i
    }
    if (out.description == null) {
      const i = find([/^description$/, /particulars/, /narrative/, /details/, /memo/, /remarks/])
      if (i >= 0) out.description = i
    }
    if (out.credit == null) {
      const i = find([/^credit$/, /\bcr\b/, /deposits?/, /in(?:ward)?/])
      if (i >= 0) out.credit = i
    }
    if (out.debit == null) {
      const i = find([/^debit$/, /\bdr\b/, /withdrawals?/, /out(?:ward)?/])
      if (i >= 0) out.debit = i
    }
    if (out.credit == null && out.debit == null) {
      const i = find([/^amount$/, /^amt$/, /total/])
      if (i >= 0) {
        out.credit = i
        out.debit = i
      }
    }
  }

  return out
}

function getMappingConfidence(
  headers: string[],
  mapping: Record<string, number>
): Record<string, MappingConfidence> {
  const out: Record<string, MappingConfidence> = {}
  const STRONG: Record<string, RegExp[]> = {
    date: [/^date$/, /transaction\s*date/, /value\s*date/, /posting\s*date/],
    transaction_date: [/^date$/, /transaction\s*date/, /value\s*date/, /posting\s*date/],
    description: [/^description$/, /particulars/, /narrative/, /details/, /memo/, /remarks/],
    name: [/^name$/, /payee/, /party/, /description/],
    details: [/^details$/, /particulars/, /narrative/, /memo/, /remarks/],
    doc_ref: [/^doc ref$/, /^doc_ref$/, /^ref$/, /reference/, /voucher/],
    chq_no: [/^chq no$/, /^chq_no$/, /cheque\s*no/, /cheque\s*number/],
    accode: [/^accode$/, /account\s*code/, /ac\s*code/],
    amt_received: [/amt\s*received/, /amount\s*received/, /receipts?/, /^received$/, /^credit$/, /\bcr\b/],
    amt_paid: [/amt\s*paid/, /amount\s*paid/, /payments?/, /^paid$/, /^debit$/, /\bdr\b/],
    credit: [/^credit$/, /\bcr\b/, /deposits?/],
    debit: [/^debit$/, /\bdr\b/, /withdrawals?/],
  }
  const SOFT: Record<string, RegExp[]> = {
    doc_ref: [/ref/, /receipt/, /number/],
    chq_no: [/chq/, /cheque/, /number/],
    amt_received: [/received/, /credit/, /deposit/, /amount/, /amt/],
    amt_paid: [/paid/, /debit/, /withdrawal/, /amount/, /amt/],
    credit: [/credit/, /deposit/, /amount/, /amt/],
    debit: [/debit/, /withdrawal/, /amount/, /amt/],
  }
  for (const [field, idx] of Object.entries(mapping)) {
    const header = normHeader(headers[idx] || '')
    if (!header) {
      out[field] = 'low'
      continue
    }
    const strong = (STRONG[field] || []).some((p) => p.test(header))
    if (strong) {
      out[field] = 'high'
      continue
    }
    const soft = (SOFT[field] || [/amount/, /date/, /desc/, /ref/, /details/]).some((p) => p.test(header))
    out[field] = soft ? 'medium' : 'low'
  }
  return out
}

router.get('/:id/preview', async (req: AuthRequest, res) => {
  const { id } = req.params
  const orgId = req.auth!.orgId
  const doc = await prisma.document.findFirst({
    where: { id },
    include: { project: true },
  })
  if (!doc || doc.project.organizationId !== orgId) {
    return res.status(404).json({ error: 'Document not found' })
  }
  if (!fs.existsSync(doc.filepath)) {
    return res.status(404).json({ error: 'File not found' })
  }
  try {
    const type = detectFileType(doc.filepath)
    let result: { headers: string[]; rows: unknown[][]; sheetNames?: string[] }
    if (type === 'excel') result = parseExcel(doc.filepath)
    else if (type === 'csv') result = parseCsv(doc.filepath)
    else if (type === 'pdf') result = await parsePdf(doc.filepath)
    else result = await parseImage(doc.filepath)
    const sample = result.rows.slice(0, 20)
    let detectedBankFormat: GhanaBankFormat = null
    let suggestedMapping: Record<string, number> | undefined
    if (!doc.type.startsWith('cash_book_')) {
      detectedBankFormat = detectGhanaBankFormat(result.headers, sample)
      if (detectedBankFormat) {
        const type = doc.type === 'bank_credits' ? 'credits' : 'debits'
        suggestedMapping = getSuggestedBankMapping(detectedBankFormat, result.headers, type)
      }
    }
    suggestedMapping = buildSmartSuggestedMapping(result.headers, doc.type.startsWith('cash_book_'), suggestedMapping)
    const mappingConfidence = getMappingConfidence(result.headers, suggestedMapping)
    res.json({
      documentId: doc.id,
      filename: doc.filename,
      headers: result.headers,
      rows: sample,
      totalRows: result.rows.length,
      sheetNames: result.sheetNames,
      canonicalFields: doc.type.startsWith('cash_book_')
        ? CANONICAL_CASH_BOOK
        : CANONICAL_BANK,
      detectedBankFormat: detectedBankFormat ?? undefined,
      suggestedMapping,
      mappingConfidence,
      pdfTruncated: (result as { pdfTruncated?: boolean }).pdfTruncated,
      pdfPagesProcessed: (result as { pdfPagesProcessed?: number }).pdfPagesProcessed,
      pdfTotalPages: (result as { pdfTotalPages?: number }).pdfTotalPages,
    })
  } catch (e) {
    const msg = (e as Error).message || 'Parse failed'
    const fileType = detectFileType(doc.filepath)
    const hint = fileType === 'pdf' ? ' PDF may be scanned—ensure it contains extractable text.' : fileType === 'image' ? ' Image may be low quality or contain non-Latin text.' : ''
    res.status(400).json({ error: msg + hint })
  }
})

const mapSchema = z.object({
  mapping: z.record(z.string(), z.union([z.number(), z.string()])),
  sheetIndex: z.number().optional(),
})

router.post('/:id/map', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canMapDocuments(role)) {
    return res.status(403).json({ error: 'Insufficient permission to map documents' })
  }
  const { id } = req.params
  const orgId = req.auth!.orgId
  const doc = await prisma.document.findFirst({
    where: { id },
    include: { project: true },
  })
  if (!doc || doc.project.organizationId !== orgId) {
    return res.status(404).json({ error: 'Document not found' })
  }
  if (!isProjectEditable((doc.project as { status?: string }).status)) {
    return res.status(403).json({ error: 'Project is locked (submitted for review or approved). Reopen to edit.' })
  }
  if (!fs.existsSync(doc.filepath)) {
    return res.status(404).json({ error: 'File not found' })
  }
  const org = await prisma.organization.findFirst({
    where: { id: doc.project.organizationId },
  })
  if (!org) return res.status(404).json({ error: 'Organization not found' })
  try {
    const body = mapSchema.parse(req.body)
    const type = detectFileType(doc.filepath)
    let result: { headers: string[]; rows: unknown[][] }
    if (type === 'excel') result = parseExcel(doc.filepath, body.sheetIndex ?? 0)
    else if (type === 'csv') result = parseCsv(doc.filepath)
    else if (type === 'pdf') result = await parsePdf(doc.filepath)
    else result = await parseImage(doc.filepath)
    const rawMapping = body.mapping as Record<string, number | string>
    const mapping: Record<string, number> = {}
    for (const [k, v] of Object.entries(rawMapping)) {
      const idx = typeof v === 'string' ? parseInt(v, 10) : v
      if (typeof idx === 'number' && !isNaN(idx) && idx >= 0) mapping[k] = idx
    }
    const isCashBook = doc.type.startsWith('cash_book_')
    const dateField = isCashBook ? 'date' : 'transaction_date'
    const numCols = (result.rows[0] as unknown[])?.length ?? result.headers?.length ?? 0
    for (const [field, idx] of Object.entries(mapping)) {
      if (idx >= numCols) {
        return res.status(400).json({ error: `Column mapping for "${field}" (index ${idx}) is out of range. Document has ${numCols} columns.` })
      }
    }
    if (mapping[dateField] == null) {
      return res.status(400).json({ error: `${dateField === 'date' ? 'Date' : 'Transaction date'} column is required for mapping. Please map the date column.` })
    }
    const amountField = isCashBook
      ? (doc.type === 'cash_book_receipts' ? 'amt_received' : 'amt_paid')
      : (doc.type === 'bank_credits' ? 'credit' : 'debit')
    const isCashMixedOneColumn =
      isCashBook &&
      mapping.amt_received != null &&
      mapping.amt_paid != null &&
      mapping.amt_received === mapping.amt_paid
    const isBankMixedOneColumn =
      !isCashBook &&
      mapping.credit != null &&
      mapping.debit != null &&
      mapping.credit === mapping.debit
    const transactions: { rowIndex: number; date: Date | null; name: string | null; details: string | null; docRef: string | null; chqNo: string | null; accode: number | null; amount: number }[] = []
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i] as unknown[]
      const getVal = (field: string): unknown => {
        const col = mapping[field]
        if (col == null) return null
        const idx = typeof col === 'string' ? parseInt(col, 10) : col
        if (isNaN(idx) || idx < 0 || idx >= row.length) return null
        const v = row[idx]
        return v != null && String(v).trim() !== '' ? v : null
      }
      const parseDate = (v: unknown): Date | null => {
        if (!v) return null
        if (v instanceof Date) return v
        const s = String(v).trim()
        if (!s) return null
        // Try DD/MM/YYYY or DD-MM-YYYY with optional HH:mm[:ss]
        const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
        if (dmy) {
          const [, day, month, year, hh, mm, ss] = dmy
          const d = new Date(
            parseInt(year!, 10),
            parseInt(month!, 10) - 1,
            parseInt(day!, 10),
            parseInt(hh || '0', 10),
            parseInt(mm || '0', 10),
            parseInt(ss || '0', 10)
          )
          return isNaN(d.getTime()) ? null : d
        }
        const d = new Date(s)
        return isNaN(d.getTime()) ? null : d
      }
      const date = parseDate(getVal(dateField))
      const name = getVal('name') != null ? String(getVal('name')) : null
      const details = getVal('details') != null ? String(getVal('details')) : (getVal('description') != null ? String(getVal('description')) : null)
      const docRef = getVal('doc_ref') != null ? String(getVal('doc_ref')) : null
      let chqNo = getVal('chq_no') != null ? String(getVal('chq_no')) : null
      if (!chqNo && !isCashBook && details) {
        const extracted = extractChqNoFromDescription(details)
        if (extracted) chqNo = extracted
      }
      const accode = getVal('accode') != null ? (typeof getVal('accode') === 'number' ? getVal('accode') as number : parseInt(String(getVal('accode')), 10)) : null
      const amount = parseImportedAmount(getVal(amountField))
      let normalizedAmount = amount
      // Only persist rows with non-zero monetary value.
      // For bank docs, this avoids duplicate zero rows from opposite debit/credit columns.
      let includeRow = Math.abs(amount) > 0
      if (includeRow && isCashMixedOneColumn) {
        if (doc.type === 'cash_book_receipts') includeRow = amount > 0
        else includeRow = amount < 0
        normalizedAmount = Math.abs(amount)
      } else if (includeRow && isBankMixedOneColumn) {
        if (doc.type === 'bank_credits') includeRow = amount > 0
        else includeRow = amount < 0
        normalizedAmount = Math.abs(amount)
      }
      if (includeRow) {
        transactions.push({
          rowIndex: i + 1,
          date,
          name,
          details,
          docRef,
          chqNo,
          accode: accode ?? null,
          amount: normalizedAmount,
        })
      }
    }
    const txLimitCheck = await canAddTransactions(doc.project.organizationId, org.plan, transactions.length)
    if (!txLimitCheck.ok) return res.status(403).json({ error: txLimitCheck.message })
    await prisma.transaction.deleteMany({ where: { documentId: id } })
    await prisma.transaction.createMany({
      data: transactions.map((t) => ({
        documentId: id,
        rowIndex: t.rowIndex,
        date: t.date,
        name: t.name,
        details: t.details,
        docRef: t.docRef,
        chqNo: t.chqNo,
        accode: t.accode,
        amount: t.amount,
      })),
    })
    await prisma.project.update({
      where: { id: doc.projectId },
      data: { status: 'mapping' },
    })
    const sourceType = doc.type as SourceDocumentType
    const signSummary = summarizeSignBuckets(sourceType, transactions.map((t) => t.amount))
    const signWarnings = transactions
      .map((t) => {
        const c = classifyBySourceSign(sourceType, t.amount)
        return { rowIndex: t.rowIndex, amount: t.amount, bucket: c.bucket, note: c.note }
      })
      .filter((w) => w.bucket !== 'primary')
    const signWarningsPreview = signWarnings.slice(0, 25)
    await incrementTransactions(doc.project.organizationId, transactions.length)
    await logAudit({
      organizationId: doc.project.organizationId,
      userId: req.auth!.userId,
      projectId: doc.projectId,
      action: 'document_mapped',
      details: {
        documentId: id,
        documentType: doc.type,
        transactionCount: transactions.length,
        signWarnings: signWarnings.length,
      },
    })
    res.json({
      count: transactions.length,
      signFilterSummary: signSummary,
      signWarningsCount: signWarnings.length,
      signWarningsPreview,
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message ?? 'Invalid mapping' })
    }
    const msg = (e as Error).message
    if (msg.includes('column') || msg.includes('required') || msg.includes('mapping')) {
      return res.status(400).json({ error: msg })
    }
    res.status(500).json({ error: msg || 'Mapping failed. Check that column mapping is correct.' })
  }
})

router.get('/:id/transactions', async (req: AuthRequest, res) => {
  const { id } = req.params
  const orgId = req.auth!.orgId
  const doc = await prisma.document.findFirst({
    where: { id },
    include: { project: true },
  })
  if (!doc || doc.project.organizationId !== orgId) {
    return res.status(404).json({ error: 'Document not found' })
  }
  const transactions = await prisma.transaction.findMany({
    where: { documentId: id },
    orderBy: { rowIndex: 'asc' },
  })
  res.json(transactions)
})

export default router
