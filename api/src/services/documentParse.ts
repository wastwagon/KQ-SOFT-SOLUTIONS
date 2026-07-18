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
import { pickBetterParse, scoreParseQuality } from './ocrQuality.js'
import {
  extractWordsFromTesseractPage,
  reconstructTableFromWords,
  shouldPreferGeometryTable,
  type OcrWord,
} from './genericStatementTable.js'
import Tesseract from 'tesseract.js'

const require = createRequire(import.meta.url)
import { resolvePdfOcrMaxPages } from '../config/importLimits.js'
const PDF_OCR_SCALE = Math.min(3, Math.max(1, parseFloat(process.env.PDF_OCR_SCALE || '2') || 2))
/** Higher scale used when the first OCR pass scores poorly (env PDF_OCR_RETRY_SCALE, default 3). */
const PDF_OCR_RETRY_SCALE = Math.min(
  3.5,
  Math.max(PDF_OCR_SCALE, parseFloat(process.env.PDF_OCR_RETRY_SCALE || '3') || 3)
)
const PDF_USE_NATIVE_FIRST = process.env.PDF_USE_NATIVE_FIRST !== 'false'
const NATIVE_MIN_CHARS = 50
const OCR_QUALITY_RETRY = process.env.PDF_OCR_QUALITY_RETRY !== 'false'

export type ParsedDocument = ParseResult & {
  pdfTruncated?: boolean
  pdfPagesProcessed?: number
  pdfTotalPages?: number
  parseMethod?: 'ecobank_pdf' | 'gcb_pdf' | 'absa_pdf' | 'prudential_pdf' | 'uba_pdf' | 'nib_pdf' | 'adb_pdf' | 'umb_pdf' | 'ecobank_excel' | 'native_text' | 'ocr' | 'ocr_geometry' | 'excel' | 'csv' | 'image'
  /** 0–100 parse quality score (OCR / generic native tables). */
  parseQualityScore?: number
  /** True when a higher-resolution OCR retry was attempted. */
  ocrRetried?: boolean
  /** Human-readable quality notes for Map UI. */
  parseQualityNotes?: string[]
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

function withTruncation(
  doc: ParsedDocument,
  truncated: boolean,
  pageCount: number,
  totalPages: number
): ParsedDocument {
  return truncated
    ? { ...doc, pdfTruncated: true, pdfPagesProcessed: pageCount, pdfTotalPages: totalPages }
    : { ...doc, pdfTotalPages: totalPages }
}

function finalizeFromOcrText(
  ocrText: string,
  totalPages: number,
  truncated: boolean,
  pageCount: number,
  words: OcrWord[] = []
): ParsedDocument {
  const adb = tryAdbFromText(ocrText, totalPages)
  if (adb) return withTruncation(adb, truncated, pageCount, totalPages)
  const umb = tryUmbFromText(ocrText, totalPages)
  if (umb) return withTruncation(umb, truncated, pageCount, totalPages)
  const nib = tryNibFromText(ocrText, totalPages)
  if (nib) return withTruncation(nib, truncated, pageCount, totalPages)
  const pru = tryPrudentialFromText(ocrText, totalPages)
  if (pru) return withTruncation(pru, truncated, pageCount, totalPages)
  const uba = tryUbaFromText(ocrText, totalPages)
  if (uba) return withTruncation(uba, truncated, pageCount, totalPages)
  const absa = tryAbsaFromText(ocrText, totalPages)
  if (absa) return withTruncation(absa, truncated, pageCount, totalPages)
  const gcb = tryGcbFromText(ocrText, totalPages)
  if (gcb) return withTruncation(gcb, truncated, pageCount, totalPages)
  const ecobank = tryEcobankFromText(ocrText, totalPages)
  if (ecobank) return withTruncation(ecobank, truncated, pageCount, totalPages)
  const base = textToTableFromOcrText(ocrText)
  if (shouldUseAbsaPdfParser(base)) {
    const glued = tryAbsaFromGluedRows(base.rows, totalPages)
    if (glued) return withTruncation(glued, truncated, pageCount, totalPages)
  }

  let chosen: ParsedDocument = { ...base, parseMethod: 'ocr' }
  if (words.length >= 8) {
    const geo = reconstructTableFromWords(words)
    if (geo.rows.length > 0) {
      const compared = pickBetterParse(
        { headers: base.headers, rows: base.rows, sourceText: ocrText, parseMethod: 'ocr' },
        {
          headers: geo.headers,
          rows: geo.rows,
          sourceText: ocrText,
          parseMethod: 'ocr_geometry',
        }
      )
      const preferGeo =
        shouldPreferGeometryTable(base, geo) || compared.bScore.score > compared.aScore.score + 2
      if (preferGeo) {
        chosen = {
          headers: geo.headers,
          rows: geo.rows,
          parseMethod: 'ocr_geometry',
        }
      }
    }
  }

  return withTruncation(chosen, truncated, pageCount, totalPages)
}

async function ocrPdfPages(
  buffer: Buffer,
  scale: number,
  maxPages: number
): Promise<{
  text: string
  words: OcrWord[]
  totalPages: number
  pageCount: number
  truncated: boolean
}> {
  const { pdf } = await import('pdf-to-img')
  const doc = await pdf(buffer, { scale })
  const totalPages = doc.length
  const pageCount = Math.min(totalPages, maxPages)
  const truncated = totalPages > maxPages
  const lang = resolveOcrLanguages()
  const pages: string[] = []
  const words: OcrWord[] = []
  for (let i = 0; i < pageCount; i++) {
    const pageBuffer = await doc.getPage(i + 1)
    const result = await Tesseract.recognize(pageBuffer, lang, { logger: () => {} })
    pages.push(result.data.text)
    words.push(...extractWordsFromTesseractPage(result.data, i))
  }
  return { text: pages.join('\n\n'), words, totalPages, pageCount, truncated }
}

function attachQuality(
  doc: ParsedDocument,
  sourceText: string,
  extra?: { ocrRetried?: boolean }
): ParsedDocument {
  const quality = scoreParseQuality({
    headers: doc.headers,
    rows: doc.rows,
    sourceText,
    parseMethod: doc.parseMethod,
  })
  const notes = [...quality.reasons.slice(0, 4)]
  if (doc.parseMethod === 'ocr_geometry') {
    notes.unshift('Geometry OCR kept empty amount columns and aligned rows by position.')
  }
  return {
    ...doc,
    parseQualityScore: quality.score,
    parseQualityNotes: notes.slice(0, 5),
    ...(extra?.ocrRetried ? { ocrRetried: true } : {}),
  }
}

async function parsePdfWithOcr(buffer: Buffer, maxPages = resolvePdfOcrMaxPages()): Promise<ParsedDocument> {
  const first = await ocrPdfPages(buffer, PDF_OCR_SCALE, maxPages)
  let bestDoc = finalizeFromOcrText(
    first.text,
    first.totalPages,
    first.truncated,
    first.pageCount,
    first.words
  )
  bestDoc = attachQuality(bestDoc, first.text)

  const firstQuality = scoreParseQuality({
    headers: bestDoc.headers,
    rows: bestDoc.rows,
    sourceText: first.text,
    parseMethod: bestDoc.parseMethod,
  })

  const canRetryHigherScale =
    OCR_QUALITY_RETRY &&
    firstQuality.shouldRetry &&
    PDF_OCR_RETRY_SCALE > PDF_OCR_SCALE + 0.05

  if (!canRetryHigherScale) return bestDoc

  const retry = await ocrPdfPages(buffer, PDF_OCR_RETRY_SCALE, maxPages)
  let retryDoc = finalizeFromOcrText(
    retry.text,
    retry.totalPages,
    retry.truncated,
    retry.pageCount,
    retry.words
  )
  retryDoc = attachQuality(retryDoc, retry.text, { ocrRetried: true })

  const picked = pickBetterParse(
    { headers: bestDoc.headers, rows: bestDoc.rows, sourceText: first.text, parseMethod: bestDoc.parseMethod },
    { headers: retryDoc.headers, rows: retryDoc.rows, sourceText: retry.text, parseMethod: retryDoc.parseMethod }
  )
  if (picked.bScore.score > picked.aScore.score + 3) {
    return {
      ...retryDoc,
      ocrRetried: true,
      parseQualityNotes: [
        ...(retryDoc.parseQualityNotes || []),
        `Kept higher-resolution OCR (${picked.bScore.score} > ${picked.aScore.score})`,
      ],
    }
  }
  return {
    ...bestDoc,
    ocrRetried: true,
    parseQualityNotes: [
      ...(bestDoc.parseQualityNotes || []),
      `Retried at ${PDF_OCR_RETRY_SCALE}x; kept first pass (${picked.aScore.score} vs ${picked.bScore.score})`,
    ],
  }
}

function trySpecializeGeneric(
  text: string,
  generic: ParseResult,
  numpages?: number
): ParsedDocument | null {
  if (shouldUseAdbPdfParser(generic)) {
    const retryAdb = tryAdbFromText(text, numpages)
    if (retryAdb) return retryAdb
  }
  if (shouldUseUmbPdfParser(generic)) {
    const retryUmb = tryUmbFromText(text, numpages)
    if (retryUmb) return retryUmb
  }
  if (shouldUseNibPdfParser(generic)) {
    const retryNib = tryNibFromText(text, numpages)
    if (retryNib) return retryNib
  }
  if (shouldUseUbaPdfParser(generic)) {
    const retryUba = tryUbaFromText(text, numpages)
    if (retryUba) return retryUba
  }
  if (shouldUsePrudentialPdfParser(generic)) {
    const retryPru = tryPrudentialFromText(text, numpages)
    if (retryPru) return retryPru
  }
  if (shouldUseAbsaPdfParser(generic)) {
    const retryAbsa = tryAbsaFromText(text, numpages)
    if (retryAbsa) return retryAbsa
    const glued = tryAbsaFromGluedRows(generic.rows, numpages)
    if (glued) return glued
  }
  if (shouldUseGcbPdfParser(generic)) {
    const retryGcb = tryGcbFromText(text, numpages)
    if (retryGcb) return retryGcb
  }
  if (shouldUseEcobankPdfParser(generic)) {
    const retry = tryEcobankFromText(text, numpages)
    if (retry) return retry
  }
  return null
}

/** Bank statement PDF — native dedicated parsers first; OCR when native table quality is poor. */
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
    const pru = tryPrudentialFromText(nativeResult.text, nativeResult.numpages)
    if (pru) return pru
    const uba = tryUbaFromText(nativeResult.text, nativeResult.numpages)
    if (uba) return uba
    const absa = tryAbsaFromText(nativeResult.text, nativeResult.numpages)
    if (absa) return absa
    const gcb = tryGcbFromText(nativeResult.text, nativeResult.numpages)
    if (gcb) return gcb
    const ecobank = tryEcobankFromText(nativeResult.text, nativeResult.numpages)
    if (ecobank) return ecobank
    const generic = textToTableFromOcrText(nativeResult.text)
    const specialized = trySpecializeGeneric(nativeResult.text, generic, nativeResult.numpages)
    if (specialized) return specialized

    const nativeDoc = attachQuality(
      { ...generic, pdfTotalPages: nativeResult.numpages, parseMethod: 'native_text' },
      nativeResult.text
    )
    const nativeQuality = scoreParseQuality({
      headers: nativeDoc.headers,
      rows: nativeDoc.rows,
      sourceText: nativeResult.text,
      parseMethod: 'native_text',
    })
    // Native text existed but produced a weak table (common for scanned PDFs with a text layer of junk).
    if (OCR_QUALITY_RETRY && nativeQuality.shouldRetry) {
      const ocrDoc = await parsePdfWithOcr(buffer)
      const picked = pickBetterParse(
        {
          headers: nativeDoc.headers,
          rows: nativeDoc.rows,
          sourceText: nativeResult.text,
          parseMethod: nativeDoc.parseMethod,
        },
        {
          headers: ocrDoc.headers,
          rows: ocrDoc.rows,
          sourceText: '',
          parseMethod: ocrDoc.parseMethod,
        }
      )
      if (picked.bScore.score > picked.aScore.score + 3) {
        return {
          ...ocrDoc,
          ocrRetried: true,
          parseQualityNotes: [
            ...(ocrDoc.parseQualityNotes || []),
            `Replaced weak native text extract (${picked.aScore.score}) with OCR (${picked.bScore.score})`,
          ],
        }
      }
      return {
        ...nativeDoc,
        ocrRetried: true,
        parseQualityNotes: [
          ...(nativeDoc.parseQualityNotes || []),
          `Kept native extract after OCR retry (${picked.aScore.score} vs ${picked.bScore.score})`,
        ],
      }
    }
    return nativeDoc
  }
  return parsePdfWithOcr(buffer)
}

export async function parseCashBookPdf(filepath: string): Promise<ParsedDocument> {
  const buffer = fs.readFileSync(filepath)
  if (PDF_USE_NATIVE_FIRST) {
    const nativeResult = await extractPdfTextNative(buffer)
    if (nativeResult) {
      const nativeDoc = attachQuality(
        {
          ...textToTableFromOcrText(nativeResult.text),
          pdfTotalPages: nativeResult.numpages,
          parseMethod: 'native_text',
        },
        nativeResult.text
      )
      const nativeQuality = scoreParseQuality({
        headers: nativeDoc.headers,
        rows: nativeDoc.rows,
        sourceText: nativeResult.text,
        parseMethod: 'native_text',
      })
      if (OCR_QUALITY_RETRY && nativeQuality.shouldRetry) {
        const ocrDoc = await parsePdfWithOcr(buffer)
        const picked = pickBetterParse(
          {
            headers: nativeDoc.headers,
            rows: nativeDoc.rows,
            sourceText: nativeResult.text,
            parseMethod: nativeDoc.parseMethod,
          },
          {
            headers: ocrDoc.headers,
            rows: ocrDoc.rows,
            sourceText: '',
            parseMethod: ocrDoc.parseMethod,
          }
        )
        if (picked.bScore.score > picked.aScore.score + 3) {
          return {
            ...ocrDoc,
            ocrRetried: true,
            parseQualityNotes: [
              ...(ocrDoc.parseQualityNotes || []),
              `Replaced weak native cash-book extract (${picked.aScore.score}) with OCR (${picked.bScore.score})`,
            ],
          }
        }
      }
      return nativeDoc
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
  return parseImageFile(filepath)
}

/** Image uploads: OCR + geometry table reconstruction (same finalize path as PDF OCR). */
export async function parseImageFile(filepath: string): Promise<ParsedDocument> {
  const ext = path.extname(filepath).toLowerCase()
  if (!['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp'].includes(ext)) {
    throw new Error('Unsupported image format')
  }
  const lang = resolveOcrLanguages()
  const result = await Tesseract.recognize(filepath, lang, { logger: () => {} })
  const words = extractWordsFromTesseractPage(result.data, 0)
  let doc = finalizeFromOcrText(result.data.text, 1, false, 1, words)
  if (doc.parseMethod === 'ocr') {
    doc = { ...doc, parseMethod: 'image' }
  }
  return attachQuality(doc, result.data.text)
}
