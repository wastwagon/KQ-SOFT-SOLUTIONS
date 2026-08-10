/**
 * Thin pattern matchers for GCB, NIB, Prudential, Absa, and Bank of Africa (Ghana).
 * Suggestion-first; unique-amount-only stays ≤0.84 (below Phase B).
 */
import {
  descriptionSimilarity,
  shareReferenceEvidence,
  type SuggestedMatch,
  type Tx,
} from './matching.js'
import { bankAccountsForScope, type ScopedBankAccount } from './ecobankClearingMatcher.js'
import { extractChqNoFromDescription } from './ghanaBankParsers.js'
import { mergeReceiptSuggestions } from './scbSweepMatcher.js'

export const GCB_BULK_SAFE_REASON_RE =
  /GCB cheque withdrawal|GCB cash deposit|GCB CHQ lodgement/i
export const NIB_BULK_SAFE_REASON_RE =
  /NIB inward cheque|NIB cash deposit|NIB telex/i
export const PRUDENTIAL_BULK_SAFE_REASON_RE =
  /Prudential inward clearing|Prudential cheque withdrawal|Prudential NRT|Prudential call\/credit/i
export const ABSA_BULK_SAFE_REASON_RE =
  /Absa investment|Absa EBOX|Absa FT/i
export const BOA_BULK_SAFE_REASON_RE =
  /BOA inward cheque|BOA cash deposit|BOA maturity|BOA interest/i

export const GHANA_REGIONAL_BULK_SAFE_REASON_RE =
  /GCB cheque withdrawal|GCB cash deposit|GCB CHQ lodgement|NIB inward cheque|NIB cash deposit|NIB telex|Prudential inward clearing|Prudential cheque withdrawal|Prudential NRT|Prudential call\/credit|Absa investment|Absa EBOX|Absa FT|BOA inward cheque|BOA cash deposit|BOA maturity|BOA interest/i

export function isGcbPatternMatchReason(reason: string): boolean {
  return GCB_BULK_SAFE_REASON_RE.test(reason)
}
export function isNibPatternMatchReason(reason: string): boolean {
  return NIB_BULK_SAFE_REASON_RE.test(reason)
}
export function isPrudentialPatternMatchReason(reason: string): boolean {
  return PRUDENTIAL_BULK_SAFE_REASON_RE.test(reason)
}
export function isAbsaPatternMatchReason(reason: string): boolean {
  return ABSA_BULK_SAFE_REASON_RE.test(reason)
}
export function isBoaPatternMatchReason(reason: string): boolean {
  return BOA_BULK_SAFE_REASON_RE.test(reason)
}
export function isGhanaRegionalPatternMatchReason(reason: string): boolean {
  return GHANA_REGIONAL_BULK_SAFE_REASON_RE.test(reason)
}

const GCB_CHEQUE_WITHDRAWAL_RE = /Cheque\s+Withdrawal/i
const GCB_CASH_DEPOSIT_RE = /Cash\s+Deposit/i
const GCB_BOG_CHQ_RE = /BANK\s+OF\s+GHANA\s+CHQ|\bBOG\s+CHQ\b|\bCHQ\s*-\s*/i

const NIB_INWARD_CHEQUE_RE = /Inward\s+Cheque|CHQ\s*NO\.?\s*\d|By\s+cheque\s+No/i
const NIB_CASH_DEPOSIT_RE = /Cash\s+Deposit/i
const NIB_TELEX_RE = /Inward\s+Telex\s+Payment/i

const PRU_INWARD_CLEARING_RE = /INWARD\s+CLEARING/i
const PRU_CHEQUE_WITHDRAWAL_RE = /CHEQUE\s+WITHDRAWAL/i
const PRU_NRT_RE = /NRT\s+ACH\s+OUT|OUTGOING\s+RT\s+ACH/i
const PRU_CREDIT_TYPE_RE = /CALL\s+TRANSACTIONS|PRINCIPAL\s+PAYMENT|DIRECT\s+CREDIT|INTEREST\b/i

const ABSA_INVESTMENT_RE = /INVESTMENT\s+BANK/i
const ABSA_EBOX_RE = /\bEBOX\b/i
const ABSA_FT_RE = /\bFT\d{6,}[A-Z0-9]*\b/i

const BOA_CHECK_PAID_RE = /CHECK\s+PAID|INW\.CHQ/i
const BOA_CASH_DEPOSIT_RE = /YOUR\s+CASH\s+DEPOSIT|CASH\s+DEPOSIT/i
const BOA_MATURITY_RE = /\bMAT\.DEPOT\b/i
const BOA_INTEREST_RE = /\bINT\.DEPO\b|DECREASE\s+RENEWAL\s+DEPOSIT/i

function txText(tx: Tx): string {
  return [tx.details, tx.name].filter(Boolean).join(' ')
}

function amountsMatch(a: number, b: number, tolerance = 0.01): boolean {
  return Math.abs(a - b) <= tolerance
}

function normalizeRefToken(value: string | null | undefined): string {
  if (!value) return ''
  const digits = String(value).replace(/\D/g, '')
  if (digits) return digits.replace(/^0+/, '') || '0'
  return String(value).trim().toLowerCase()
}

/** Cheque refs across GCB/NIB/Prudential/BOA narration variants. */
export function extractGhanaChequeRef(tx: Tx): string | null {
  if (tx.chqNo?.trim()) return tx.chqNo.trim()
  const text = txText(tx)
  const patterns = [
    /\/Chq_No\s*-\s*(\d{3,10})/i,
    /\bBy\s+cheque\s+No:\s*(\d{3,10})\b/i,
    /\bIFO\s+Chq\s+(\d{3,10})\b/i,
    /\bbog\s+chq\s+(\d{3,10})\b/i,
    /\bCheque:\s*(\d{3,10})\b/i,
    /\bCHQ\s*NO\.?\s*(\d{3,10})\b/i,
    /\bCHQ\s*#\s*(\d{3,10})\b/i,
    /\bCheque\s*(?:No\.?|#|:)?\s*(\d{3,10})\b/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) return m[1]
  }
  return extractChqNoFromDescription(text)
}

/** Absa / common FT transfer reference (e.g. FT2234109356). */
export function extractFtRef(tx: Tx): string | null {
  const m = txText(tx).match(/\b(FT\d{6,}[A-Z0-9]*)\b/i)
  return m ? m[1]!.toUpperCase() : null
}

/** BOA Our Reference (AX… / numeric) from docRef or narration. */
export function extractBoaOurRef(tx: Tx): string | null {
  if (tx.docRef?.trim()) return tx.docRef.trim().toUpperCase()
  const m = txText(tx).match(/\b(AX\d{4,})\b/i)
  return m ? m[1]!.toUpperCase() : null
}

function refsLink(cb: Tx, bk: Tx): boolean {
  if (shareReferenceEvidence(cb, bk)) return true
  const cbRef = extractGhanaChequeRef(cb)
  const bkRef = extractGhanaChequeRef(bk)
  if (cbRef && bkRef && normalizeRefToken(cbRef) === normalizeRefToken(bkRef)) return true
  if (cbRef && normalizeRefToken(cbRef) && txText(bk).includes(cbRef)) return true
  if (bkRef && normalizeRefToken(bkRef) && txText(cb).includes(bkRef)) return true
  return false
}

function payeeScore(cb: Tx, bk: Tx): number {
  return descriptionSimilarity(
    [cb.details, cb.name].filter(Boolean).join(' '),
    [bk.details, bk.name].filter(Boolean).join(' ')
  )
}

function dedupeSuggestions(suggestions: SuggestedMatch[]): SuggestedMatch[] {
  const byCb = new Map<string, SuggestedMatch>()
  for (const s of suggestions) {
    const prev = byCb.get(s.cashBookTx.id)
    if (!prev || s.confidence > prev.confidence) byCb.set(s.cashBookTx.id, s)
  }
  const byBank = new Map<string, SuggestedMatch>()
  for (const s of byCb.values()) {
    const prev = byBank.get(s.bankTx.id)
    if (!prev || s.confidence > prev.confidence) byBank.set(s.bankTx.id, s)
  }
  return Array.from(byBank.values()).sort((a, b) => b.confidence - a.confidence)
}

function profileText(opts: {
  bankAccounts?: ScopedBankAccount[]
  bankAccountId?: string
  sampleBankText?: string
}): string {
  const names = bankAccountsForScope(opts.bankAccounts, opts.bankAccountId)
    .flatMap((a) => [a.name, a.bankName])
    .filter(Boolean)
    .join(' ')
  return [names, opts.sampleBankText || ''].join(' ')
}

export function resolveGcbProfile(opts: {
  bankAccounts?: ScopedBankAccount[]
  bankAccountId?: string
  sampleBankText?: string
}): { active: boolean } {
  const text = profileText(opts)
  const sample = opts.sampleBankText || ''
  const active =
    /\bgcb\b|ghana\s+commercial/i.test(text) ||
    (/Cash\s+Deposit\/\//i.test(sample) && /\/Chq_No\s*-/i.test(sample)) ||
    (/Cheque\s+Withdrawal/i.test(sample) && /\/Chq_No\s*-/i.test(sample))
  return { active }
}

export function resolveNibProfile(opts: {
  bankAccounts?: ScopedBankAccount[]
  bankAccountId?: string
  sampleBankText?: string
}): { active: boolean } {
  const text = profileText(opts)
  const sample = opts.sampleBankText || ''
  const active =
    /\bnib\b|national\s+investment\s+bank/i.test(text) ||
    /Inward\s+Cheque\s*-\s*Dr|Inward\s+Telex\s+Payment|By\s+cheque\s+No:/i.test(sample)
  return { active }
}

export function resolvePrudentialProfile(opts: {
  bankAccounts?: ScopedBankAccount[]
  bankAccountId?: string
  sampleBankText?: string
}): { active: boolean } {
  const text = profileText(opts)
  const sample = opts.sampleBankText || ''
  const active =
    /prudential|ring\s+road\s+central/i.test(text) ||
    (/INWARD\s+CLEARING/i.test(sample) &&
      /CALL\s+TRANSACTIONS|CHEQUE\s+WITHDRAWAL|NRT\s+ACH/i.test(sample))
  return { active }
}

export function resolveAbsaProfile(opts: {
  bankAccounts?: ScopedBankAccount[]
  bankAccountId?: string
  sampleBankText?: string
}): { active: boolean } {
  const text = profileText(opts)
  const sample = opts.sampleBankText || ''
  const active =
    /\babsa\b|barclays/i.test(text) ||
    (/\bEBOX\b/i.test(sample) && /INVESTMENT\s+BANK|FT\d{6,}/i.test(sample))
  return { active }
}

export function resolveBoaProfile(opts: {
  bankAccounts?: ScopedBankAccount[]
  bankAccountId?: string
  sampleBankText?: string
}): { active: boolean } {
  const text = profileText(opts)
  const sample = opts.sampleBankText || ''
  const active =
    /bank\s+of\s+africa|\bboa\b/i.test(text) ||
    (/CHECK\s+PAID|INW\.CHQ/i.test(sample) && /MAT\.DEPOT|YOUR\s+CASH\s+DEPOSIT/i.test(sample))
  return { active }
}

// ─── GCB ─────────────────────────────────────────────────────────────────────

export function suggestGcbChequeWithdrawalMatches(
  payments: Tx[],
  debits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of payments) {
    if (matchedCashBookIds.has(cb.id)) continue
    const cbRef = extractGhanaChequeRef(cb)
    if (!cbRef) continue
    const candidates = debits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        GCB_CHEQUE_WITHDRAWAL_RE.test(txText(bk)) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance) &&
        refsLink(cb, bk)
    )
    if (candidates.length !== 1) continue
    suggestions.push({
      cashBookTx: cb,
      bankTx: candidates[0]!,
      confidence: 0.92,
      reason: 'GCB cheque withdrawal: chq/ref + amount',
    })
  }
  return dedupeSuggestions(suggestions)
}

export function suggestGcbBogChqMatches(
  payments: Tx[],
  debits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of payments) {
    if (matchedCashBookIds.has(cb.id)) continue
    const cbRef = extractGhanaChequeRef(cb)
    if (!cbRef) continue
    const candidates = debits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        GCB_BOG_CHQ_RE.test(txText(bk)) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance) &&
        refsLink(cb, bk)
    )
    if (candidates.length !== 1) continue
    suggestions.push({
      cashBookTx: cb,
      bankTx: candidates[0]!,
      confidence: 0.91,
      reason: 'GCB CHQ lodgement: chq + amount',
    })
  }
  return dedupeSuggestions(suggestions)
}

export function suggestGcbCashDepositMatches(
  receipts: Tx[],
  credits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of receipts) {
    if (matchedCashBookIds.has(cb.id)) continue
    const candidates = credits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        GCB_CASH_DEPOSIT_RE.test(txText(bk)) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance)
    )
    if (!candidates.length) continue
    const withPayee = candidates.filter((bk) => payeeScore(cb, bk) >= 0.3)
    if (withPayee.length === 1) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: withPayee[0]!,
        confidence: 0.91,
        reason: 'GCB cash deposit: amount + payee',
      })
      continue
    }
    if (candidates.length === 1 && withPayee.length === 0) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: candidates[0]!,
        confidence: 0.84,
        reason: 'GCB cash deposit: unique amount',
      })
    }
  }
  return dedupeSuggestions(suggestions)
}

// ─── NIB ─────────────────────────────────────────────────────────────────────

export function suggestNibInwardChequeMatches(
  payments: Tx[],
  debits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of payments) {
    if (matchedCashBookIds.has(cb.id)) continue
    const cbRef = extractGhanaChequeRef(cb)
    if (!cbRef) continue
    const candidates = debits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        NIB_INWARD_CHEQUE_RE.test(txText(bk)) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance) &&
        refsLink(cb, bk)
    )
    if (candidates.length !== 1) continue
    suggestions.push({
      cashBookTx: cb,
      bankTx: candidates[0]!,
      confidence: 0.92,
      reason: 'NIB inward cheque: chq/ref + amount',
    })
  }
  return dedupeSuggestions(suggestions)
}

export function suggestNibCashDepositMatches(
  receipts: Tx[],
  credits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of receipts) {
    if (matchedCashBookIds.has(cb.id)) continue
    const candidates = credits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        NIB_CASH_DEPOSIT_RE.test(txText(bk)) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance)
    )
    const withPayee = candidates.filter((bk) => payeeScore(cb, bk) >= 0.3)
    if (withPayee.length === 1) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: withPayee[0]!,
        confidence: 0.91,
        reason: 'NIB cash deposit: amount + payee',
      })
      continue
    }
    if (candidates.length === 1 && withPayee.length === 0) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: candidates[0]!,
        confidence: 0.84,
        reason: 'NIB cash deposit: unique amount',
      })
    }
  }
  return dedupeSuggestions(suggestions)
}

export function suggestNibTelexMatches(
  receipts: Tx[],
  credits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of receipts) {
    if (matchedCashBookIds.has(cb.id)) continue
    const candidates = credits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        NIB_TELEX_RE.test(txText(bk)) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance)
    )
    const withPayee = candidates.filter((bk) => payeeScore(cb, bk) >= 0.3)
    if (withPayee.length === 1) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: withPayee[0]!,
        confidence: 0.9,
        reason: 'NIB telex: amount + payee',
      })
      continue
    }
    if (candidates.length === 1) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: candidates[0]!,
        confidence: 0.84,
        reason: 'NIB telex: unique amount',
      })
    }
  }
  return dedupeSuggestions(suggestions)
}

// ─── Prudential ──────────────────────────────────────────────────────────────

export function suggestPrudentialInwardClearingMatches(
  payments: Tx[],
  debits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of payments) {
    if (matchedCashBookIds.has(cb.id)) continue
    const candidates = debits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        PRU_INWARD_CLEARING_RE.test(txText(bk)) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance)
    )
    const withPayee = candidates.filter((bk) => payeeScore(cb, bk) >= 0.3 || refsLink(cb, bk))
    if (withPayee.length === 1) {
      const viaRef = refsLink(cb, withPayee[0]!)
      suggestions.push({
        cashBookTx: cb,
        bankTx: withPayee[0]!,
        confidence: viaRef ? 0.92 : 0.9,
        reason: viaRef
          ? 'Prudential inward clearing: chq/ref + amount'
          : 'Prudential inward clearing: amount + payee',
      })
      continue
    }
    if (candidates.length === 1 && withPayee.length === 0) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: candidates[0]!,
        confidence: 0.84,
        reason: 'Prudential inward clearing: unique amount',
      })
    }
  }
  return dedupeSuggestions(suggestions)
}

export function suggestPrudentialChequeWithdrawalMatches(
  payments: Tx[],
  debits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of payments) {
    if (matchedCashBookIds.has(cb.id)) continue
    const cbRef = extractGhanaChequeRef(cb)
    if (!cbRef) continue
    const candidates = debits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        PRU_CHEQUE_WITHDRAWAL_RE.test(txText(bk)) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance) &&
        refsLink(cb, bk)
    )
    if (candidates.length !== 1) continue
    suggestions.push({
      cashBookTx: cb,
      bankTx: candidates[0]!,
      confidence: 0.92,
      reason: 'Prudential cheque withdrawal: chq/ref + amount',
    })
  }
  return dedupeSuggestions(suggestions)
}

export function suggestPrudentialNrtMatches(
  payments: Tx[],
  debits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of payments) {
    if (matchedCashBookIds.has(cb.id)) continue
    const candidates = debits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        PRU_NRT_RE.test(txText(bk)) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance)
    )
    const withPayee = candidates.filter((bk) => payeeScore(cb, bk) >= 0.3)
    if (withPayee.length === 1) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: withPayee[0]!,
        confidence: 0.9,
        reason: 'Prudential NRT: amount + payee',
      })
      continue
    }
    if (candidates.length === 1 && withPayee.length === 0) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: candidates[0]!,
        confidence: 0.84,
        reason: 'Prudential NRT: unique amount',
      })
    }
  }
  return dedupeSuggestions(suggestions)
}

export function suggestPrudentialCreditTypeMatches(
  receipts: Tx[],
  credits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of receipts) {
    if (matchedCashBookIds.has(cb.id)) continue
    const candidates = credits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        PRU_CREDIT_TYPE_RE.test(txText(bk)) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance)
    )
    const withPayee = candidates.filter((bk) => payeeScore(cb, bk) >= 0.3)
    if (withPayee.length === 1) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: withPayee[0]!,
        confidence: 0.9,
        reason: 'Prudential call/credit: amount + payee',
      })
      continue
    }
    if (candidates.length === 1) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: candidates[0]!,
        confidence: 0.84,
        reason: 'Prudential call/credit: unique amount',
      })
    }
  }
  return dedupeSuggestions(suggestions)
}

// ─── Absa ────────────────────────────────────────────────────────────────────

export function suggestAbsaInvestmentCreditMatches(
  receipts: Tx[],
  credits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of receipts) {
    if (matchedCashBookIds.has(cb.id)) continue
    const candidates = credits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        ABSA_INVESTMENT_RE.test(txText(bk)) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance)
    )
    const cbFt = extractFtRef(cb)
    const withSignal = candidates.filter((bk) => {
      const bkFt = extractFtRef(bk)
      return (
        payeeScore(cb, bk) >= 0.3 ||
        refsLink(cb, bk) ||
        (!!cbFt && !!bkFt && cbFt === bkFt)
      )
    })
    if (withSignal.length === 1) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: withSignal[0]!,
        confidence: 0.91,
        reason: 'Absa investment: amount + payee/ref',
      })
      continue
    }
    if (candidates.length === 1 && withSignal.length === 0) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: candidates[0]!,
        confidence: 0.84,
        reason: 'Absa investment: unique amount',
      })
    }
  }
  return dedupeSuggestions(suggestions)
}

export function suggestAbsaEboxCreditMatches(
  receipts: Tx[],
  credits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of receipts) {
    if (matchedCashBookIds.has(cb.id)) continue
    const candidates = credits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        ABSA_EBOX_RE.test(txText(bk)) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance)
    )
    const withPayee = candidates.filter((bk) => payeeScore(cb, bk) >= 0.3)
    if (withPayee.length === 1) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: withPayee[0]!,
        confidence: 0.9,
        reason: 'Absa EBOX: amount + payee',
      })
      continue
    }
    if (candidates.length === 1 && withPayee.length === 0) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: candidates[0]!,
        confidence: 0.84,
        reason: 'Absa EBOX: unique amount',
      })
    }
  }
  return dedupeSuggestions(suggestions)
}

export function suggestAbsaFtMatches(
  cashBookTxs: Tx[],
  bankTxs: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of cashBookTxs) {
    if (matchedCashBookIds.has(cb.id)) continue
    const cbFt = extractFtRef(cb)
    if (!cbFt) continue
    const candidates = bankTxs.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        ABSA_FT_RE.test(txText(bk)) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance) &&
        extractFtRef(bk) === cbFt
    )
    if (candidates.length !== 1) continue
    suggestions.push({
      cashBookTx: cb,
      bankTx: candidates[0]!,
      confidence: 0.92,
      reason: 'Absa FT: FT ref + amount',
    })
  }
  return dedupeSuggestions(suggestions)
}

// ─── Bank of Africa ──────────────────────────────────────────────────────────

export function suggestBoaInwardChequeMatches(
  payments: Tx[],
  debits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of payments) {
    if (matchedCashBookIds.has(cb.id)) continue
    const cbRef = extractGhanaChequeRef(cb)
    if (!cbRef) continue
    const candidates = debits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        BOA_CHECK_PAID_RE.test(txText(bk)) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance) &&
        refsLink(cb, bk)
    )
    if (candidates.length !== 1) continue
    suggestions.push({
      cashBookTx: cb,
      bankTx: candidates[0]!,
      confidence: 0.92,
      reason: 'BOA inward cheque: chq/ref + amount',
    })
  }
  return dedupeSuggestions(suggestions)
}

export function suggestBoaCashDepositMatches(
  receipts: Tx[],
  credits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of receipts) {
    if (matchedCashBookIds.has(cb.id)) continue
    const candidates = credits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        BOA_CASH_DEPOSIT_RE.test(txText(bk)) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance)
    )
    const withPayee = candidates.filter((bk) => payeeScore(cb, bk) >= 0.3)
    if (withPayee.length === 1) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: withPayee[0]!,
        confidence: 0.91,
        reason: 'BOA cash deposit: amount + payee',
      })
      continue
    }
    if (candidates.length === 1 && withPayee.length === 0) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: candidates[0]!,
        confidence: 0.84,
        reason: 'BOA cash deposit: unique amount',
      })
    }
  }
  return dedupeSuggestions(suggestions)
}

export function suggestBoaMaturityMatches(
  receipts: Tx[],
  credits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of receipts) {
    if (matchedCashBookIds.has(cb.id)) continue
    const cbRef = extractBoaOurRef(cb)
    const candidates = credits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        BOA_MATURITY_RE.test(txText(bk)) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance)
    )
    const withRef = cbRef
      ? candidates.filter((bk) => {
          const bkRef = extractBoaOurRef(bk)
          return bkRef && normalizeRefToken(bkRef) === normalizeRefToken(cbRef)
        })
      : []
    if (withRef.length === 1) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: withRef[0]!,
        confidence: 0.92,
        reason: 'BOA maturity: ref + amount',
      })
      continue
    }
    const withPayee = candidates.filter((bk) => payeeScore(cb, bk) >= 0.3)
    if (withPayee.length === 1) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: withPayee[0]!,
        confidence: 0.9,
        reason: 'BOA maturity: amount + payee',
      })
      continue
    }
    if (candidates.length === 1) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: candidates[0]!,
        confidence: 0.84,
        reason: 'BOA maturity: unique amount',
      })
    }
  }
  return dedupeSuggestions(suggestions)
}

export function suggestBoaInterestMatches(
  receipts: Tx[],
  credits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of receipts) {
    if (matchedCashBookIds.has(cb.id)) continue
    const candidates = credits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        BOA_INTEREST_RE.test(txText(bk)) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance)
    )
    const withPayee = candidates.filter((bk) => payeeScore(cb, bk) >= 0.3)
    if (withPayee.length === 1) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: withPayee[0]!,
        confidence: 0.9,
        reason: 'BOA interest: amount + payee',
      })
      continue
    }
    if (candidates.length === 1) {
      suggestions.push({
        cashBookTx: cb,
        bankTx: candidates[0]!,
        confidence: 0.84,
        reason: 'BOA interest: unique amount',
      })
    }
  }
  return dedupeSuggestions(suggestions)
}

export function mergeGhanaRegionalPaymentSuggestions(
  ...lists: SuggestedMatch[][]
): SuggestedMatch[] {
  return mergeReceiptSuggestions(...lists)
}

export function mergeGhanaRegionalReceiptSuggestions(
  ...lists: SuggestedMatch[][]
): SuggestedMatch[] {
  return mergeReceiptSuggestions(...lists)
}
