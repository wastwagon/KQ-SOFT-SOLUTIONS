/**
 * Specimen parse/match benchmark over corrected-bank-specimens-for-user/.
 * Ground truth = manifest.json metrics produced by the export pipeline.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { DocumentType } from '@prisma/client'
import { parseDocumentFile } from './documentParse.js'
import { parseImportedAmount } from './amountParser.js'
import { parseImportedDate } from './dateParser.js'
import { buildSmartSuggestedMapping } from './suggestedMapping.js'
import { suggestMatches, suggestSplitMatches, type Tx } from './matching.js'
import { resolveMatchSides } from './sideInversion.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DEFAULT_SPECIMEN_ROOT = path.resolve(__dirname, '../../../corrected-bank-specimens-for-user')

export interface SpecimenFileMeta {
  label: string
  file: string
  type: string
  status: string
  rowCount?: number
  sumDebit?: number
  sumCredit?: number
  parseMethod?: string
  note?: string
  correction?: string
}

export interface SpecimenBankMeta {
  id: string
  name: string
  files: SpecimenFileMeta[]
}

export interface SpecimenManifest {
  exportedAt?: string
  banks: SpecimenBankMeta[]
}

export interface ParseBenchmarkRow {
  bankId: string
  bankName: string
  file: string
  label: string
  type: string
  expected: { rowCount: number; sumDebit: number; sumCredit: number; parseMethod?: string }
  actual: { rowCount: number; sumDebit: number; sumCredit: number; parseMethod?: string } | null
  pass: boolean
  errors: string[]
  elapsedMs: number
}

export interface MatchBenchmarkRow {
  bankId: string
  cashBookFile: string
  bankFile: string
  cashBookRows: number
  bankRows: number
  receiptSuggestions: number
  paymentSuggestions: number
  splitSuggestions: number
  receiptCoverage: number
  paymentCoverage: number
  sideInversion: boolean
  elapsedMs: number
}

export interface SpecimenBenchmarkReport {
  specimenRoot: string
  generatedAt: string
  parse: {
    total: number
    passed: number
    failed: number
    skipped: number
    rows: ParseBenchmarkRow[]
  }
  match: {
    total: number
    rows: MatchBenchmarkRow[]
  }
}

/** Curated cash-book + bank pairs used for dual-file matching coverage. */
export const MATCH_PAIRS: Array<{
  bankId: string
  cashBookFile: string
  bankFile: string
}> = [
  {
    bankId: '11-lordship-9033-q1-2026',
    cashBookFile: 'LIBcashbk1 2026 1qtr.xlsx',
    bankFile: '1778163944552 dated 4.6.26.xlsx',
  },
  {
    bankId: '12-lordship-9035-q1-2026',
    cashBookFile: 'LIBcashbk2 2026 1qtr.xlsx',
    bankFile: '1778676142095 dated 4.6.26.xlsx',
  },
  {
    bankId: '15-acct4702-test-data',
    cashBookFile: 'acct4702 cashbk.xlsx',
    bankFile: 'acct 4702 bank statement.xlsx',
  },
  {
    bankId: '16-acct430-test-data',
    cashBookFile: 'acct430 cash book.xlsx',
    bankFile: 'acct430 bank statement.xlsx',
  },
]

export function loadSpecimenManifest(specimenRoot = DEFAULT_SPECIMEN_ROOT): SpecimenManifest {
  const p = path.join(specimenRoot, 'manifest.json')
  return JSON.parse(fs.readFileSync(p, 'utf8')) as SpecimenManifest
}

export function amountColumnIndex(headers: string[], side: 'debit' | 'credit'): number {
  const debitRes = [/^(debit|debits)$/i, /amt\s*paid/i, /^payment$/i]
  const creditRes = [/^(credit|credits)$/i, /amt\s*received/i, /^receipt$/i]
  const patterns = side === 'debit' ? debitRes : creditRes
  for (const re of patterns) {
    const i = headers.findIndex((h) => re.test(String(h)))
    if (i >= 0) return i
  }
  return -1
}

export function summarizeParsedAmounts(
  headers: string[],
  rows: unknown[][]
): { sumDebit: number; sumCredit: number } {
  const debitCol = amountColumnIndex(headers, 'debit')
  const creditCol = amountColumnIndex(headers, 'credit')
  const sumDebit = rows.reduce(
    (s, r) => s + (debitCol >= 0 ? parseImportedAmount(r[debitCol]) : 0),
    0
  )
  const sumCredit = rows.reduce(
    (s, r) => s + (creditCol >= 0 ? parseImportedAmount(r[creditCol]) : 0),
    0
  )
  return { sumDebit, sumCredit }
}

export function amountsClose(a: number, b: number, absTol = 0.05, relTol = 1e-6): boolean {
  const diff = Math.abs(a - b)
  if (diff <= absTol) return true
  const scale = Math.max(Math.abs(a), Math.abs(b), 1)
  return diff / scale <= relTol
}

function isCashBookLabel(label: string, file: string): boolean {
  const s = `${label} ${file}`.toLowerCase()
  return /cash\s*book|cashbk|cashbook/.test(s)
}

function originalPath(specimenRoot: string, bankId: string, file: string): string {
  return path.join(specimenRoot, bankId, 'original', file)
}

export async function parseSpecimenFile(
  specimenRoot: string,
  bankId: string,
  meta: SpecimenFileMeta
): Promise<{ rowCount: number; sumDebit: number; sumCredit: number; parseMethod?: string; headers: string[]; rows: unknown[][] }> {
  const fp = originalPath(specimenRoot, bankId, meta.file)
  if (!fs.existsSync(fp)) throw new Error(`Missing original: ${fp}`)
  const cashBook = isCashBookLabel(meta.label, meta.file)
  const docType: DocumentType = cashBook ? 'cash_book_receipts' : 'bank_credits'
  const parsed = await parseDocumentFile(fp, docType)
  const sums = summarizeParsedAmounts(parsed.headers, parsed.rows)
  return {
    rowCount: parsed.rows.length,
    sumDebit: sums.sumDebit,
    sumCredit: sums.sumCredit,
    parseMethod: parsed.parseMethod,
    headers: parsed.headers,
    rows: parsed.rows,
  }
}

function headersHaveUsableFcAmounts(headers: string[], rows: unknown[][]): boolean {
  const fcRecv = headers.findIndex((h) => /^fc\s*amt\s*received$/i.test(String(h).trim()))
  const fcPaid = headers.findIndex((h) => /^fc\s*amt\s*paid$/i.test(String(h).trim()))
  if (fcRecv < 0 && fcPaid < 0) return false
  let hits = 0
  for (const row of rows) {
    if (fcRecv >= 0 && Math.abs(parseImportedAmount(row[fcRecv])) > 0) hits++
    if (fcPaid >= 0 && Math.abs(parseImportedAmount(row[fcPaid])) > 0) hits++
    if (hits >= 3) return true
  }
  return hits > 0
}

export function rowsToSideTxs(
  headers: string[],
  rows: unknown[][],
  side: 'receipts' | 'payments' | 'credits' | 'debits',
  idPrefix: string,
  options: { preferForeignCurrencyAmounts?: boolean } = {}
): Tx[] {
  const isCash = side === 'receipts' || side === 'payments'
  const preferForeign =
    options.preferForeignCurrencyAmounts ??
    (isCash && headersHaveUsableFcAmounts(headers, rows))
  const mapping = buildSmartSuggestedMapping(headers, isCash, {}, {
    preferForeignCurrencyAmounts: preferForeign,
  })
  const dateIdx = isCash ? mapping.date ?? -1 : mapping.transaction_date ?? -1
  const descIdx = isCash
    ? mapping.details ?? mapping.name ?? -1
    : mapping.description ?? -1
  const nameIdx = isCash ? mapping.name ?? -1 : -1
  const amountIdx = isCash
    ? side === 'receipts'
      ? mapping.amt_received ?? -1
      : mapping.amt_paid ?? -1
    : side === 'credits'
      ? mapping.credit ?? -1
      : mapping.debit ?? -1
  const chqIdx = mapping.chq_no ?? -1
  const refIdx = mapping.doc_ref ?? -1

  if (amountIdx < 0) return []

  const out: Tx[] = []
  rows.forEach((row, i) => {
    const amount = Math.abs(parseImportedAmount(row[amountIdx]))
    if (!(amount > 0)) return
    out.push({
      id: `${idPrefix}-${i}`,
      date: dateIdx >= 0 ? parseImportedDate(row[dateIdx]) : null,
      name: nameIdx >= 0 ? String(row[nameIdx] ?? '') || null : null,
      details: descIdx >= 0 ? String(row[descIdx] ?? '') || null : null,
      amount,
      chqNo: chqIdx >= 0 ? String(row[chqIdx] ?? '') || null : null,
      docRef: refIdx >= 0 ? String(row[refIdx] ?? '') || null : null,
    })
  })
  return out
}

function uniqueCoverage(suggestions: { cashBookTx: Tx; bankTx: Tx }[], side: 'cb' | 'bank'): number {
  const ids = new Set(
    suggestions.map((s) => (side === 'cb' ? s.cashBookTx.id : s.bankTx.id))
  )
  return ids.size
}

export async function evaluateParseFile(
  specimenRoot: string,
  bank: SpecimenBankMeta,
  meta: SpecimenFileMeta
): Promise<ParseBenchmarkRow> {
  const expected = {
    rowCount: meta.rowCount ?? 0,
    sumDebit: meta.sumDebit ?? 0,
    sumCredit: meta.sumCredit ?? 0,
    parseMethod: meta.parseMethod,
  }
  const started = Date.now()
  const errors: string[] = []
  try {
    const actualRaw = await parseSpecimenFile(specimenRoot, bank.id, meta)
    const actual = {
      rowCount: actualRaw.rowCount,
      sumDebit: actualRaw.sumDebit,
      sumCredit: actualRaw.sumCredit,
      parseMethod: actualRaw.parseMethod,
    }
    if (actual.rowCount !== expected.rowCount) {
      errors.push(`rowCount ${actual.rowCount} != ${expected.rowCount}`)
    }
    if (!amountsClose(actual.sumDebit, expected.sumDebit)) {
      errors.push(`sumDebit ${actual.sumDebit} != ${expected.sumDebit}`)
    }
    if (!amountsClose(actual.sumCredit, expected.sumCredit)) {
      errors.push(`sumCredit ${actual.sumCredit} != ${expected.sumCredit}`)
    }
    if (expected.parseMethod && actual.parseMethod && actual.parseMethod !== expected.parseMethod) {
      // Soft signal — do not fail the row, but record it.
      errors.push(`parseMethod ${actual.parseMethod} != ${expected.parseMethod} (info)`)
    }
    const hardErrors = errors.filter((e) => !e.includes('(info)'))
    return {
      bankId: bank.id,
      bankName: bank.name,
      file: meta.file,
      label: meta.label,
      type: meta.type,
      expected,
      actual,
      pass: hardErrors.length === 0,
      errors,
      elapsedMs: Date.now() - started,
    }
  } catch (e) {
    return {
      bankId: bank.id,
      bankName: bank.name,
      file: meta.file,
      label: meta.label,
      type: meta.type,
      expected,
      actual: null,
      pass: false,
      errors: [e instanceof Error ? e.message : String(e)],
      elapsedMs: Date.now() - started,
    }
  }
}

export async function evaluateMatchPair(
  specimenRoot: string,
  pair: (typeof MATCH_PAIRS)[number]
): Promise<MatchBenchmarkRow> {
  const started = Date.now()
  const cashMeta: SpecimenFileMeta = {
    label: 'Cash book',
    file: pair.cashBookFile,
    type: 'excel',
    status: 'ok',
  }
  const bankMeta: SpecimenFileMeta = {
    label: 'Bank statement',
    file: pair.bankFile,
    type: 'excel',
    status: 'ok',
  }
  const cash = await parseSpecimenFile(specimenRoot, pair.bankId, cashMeta)
  const bank = await parseSpecimenFile(specimenRoot, pair.bankId, bankMeta)

  const useFc = headersHaveUsableFcAmounts(cash.headers, cash.rows)
  const receipts = rowsToSideTxs(cash.headers, cash.rows, 'receipts', 'cb-r', {
    preferForeignCurrencyAmounts: useFc,
  })
  const payments = rowsToSideTxs(cash.headers, cash.rows, 'payments', 'cb-p', {
    preferForeignCurrencyAmounts: useFc,
  })
  const credits = rowsToSideTxs(bank.headers, bank.rows, 'credits', 'bk-c')
  const debits = rowsToSideTxs(bank.headers, bank.rows, 'debits', 'bk-d')

  const { inversion, receiptBank, paymentBank } = resolveMatchSides({
    receipts,
    payments,
    credits,
    debits,
  })

  const empty = new Set<string>()
  const receiptSuggestions = suggestMatches(receipts, receiptBank, empty, empty)
  const paymentSuggestions = suggestMatches(payments, paymentBank, empty, empty)
  const splitReceipts = suggestSplitMatches(receipts, receiptBank, empty, empty)
  const splitPayments = suggestSplitMatches(payments, paymentBank, empty, empty)

  const receiptCoverage =
    receipts.length === 0 ? 1 : uniqueCoverage(receiptSuggestions, 'cb') / receipts.length
  const paymentCoverage =
    payments.length === 0 ? 1 : uniqueCoverage(paymentSuggestions, 'cb') / payments.length

  return {
    bankId: pair.bankId,
    cashBookFile: pair.cashBookFile,
    bankFile: pair.bankFile,
    cashBookRows: cash.rowCount,
    bankRows: bank.rowCount,
    receiptSuggestions: receiptSuggestions.length,
    paymentSuggestions: paymentSuggestions.length,
    splitSuggestions: splitReceipts.length + splitPayments.length,
    receiptCoverage,
    paymentCoverage,
    sideInversion: inversion.inverted,
    elapsedMs: Date.now() - started,
  }
}

export interface RunSpecimenBenchmarkOptions {
  specimenRoot?: string
  /** When true, only excel/csv originals (skip PDFs). Default false. */
  excelOnly?: boolean
  /** When false, skip dual-file matching pairs. Default true. */
  includeMatch?: boolean
  /** Optional bank id filter. */
  bankIds?: string[]
}

export async function runSpecimenBenchmark(
  options: RunSpecimenBenchmarkOptions = {}
): Promise<SpecimenBenchmarkReport> {
  const specimenRoot = options.specimenRoot ?? DEFAULT_SPECIMEN_ROOT
  const manifest = loadSpecimenManifest(specimenRoot)
  const bankFilter = options.bankIds ? new Set(options.bankIds) : null

  const parseRows: ParseBenchmarkRow[] = []
  let skipped = 0

  for (const bank of manifest.banks) {
    if (bankFilter && !bankFilter.has(bank.id)) continue
    for (const file of bank.files) {
      if (file.status !== 'ok') {
        skipped++
        continue
      }
      if (options.excelOnly && !/^excel|csv$/i.test(file.type) && !/\.xlsx?$/i.test(file.file)) {
        // Still allow .xlsx typed oddly; skip clear PDFs.
        if (/pdf/i.test(file.type) || /\.pdf$/i.test(file.file)) {
          skipped++
          continue
        }
      }
      parseRows.push(await evaluateParseFile(specimenRoot, bank, file))
    }
  }

  const matchRows: MatchBenchmarkRow[] = []
  if (options.includeMatch !== false) {
    for (const pair of MATCH_PAIRS) {
      if (bankFilter && !bankFilter.has(pair.bankId)) continue
      const cashPath = originalPath(specimenRoot, pair.bankId, pair.cashBookFile)
      const bankPath = originalPath(specimenRoot, pair.bankId, pair.bankFile)
      if (!fs.existsSync(cashPath) || !fs.existsSync(bankPath)) continue
      matchRows.push(await evaluateMatchPair(specimenRoot, pair))
    }
  }

  const passed = parseRows.filter((r) => r.pass).length
  return {
    specimenRoot,
    generatedAt: new Date().toISOString(),
    parse: {
      total: parseRows.length,
      passed,
      failed: parseRows.length - passed,
      skipped,
      rows: parseRows,
    },
    match: {
      total: matchRows.length,
      rows: matchRows,
    },
  }
}

export function formatBenchmarkSummary(report: SpecimenBenchmarkReport): string {
  const lines: string[] = []
  lines.push(`Specimen benchmark @ ${report.generatedAt}`)
  lines.push(
    `Parse: ${report.parse.passed}/${report.parse.total} passed (${report.parse.failed} failed, ${report.parse.skipped} skipped)`
  )
  for (const row of report.parse.rows.filter((r) => !r.pass)) {
    lines.push(`  FAIL ${row.bankId} / ${row.file}: ${row.errors.join('; ')}`)
  }
  if (report.match.rows.length) {
    lines.push('Match coverage:')
    for (const m of report.match.rows) {
      lines.push(
        `  ${m.bankId}: receipts ${(m.receiptCoverage * 100).toFixed(0)}% (${m.receiptSuggestions} sug), ` +
          `payments ${(m.paymentCoverage * 100).toFixed(0)}% (${m.paymentSuggestions} sug), ` +
          `splits ${m.splitSuggestions}` +
          (m.sideInversion ? ' [side-inverted]' : '')
      )
    }
  }
  return lines.join('\n')
}
