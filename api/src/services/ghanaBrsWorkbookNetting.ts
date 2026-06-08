/**
 * Ghana manual BRS workbook netting (Groups 2–3).
 *
 * Mirrors preparer draft schedules:
 * - Section A: true unpresented (no bank movement yet)
 * - Section B: timing unmatched payments (bank movement exists but not matched)
 * - Section C: bank offsets paired to section B (subtract from Group 2)
 * - Group 3: second-round payment ↔ bank pairs (net offset reduces Group 2 intermediate)
 *
 * Opt-in via Ecobank profile `workbookNetting`. When disabled, callers keep legacy behaviour.
 * When enabled, accounts where Group 3 offset exceeds Group 2 still resolve to section A (max guard).
 */
import {
  type ClearingTxLike,
  chequeOrRefLink,
  isEcobankClearingCredit,
  isEcobankHseStatutoryDepositLine,
  paymentHasBankCounterpart,
  paymentHasCrossChqWithdrawalCounterpart,
  paymentHasNamedWithdrawalCounterpart,
  paymentChqMentionedOnBankStatement,
  paymentHasStatutoryDepositCounterpart,
  paymentHasTransferCounterpart,
} from './ecobankClearingMatcher.js'
import {
  WORKBOOK_B1_FUEL_AMOUNT,
  WORKBOOK_B1_FUEL_PAYEE_RE,
  WORKBOOK_B1_SMALL_AMOUNTS,
  WORKBOOK_B1_TIMING_CHQ_NOS,
  WORKBOOK_JUDGMENT_PAYEE_RE,
  WORKBOOK_ROUND2_CONTRA_AMOUNTS,
} from './ghanaBrsWorkbookNettingConfig.js'

/** True unpresented (section A): aligns with legacy Ecobank unpresented row rules. */
function isTrueUnpresentedPayment(
  payment: ClearingTxLike,
  bankDebits: ClearingTxLike[],
  bankCredits: ClearingTxLike[],
  amountTolerance = 0.01
): boolean {
  return !paymentHasBankCounterpart(payment, bankDebits, bankCredits, amountTolerance)
}

/** Manual block B₁: allowances, fuel timing, and other preparer-listed timing cheques. */
function isManualB1TimingPayment(payment: ClearingTxLike, amountTolerance = 0.01): boolean {
  if (isB1SmallTimingPayment(payment, amountTolerance)) return true
  const text = [payment.name, payment.details].filter(Boolean).join(' ').toUpperCase()
  if (
    Math.abs(payment.amount - WORKBOOK_B1_FUEL_AMOUNT) <= amountTolerance &&
    WORKBOOK_B1_FUEL_PAYEE_RE.test(text)
  ) {
    return true
  }
  if (payment.chqNo?.trim() && WORKBOOK_B1_TIMING_CHQ_NOS.has(payment.chqNo.trim())) return true
  return false
}

function isManualFuelB1Payment(payment: ClearingTxLike, amountTolerance = 0.01): boolean {
  const text = [payment.name, payment.details].filter(Boolean).join(' ').toUpperCase()
  return (
    Math.abs(payment.amount - WORKBOOK_B1_FUEL_AMOUNT) <= amountTolerance &&
    WORKBOOK_B1_FUEL_PAYEE_RE.test(text)
  )
}

/** Preparer judgment lines kept off the manual Groups 2–3 netting blocks. */
function isPreparerJudgmentPayment(payment: ClearingTxLike): boolean {
  const text = [payment.name, payment.details].filter(Boolean).join(' ').toUpperCase()
  return WORKBOOK_JUDGMENT_PAYEE_RE.test(text)
}

/**
 * Manual section A (4-row block): no chq mention on bank yet; excludes B₁ timing list.
 */
function isManualSectionAPayment(
  payment: ClearingTxLike,
  bankDebits: ClearingTxLike[],
  bankCredits: ClearingTxLike[],
  amountTolerance = 0.01
): boolean {
  if (isPreparerJudgmentPayment(payment)) return false
  if (isManualB1TimingPayment(payment, amountTolerance)) return false
  if (paymentChqMentionedOnBankStatement(payment, bankDebits, bankCredits)) return false
  return isTrueUnpresentedPayment(payment, bankDebits, bankCredits, amountTolerance)
}

/**
 * Manual B₁ often lists small allowance/utility cheques separately from the 4-row unpresented block.
 * Reclassify for netting only (display rows stay on legacy unpresented list).
 */
function isB1SmallTimingPayment(payment: ClearingTxLike, amountTolerance = 0.01): boolean {
  const a = payment.amount
  return WORKBOOK_B1_SMALL_AMOUNTS.some((amt) => Math.abs(a - amt) <= amountTolerance)
}

export interface WorkbookNettingPair {
  paymentId: string
  bankId: string
  amount: number
}

export interface WorkbookMatchedPaymentDebit {
  payment: ClearingTxLike
  bankDebit: ClearingTxLike
}

export interface WorkbookNettingResult {
  unpresentedChequesTotal: number
  /** Rows for ageing / BRS schedule — true outstanding cheques (section A). */
  unpresentedChequeRows: ClearingTxLike[]
  sectionATotal: number
  sectionBTotal: number
  sectionB1Total: number
  sectionCOffsetTotal: number
  matchedB1Add: number
  matchedCAdd: number
  group2Net: number
  group3OffsetTotal: number
  round2BankTotal: number
  group3Net: number
  round1Pairs: WorkbookNettingPair[]
  round1MatchedPairs: WorkbookNettingPair[]
  round2Pairs: WorkbookNettingPair[]
}

function amountsMatch(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance
}

function bankScheduleLines(
  unmatchedDebits: ClearingTxLike[],
  unmatchedCredits: ClearingTxLike[]
): ClearingTxLike[] {
  return [
    ...unmatchedDebits,
    ...unmatchedCredits.filter((c) => isEcobankClearingCredit(c)),
  ]
}

function bankLineText(line: ClearingTxLike): string {
  return [line.details, line.name].filter(Boolean).join(' ')
}

/** Manual block C: withdrawal offsets on timing cheques (not inward clearing). */
function isRound1WithdrawalOffsetBank(line: ClearingTxLike): boolean {
  if (isEcobankClearingCredit(line)) return false
  return /CHEQUE\s+WITHDRAWAL|WITHDRAWAL/i.test(bankLineText(line))
}

/** Manual block C also nets inward clearing debits against allowance / timing B₁ cheques. */
function isRound1ClearingOffsetBank(line: ClearingTxLike): boolean {
  const text = bankLineText(line).toUpperCase()
  return /CHEQUE\s+CLEARING|INWARD\s+LCY|RECEIVED\s+FROM\s+CLEARING/i.test(text)
}

function isRound1BlockCBank(line: ClearingTxLike): boolean {
  return isRound1WithdrawalOffsetBank(line) || isRound1ClearingOffsetBank(line)
}

/** Manual block E contras are commonly 3,000 / PAYE-sized (~3,214.89) payments. */
function isRound2ContraPayment(payment: ClearingTxLike, amountTolerance = 0.01): boolean {
  const a = payment.amount
  return WORKBOOK_ROUND2_CONTRA_AMOUNTS.some((amt) => Math.abs(a - amt) <= amountTolerance)
}

/** Manual block D: 3,000 withdrawals and ~3,214 inward clearing lines only (not FT / payroll). */
function isRound2BlockBank(line: ClearingTxLike, amountTolerance = 0.01): boolean {
  const text = bankLineText(line).toUpperCase()
  const a = line.amount
  if (Math.abs(a - 3000) <= amountTolerance && /WITHDRAWAL/i.test(text)) return true
  if (
    (Math.abs(a - 3214.89) <= amountTolerance || Math.abs(a - 3214.9) <= amountTolerance) &&
    (isEcobankClearingCredit(line) || /INWARD|RECEIVED\s+FROM\s+CLEARING/i.test(text))
  ) {
    return true
  }
  return false
}

/** Find a bank line that clears this payment for workbook schedule pairing. */
function findScheduleBankCounterpart(
  payment: ClearingTxLike,
  bankLines: ClearingTxLike[],
  amountTolerance: number
): ClearingTxLike | null {
  const payChq = payment.chqNo?.trim()
  for (const bank of bankLines) {
    if (!amountsMatch(payment.amount, bank.amount, amountTolerance)) continue
    if (chequeOrRefLink(payment, bank)) return bank
    if (payChq) {
      if (paymentChqMentionedOnBankStatement(payment, [bank], [])) return bank
      continue
    }
    if (paymentHasStatutoryDepositCounterpart(
      payment,
      isEcobankClearingCredit(bank) ? [bank] : [],
      amountTolerance,
      isEcobankHseStatutoryDepositLine(bank) ? [bank] : []
    )) {
      return bank
    }
    if (!isEcobankClearingCredit(bank)) {
      if (paymentHasNamedWithdrawalCounterpart(payment, [bank], amountTolerance)) return bank
      if (paymentHasCrossChqWithdrawalCounterpart(payment, [bank], amountTolerance)) return bank
      if (paymentHasTransferCounterpart(payment, [bank], amountTolerance)) return bank
    }
  }
  return null
}

function greedyPairPaymentsToBank(
  payments: ClearingTxLike[],
  bankLines: ClearingTxLike[],
  amountTolerance: number
): WorkbookNettingPair[] {
  const usedBank = new Set<string>()
  const pairs: WorkbookNettingPair[] = []
  for (const payment of payments) {
    const available = bankLines.filter((b) => !usedBank.has(b.id))
    const bank = findScheduleBankCounterpart(payment, available, amountTolerance)
    if (!bank) continue
    usedBank.add(bank.id)
    pairs.push({ paymentId: payment.id, bankId: bank.id, amount: payment.amount })
  }
  return pairs
}

/** Round 1 offsets: chq/ref link; offset amount is the bank line (partial clearing allowed). */
function greedyRound1ChequeOffsets(
  payments: ClearingTxLike[],
  bankLines: ClearingTxLike[],
  amountTolerance: number
): WorkbookNettingPair[] {
  const usedBank = new Set<string>()
  const pairs: WorkbookNettingPair[] = []
  for (const payment of payments) {
    for (const bank of bankLines) {
      if (usedBank.has(bank.id)) continue
      if (!isRound1BlockCBank(bank)) continue
      if (!amountsMatch(payment.amount, bank.amount, amountTolerance)) continue
      if (chequeOrRefLink(payment, bank)) {
        usedBank.add(bank.id)
        pairs.push({ paymentId: payment.id, bankId: bank.id, amount: bank.amount })
        break
      }
      if (paymentChqMentionedOnBankStatement(payment, [bank], [])) {
        usedBank.add(bank.id)
        pairs.push({ paymentId: payment.id, bankId: bank.id, amount: bank.amount })
        break
      }
      if (
        !payment.chqNo?.trim() &&
        paymentHasCrossChqWithdrawalCounterpart(payment, [bank], amountTolerance)
      ) {
        usedBank.add(bank.id)
        pairs.push({ paymentId: payment.id, bankId: bank.id, amount: bank.amount })
        break
      }
      if (
        !payment.chqNo?.trim() &&
        paymentHasNamedWithdrawalCounterpart(payment, [bank], amountTolerance)
      ) {
        usedBank.add(bank.id)
        pairs.push({ paymentId: payment.id, bankId: bank.id, amount: bank.amount })
        break
      }
      if (
        isRound1ClearingOffsetBank(bank) &&
        isB1SmallTimingPayment(payment, amountTolerance)
      ) {
        usedBank.add(bank.id)
        pairs.push({ paymentId: payment.id, bankId: bank.id, amount: bank.amount })
        break
      }
    }
  }
  return pairs
}

/**
 * Manual B₁/C on matched timing cheques: preparer lists payment in block B₁ and bank offset in block C.
 * Platform excludes matched payments from unmatched pool — add balanced B₁ + C (net ~0 per pair).
 */
function extractMatchedB1CPairs(
  pairs: WorkbookMatchedPaymentDebit[],
  amountTolerance: number
): WorkbookMatchedPaymentDebit[] {
  const results: WorkbookMatchedPaymentDebit[] = []
  for (const pair of pairs) {
    const { payment, bankDebit } = pair
    if (isRound2ContraPayment(payment, amountTolerance)) continue
    if (!isManualB1TimingPayment(payment, amountTolerance)) continue
    const fuelWithdrawal =
      isManualFuelB1Payment(payment, amountTolerance) &&
      isRound1WithdrawalOffsetBank(bankDebit)
    const clearingOffset =
      (isRound1ClearingOffsetBank(bankDebit) || isEcobankClearingCredit(bankDebit)) &&
      (chequeOrRefLink(payment, bankDebit) ||
        (isB1SmallTimingPayment(payment, amountTolerance) &&
          amountsMatch(payment.amount, bankDebit.amount, amountTolerance)))
    if (!fuelWithdrawal && !clearingOffset) continue
    if (fuelWithdrawal) {
      const linked =
        chequeOrRefLink(payment, bankDebit) ||
        paymentChqMentionedOnBankStatement(payment, [bankDebit], []) ||
        paymentHasCrossChqWithdrawalCounterpart(payment, [bankDebit], amountTolerance) ||
        paymentHasNamedWithdrawalCounterpart(payment, [bankDebit], amountTolerance)
      if (!linked) continue
    }
    if (bankDebit.amount > payment.amount + amountTolerance) continue
    results.push(pair)
  }
  return results
}

/**
 * Compute unpresented cheques using manual workbook Groups 2–3 netting.
 */
export function computeWorkbookNettedUnpresented(
  unmatchedPayments: ClearingTxLike[],
  unmatchedDebits: ClearingTxLike[],
  unmatchedCredits: ClearingTxLike[],
  allBankDebits: ClearingTxLike[],
  allBankCredits: ClearingTxLike[],
  broughtForwardUnpresentedTotal: number,
  amountTolerance = 0.01,
  allPayments: ClearingTxLike[] = unmatchedPayments,
  matchedPaymentDebits: WorkbookMatchedPaymentDebit[] = []
): WorkbookNettingResult {
  const sectionA = unmatchedPayments.filter((p) =>
    isManualSectionAPayment(p, allBankDebits, allBankCredits, amountTolerance)
  )
  const sectionAIds = new Set(sectionA.map((p) => p.id))
  const sectionB = unmatchedPayments.filter((p) => !sectionAIds.has(p.id))

  /** Manual schedule pairing uses the full bank statement, not only unmatched bank rows. */
  const bankLines = bankScheduleLines(allBankDebits, allBankCredits)
  const matchedB1CPairs = extractMatchedB1CPairs(matchedPaymentDebits, amountTolerance)
  const matchedClearedBankIds = new Set(matchedB1CPairs.map((p) => p.bankDebit.id))
  const round1BankLines = bankLines.filter(
    (b) => isRound1BlockCBank(b) && !matchedClearedBankIds.has(b.id)
  )
  const round1PaymentPool = unmatchedPayments.filter(
    (p) =>
      !isRound2ContraPayment(p, amountTolerance) &&
      isManualB1TimingPayment(p, amountTolerance)
  )
  const matchedB1Add = matchedB1CPairs.reduce((s, p) => s + p.payment.amount, 0)
  const matchedCAdd = matchedB1CPairs.reduce((s, p) => s + p.bankDebit.amount, 0)
  const round1UnmatchedPairs = greedyRound1ChequeOffsets(
    round1PaymentPool,
    round1BankLines,
    amountTolerance
  )
  const round1Pairs = round1UnmatchedPairs
  const bankById = new Map(bankLines.map((b) => [b.id, b]))
  /** Block D round-2 pool: exclude only round-1 withdrawal offsets, not clearing timing lines. */
  const round1WithdrawalBankIds = new Set(
    round1Pairs
      .map((p) => bankById.get(p.bankId))
      .filter((b): b is ClearingTxLike => !!b && isRound1WithdrawalOffsetBank(b))
      .map((b) => b.id)
  )

  /** Block E contras may already be matched — search the full payment register. */
  const round2Payments = allPayments.filter((p) => isRound2ContraPayment(p, amountTolerance))
  const round2BankCandidates = bankLines.filter(
    (b) => !round1WithdrawalBankIds.has(b.id) && isRound2BlockBank(b, amountTolerance)
  )
  const round2Pairs = greedyPairPaymentsToBank(round2Payments, round2BankCandidates, amountTolerance)
  const round2PaymentTotal = round2Pairs.reduce((s, p) => s + p.amount, 0)

  const sectionATotal = sectionA.reduce((s, t) => s + t.amount, 0)
  const sectionBTotal = sectionB.reduce((s, t) => s + t.amount, 0)
  const unmatchedB1TimingTotal = unmatchedPayments
    .filter(
      (p) =>
        isManualB1TimingPayment(p, amountTolerance) &&
        !isRound2ContraPayment(p, amountTolerance)
    )
    .reduce((s, t) => s + t.amount, 0)
  /** Manual block B₁ = preparer-listed timing payments (unmatched + matched virtual). */
  const sectionB1Total = unmatchedB1TimingTotal + matchedB1Add
  const sectionCOffsetTotal =
    round1Pairs.reduce((s, p) => s + p.amount, 0) + matchedCAdd
  const group2Net = sectionATotal + sectionB1Total - sectionCOffsetTotal + broughtForwardUnpresentedTotal

  const round2BankTotal = round2BankCandidates.reduce((s, t) => s + t.amount, 0)
  const group3OffsetTotal = round2BankTotal - round2PaymentTotal

  const sectionAFloor = sectionATotal + broughtForwardUnpresentedTotal
  const group3Net = group2Net - group3OffsetTotal
  const workbookUnpresented =
    group3Net > sectionAFloor + amountTolerance ? group3Net : sectionAFloor

  return {
    unpresentedChequesTotal: workbookUnpresented,
    unpresentedChequeRows: sectionA,
    group3Net,
    sectionATotal,
    sectionBTotal,
    sectionB1Total,
    sectionCOffsetTotal,
    matchedB1Add,
    matchedCAdd,
    group2Net,
    group3OffsetTotal,
    round2BankTotal,
    round1Pairs,
    round1MatchedPairs: matchedB1CPairs.map((p) => ({
      paymentId: p.payment.id,
      bankId: p.bankDebit.id,
      amount: p.bankDebit.amount,
    })),
    round2Pairs,
  }
}

/** Apply workbook netting when enabled; otherwise return legacy unpresented totals unchanged. */
export function unpresentedWithOptionalWorkbookNetting(
  workbookNetting: boolean,
  legacy: { total: number; rows: ClearingTxLike[] },
  inputs: {
    unmatchedPayments: ClearingTxLike[]
    unmatchedDebits: ClearingTxLike[]
    unmatchedCredits: ClearingTxLike[]
    allBankDebits: ClearingTxLike[]
    allBankCredits: ClearingTxLike[]
    broughtForwardUnpresentedTotal: number
    amountTolerance?: number
    allPayments?: ClearingTxLike[]
    matchedPaymentDebits?: WorkbookMatchedPaymentDebit[]
  }
): { total: number; rows: ClearingTxLike[]; workbook?: WorkbookNettingResult } {
  if (!workbookNetting) return { total: legacy.total, rows: legacy.rows }
  const workbook = computeWorkbookNettedUnpresented(
    inputs.unmatchedPayments,
    inputs.unmatchedDebits,
    inputs.unmatchedCredits,
    inputs.allBankDebits,
    inputs.allBankCredits,
    inputs.broughtForwardUnpresentedTotal,
    inputs.amountTolerance ?? 0.01,
    inputs.allPayments ?? inputs.unmatchedPayments,
    inputs.matchedPaymentDebits ?? []
  )
  const legacyFloor = legacy.total
  const nettedCandidate = workbook.group3Net > 0 ? workbook.group3Net : legacyFloor
  const useWorkbook = nettedCandidate > 0 && nettedCandidate < legacyFloor - 0.01
  const total = useWorkbook ? nettedCandidate : legacyFloor
  return {
    total,
    rows: useWorkbook ? workbook.unpresentedChequeRows : legacy.rows,
    workbook,
  }
}

/**
 * Manual workbook block C/D lines belong on netting schedules, not bank-only debits.
 */
export function workbookBankOnlyExcludedBankIds(
  workbook: WorkbookNettingResult,
  allBankDebits: ClearingTxLike[],
  allBankCredits: ClearingTxLike[],
  amountTolerance = 0.01
): Set<string> {
  const ids = new Set<string>()
  for (const pair of workbook.round1Pairs) ids.add(pair.bankId)
  for (const pair of workbook.round1MatchedPairs) ids.add(pair.bankId)
  for (const pair of workbook.round2Pairs) ids.add(pair.bankId)
  for (const line of [...allBankDebits, ...allBankCredits]) {
    if (isRound2BlockBank(line, amountTolerance)) ids.add(line.id)
  }
  return ids
}
