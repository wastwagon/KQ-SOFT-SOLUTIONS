/// <reference path="../types/pdf-parse-new.d.ts" />
/**
 * OCR service: extract text from PDF and images (PNG, JPG, TIFF)
 * - PDFs: Try native text extraction first (faster, more accurate for text-based PDFs); fall back to OCR for scanned PDFs.
 * - Images: Tesseract.js OCR. pdf-to-img used for PDF→image when native extraction yields no useful text.
 */
import Tesseract from 'tesseract.js'
import fs from 'fs'
import path from 'path'
import { resolveOcrLanguages } from './ocrLang.js'
import { textToTableFromOcrText } from './ocrLineSplit.js'
import { looksLikeEcobankStatementText, parseEcobankPdfText } from './ecobankStatement.js'
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

async function ocrFromPath(imagePath: string): Promise<string> {
  const lang = resolveOcrLanguages()
  const result = await Tesseract.recognize(imagePath, lang, { logger: () => {} })
  return result.data.text
}

async function ocrFromBuffer(buffer: Buffer): Promise<string> {
  const lang = resolveOcrLanguages()
  const result = await Tesseract.recognize(buffer, lang, { logger: () => {} })
  return result.data.text
}

export async function parseImage(filepath: string): Promise<OcrResult> {
  const ext = path.extname(filepath).toLowerCase()
  if (!['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp'].includes(ext)) {
    throw new Error('Unsupported image format')
  }
  const text = await ocrFromPath(filepath)
  return textToTable(text)
}

const PDF_MAX_PAGES = parseInt(process.env.PDF_OCR_MAX_PAGES || '50', 10)
const PDF_OCR_SCALE = Math.min(3, Math.max(1, parseFloat(process.env.PDF_OCR_SCALE || '2') || 2))
const PDF_USE_NATIVE_FIRST = process.env.PDF_USE_NATIVE_FIRST !== 'false'
const NATIVE_MIN_CHARS = 50 // Minimum chars to consider native extraction useful

function shouldPreferEcobankParser(text: string, result: OcrResult): boolean {
  if (!looksLikeEcobankStatementText(text)) return false
  const h = result.headers.map((x) => (x || '').toLowerCase()).join(' ')
  if (/\bdebit\b/.test(h) && /\bcredit\b/.test(h)) return false
  return result.headers.length < 5 || /payments?/.test(h) || result.rows.length > 150
}

export async function parsePdf(filepath: string, maxPages = PDF_MAX_PAGES): Promise<OcrResult> {
  const ext = path.extname(filepath).toLowerCase()
  if (ext !== '.pdf') throw new Error('Not a PDF file')

  const buffer = fs.readFileSync(filepath)

  // Try native text extraction first (text-based PDFs: bank statements, Excel exports) — faster than OCR
  if (PDF_USE_NATIVE_FIRST) {
    const nativeResult = await extractPdfTextNative(buffer)
    if (nativeResult) {
      if (looksLikeEcobankStatementText(nativeResult.text)) {
        const ecobank = parseEcobankPdfText(nativeResult.text)
        if (ecobank.rows.length > 0) {
          return { ...ecobank, pdfTotalPages: nativeResult.numpages }
        }
      }
      const base = textToTable(nativeResult.text)
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
  if (looksLikeEcobankStatementText(ocrText)) {
    const ecobank = parseEcobankPdfText(ocrText)
    if (ecobank.rows.length > 0) {
      return truncated
        ? { ...ecobank, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
        : { ...ecobank, pdfTotalPages: totalPages }
    }
  }
  const base = textToTable(ocrText)
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
