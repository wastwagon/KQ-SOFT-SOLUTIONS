/**
 * Standalone clean tools — parse a bank statement or cash book and download
 * cleaned Excel / PDF without creating a reconciliation project.
 */
import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import type { DocumentType } from '@prisma/client'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { requireOrgSubscriptionForApp } from '../middleware/requireOrgSubscriptionForApp.js'
import { uploadParseRouteLimiter } from '../middleware/heavyRouteLimiter.js'
import { resolveMaxUploadSizeBytes } from '../config/importLimits.js'
import { ensureLocalUploadDirs } from '../lib/storage.js'
import { sanitizeFilename } from '../lib/sanitizeFilename.js'
import { parseDocumentFile } from '../services/documentParse.js'
import { pickBestExcelSheetIndex } from '../services/cashBookExcel.js'
import { detectFileType } from '../services/parser.js'
import {
  buildParsedExcelBuffer,
  buildParsedPdfBuffer,
  summarizeParsed,
  type CleanExportKind,
} from '../services/cleanExport.js'
import { logAudit } from '../services/audit.js'

const router = Router()
ensureLocalUploadDirs()
const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin'
    cb(null, `clean-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  },
})

const ALLOWED = ['.xlsx', '.xls', '.xlsm', '.csv', '.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp']
const upload = multer({
  storage,
  limits: { fileSize: resolveMaxUploadSizeBytes() },
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ALLOWED.includes(ext)) cb(null, true)
    else cb(new Error(`File type not allowed. Use: ${ALLOWED.join(', ')}`))
  },
})

router.use(authMiddleware)
router.use(requireOrgSubscriptionForApp)
router.use(uploadParseRouteLimiter)

type CleanFormat = 'xlsx' | 'pdf' | 'json'

function parseFormat(raw: unknown): CleanFormat {
  const v = String(raw || 'xlsx').toLowerCase()
  if (v === 'pdf' || v === 'json') return v
  return 'xlsx'
}

function safeBaseName(original: string): string {
  const base = path.basename(original, path.extname(original))
  return sanitizeFilename(base).slice(0, 80) || 'cleaned'
}

async function handleClean(
  req: AuthRequest,
  res: import('express').Response,
  kind: CleanExportKind,
  docType: DocumentType
) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const filepath = req.file.path
  const originalName = req.file.originalname
  const format = parseFormat(req.query.format ?? req.body?.format)

  try {
    const ft = detectFileType(filepath)
    const sheetIndex =
      ft === 'excel' ? pickBestExcelSheetIndex(filepath, docType) : 0
    const parsed = await parseDocumentFile(filepath, docType, sheetIndex)
    const sums = summarizeParsed(parsed)
    const metaBase = {
      kind,
      source: originalName,
      parseMethod: parsed.parseMethod,
      ...sums,
    }

    if (format === 'json') {
      return res.json({
        kind,
        source: originalName,
        parseMethod: parsed.parseMethod ?? null,
        headers: parsed.headers,
        rowCount: sums.rowCount,
        sumDebit: sums.sumDebit,
        sumCredit: sums.sumCredit,
        sampleRows: parsed.rows.slice(0, 12),
      })
    }

    const base = safeBaseName(originalName)
    const label = kind === 'cash_book' ? 'cash-book' : 'bank-statement'

    if (format === 'pdf') {
      const buffer = await buildParsedPdfBuffer(parsed, metaBase)
      await logAudit({
        organizationId: req.auth!.orgId,
        userId: req.auth!.userId,
        action: 'tools_clean_export',
        details: {
          kind,
          format: 'pdf',
          parseMethod: parsed.parseMethod,
          rowCount: sums.rowCount,
          source: originalName,
        },
      })
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${base}-${label}-cleaned.pdf"`)
      res.setHeader('X-Parse-Method', String(parsed.parseMethod || ''))
      res.setHeader('X-Row-Count', String(sums.rowCount))
      return res.send(buffer)
    }

    const { buffer } = buildParsedExcelBuffer(parsed, metaBase)
    await logAudit({
      organizationId: req.auth!.orgId,
      userId: req.auth!.userId,
      action: 'tools_clean_export',
      details: {
        kind,
        format: 'xlsx',
        parseMethod: parsed.parseMethod,
        rowCount: sums.rowCount,
        source: originalName,
      },
    })
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader('Content-Disposition', `attachment; filename="${base}-${label}-cleaned.xlsx"`)
    res.setHeader('X-Parse-Method', String(parsed.parseMethod || ''))
    res.setHeader('X-Row-Count', String(sums.rowCount))
    return res.send(buffer)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse file'
    return res.status(400).json({ error: message })
  } finally {
    try {
      if (filepath && fs.existsSync(filepath)) fs.unlinkSync(filepath)
    } catch {
      /* ignore cleanup errors */
    }
  }
}

router.post('/clean-bank-statement', upload.single('file'), (req: AuthRequest, res) =>
  handleClean(req, res, 'bank_statement', 'bank_credits')
)

router.post('/clean-cash-book', upload.single('file'), (req: AuthRequest, res) =>
  handleClean(req, res, 'cash_book', 'cash_book_receipts')
)

export default router
