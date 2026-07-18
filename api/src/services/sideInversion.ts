/**
 * Detect ERP cash books that invert bank sides (common on SCB/TGL-style ledgers):
 * cash AMT RECEIVED totals ≈ bank DEBITS, cash AMT PAID ≈ bank CREDITS.
 *
 * Used to pair matching suggestions correctly without requiring the user to remap columns.
 */
import type { Tx } from './matching.js'

export interface SideInversionInput {
  receipts: Tx[]
  payments: Tx[]
  credits: Tx[]
  debits: Tx[]
}

export interface SideInversionResult {
  inverted: boolean
  standardOverlap: number
  crossedOverlap: number
  reason: string
}

function uniqueAmountKeys(txs: Tx[]): Set<string> {
  const keys = new Set<string>()
  for (const t of txs) {
    if (!(t.amount > 0)) continue
    keys.add(t.amount.toFixed(2))
  }
  return keys
}

function overlapCount(a: Set<string>, b: Set<string>): number {
  let n = 0
  for (const k of a) if (b.has(k)) n++
  return n
}

/**
 * Prefer crossed pairing when it finds substantially more amount overlap than the
 * standard receipts↔credits / payments↔debits pairing.
 */
export function detectCashBookBankSideInversion(input: SideInversionInput): SideInversionResult {
  const receiptAmts = uniqueAmountKeys(input.receipts)
  const paymentAmts = uniqueAmountKeys(input.payments)
  const creditAmts = uniqueAmountKeys(input.credits)
  const debitAmts = uniqueAmountKeys(input.debits)

  const standardOverlap =
    overlapCount(receiptAmts, creditAmts) + overlapCount(paymentAmts, debitAmts)
  const crossedOverlap =
    overlapCount(receiptAmts, debitAmts) + overlapCount(paymentAmts, creditAmts)

  // Require a clear gap so we don't flip on sparse/noisy samples.
  const inverted =
    crossedOverlap >= 5 &&
    crossedOverlap >= standardOverlap * 2 &&
    crossedOverlap - standardOverlap >= 5

  return {
    inverted,
    standardOverlap,
    crossedOverlap,
    reason: inverted
      ? `Cash-book sides appear inverted vs bank (crossed overlap ${crossedOverlap} vs standard ${standardOverlap})`
      : `Standard side pairing preferred (standard overlap ${standardOverlap} vs crossed ${crossedOverlap})`,
  }
}

/** Apply inversion: receipts pair with debits, payments with credits. */
export function resolveMatchSides(input: SideInversionInput): {
  inversion: SideInversionResult
  receiptBank: Tx[]
  paymentBank: Tx[]
} {
  const inversion = detectCashBookBankSideInversion(input)
  if (inversion.inverted) {
    return {
      inversion,
      receiptBank: input.debits,
      paymentBank: input.credits,
    }
  }
  return {
    inversion,
    receiptBank: input.credits,
    paymentBank: input.debits,
  }
}
