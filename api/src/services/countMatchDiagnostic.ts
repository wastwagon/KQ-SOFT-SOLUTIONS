/**
 * Match-by-counting diagnostic (read-only).
 *
 * Builds per-amount frequency schedules for BRS list layout:
 * only-CB / only-bank / open imbalances / batch-cancel.
 *
 * Does NOT confirm matches. Amount is the counting statistic only;
 * clears remain in the corroborated pairwise matcher.
 */
import type { Tx } from './matching.js'

export type CountScope = 'unmatched' | 'all'

export type CountBucketCategory =
  | 'only_cash_book'
  | 'only_bank'
  | 'open_cb_surplus'
  | 'open_bank_surplus'
  | 'batch_cancel'

export interface CountAmountRow {
  amountKey: string
  amount: number
  cashBookCount: number
  bankCount: number
  /** cashBookCount − bankCount */
  difference: number
  category: CountBucketCategory
  cashBookTxIds: string[]
  bankTxIds: string[]
}

export interface CountLaneResult {
  lane: 'receipts_credits' | 'payments_debits'
  cashBookLabel: 'Received' | 'Payment'
  bankLabel: 'Lodgment' | 'Debits'
  rows: CountAmountRow[]
  summary: {
    onlyCashBook: number
    onlyBank: number
    openCbSurplus: number
    openBankSurplus: number
    batchCancel: number
  }
}

export interface CountMatchDiagnostic {
  scope: CountScope
  invertedSides: boolean
  /** Informational — counting uses cent buckets (0.01 GHS). */
  amountTolerance: number
  receiptsCredits: CountLaneResult
  paymentsDebits: CountLaneResult
  brsDetails: {
    onlyCashBookReceived: CountAmountRow[]
    onlyCashBookPayments: CountAmountRow[]
    onlyBankLodgments: CountAmountRow[]
    onlyBankDebits: CountAmountRow[]
    openReceiptsVsCreditsCbSurplus: CountAmountRow[]
    openReceiptsVsCreditsBankSurplus: CountAmountRow[]
    openPaymentsVsDebitsCbSurplus: CountAmountRow[]
    openPaymentsVsDebitsBankSurplus: CountAmountRow[]
  }
  cancelSchedule: {
    receiptsEqualsCredits: CountAmountRow[]
    paymentsEqualsDebits: CountAmountRow[]
  }
}

export interface CountMatchInput {
  receipts: Tx[]
  payments: Tx[]
  /** Bank side paired with receipts (credits normally; debits when inverted). */
  receiptBank: Tx[]
  /** Bank side paired with payments (debits normally; credits when inverted). */
  paymentBank: Tx[]
  matchedCbIds?: Set<string>
  matchedBankIds?: Set<string>
  scope?: CountScope
  invertedSides?: boolean
  amountTolerance?: number
}

function amountKey(amount: number): string {
  return Math.abs(amount).toFixed(2)
}

function filterScope(txs: Tx[], matchedIds: Set<string> | undefined, scope: CountScope): Tx[] {
  return txs.filter((t) => {
    if (!(t.amount > 0)) return false
    if (scope === 'all') return true
    if (!matchedIds || matchedIds.size === 0) return true
    return !matchedIds.has(t.id)
  })
}

function histogram(txs: Tx[]): Map<string, { amount: number; ids: string[] }> {
  const map = new Map<string, { amount: number; ids: string[] }>()
  for (const t of txs) {
    const key = amountKey(t.amount)
    let bucket = map.get(key)
    if (!bucket) {
      bucket = { amount: Math.abs(Number(t.amount.toFixed(2))), ids: [] }
      map.set(key, bucket)
    }
    bucket.ids.push(t.id)
  }
  return map
}

function categorize(cbCount: number, bankCount: number): CountBucketCategory {
  if (cbCount > 0 && bankCount === 0) return 'only_cash_book'
  if (bankCount > 0 && cbCount === 0) return 'only_bank'
  if (cbCount === bankCount) return 'batch_cancel'
  if (cbCount > bankCount) return 'open_cb_surplus'
  return 'open_bank_surplus'
}

function buildLane(opts: {
  lane: CountLaneResult['lane']
  cashBookLabel: CountLaneResult['cashBookLabel']
  bankLabel: CountLaneResult['bankLabel']
  cashBook: Tx[]
  bank: Tx[]
}): CountLaneResult {
  const cbHist = histogram(opts.cashBook)
  const bankHist = histogram(opts.bank)
  const keys = new Set([...cbHist.keys(), ...bankHist.keys()])
  const rows: CountAmountRow[] = []

  for (const key of keys) {
    const cb = cbHist.get(key)
    const bank = bankHist.get(key)
    const cashBookCount = cb?.ids.length ?? 0
    const bankCount = bank?.ids.length ?? 0
    const amount = cb?.amount ?? bank?.amount ?? Number(key)
    const category = categorize(cashBookCount, bankCount)
    rows.push({
      amountKey: key,
      amount,
      cashBookCount,
      bankCount,
      difference: cashBookCount - bankCount,
      category,
      cashBookTxIds: cb?.ids ?? [],
      bankTxIds: bank?.ids ?? [],
    })
  }

  rows.sort((a, b) => b.amount - a.amount || a.amountKey.localeCompare(b.amountKey))

  const summary = {
    onlyCashBook: 0,
    onlyBank: 0,
    openCbSurplus: 0,
    openBankSurplus: 0,
    batchCancel: 0,
  }
  for (const r of rows) {
    if (r.category === 'only_cash_book') summary.onlyCashBook++
    else if (r.category === 'only_bank') summary.onlyBank++
    else if (r.category === 'open_cb_surplus') summary.openCbSurplus++
    else if (r.category === 'open_bank_surplus') summary.openBankSurplus++
    else summary.batchCancel++
  }

  return {
    lane: opts.lane,
    cashBookLabel: opts.cashBookLabel,
    bankLabel: opts.bankLabel,
    rows,
    summary,
  }
}

function byCategory(rows: CountAmountRow[], category: CountBucketCategory): CountAmountRow[] {
  return rows.filter((r) => r.category === category)
}

/**
 * Build match-by-counting schedules for one project scope.
 * Pass already side-resolved bank lanes (via resolveMatchSides).
 */
export function buildCountMatchDiagnostic(input: CountMatchInput): CountMatchDiagnostic {
  const scope: CountScope = input.scope === 'all' ? 'all' : 'unmatched'
  const matchedCb = input.matchedCbIds
  const matchedBank = input.matchedBankIds

  const receipts = filterScope(input.receipts, matchedCb, scope)
  const payments = filterScope(input.payments, matchedCb, scope)
  const receiptBank = filterScope(input.receiptBank, matchedBank, scope)
  const paymentBank = filterScope(input.paymentBank, matchedBank, scope)

  const receiptsCredits = buildLane({
    lane: 'receipts_credits',
    cashBookLabel: 'Received',
    bankLabel: 'Lodgment',
    cashBook: receipts,
    bank: receiptBank,
  })
  const paymentsDebits = buildLane({
    lane: 'payments_debits',
    cashBookLabel: 'Payment',
    bankLabel: 'Debits',
    cashBook: payments,
    bank: paymentBank,
  })

  return {
    scope,
    invertedSides: !!input.invertedSides,
    amountTolerance: input.amountTolerance ?? 0.01,
    receiptsCredits,
    paymentsDebits,
    brsDetails: {
      onlyCashBookReceived: byCategory(receiptsCredits.rows, 'only_cash_book'),
      onlyCashBookPayments: byCategory(paymentsDebits.rows, 'only_cash_book'),
      onlyBankLodgments: byCategory(receiptsCredits.rows, 'only_bank'),
      onlyBankDebits: byCategory(paymentsDebits.rows, 'only_bank'),
      openReceiptsVsCreditsCbSurplus: byCategory(receiptsCredits.rows, 'open_cb_surplus'),
      openReceiptsVsCreditsBankSurplus: byCategory(receiptsCredits.rows, 'open_bank_surplus'),
      openPaymentsVsDebitsCbSurplus: byCategory(paymentsDebits.rows, 'open_cb_surplus'),
      openPaymentsVsDebitsBankSurplus: byCategory(paymentsDebits.rows, 'open_bank_surplus'),
    },
    cancelSchedule: {
      receiptsEqualsCredits: byCategory(receiptsCredits.rows, 'batch_cancel'),
      paymentsEqualsDebits: byCategory(paymentsDebits.rows, 'batch_cancel'),
    },
  }
}
