/**
 * Ghana Ecobank BRS payment groupings — permanent classification for Face (√) vs Working (??).
 *
 * Preparer workbooks use two consistent schedules:
 * - Face (√): Groups 2–3 netting → signed unpresented + bank-only debits
 * - Working (??): section A + open timing (B₁) with companion bank-only shift
 *
 * Matching should clear `**` pairs (cheque clearing / named withdrawal). Remaining open
 * timing stays in Working unpresented. Judgment payees stay off both unpresented lines.
 */
import type { ClearingTxLike } from './ecobankClearingMatcher.js'
import { paymentChqMentionedOnBankStatement, paymentHasBankCounterpart } from './ecobankClearingMatcher.js'
import {
  WORKBOOK_B1_FUEL_AMOUNT,
  WORKBOOK_B1_FUEL_PAYEE_RE,
  WORKBOOK_B1_SMALL_AMOUNTS,
  WORKBOOK_B1_TIMING_CHQ_NOS,
  WORKBOOK_B1_TIMING_PAYEE_RE,
  WORKBOOK_JUDGMENT_PAYEE_RE,
  WORKBOOK_ROUND2_CONTRA_AMOUNTS,
  WORKBOOK_WORKING_CLEARING_AMOUNTS,
  WORKBOOK_WORKING_CLEARING_BANK_RE,
  WORKBOOK_WORKING_CLEARING_PAYEE_RE,
} from './ghanaBrsWorkbookNettingConfig.js'

export type GhanaBrsPaymentGroup =
  | 'section_a'
  | 'timing_open'
  | 'timing_bank_linked'
  | 'round2_contra'
  | 'judgment'
  | 'other'

export const GHANA_BRS_GROUP_MEANING: Record<
  GhanaBrsPaymentGroup,
  { label: string; meaning: string; inWorkingUnpresented: boolean; faceRole: string }
> = {
  section_a: {
    label: 'True unpresented (A)',
    meaning: 'Cheque not yet on the bank statement — stays outstanding on both Face and Working.',
    inWorkingUnpresented: true,
    faceRole: 'Core Face unpresented; Groups 2–3 start from this floor',
  },
  timing_open: {
    label: 'Open timing (B₁)',
    meaning:
      'Recurring operating cheques (board/security/fuel/staff loan style) still unmatched. Working (??) adds these to unpresented; Face nets them through Groups 2–3.',
    inWorkingUnpresented: true,
    faceRole: 'Enter Group 2 as B₁, then offset by bank clearing/withdrawals',
  },
  timing_bank_linked: {
    label: 'Cleared timing (**)',
    meaning:
      'Same timing class, but cheque already appears on the bank (clearing/withdrawal). Preparer marks ** — exclude from open unpresented after pairing.',
    inWorkingUnpresented: false,
    faceRole: 'Section C / matched B₁ offsets',
  },
  round2_contra: {
    label: 'Round-2 contra',
    meaning: 'Fixed-pattern staff/statutory contras (e.g. 3,000 / SSNIT-style) used in Group 3 netting.',
    inWorkingUnpresented: false,
    faceRole: 'Group 3 payment offsets',
  },
  judgment: {
    label: 'Judgment / other schedule',
    meaning: 'Tax, utility, and similar lines the preparer keeps off the unpresented TOTAL columns.',
    inWorkingUnpresented: false,
    faceRole: 'Out of Groups 2–3 unpresented',
  },
  other: {
    label: 'Other unmatched',
    meaning: 'Unmatched payment that did not fit A / B₁ / contra / judgment rules — review manually.',
    inWorkingUnpresented: false,
    faceRole: 'Usually absorbed into legacy unpresented or bank-only analysis',
  },
}

export function paymentText(payment: ClearingTxLike): string {
  return [payment.name, payment.details].filter(Boolean).join(' ').toUpperCase()
}

export function isPreparerJudgmentPayment(payment: ClearingTxLike): boolean {
  return WORKBOOK_JUDGMENT_PAYEE_RE.test(paymentText(payment))
}

export function isRound2ContraPayment(payment: ClearingTxLike, amountTolerance = 0.01): boolean {
  return WORKBOOK_ROUND2_CONTRA_AMOUNTS.some((amt) => Math.abs(payment.amount - amt) <= amountTolerance)
}

export function isB1SmallTimingPayment(payment: ClearingTxLike, amountTolerance = 0.01): boolean {
  return WORKBOOK_B1_SMALL_AMOUNTS.some((amt) => Math.abs(payment.amount - amt) <= amountTolerance)
}

/** Manual / generalisable B₁ timing: payee patterns, fuel, small recurring amounts, listed chqs. */
export function isManualB1TimingPayment(payment: ClearingTxLike, amountTolerance = 0.01): boolean {
  if (isB1SmallTimingPayment(payment, amountTolerance)) return true
  const text = paymentText(payment)
  if (WORKBOOK_B1_TIMING_PAYEE_RE.test(text)) return true
  if (
    Math.abs(payment.amount - WORKBOOK_B1_FUEL_AMOUNT) <= amountTolerance &&
    WORKBOOK_B1_FUEL_PAYEE_RE.test(text)
  ) {
    return true
  }
  if (payment.chqNo?.trim() && WORKBOOK_B1_TIMING_CHQ_NOS.has(payment.chqNo.trim())) return true
  return false
}

export function isTrueUnpresentedPayment(
  payment: ClearingTxLike,
  bankDebits: ClearingTxLike[],
  bankCredits: ClearingTxLike[],
  amountTolerance = 0.01
): boolean {
  return !paymentHasBankCounterpart(payment, bankDebits, bankCredits, amountTolerance)
}

export function isManualSectionAPayment(
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
 * Classify one unmatched cash-book payment for Ghana BRS schedules.
 * Bank-linked timing (** path) = B₁-class with cheque already on the bank statement.
 */
export function classifyGhanaBrsPayment(
  payment: ClearingTxLike,
  bankDebits: ClearingTxLike[],
  bankCredits: ClearingTxLike[],
  amountTolerance = 0.01
): GhanaBrsPaymentGroup {
  if (isPreparerJudgmentPayment(payment)) return 'judgment'
  if (isRound2ContraPayment(payment, amountTolerance)) return 'round2_contra'
  if (isManualSectionAPayment(payment, bankDebits, bankCredits, amountTolerance)) return 'section_a'
  if (isManualB1TimingPayment(payment, amountTolerance)) {
    // Preparer ** = this cheque appears on the bank — not a mere same-amount counterpart.
    const linked = paymentChqMentionedOnBankStatement(payment, bankDebits, bankCredits)
    return linked ? 'timing_bank_linked' : 'timing_open'
  }
  return 'other'
}

export interface GhanaBrsGroupBucket {
  group: GhanaBrsPaymentGroup
  label: string
  meaning: string
  inWorkingUnpresented: boolean
  faceRole: string
  count: number
  total: number
  sampleChqNos: string[]
}

export interface GhanaBrsPaymentGroupsSummary {
  buckets: GhanaBrsGroupBucket[]
  workingUnpresentedTotal: number
  sectionATotal: number
  openTimingTotal: number
  /** Explains √ vs ?? in one sentence for UI. */
  scheduleExplanation: string
}

export function summarizeGhanaBrsPaymentGroups(
  unmatchedPayments: ClearingTxLike[],
  bankDebits: ClearingTxLike[],
  bankCredits: ClearingTxLike[],
  amountTolerance = 0.01
): GhanaBrsPaymentGroupsSummary {
  const byGroup = new Map<GhanaBrsPaymentGroup, ClearingTxLike[]>()
  for (const p of unmatchedPayments) {
    const g = classifyGhanaBrsPayment(p, bankDebits, bankCredits, amountTolerance)
    const list = byGroup.get(g) || []
    list.push(p)
    byGroup.set(g, list)
  }

  const order: GhanaBrsPaymentGroup[] = [
    'section_a',
    'timing_open',
    'timing_bank_linked',
    'round2_contra',
    'judgment',
    'other',
  ]

  const buckets: GhanaBrsGroupBucket[] = order
    .map((group) => {
      const rows = byGroup.get(group) || []
      const meta = GHANA_BRS_GROUP_MEANING[group]
      return {
        group,
        label: meta.label,
        meaning: meta.meaning,
        inWorkingUnpresented: meta.inWorkingUnpresented,
        faceRole: meta.faceRole,
        count: rows.length,
        total: rows.reduce((s, t) => s + t.amount, 0),
        sampleChqNos: rows
          .map((r) => r.chqNo?.trim())
          .filter((c): c is string => !!c)
          .slice(0, 6),
      }
    })
    .filter((b) => b.count > 0)

  const sectionATotal = buckets.find((b) => b.group === 'section_a')?.total ?? 0
  const openTimingTotal = buckets.find((b) => b.group === 'timing_open')?.total ?? 0
  const workingUnpresentedTotal = sectionATotal + openTimingTotal

  return {
    buckets,
    workingUnpresentedTotal,
    sectionATotal,
    openTimingTotal,
    scheduleExplanation:
      'Working (??) unpresented = true unpresented (A) + open timing (B₁). Face (√) continues Groups 2–3 netting so both unpresented and bank-only debits move together and still tie to cash book.',
  }
}

export interface WorkingClearingOffset {
  paymentId: string
  bankId: string
  amount: number
  chqNo: string | null
}

/**
 * Account902-style Working (??) unpresented when A+B₁ is empty:
 * Face unpresented + matched finders/IBAG/Helina payments cleared via HSE/inward clearing.
 */
export function computeWorkingPaperFromClearingOffsets(
  faceUnpresentedTotal: number,
  faceUnpresentedRows: ClearingTxLike[],
  matchedPaymentDebits: Array<{ payment: ClearingTxLike; bankDebit: ClearingTxLike }>,
  amountTolerance = 0.01
): {
  unpresentedChequesTotal: number
  sectionATotal: number
  openB1Total: number
  clearingOffsetTotal: number
  sectionARows: ClearingTxLike[]
  openB1Rows: ClearingTxLike[]
  offsets: WorkingClearingOffset[]
} {
  const offsets: WorkingClearingOffset[] = []
  const seenPay = new Set<string>()
  for (const { payment, bankDebit } of matchedPaymentDebits) {
    if (seenPay.has(payment.id)) continue
    const payText = paymentText(payment)
    const bankText = [bankDebit.name, bankDebit.details].filter(Boolean).join(' ')
    if (!WORKBOOK_WORKING_CLEARING_PAYEE_RE.test(payText)) continue
    if (!WORKBOOK_WORKING_CLEARING_BANK_RE.test(bankText)) continue
    if (Math.abs(payment.amount - bankDebit.amount) > amountTolerance) continue
    const amountOk = WORKBOOK_WORKING_CLEARING_AMOUNTS.some(
      (amt) => Math.abs(payment.amount - amt) <= amountTolerance
    )
    if (!amountOk) continue
    seenPay.add(payment.id)
    offsets.push({
      paymentId: payment.id,
      bankId: bankDebit.id,
      amount: payment.amount,
      chqNo: payment.chqNo ?? null,
    })
  }
  const clearingOffsetTotal = offsets.reduce((s, o) => s + o.amount, 0)
  return {
    unpresentedChequesTotal: faceUnpresentedTotal + clearingOffsetTotal,
    sectionATotal: faceUnpresentedTotal,
    openB1Total: clearingOffsetTotal,
    clearingOffsetTotal,
    sectionARows: faceUnpresentedRows,
    openB1Rows: [],
    offsets,
  }
}
