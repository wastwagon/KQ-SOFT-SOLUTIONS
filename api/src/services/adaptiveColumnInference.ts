/**
 * Data-driven schema inference for unfamiliar cash-book and bank layouts.
 *
 * Header aliases remain the first choice. This module fills missing mappings
 * by profiling sample values, and only returns fields with strong evidence.
 */
import { parseImportedAmount } from './amountParser.js'
import { parseImportedDate } from './dateParser.js'

export type AdaptiveConfidence = 'high' | 'medium' | 'low'

export interface AdaptiveInference {
  mapping: Record<string, number>
  confidence: Record<string, AdaptiveConfidence>
  reasons: Record<string, string>
}

interface ColumnProfile {
  index: number
  nonEmpty: number
  numeric: number
  positive: number
  negative: number
  dateLike: number
  text: number
  textLength: number
}

function present(value: unknown): boolean {
  return value != null && String(value).trim() !== ''
}

function isDateLike(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime())
  const raw = String(value ?? '').trim()
  if (!raw) return false
  // Avoid treating ordinary amounts as Excel date serials unless they are
  // integer-like and within the plausible spreadsheet date range.
  const explicit =
    /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/.test(raw) ||
    /^\d{1,2}-[A-Za-z]{3}-\d{2,4}$/.test(raw) ||
    /^[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}$/.test(raw) ||
    /^\d{4}-\d{1,2}-\d{1,2}/.test(raw)
  if (explicit) return parseImportedDate(value) != null
  if (/^\d{5}$/.test(raw)) {
    const serial = Number(raw)
    return serial >= 20_000 && serial <= 80_000
  }
  return false
}

function isNumericLike(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  const raw = String(value ?? '').trim()
  if (!raw || !/\d/.test(raw)) return false
  return /^[-+]?[\s(]*[A-Za-z€£$₵GH₵]*\s*[\d,.]+(?:\s*[)-])?$/.test(raw)
}

function profileColumns(headers: string[], rows: unknown[][]): ColumnProfile[] {
  const sample = rows.slice(0, 250)
  return headers.map((_, index) => {
    const p: ColumnProfile = {
      index,
      nonEmpty: 0,
      numeric: 0,
      positive: 0,
      negative: 0,
      dateLike: 0,
      text: 0,
      textLength: 0,
    }
    for (const row of sample) {
      const value = row[index]
      if (!present(value)) continue
      p.nonEmpty++
      if (isDateLike(value)) p.dateLike++
      if (isNumericLike(value)) {
        p.numeric++
        const n = parseImportedAmount(value)
        if (n > 0) p.positive++
        if (n < 0) p.negative++
      } else {
        const text = String(value).trim()
        if (/[A-Za-z]/.test(text)) {
          p.text++
          p.textLength += text.length
        }
      }
    }
    return p
  })
}

function ratio(n: number, d: number): number {
  return d > 0 ? n / d : 0
}

function headerLooksLikeBalance(header: string): boolean {
  return /\bbal(?:ance)?\b|running\s*total|closing\s*balance/i.test(header)
}

function balanceOrientation(
  rows: unknown[][],
  amountIndex: number,
  balanceIndex: number
): { credit: number; debit: number; observations: number } {
  let credit = 0
  let debit = 0
  let observations = 0
  let previousBalance: number | null = null
  for (const row of rows.slice(0, 300)) {
    if (!present(row[balanceIndex])) continue
    const balance = parseImportedAmount(row[balanceIndex])
    if (previousBalance == null) {
      previousBalance = balance
      continue
    }
    if (!present(row[amountIndex])) {
      previousBalance = balance
      continue
    }
    const amount = Math.abs(parseImportedAmount(row[amountIndex]))
    const delta = balance - previousBalance
    previousBalance = balance
    if (!(amount > 0)) continue
    const tolerance = Math.max(0.02, amount * 0.00001)
    observations++
    if (Math.abs(delta - amount) <= tolerance) credit++
    if (Math.abs(delta + amount) <= tolerance) debit++
  }
  return { credit, debit, observations }
}

function setInference(
  out: AdaptiveInference,
  field: string,
  index: number,
  confidence: AdaptiveConfidence,
  reason: string
): void {
  if (out.mapping[field] != null) return
  out.mapping[field] = index
  out.confidence[field] = confidence
  out.reasons[field] = reason
}

export function inferAdaptiveMapping(
  docType: string,
  headers: string[],
  rows: unknown[][],
  existing: Record<string, number> = {}
): AdaptiveInference {
  const out: AdaptiveInference = {
    mapping: { ...existing },
    confidence: {},
    reasons: {},
  }
  if (!headers.length || !rows.length) return out

  const profiles = profileColumns(headers, rows)
  const isCash = docType.startsWith('cash_book_')
  const dateField = isCash ? 'date' : 'transaction_date'

  if (out.mapping[dateField] == null) {
    const bestDate = profiles
      .filter((p) => p.nonEmpty >= 3)
      .map((p) => ({ p, score: ratio(p.dateLike, p.nonEmpty) }))
      .sort((a, b) => b.score - a.score)[0]
    if (bestDate && bestDate.score >= 0.7) {
      setInference(
        out,
        dateField,
        bestDate.p.index,
        bestDate.score >= 0.9 ? 'high' : 'medium',
        `${Math.round(bestDate.score * 100)}% of sampled values look like dates`
      )
    }
  }

  const descriptionField = isCash ? 'details' : 'description'
  if (out.mapping[descriptionField] == null) {
    const excluded = new Set(Object.values(out.mapping))
    const bestText = profiles
      .filter((p) => !excluded.has(p.index) && p.nonEmpty >= 3 && ratio(p.text, p.nonEmpty) >= 0.55)
      .map((p) => ({
        p,
        score: ratio(p.text, p.nonEmpty) * Math.min(1, p.textLength / Math.max(p.text, 1) / 24),
      }))
      .sort((a, b) => b.score - a.score)[0]
    if (bestText && bestText.score >= 0.25) {
      setInference(
        out,
        descriptionField,
        bestText.p.index,
        bestText.score >= 0.65 ? 'high' : 'medium',
        'Column contains the strongest transaction-narration text pattern'
      )
      if (isCash && out.mapping.name == null) {
        setInference(out, 'name', bestText.p.index, 'medium', 'Using inferred narration as name/payee')
      }
    }
  }

  const excluded = new Set([
    out.mapping[dateField],
    out.mapping[descriptionField],
    out.mapping.name,
    out.mapping.doc_ref,
    out.mapping.chq_no,
  ].filter((v): v is number => v != null))
  const numeric = profiles.filter(
    (p) =>
      !excluded.has(p.index) &&
      !headerLooksLikeBalance(headers[p.index] || '') &&
      p.nonEmpty >= 3 &&
      ratio(p.numeric, p.nonEmpty) >= 0.75
  )

  // A mixed-sign amount column is the safest unknown-layout inference.
  const signed = numeric
    .filter((p) => p.positive >= 2 && p.negative >= 2)
    .sort((a, b) => b.numeric - a.numeric)[0]
  if (signed) {
    const fields = isCash ? ['amt_received', 'amt_paid'] : ['credit', 'debit']
    for (const field of fields) {
      setInference(
        out,
        field,
        signed.index,
        'high',
        'Single signed amount column contains both positive and negative transactions'
      )
    }
  }

  // For separate unknown amount columns, a running balance can determine which
  // is debit and which is credit without relying on bank-specific headers.
  if (!isCash && (out.mapping.credit == null || out.mapping.debit == null)) {
    const balance = profiles.find((p) => headerLooksLikeBalance(headers[p.index] || ''))
    if (balance) {
      for (const candidate of numeric) {
        const orientation = balanceOrientation(rows, candidate.index, balance.index)
        if (orientation.observations < 2) continue
        const creditRate = orientation.credit / orientation.observations
        const debitRate = orientation.debit / orientation.observations
        if (creditRate >= 0.65 && creditRate >= debitRate + 0.25) {
          setInference(
            out,
            'credit',
            candidate.index,
            creditRate >= 0.85 ? 'high' : 'medium',
            'Values increase the running balance'
          )
        }
        if (debitRate >= 0.65 && debitRate >= creditRate + 0.25) {
          setInference(
            out,
            'debit',
            candidate.index,
            debitRate >= 0.85 ? 'high' : 'medium',
            'Values decrease the running balance'
          )
        }
      }
    }
  }

  return out
}
