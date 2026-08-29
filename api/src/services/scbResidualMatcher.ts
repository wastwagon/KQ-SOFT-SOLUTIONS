/**
 * Residual SCB / side-inverted pairing for open transactions after phased suggestions.
 * Mirrors integration-script finish passes — sweeps, ref+amount, unique amount + date.
 */
import type { Tx } from './matching.js'
import {
  extractScbClearingRef,
  extractScbOtRef,
} from './scbSweepMatcher.js'
import { suggestionClearingRef } from './suggestionDuplicateFlags.js'

export type ResidualMatchPair = {
  cashBookTransactionId: string
  bankTransactionId: string
}

const SWEEP_RE = /\bSWEEP\b/i

function txText(t: Tx): string {
  return [t.details, t.name, t.chqNo].filter(Boolean).join(' ')
}

function isSweepLine(t: Tx): boolean {
  return SWEEP_RE.test(txText(t))
}

function daysApart(a: Tx, b: Tx): number {
  const d1 = a.date ? new Date(a.date) : null
  const d2 = b.date ? new Date(b.date) : null
  if (!d1 || !d2 || Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return 0
  return Math.abs(d1.getTime() - d2.getTime()) / 86400000
}

function amountsMatch(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance
}

export type ResidualSuggestion = {
  cashBookTx: Tx
  bankTx: Tx
  confidence: number
  duplicateWarning?: boolean
}

export function collectCorroboratedDuplicatePairs(
  suggestions: ResidualSuggestion[],
  matchedCbIds: Set<string>,
  matchedBankIds: Set<string>,
  opts: { minConfidence?: number } = {}
): ResidualMatchPair[] {
  const minConfidence = opts.minConfidence ?? 0.88
  const pairs: ResidualMatchPair[] = []
  const usedCb = new Set<string>()
  const usedBank = new Set<string>()

  for (const s of suggestions) {
    if (s.confidence < minConfidence) continue
    const cbId = s.cashBookTx.id
    const bankId = s.bankTx.id
    if (matchedCbIds.has(cbId) || matchedBankIds.has(bankId)) continue
    if (usedCb.has(cbId) || usedBank.has(bankId)) continue
    const refA = suggestionClearingRef(s.cashBookTx)
    const refB = suggestionClearingRef(s.bankTx)
    if (!refA || !refB || refA !== refB) continue
    usedCb.add(cbId)
    usedBank.add(bankId)
    pairs.push({ cashBookTransactionId: cbId, bankTransactionId: bankId })
  }
  return pairs
}

export function collectScbResidualPairs(opts: {
  receipts: Tx[]
  payments: Tx[]
  credits: Tx[]
  debits: Tx[]
  matchedCbIds: Set<string>
  matchedBankIds: Set<string>
  sideInverted: boolean
  amountTolerance?: number
  uniqueAmountDateWindowDays?: number
}): ResidualMatchPair[] {
  const {
    receipts,
    payments,
    credits,
    debits,
    matchedCbIds,
    matchedBankIds,
    sideInverted,
    amountTolerance = 0.01,
    uniqueAmountDateWindowDays = 14,
  } = opts

  const ur = receipts.filter((t) => t.id && !matchedCbIds.has(t.id) && t.amount > 0)
  const up = payments.filter((t) => t.id && !matchedCbIds.has(t.id) && t.amount > 0)
  const uc = credits.filter((t) => t.id && !matchedBankIds.has(t.id) && t.amount > 0)
  const ud = debits.filter((t) => t.id && !matchedBankIds.has(t.id) && t.amount > 0)

  const cbBankLanes: [Tx[], Tx[]][] = sideInverted
    ? [
        [ur, ud],
        [up, uc],
      ]
    : [
        [ur, uc],
        [up, ud],
      ]

  const pairs: ResidualMatchPair[] = []
  const usedCb = new Set<string>()
  const usedBank = new Set<string>()

  for (const [cbList, bankList] of cbBankLanes) {
    const bankOpen = () => bankList.filter((b) => !usedBank.has(b.id))

    for (const c of cbList.filter((x) => !usedCb.has(x.id) && isSweepLine(x))) {
      const hits = bankOpen().filter(
        (b) => isSweepLine(b) && amountsMatch(b.amount, c.amount, amountTolerance)
      )
      if (hits.length !== 1) continue
      usedCb.add(c.id)
      usedBank.add(hits[0]!.id)
      pairs.push({ cashBookTransactionId: c.id, bankTransactionId: hits[0]!.id })
    }

    for (const c of cbList.filter((x) => !usedCb.has(x.id))) {
      const ref = suggestionClearingRef(c)
      if (!ref) continue
      const hits = bankOpen().filter(
        (b) =>
          amountsMatch(b.amount, c.amount, amountTolerance) && suggestionClearingRef(b) === ref
      )
      if (!hits.length) continue
      usedCb.add(c.id)
      usedBank.add(hits[0]!.id)
      pairs.push({ cashBookTransactionId: c.id, bankTransactionId: hits[0]!.id })
    }

    const bankByAmt = new Map<string, Tx[]>()
    for (const b of bankOpen()) {
      const k = b.amount.toFixed(2)
      if (!bankByAmt.has(k)) bankByAmt.set(k, [])
      bankByAmt.get(k)!.push(b)
    }
    for (const c of cbList.filter((x) => !usedCb.has(x.id))) {
      const hits = (bankByAmt.get(c.amount.toFixed(2)) || []).filter((b) => !usedBank.has(b.id))
      if (hits.length !== 1) continue
      if (daysApart(c, hits[0]!) > uniqueAmountDateWindowDays) continue
      usedCb.add(c.id)
      usedBank.add(hits[0]!.id)
      pairs.push({ cashBookTransactionId: c.id, bankTransactionId: hits[0]!.id })
    }
  }

  return pairs
}

/** Re-export for tests documenting OT ref parity with scbSweepMatcher. */
export { extractScbOtRef, extractScbClearingRef }
