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
import {
  looksLikeGcbStatementText,
  parseGcbPdfText,
  shouldUseGcbPdfParser,
} from './gcbStatement.js'
import {
  looksLikeAbsaStatementText,
  parseAbsaPdfText,
  shouldUseAbsaPdfParser,
} from './absaStatement.js'
import {
  looksLikePrudentialStatementText,
  parsePrudentialPdfText,
  shouldUsePrudentialPdfParser,
} from './prudentialStatement.js'
import {
  looksLikeUbaStatementText,
  parseUbaPdfText,
  shouldUseUbaPdfParser,
} from './ubaStatement.js'
import {
  looksLikeNibStatementText,
  parseNibPdfText,
  shouldUseNibPdfParser,
} from './nibStatement.js'
import {
  looksLikeAdbStatementText,
  parseAdbPdfText,
  shouldUseAdbPdfParser,
} from './adbStatement.js'
import {
  looksLikeUmbStatementText,
  parseUmbPdfText,
  shouldUseUmbPdfParser,
} from './umbStatement.js'
import { resolveOcrLanguages } from './ocrLang.js'
import Tesseract from 'tesseract.js'

const require = createRequire(import.meta.url)
import { resolvePdfOcrMaxPages } from '../config/importLimits.js'
const PDF_OCR_SCALE = Math.min(3, Math.max(1, parseFloat(process.env.PDF_OCR_SCALE || '2') || 2))
const PDF_USE_NATIVE_FIRST = process.env.PDF_USE_NATIVE_FIRST !== 'false'
const NATIVE_MIN_CHARS = 50

export type ParsedDocument = ParseResult & {
  pdfTruncated?: boolean
  pdfPagesProcessed?: number
  pdfTotalPages?: number
  parseMethod?: 'ecobank_pdf' | 'gcb_pdf' | 'absa_pdf' | 'prudential_pdf' | 'uba_pdf' | 'nib_pdf' | 'adb_pdf' | 'umb_pdf' | 'ecobank_excel' | 'native_text' | 'ocr' | 'excel' | 'csv' | 'image'
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

function tryAbsaFromGluedRows(rows: unknown[][], numpages?: number): ParsedDocument | null {
  const text = rows.map((r) => (r as unknown[]).map((c) => String(c ?? '')).join('')).join('\n')
  const absa = parseAbsaPdfText(text)
  if (absa.rows.length === 0) return null
  return { ...absa, pdfTotalPages: numpages, parseMethod: 'absa_pdf' }
}

function tryAbsaFromText(text: string, numpages?: number): ParsedDocument | null {
  if (!looksLikeAbsaStatementText(text)) return null
  const absa = parseAbsaPdfText(text)
  if (absa.rows.length === 0) return null
  return { ...absa, pdfTotalPages: numpages, parseMethod: 'absa_pdf' }
}

function tryAdbFromText(text: string, numpages?: number): ParsedDocument | null {
  if (!looksLikeAdbStatementText(text)) return null
  const adb = parseAdbPdfText(text)
  if (adb.rows.length === 0) return null
  return { ...adb, pdfTotalPages: numpages, parseMethod: 'adb_pdf' }
}

function tryUmbFromText(text: string, numpages?: number): ParsedDocument | null {
  if (!looksLikeUmbStatementText(text)) return null
  const umb = parseUmbPdfText(text)
  if (umb.rows.length === 0) return null
  return { ...umb, pdfTotalPages: numpages, parseMethod: 'umb_pdf' }
}

function tryNibFromText(text: string, numpages?: number): ParsedDocument | null {
  if (!looksLikeNibStatementText(text)) return null
  const nib = parseNibPdfText(text)
  if (nib.rows.length === 0) return null
  return { ...nib, pdfTotalPages: numpages, parseMethod: 'nib_pdf' }
}

function tryUbaFromText(text: string, numpages?: number): ParsedDocument | null {
  if (!looksLikeUbaStatementText(text)) return null
  const uba = parseUbaPdfText(text)
  if (uba.rows.length === 0) return null
  return { ...uba, pdfTotalPages: numpages, parseMethod: 'uba_pdf' }
}

function tryPrudentialFromText(text: string, numpages?: number): ParsedDocument | null {
  if (!looksLikePrudentialStatementText(text)) return null
  const pru = parsePrudentialPdfText(text)
  if (pru.rows.length === 0) return null
  return { ...pru, pdfTotalPages: numpages, parseMethod: 'prudential_pdf' }
}

function tryGcbFromText(text: string, numpages?: number): ParsedDocument | null {
  if (!looksLikeGcbStatementText(text)) return null
  const gcb = parseGcbPdfText(text)
  if (gcb.rows.length === 0) return null
  return { ...gcb, pdfTotalPages: numpages, parseMethod: 'gcb_pdf' }
}

async function parsePdfWithOcr(buffer: Buffer, maxPages = resolvePdfOcrMaxPages()): Promise<ParsedDocument> {
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
  const adb = tryAdbFromText(ocrText, totalPages)
  if (adb) {
    return truncated
      ? { ...adb, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
      : adb
  }
  const umb = tryUmbFromText(ocrText, totalPages)
  if (umb) {
    return truncated
      ? { ...umb, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
      : umb
  }
  const nib = tryNibFromText(ocrText, totalPages)
  if (nib) {
    return truncated
      ? { ...nib, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
      : nib
  }
  const uba = tryUbaFromText(ocrText, totalPages)
  if (uba) {
    return truncated
      ? { ...uba, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
      : uba
  }
  const pru = tryPrudentialFromText(ocrText, totalPages)
  if (pru) {
    return truncated
      ? { ...pru, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
      : pru
  }
  const absa = tryAbsaFromText(ocrText, totalPages)
  if (absa) {
    return truncated
      ? { ...absa, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
      : absa
  }
  const gcb = tryGcbFromText(ocrText, totalPages)
  if (gcb) {
    return truncated
      ? { ...gcb, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
      : gcb
  }
  const ecobank = tryEcobankFromText(ocrText, totalPages)
  if (ecobank) {
    return truncated
      ? { ...ecobank, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
      : ecobank
  }
  const base = textToTableFromOcrText(ocrText)
  if (shouldUseAbsaPdfParser(base)) {
    const glued = tryAbsaFromGluedRows(base.rows, totalPages)
    if (glued) {
      return truncated
        ? { ...glued, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
        : glued
    }
  }
  return truncated
    ? { ...base, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages, parseMethod: 'ocr' }
    : { ...base, pdfTotalPages: totalPages, parseMethod: 'ocr' }
}

/** Bank statement PDF — native Ecobank parser first; OCR only if no usable native text. */
export async function parseBankPdf(filepath: string): Promise<ParsedDocument> {
  const buffer = fs.readFileSync(filepath)
  const nativeResult = await extractPdfTextNative(buffer)
  if (nativeResult) {
    const adb = tryAdbFromText(nativeResult.text, nativeResult.numpages)
    if (adb) return adb
    const umb = tryUmbFromText(nativeResult.text, nativeResult.numpages)
    if (umb) return umb
    const nib = tryNibFromText(nativeResult.text, nativeResult.numpages)
    if (nib) return nib
    const uba = tryUbaFromText(nativeResult.text, nativeResult.numpages)
    if (uba) return uba
    const pru = tryPrudentialFromText(nativeResult.text, nativeResult.numpages)
    if (pru) return pru
    const absa = tryAbsaFromText(nativeResult.text, nativeResult.numpages)
    if (absa) return absa
    const gcb = tryGcbFromText(nativeResult.text, nativeResult.numpages)
    if (gcb) return gcb
    const ecobank = tryEcobankFromText(nativeResult.text, nativeResult.numpages)
    if (ecobank) return ecobank
    const generic = textToTableFromOcrText(nativeResult.text)
    if (shouldUseAdbPdfParser(generic)) {
      const retryAdb = tryAdbFromText(nativeResult.text, nativeResult.numpages)
      if (retryAdb) return retryAdb
    }
    if (shouldUseUmbPdfParser(generic)) {
      const retryUmb = tryUmbFromText(nativeResult.text, nativeResult.numpages)
      if (retryUmb) return retryUmb
    }
    if (shouldUseNibPdfParser(generic)) {
      const retryNib = tryNibFromText(nativeResult.text, nativeResult.numpages)
      if (retryNib) return retryNib
    }
    if (shouldUseUbaPdfParser(generic)) {
      const retryUba = tryUbaFromText(nativeResult.text, nativeResult.numpages)
      if (retryUba) return retryUba
    }
    if (shouldUsePrudentialPdfParser(generic)) {
      const retryPru = tryPrudentialFromText(nativeResult.text, nativeResult.numpages)
      if (retryPru) return retryPru
    }
    if (shouldUseAbsaPdfParser(generic)) {
      const retryAbsa = tryAbsaFromText(nativeResult.text, nativeResult.numpages)
      if (retryAbsa) return retryAbsa
      const glued = tryAbsaFromGluedRows(generic.rows, nativeResult.numpages)
      if (glued) return glued
    }
    if (shouldUseGcbPdfParser(generic)) {
      const retryGcb = tryGcbFromText(nativeResult.text, nativeResult.numpages)
      if (retryGcb) return retryGcb
    }
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
