/**
 * Single entry point for parsing uploaded documents (preview, map, auto-map).
 */
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import type { DocumentType } from '@prisma/client'
import { parseExcel, parseCsv, detectFileType, type ParseResult } from './parser.js'
import { textToTableFromOcrText } from './ocrLineSplit.js'
import {
  looksLikeEcobankStatementText,
  parseEcobankPdfText,
  shouldUseEcobankPdfParser,
} from './ecobankStatement.js'
import { resolveOcrLanguages } from './ocrLang.js'
import Tesseract from 'tesseract.js'

const require = createRequire(import.meta.url)
const PDF_MAX_PAGES = parseInt(process.env.PDF_OCR_MAX_PAGES || '50', 10)
const PDF_OCR_SCALE = Math.min(3, Math.max(1, parseFloat(process.env.PDF_OCR_SCALE || '2') || 2))
const PDF_USE_NATIVE_FIRST = process.env.PDF_USE_NATIVE_FIRST !== 'false'
const NATIVE_MIN_CHARS = 50

export type ParsedDocument = ParseResult & {
  pdfTruncated?: boolean
  pdfPagesProcessed?: number
  pdfTotalPages?: number
  parseMethod?: 'ecobank_pdf' | 'ecobank_excel' | 'native_text' | 'ocr' | 'excel' | 'csv' | 'image'
}

export async function extractPdfTextNative(buffer: Buffer): Promise<{ text: string; numpages: number } | null> {
  try {
    const pdfParse = require('pdf-parse-new') as (b: Buffer) => Promise<{ text: string; numpages?: number }>
    const data = await pdfParse(buffer)
    const text = (data?.text || '').trim()
    if (text.length >= NATIVE_MIN_CHARS) {
      return { text, numpages: data?.numpages ?? 1 }
    }
    return null
  } catch {
    return null
  }
}

function tryEcobankFromText(text: string, numpages?: number): ParsedDocument | null {
  if (!looksLikeEcobankStatementText(text)) return null
  const ecobank = parseEcobankPdfText(text)
  if (ecobank.rows.length === 0) return null
  return { ...ecobank, pdfTotalPages: numpages, parseMethod: 'ecobank_pdf' }
}

async function parsePdfWithOcr(buffer: Buffer, maxPages = PDF_MAX_PAGES): Promise<ParsedDocument> {
  const { pdf } = await import('pdf-to-img')
  const doc = await pdf(buffer, { scale: PDF_OCR_SCALE })
  const totalPages = doc.length
  const pageCount = Math.min(totalPages, maxPages)
  const truncated = totalPages > maxPages
  const lang = resolveOcrLanguages()
  const pages: string[] = []
  for (let i = 0; i < pageCount; i++) {
    const pageBuffer = await doc.getPage(i + 1)
    const result = await Tesseract.recognize(pageBuffer, lang, { logger: () => {} })
    pages.push(result.data.text)
  }
  const ocrText = pages.join('\n\n')
  const ecobank = tryEcobankFromText(ocrText, totalPages)
  if (ecobank) {
    return truncated
      ? { ...ecobank, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
      : ecobank
  }
  const base = textToTableFromOcrText(ocrText)
  return truncated
    ? { ...base, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages, parseMethod: 'ocr' }
    : { ...base, pdfTotalPages: totalPages, parseMethod: 'ocr' }
}

/** Bank statement PDF — native Ecobank parser first; OCR only if no usable native text. */
export async function parseBankPdf(filepath: string): Promise<ParsedDocument> {
  const buffer = fs.readFileSync(filepath)
  const nativeResult = await extractPdfTextNative(buffer)
  if (nativeResult) {
    const ecobank = tryEcobankFromText(nativeResult.text, nativeResult.numpages)
    if (ecobank) return ecobank
    const generic = textToTableFromOcrText(nativeResult.text)
    if (shouldUseEcobankPdfParser(generic)) {
      const retry = tryEcobankFromText(nativeResult.text, nativeResult.numpages)
      if (retry) return retry
    }
    return { ...generic, pdfTotalPages: nativeResult.numpages, parseMethod: 'native_text' }
  }
  return parsePdfWithOcr(buffer)
}

export async function parseCashBookPdf(filepath: string): Promise<ParsedDocument> {
  const buffer = fs.readFileSync(filepath)
  if (PDF_USE_NATIVE_FIRST) {
    const nativeResult = await extractPdfTextNative(buffer)
    if (nativeResult) {
      return { ...textToTableFromOcrText(nativeResult.text), pdfTotalPages: nativeResult.numpages, parseMethod: 'native_text' }
    }
  }
  return parsePdfWithOcr(buffer)
}

export async function parseDocumentFile(
  filepath: string,
  docType: DocumentType,
  sheetIndex = 0
): Promise<ParsedDocument> {
  if (!fs.existsSync(filepath)) {
    throw new Error('File not found')
  }
  const ft = detectFileType(filepath)
  if (ft === 'excel') {
    const r = parseExcel(filepath, sheetIndex)
    return { ...r, parseMethod: r.headers.includes('Debit') ? 'ecobank_excel' : 'excel' }
  }
  if (ft === 'csv') {
    const r = parseCsv(filepath)
    return { ...r, parseMethod: 'csv' }
  }
  if (ft === 'pdf') {
    return docType.startsWith('cash_book_') ? parseCashBookPdf(filepath) : parseBankPdf(filepath)
  }
  const { parseImage } = await import('./ocr.js')
  const r = await parseImage(filepath)
  return { ...r, parseMethod: 'image' }
}
