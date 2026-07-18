/// <reference path="../types/pdf-parse-new.d.ts" />
/**
 * OCR service: extract text from PDF and images (PNG, JPG, TIFF)
 * - PDFs: Try native text extraction first (faster, more accurate for text-based PDFs); fall back to OCR for scanned PDFs.
 * - Images: Tesseract.js OCR. pdf-to-img used for PDF→image when native extraction yields no useful text.
 */
import fs from 'fs'
import path from 'path'
import { resolveOcrLanguages } from './ocrLang.js'
import { textToTableFromOcrText } from './ocrLineSplit.js'
import { recognizeWithOcrGate } from '../lib/ocrGate.js'
import { looksLikeEcobankStatementText, parseEcobankPdfText } from './ecobankStatement.js'
import { looksLikeGcbStatementText, parseGcbPdfText } from './gcbStatement.js'
import { looksLikeAbsaStatementText, parseAbsaPdfText } from './absaStatement.js'
import { looksLikePrudentialStatementText, parsePrudentialPdfText, shouldUsePrudentialPdfParser } from './prudentialStatement.js'
import { looksLikeUbaStatementText, parseUbaPdfText } from './ubaStatement.js'
import { looksLikeNibStatementText, parseNibPdfText } from './nibStatement.js'
import { looksLikeUmbStatementText, parseUmbPdfText } from './umbStatement.js'
import { looksLikeAdbStatementText, parseAdbPdfText } from './adbStatement.js'
import { extractPdfTextNative } from './documentParse.js'

export { parseBankPdf, extractPdfTextNative } from './documentParse.js'

export interface OcrResult {
  headers: string[]
  rows: unknown[][]
  /** PDF-specific: true when OCR was limited by PDF_OCR_MAX_PAGES */
  pdfTruncated?: boolean
  /** PDF-specific: number of pages actually processed */
  pdfPagesProcessed?: number
  /** PDF-specific: total pages in the PDF */
  pdfTotalPages?: number
}

function textToTable(text: string): OcrResult {
  return textToTableFromOcrText(text)
}

async function ocrFromBuffer(buffer: Buffer): Promise<string> {
  const lang = resolveOcrLanguages()
  const result = await recognizeWithOcrGate(buffer, lang)
  return result.data.text
}

export async function parseImage(filepath: string): Promise<OcrResult> {
  const { parseImageFile } = await import('./documentParse.js')
  const doc = await parseImageFile(filepath)
  return {
    headers: doc.headers,
    rows: doc.rows,
    pdfTruncated: doc.pdfTruncated,
    pdfPagesProcessed: doc.pdfPagesProcessed,
    pdfTotalPages: doc.pdfTotalPages,
  }
}

import { resolvePdfOcrMaxPages } from '../config/importLimits.js'
const PDF_OCR_SCALE = Math.min(3, Math.max(1, parseFloat(process.env.PDF_OCR_SCALE || '2') || 2))
const PDF_USE_NATIVE_FIRST = process.env.PDF_USE_NATIVE_FIRST !== 'false'
const NATIVE_MIN_CHARS = 50 // Minimum chars to consider native extraction useful

function shouldPreferEcobankParser(text: string, result: OcrResult): boolean {
  if (!looksLikeEcobankStatementText(text)) return false
  const h = result.headers.map((x) => (x || '').toLowerCase()).join(' ')
  if (/\bdebit\b/.test(h) && /\bcredit\b/.test(h)) return false
  return result.headers.length < 5 || /payments?/.test(h) || result.rows.length > 150
}

export async function parsePdf(filepath: string, maxPages = resolvePdfOcrMaxPages()): Promise<OcrResult> {
  const ext = path.extname(filepath).toLowerCase()
  if (ext !== '.pdf') throw new Error('Not a PDF file')

  const buffer = fs.readFileSync(filepath)

  // Try native text extraction first (text-based PDFs: bank statements, Excel exports) — faster than OCR
  if (PDF_USE_NATIVE_FIRST) {
    const nativeResult = await extractPdfTextNative(buffer)
    if (nativeResult) {
      if (looksLikeAdbStatementText(nativeResult.text)) {
        const adb = parseAdbPdfText(nativeResult.text)
        if (adb.rows.length > 0) {
          return { ...adb, pdfTotalPages: nativeResult.numpages }
        }
      }
      if (looksLikeUmbStatementText(nativeResult.text)) {
        const umb = parseUmbPdfText(nativeResult.text)
        if (umb.rows.length > 0) {
          return { ...umb, pdfTotalPages: nativeResult.numpages }
        }
      }
      if (looksLikeNibStatementText(nativeResult.text)) {
        const nib = parseNibPdfText(nativeResult.text)
        if (nib.rows.length > 0) {
          return { ...nib, pdfTotalPages: nativeResult.numpages }
        }
      }
      if (looksLikePrudentialStatementText(nativeResult.text)) {
        const pru = parsePrudentialPdfText(nativeResult.text)
        if (pru.rows.length > 0) {
          return { ...pru, pdfTotalPages: nativeResult.numpages }
        }
      }
      if (looksLikeUbaStatementText(nativeResult.text)) {
        const uba = parseUbaPdfText(nativeResult.text)
        if (uba.rows.length > 0) {
          return { ...uba, pdfTotalPages: nativeResult.numpages }
        }
      }
      if (looksLikeAbsaStatementText(nativeResult.text)) {
        const absa = parseAbsaPdfText(nativeResult.text)
        if (absa.rows.length > 0) {
          return { ...absa, pdfTotalPages: nativeResult.numpages }
        }
      }
      if (looksLikeGcbStatementText(nativeResult.text)) {
        const gcb = parseGcbPdfText(nativeResult.text)
        if (gcb.rows.length > 0) {
          return { ...gcb, pdfTotalPages: nativeResult.numpages }
        }
      }
      if (looksLikeEcobankStatementText(nativeResult.text)) {
        const ecobank = parseEcobankPdfText(nativeResult.text)
        if (ecobank.rows.length > 0) {
          return { ...ecobank, pdfTotalPages: nativeResult.numpages }
        }
      }
      const base = textToTable(nativeResult.text)
      if (shouldUsePrudentialPdfParser(base)) {
        const pru = parsePrudentialPdfText(nativeResult.text)
        if (pru.rows.length > 0) {
          return { ...pru, pdfTotalPages: nativeResult.numpages }
        }
      }
      if (shouldPreferEcobankParser(nativeResult.text, base)) {
        const ecobank = parseEcobankPdfText(nativeResult.text)
        if (ecobank.rows.length > 0) {
          return { ...ecobank, pdfTotalPages: nativeResult.numpages }
        }
      }
      return { ...base, pdfTotalPages: nativeResult.numpages }
    }
  }

  // Fall back to OCR (scanned PDFs, image-only PDFs)
  const { pdf } = await import('pdf-to-img')
  const doc = await pdf(buffer, { scale: PDF_OCR_SCALE })
  const totalPages = doc.length
  const pageCount = Math.min(totalPages, maxPages)
  const truncated = totalPages > maxPages
  const pages: string[] = []

  for (let i = 0; i < pageCount; i++) {
    const pageBuffer = await doc.getPage(i + 1)
    const text = await ocrFromBuffer(pageBuffer)
    pages.push(text)
  }

  const ocrText = pages.join('\n\n')
  if (looksLikeAdbStatementText(ocrText)) {
    const adb = parseAdbPdfText(ocrText)
    if (adb.rows.length > 0) {
      return truncated
        ? { ...adb, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
        : { ...adb, pdfTotalPages: totalPages }
    }
  }
  if (looksLikeUmbStatementText(ocrText)) {
    const umb = parseUmbPdfText(ocrText)
    if (umb.rows.length > 0) {
      return truncated
        ? { ...umb, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
        : { ...umb, pdfTotalPages: totalPages }
    }
  }
  if (looksLikeNibStatementText(ocrText)) {
    const nib = parseNibPdfText(ocrText)
    if (nib.rows.length > 0) {
      return truncated
        ? { ...nib, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
        : { ...nib, pdfTotalPages: totalPages }
    }
  }
  if (looksLikePrudentialStatementText(ocrText)) {
    const pru = parsePrudentialPdfText(ocrText)
    if (pru.rows.length > 0) {
      return truncated
        ? { ...pru, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
        : { ...pru, pdfTotalPages: totalPages }
    }
  }
  if (looksLikeUbaStatementText(ocrText)) {
    const uba = parseUbaPdfText(ocrText)
    if (uba.rows.length > 0) {
      return truncated
        ? { ...uba, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
        : { ...uba, pdfTotalPages: totalPages }
    }
  }
  if (looksLikeAbsaStatementText(ocrText)) {
    const absa = parseAbsaPdfText(ocrText)
    if (absa.rows.length > 0) {
      return truncated
        ? { ...absa, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
        : { ...absa, pdfTotalPages: totalPages }
    }
  }
  if (looksLikeGcbStatementText(ocrText)) {
    const gcb = parseGcbPdfText(ocrText)
    if (gcb.rows.length > 0) {
      return truncated
        ? { ...gcb, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
        : { ...gcb, pdfTotalPages: totalPages }
    }
  }
  if (looksLikeEcobankStatementText(ocrText)) {
    const ecobank = parseEcobankPdfText(ocrText)
    if (ecobank.rows.length > 0) {
      return truncated
        ? { ...ecobank, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
        : { ...ecobank, pdfTotalPages: totalPages }
    }
  }
  const base = textToTable(ocrText)
  if (shouldUsePrudentialPdfParser(base)) {
    const pru = parsePrudentialPdfText(ocrText)
    if (pru.rows.length > 0) {
      return truncated
        ? { ...pru, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
        : { ...pru, pdfTotalPages: totalPages }
    }
  }
  if (shouldPreferEcobankParser(ocrText, base)) {
    const ecobank = parseEcobankPdfText(ocrText)
    if (ecobank.rows.length > 0) {
      return truncated
        ? { ...ecobank, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
        : { ...ecobank, pdfTotalPages: totalPages }
    }
  }
  return truncated ? { ...base, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages } : base
}
