/**
 * Standalone clean tools — parse a bank statement or cash book and download
 * cleaned Excel / PDF without creating a reconciliation project.
 *
 * Sample downloads are truncated + watermarked (free). Full downloads consume
 * the org's monthly clean-export quota.
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
  CLEAN_SAMPLE_ROW_LIMIT,
  summarizeParsed,
  type CleanExportKind,
  type CleanExportMode,
} from '../services/cleanExport.js'
import {
  withParsedRowsByDateOrder,
  type TransactionDateOrder,
} from '../lib/transactionDateOrder.js'
import { logAudit } from '../services/audit.js'
import { prisma } from '../lib/prisma.js'
import { canExportFullClean, getUsageWithLimits, incrementCleanExports } from '../services/usage.js'

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

/** Default sample for binary downloads — full requires explicit mode=full. */
function parseMode(raw: unknown, format: CleanFormat): CleanExportMode {
  if (format === 'json') return 'sample'
  const v = String(raw || 'sample').toLowerCase()
  return v === 'full' ? 'full' : 'sample'
}

function parseDateOrder(raw: unknown): TransactionDateOrder {
  const v = String(raw || 'oldest_first').toLowerCase().replace(/-/g, '_')
  if (v === 'newest_first' || v === 'newest_date_first') return 'newest_first'
  // oldest_first | oldest_date_first | anything else → book order
  return 'oldest_first'
}

function safeBaseName(original: string): string {
  const base = path.basename(original, path.extname(original))
  return sanitizeFilename(base).slice(0, 80) || 'cleaned'
}

async function cleanExportQuotaSnapshot(orgId: string, plan: string) {
  const usage = await getUsageWithLimits(orgId, plan)
  return {
    used: usage.cleanExportsUsed,
    limit: usage.cleanExportsLimit,
    unlimited: usage.cleanExportsUnlimited,
    remaining: usage.cleanExportsUnlimited
      ? null
      : Math.max(0, usage.cleanExportsLimit - usage.cleanExportsUsed),
  }
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
  const mode = parseMode(req.query.mode ?? req.body?.mode, format)
  const dateOrder = parseDateOrder(req.query.dateOrder ?? req.body?.dateOrder)
  const orgId = req.auth!.orgId

  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true },
    })
    if (!org) return res.status(404).json({ error: 'Organization not found' })

    const ft = detectFileType(filepath)
    const sheetIndex =
      ft === 'excel' ? pickBestExcelSheetIndex(filepath, docType) : 0
    const parsedRaw = await parseDocumentFile(filepath, docType, sheetIndex)
    const parsed = withParsedRowsByDateOrder(parsedRaw, dateOrder)
    const sums = summarizeParsed(parsed)
    const metaBase = {
      kind,
      source: originalName,
      parseMethod: parsed.parseMethod,
      ...sums,
    }
    const quota = await cleanExportQuotaSnapshot(orgId, org.plan)

    if (format === 'json') {
      return res.json({
        kind,
        source: originalName,
        parseMethod: parsed.parseMethod ?? null,
        headers: parsed.headers,
        rowCount: sums.rowCount,
        sumDebit: sums.sumDebit,
        sumCredit: sums.sumCredit,
        rowOrder: dateOrder,
        sampleRows: parsed.rows.slice(0, 12),
        sampleDownloadRowLimit: CLEAN_SAMPLE_ROW_LIMIT,
        cleanExportQuota: quota,
      })
    }

    if (mode === 'full') {
      const gate = await canExportFullClean(orgId, org.plan)
      if (!gate.ok) {
        return res.status(403).json({
          error: gate.message || 'Full clean export limit reached',
          code: 'CLEAN_EXPORT_QUOTA',
          cleanExportQuota: await cleanExportQuotaSnapshot(orgId, org.plan),
        })
      }
    }

    const base = safeBaseName(originalName)
    const label = kind === 'cash_book' ? 'cash-book' : 'bank-statement'
    const modeSuffix = mode === 'sample' ? '-sample' : ''
    const filenameStem = `${base}-${label}${modeSuffix}-cleaned`

    if (format === 'pdf') {
      const buffer = await buildParsedPdfBuffer(parsed, metaBase, mode, dateOrder)
      if (mode === 'full') await incrementCleanExports(orgId)
      await logAudit({
        organizationId: orgId,
        userId: req.auth!.userId,
        action: 'tools_clean_export',
        details: {
          kind,
          format: 'pdf',
          mode,
          dateOrder,
          parseMethod: parsed.parseMethod,
          rowCount: sums.rowCount,
          source: originalName,
        },
      })
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${filenameStem}.pdf"`)
      res.setHeader('X-Parse-Method', String(parsed.parseMethod || ''))
      res.setHeader('X-Row-Count', String(sums.rowCount))
      res.setHeader('X-Clean-Export-Mode', mode)
      res.setHeader('X-Date-Order', dateOrder)
      return res.send(buffer)
    }

    const { buffer } = buildParsedExcelBuffer(parsed, metaBase, mode, dateOrder)
    if (mode === 'full') await incrementCleanExports(orgId)
    await logAudit({
      organizationId: orgId,
      userId: req.auth!.userId,
      action: 'tools_clean_export',
      details: {
        kind,
        format: 'xlsx',
        mode,
        dateOrder,
        parseMethod: parsed.parseMethod,
        rowCount: sums.rowCount,
        source: originalName,
      },
    })
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader('Content-Disposition', `attachment; filename="${filenameStem}.xlsx"`)
    res.setHeader('X-Parse-Method', String(parsed.parseMethod || ''))
    res.setHeader('X-Row-Count', String(sums.rowCount))
    res.setHeader('X-Clean-Export-Mode', mode)
    res.setHeader('X-Date-Order', dateOrder)
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
