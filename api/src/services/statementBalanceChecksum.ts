/**
 * Opening + credits − debits ≈ closing. Only evaluates when both balances
 * are labelled on the statement. Missing balances → not_applicable (no block).
 */
import { parseImportedAmount } from './amountParser.js'
import type { ImportLocale } from './importLocale.js'
import { DEFAULT_IMPORT_LOCALE } from './importLocale.js'

export function checksumBlocksReconcile(meta: {
  checksum?: StatementChecksumResult
  checksumAcknowledged?: boolean
} | null | undefined): boolean {
  if (!meta?.checksum) return false
  if (meta.checksumAcknowledged) return false
  return meta.checksum.blocksReconcile === true && meta.checksum.status === 'failed'
}

export type ChecksumStatus = 'not_applicable' | 'passed' | 'failed'

export type StatementChecksumResult = {
  status: ChecksumStatus
  /** True only for unrecognised layouts whose arithmetic does not tie. Ghana parsers warn only. */
  blocksReconcile: boolean
  opening?: number
  closing?: number
  credits?: number
  debits?: number
  expectedClosing?: number
  difference?: number
  tolerance?: number
  message?: string
}

const DEFAULT_TOLERANCE = 0.05
const OPENING_RE = /opening\s*(bal(ance)?|bal\.?)|balance\s*(b\/?f|brought\s*forward)|bal\s*b\/?f/i
const CLOSING_RE = /closing\s*(bal(ance)?|bal\.?)|balance\s*(c\/?f|carried\s*forward)|bal\s*c\/?f/i

function rowText(row: unknown[]): string {
  return row.map((c) => String(c ?? '').trim()).join(' ')
}

function firstAmountInRow(row: unknown[], locale: ImportLocale): number | null {
  for (let i = row.length - 1; i >= 0; i--) {
    const raw = row[i]
    if (raw == null || String(raw).trim() === '') continue
    const n = parseImportedAmount(raw, locale)
    if (n !== 0 || /0/.test(String(raw))) return n
  }
  return null
}

function findLabeledBalance(
  rows: unknown[][],
  labelRe: RegExp,
  locale: ImportLocale
): number | null {
  for (const row of rows) {
    if (!labelRe.test(rowText(row))) continue
    const n = firstAmountInRow(row, locale)
    if (n != null) return n
  }
  return null
}

function findAmountColumns(headers: string[]): { debit: number; credit: number } {
  const debit = headers.findIndex((h) => /^(debit|debits|withdrawal|withdrawals|payments|money\s*out)$/i.test(String(h).trim()))
  const credit = headers.findIndex((h) => /^(credit|credits|deposit|deposits|receipts|money\s*in)$/i.test(String(h).trim()))
  return { debit, credit }
}

function isBalanceNoiseRow(row: unknown[]): boolean {
  const t = rowText(row)
  return OPENING_RE.test(t) || CLOSING_RE.test(t) || /page\s*total|total\s*(debit|credit)/i.test(t)
}

export function evaluateStatementChecksum(opts: {
  headers: string[]
  rows: unknown[][]
  openingBalance?: number | null
  closingBalance?: number | null
  locale?: ImportLocale
  /** When false (known Ghana bank), a failed tie is a warning only. */
  blockOnFailure?: boolean
  tolerance?: number
}): StatementChecksumResult {
  const locale = opts.locale || DEFAULT_IMPORT_LOCALE
  const tolerance = opts.tolerance ?? DEFAULT_TOLERANCE
  const blockOnFailure = opts.blockOnFailure === true

  const opening =
    opts.openingBalance != null && Number.isFinite(opts.openingBalance)
      ? opts.openingBalance
      : findLabeledBalance(opts.rows, OPENING_RE, locale)
  const closing =
    opts.closingBalance != null && Number.isFinite(opts.closingBalance)
      ? opts.closingBalance
      : findLabeledBalance(opts.rows, CLOSING_RE, locale)

  if (opening == null || closing == null) {
    return {
      status: 'not_applicable',
      blocksReconcile: false,
      opening: opening ?? undefined,
      closing: closing ?? undefined,
      message: 'Opening and closing balances were not both found — checksum skipped.',
    }
  }

  const cols = findAmountColumns(opts.headers)
  if (cols.debit < 0 && cols.credit < 0) {
    return {
      status: 'not_applicable',
      blocksReconcile: false,
      opening,
      closing,
      message: 'Debit/credit columns were not found — checksum skipped.',
    }
  }

  let credits = 0
  let debits = 0
  for (const row of opts.rows) {
    if (isBalanceNoiseRow(row)) continue
    if (cols.credit >= 0) credits += parseImportedAmount(row[cols.credit], locale)
    if (cols.debit >= 0) debits += parseImportedAmount(row[cols.debit], locale)
  }

  const expectedClosing = opening + credits - debits
  const difference = Math.round((expectedClosing - closing) * 100) / 100
  const ok = Math.abs(difference) <= tolerance
  const status: ChecksumStatus = ok ? 'passed' : 'failed'
  const blocksReconcile = status === 'failed' && blockOnFailure

  return {
    status,
    blocksReconcile,
    opening,
    closing,
    credits,
    debits,
    expectedClosing,
    difference,
    tolerance,
    message: ok
      ? 'Opening + credits − debits ties to the closing balance.'
      : `Opening ${opening.toFixed(2)} + credits ${credits.toFixed(2)} − debits ${debits.toFixed(2)} = ${expectedClosing.toFixed(2)}, but closing is ${closing.toFixed(2)} (difference ${difference.toFixed(2)}). Remap columns or export Excel, CSV, OFX, MT940, or CAMT.053 before reconciling.`,
  }
}
