/**
 * Server-side auto-complete matching: phased safe/pattern bulk apply + SCB residual passes.
 * Used by POST /reconcile/:projectId/match/auto-complete and mirrors integration-script orchestration.
 */
import { prisma } from '../lib/prisma.js'
import { BULK_MATCH_LIMIT, hasPlanFeature } from '../config/planFeatures.js'
import { getPlatformDefaults } from '../lib/platformDefaults.js'
import { resolveReconcileMaxLimit } from '../config/importLimits.js'
import { suggestMatches, type SuggestedMatch, type Tx } from './matching.js'
import { resolveMatchSides } from './sideInversion.js'
import {
  isEcobankPatternMatchReason,
  mergePaymentSuggestions,
  resolveEcobankGhanaProfileForScope,
  suggestEcobankClearingMatches,
  suggestEcobankPaymentDebitMatches,
  suggestEcobankStatutoryDepositMatches,
} from './ecobankClearingMatcher.js'
import {
  isScbPatternMatchReason,
  mergeReceiptSuggestions,
  mergeScbPaymentSuggestions,
  resolveScbProfile,
  scbClearingRefsConflict,
  suggestScbCashWithdrawalMatches,
  suggestScbChqRefDebitMatches,
  suggestScbInwardClearingFooterAmountMatches,
  suggestScbInwardClearingAlternateDebitMatches,
  suggestScbInwardClearingCrossRefMatches,
  suggestScbWithdrawnToInwClgMatches,
  suggestScbInwardClearingDebitMatches,
  suggestScbOtRefMatches,
  suggestScbReturnedChequeCreditMatches,
  suggestScbSweepMatches,
} from './scbSweepMatcher.js'
import { isGhanaRegionalPatternMatchReason } from './ghanaRegionalMatchers.js'
import {
  applyDuplicateWarnings,
  clearCorroboratedDuplicateWarnings,
} from './suggestionDuplicateFlags.js'
import {
  collectCorroboratedDuplicatePairs,
  collectScbResidualPairs,
  type ResidualMatchPair,
} from './scbResidualMatcher.js'
import { loadReconcileLane } from './reconcileTransactionLoad.js'
import {
  rememberOrganisationMatch,
  sideKindFromCashBookDocType,
} from './organizationMatchMemory.js'
import { logAudit } from './audit.js'
import { purgeOrphanMatches } from './purgeOrphanMatches.js'

const SCB_REASON_RE = /SCB sweep|SCB inward clearing|SCB returned cheque|ref shifted|via bank/i
const ECOBANK_REASON_RE =
  /Ecobank clearing|Ecobank transfer|Ecobank withdrawal|Ecobank statutory deposit/i
const REGIONAL_REASON_RE =
  /GCB cheque withdrawal|GCB cash deposit|GCB CHQ lodgement|NIB inward cheque|NIB cash deposit|NIB telex|Prudential inward clearing|Prudential cheque withdrawal|Prudential NRT|Prudential call\/credit|Absa investment|Absa EBOX|Absa FT|BOA inward cheque|BOA cash deposit|BOA maturity|BOA interest/i

function isPhaseBPatternReason(reason: string | undefined): boolean {
  const r = reason || ''
  return (
    isEcobankPatternMatchReason(r) ||
    isScbPatternMatchReason(r) ||
    isGhanaRegionalPatternMatchReason(r) ||
    SCB_REASON_RE.test(r) ||
    ECOBANK_REASON_RE.test(r) ||
    REGIONAL_REASON_RE.test(r)
  )
}

export type AutoCompleteOptions = {
  bankAccountId?: string
  useDate?: boolean
  useDocRef?: boolean
  useChequeNo?: boolean
  maxRounds?: number
  userId?: string
}

export type AutoCompleteResult = {
  created: number
  rounds: number
  phases: { A: number; B: number; C: number; residual: number }
}

function collectPhasedBulkMatches(
  suggestions: SuggestedMatch[],
  phase: 'A' | 'B' | 'C',
  limit = BULK_MATCH_LIMIT
): ResidualMatchPair[] {
  const minConf = phase === 'A' ? 0.9 : phase === 'B' ? 0.85 : 0.88
  const filtered =
    phase === 'B'
      ? suggestions.filter(
          (s) =>
            s.confidence >= minConf &&
            !s.duplicateWarning &&
            (isScbPatternMatchReason(s.reason) || isPhaseBPatternReason(s.reason))
        )
      : phase === 'C'
        ? suggestions.filter(
            (s) =>
              s.confidence >= minConf &&
              !s.duplicateWarning
          )
        : suggestions.filter((s) => s.confidence >= minConf && !s.duplicateWarning)

  const sorted = [...filtered].sort((a, b) => b.confidence - a.confidence)
  const usedCb = new Set<string>()
  const usedBank = new Set<string>()
  const pairs: ResidualMatchPair[] = []

  for (const s of sorted) {
    const cbId = s.cashBookTx.id
    const bankId = s.bankTx.id
    if (usedCb.has(cbId) || usedBank.has(bankId)) continue
    usedCb.add(cbId)
    usedBank.add(bankId)
    pairs.push({ cashBookTransactionId: cbId, bankTransactionId: bankId })
    if (pairs.length >= limit) break
  }
  return pairs
}

function buildAutoCompleteSuggestions(opts: {
  receiptsFull: Tx[]
  paymentsFull: Tx[]
  creditsFull: Tx[]
  debitsFull: Tx[]
  receiptBank: Tx[]
  paymentBank: Tx[]
  matchedCbIds: Set<string>
  matchedBankIds: Set<string>
  amountTolerance: number
  dateWindowDays: number
  clearingDateWindowDays: number
  scbActive: boolean
  ecobankActive: boolean
  useDate: boolean
  useDocRef: boolean
  useChequeNo: boolean
}): { receiptSuggestions: SuggestedMatch[]; paymentSuggestions: SuggestedMatch[] } {
  const {
    receiptsFull,
    paymentsFull,
    creditsFull,
    debitsFull,
    receiptBank,
    paymentBank,
    matchedCbIds,
    matchedBankIds,
    amountTolerance,
    clearingDateWindowDays,
    scbActive,
    ecobankActive,
    useDate,
    useDocRef,
    useChequeNo,
  } = opts

  const scbSweepSuggestions = scbActive
    ? suggestScbSweepMatches(receiptsFull, receiptBank, matchedCbIds, matchedBankIds, amountTolerance)
    : []
  const scbInwardClearingSuggestions = scbActive
    ? mergeScbPaymentSuggestions(
        suggestScbInwardClearingDebitMatches(
          paymentsFull,
          paymentBank,
          matchedCbIds,
          matchedBankIds,
          amountTolerance
        ),
        suggestScbInwardClearingCrossRefMatches(
          paymentsFull,
          paymentBank,
          matchedCbIds,
          matchedBankIds,
          amountTolerance
        ),
        suggestScbInwardClearingAlternateDebitMatches(
          paymentsFull,
          paymentBank,
          matchedCbIds,
          matchedBankIds,
          amountTolerance
        ),
        suggestScbInwardClearingFooterAmountMatches(
          paymentsFull,
          paymentBank,
          matchedCbIds,
          matchedBankIds,
          amountTolerance
        ),
        suggestScbWithdrawnToInwClgMatches(
          paymentsFull,
          paymentBank,
          matchedCbIds,
          matchedBankIds,
          amountTolerance
        )
      )
    : []
  const scbReturnedChequeSuggestions = scbActive
    ? suggestScbReturnedChequeCreditMatches(
        receiptsFull,
        receiptBank,
        matchedCbIds,
        matchedBankIds,
        amountTolerance
      )
    : []
  const scbPaymentExtras = scbActive
    ? mergeScbPaymentSuggestions(
        scbInwardClearingSuggestions,
        suggestScbCashWithdrawalMatches(
          paymentsFull,
          paymentBank,
          matchedCbIds,
          matchedBankIds,
          amountTolerance
        ),
        suggestScbChqRefDebitMatches(
          paymentsFull,
          paymentBank,
          matchedCbIds,
          matchedBankIds,
          amountTolerance
        ),
        suggestScbOtRefMatches(
          paymentsFull,
          paymentBank,
          matchedCbIds,
          matchedBankIds,
          amountTolerance
        )
      )
    : []

  const standardReceiptSuggestions = suggestMatches(
    receiptsFull,
    receiptBank,
    matchedCbIds,
    matchedBankIds,
    { amountTolerance, requireDateMatch: useDate, useDate, useDocRef, useChequeNo }
  )
  const standardPaymentSuggestions = suggestMatches(
    paymentsFull,
    paymentBank,
    matchedCbIds,
    matchedBankIds,
    {
      amountTolerance,
      requireDateMatch: useDate,
      requireRefForCheques: useDocRef || useChequeNo,
      useDate,
      useDocRef,
      useChequeNo,
    }
  ).filter((s) => !scbClearingRefsConflict(s.cashBookTx, s.bankTx))

  const receiptSuggestions = mergeReceiptSuggestions(
    scbSweepSuggestions,
    scbReturnedChequeSuggestions,
    standardReceiptSuggestions
  )

  const clearingPaymentSuggestions = ecobankActive
    ? suggestEcobankClearingMatches(paymentsFull, creditsFull, matchedCbIds, matchedBankIds, {
        amountTolerance,
        dateWindowDays: clearingDateWindowDays,
      })
    : []
  const ecobankPaymentDebitSuggestions = ecobankActive
    ? suggestEcobankPaymentDebitMatches(
        paymentsFull,
        paymentBank,
        matchedCbIds,
        matchedBankIds,
        amountTolerance
      )
    : []
  const statutoryDepositSuggestions = ecobankActive
    ? suggestEcobankStatutoryDepositMatches(
        paymentsFull,
        creditsFull,
        matchedCbIds,
        matchedBankIds,
        amountTolerance,
        debitsFull
      )
    : []

  let paymentSuggestions = standardPaymentSuggestions
  if (ecobankActive) {
    paymentSuggestions = mergePaymentSuggestions(
      mergePaymentSuggestions(clearingPaymentSuggestions, statutoryDepositSuggestions),
      mergePaymentSuggestions(ecobankPaymentDebitSuggestions, paymentSuggestions)
    )
  }
  if (scbActive) {
    paymentSuggestions = mergeScbPaymentSuggestions(scbPaymentExtras, paymentSuggestions)
  }

  applyDuplicateWarnings(receiptSuggestions)
  applyDuplicateWarnings(paymentSuggestions)
  clearCorroboratedDuplicateWarnings(receiptSuggestions)
  clearCorroboratedDuplicateWarnings(paymentSuggestions)

  return { receiptSuggestions, paymentSuggestions }
}

async function createBulkMatches(
  projectId: string,
  orgId: string,
  orgPlan: string,
  currency: string,
  pairs: ResidualMatchPair[]
): Promise<number> {
  if (!pairs.length) return 0

  const requestedTxIds = new Set<string>()
  for (const pair of pairs) {
    requestedTxIds.add(pair.cashBookTransactionId)
    requestedTxIds.add(pair.bankTransactionId)
  }

  const txRows = await prisma.transaction.findMany({
    where: { id: { in: Array.from(requestedTxIds) } },
    select: {
      id: true,
      amount: true,
      name: true,
      details: true,
      docRef: true,
      chqNo: true,
      document: { select: { projectId: true, type: true } },
    },
  })
  const txById = new Map(txRows.map((t) => [t.id, t]))
  const toCreate: { cbTx: (typeof txRows)[number]; bankTx: (typeof txRows)[number] }[] = []

  for (const pair of pairs) {
    const cbTx = txById.get(pair.cashBookTransactionId)
    const bankTx = txById.get(pair.bankTransactionId)
    if (!cbTx || !bankTx) continue
    if (cbTx.document.projectId !== projectId || bankTx.document.projectId !== projectId) continue
    toCreate.push({ cbTx, bankTx })
  }
  if (!toCreate.length) return 0

  const alreadyMatched = await prisma.matchItem.findMany({
    where: {
      transactionId: { in: Array.from(requestedTxIds) },
      match: { projectId },
    },
    select: { transactionId: true },
  })
  if (alreadyMatched.length > 0) return 0

  const shouldRemember = hasPlanFeature(orgPlan, 'ai_suggestions')
  const created = await prisma.$transaction(async (tx) => {
    let count = 0
    for (const { cbTx, bankTx } of toCreate) {
      await tx.match.create({
        data: {
          projectId,
          type: 'one_to_one',
          status: 'confirmed',
          confidence: 1,
          matchItems: {
            create: [
              { transactionId: cbTx.id, side: 'cash_book' },
              { transactionId: bankTx.id, side: 'bank' },
            ],
          },
        },
      })
      count++
      if (shouldRemember) {
        await rememberOrganisationMatch({
          organizationId: orgId,
          currency,
          sideKind: sideKindFromCashBookDocType(cbTx.document.type),
          cashBookTx: {
            amount: Number(cbTx.amount),
            name: cbTx.name,
            details: cbTx.details,
            docRef: cbTx.docRef,
            chqNo: cbTx.chqNo,
          },
          bankTx: {
            amount: Number(bankTx.amount),
            name: bankTx.name,
            details: bankTx.details,
            docRef: bankTx.docRef,
            chqNo: bankTx.chqNo,
          },
          db: tx,
          prune: false,
        }).catch(() => undefined)
      }
    }
    if (count > 0) {
      await tx.project.update({ where: { id: projectId }, data: { status: 'reconciling' } })
    }
    return count
  })

  return created
}

export async function runProjectAutoComplete(
  projectId: string,
  orgId: string,
  options: AutoCompleteOptions = {}
): Promise<AutoCompleteResult> {
  const useDate = options.useDate ?? true
  const useDocRef = options.useDocRef ?? true
  const useChequeNo = options.useChequeNo ?? true
  const maxRounds = options.maxRounds ?? 40
  const bankAccountId = options.bankAccountId

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
    include: {
      organization: { select: { plan: true } },
      bankAccounts: true,
      documents: { select: { id: true, type: true, bankAccountId: true } },
    },
  })
  if (!project) throw new Error('Project not found')

  await purgeOrphanMatches(projectId)

  const orgPlan = project.organization?.plan ?? 'basic'
  if (!hasPlanFeature(orgPlan, 'bulk_match')) {
    throw new Error('Bulk match requires Standard plan or higher.')
  }

  const platformDefaults = await getPlatformDefaults()
  const amountTolerance = platformDefaults.amountTolerance ?? 0.01
  const perCategory = Math.ceil(resolveReconcileMaxLimit() / 4)

  const receiptDocIds = project.documents.filter((d) => d.type === 'cash_book_receipts').map((d) => d.id)
  const paymentDocIds = project.documents.filter((d) => d.type === 'cash_book_payments').map((d) => d.id)
  const creditDocIds = project.documents
    .filter((d) => d.type === 'bank_credits' && (!bankAccountId || d.bankAccountId === bankAccountId))
    .map((d) => d.id)
  const debitDocIds = project.documents
    .filter((d) => d.type === 'bank_debits' && (!bankAccountId || d.bankAccountId === bankAccountId))
    .map((d) => d.id)

  const sampleBankTextPromise = prisma.transaction
    .findMany({
      where: { documentId: { in: [...creditDocIds, ...debitDocIds] } },
      take: 12,
      select: { details: true, name: true },
    })
    .then((rows) => rows.map((t) => [t.details, t.name].filter(Boolean).join(' ')).join('\n'))

  let totalCreated = 0
  let rounds = 0
  const phases = { A: 0, B: 0, C: 0, residual: 0 }

  for (let round = 0; round < maxRounds; round++) {
    const [rRecLane, rCredLane, rPayLane, rDebLane, sampleBankText, matchRows] = await Promise.all([
      loadReconcileLane({ documentIds: receiptDocIds, perCategory }),
      loadReconcileLane({ documentIds: creditDocIds, perCategory }),
      loadReconcileLane({ documentIds: paymentDocIds, perCategory }),
      loadReconcileLane({ documentIds: debitDocIds, perCategory }),
      sampleBankTextPromise,
      prisma.match.findMany({
        where: { projectId },
        include: { matchItems: true },
      }),
    ])

    const receiptsFull = rRecLane.full
    const paymentsFull = rPayLane.full
    const creditsFull = rCredLane.full
    const debitsFull = rDebLane.full

    const matchedCbIds = new Set<string>()
    const matchedBankIds = new Set<string>()
    for (const m of matchRows) {
      for (const mi of m.matchItems) {
        if (mi.side === 'cash_book') matchedCbIds.add(mi.transactionId)
        else matchedBankIds.add(mi.transactionId)
      }
    }

    const { inversion, receiptBank, paymentBank } = resolveMatchSides({
      receipts: receiptsFull,
      payments: paymentsFull,
      credits: creditsFull,
      debits: debitsFull,
    })

    const scbProfile = resolveScbProfile({
      bankAccounts: project.bankAccounts || [],
      bankAccountId,
      sampleBankText,
    })
    const ecobankProfile = resolveEcobankGhanaProfileForScope({
      bankAccounts: project.bankAccounts || [],
      bankAccountId,
      sampleBankText,
      workbookNetting: false,
    })
    const dateWindowDays = platformDefaults.dateWindowDays ?? 3
    const clearingDateWindowDays = ecobankProfile.active
      ? Math.max(dateWindowDays, ecobankProfile.clearingDateWindowDays)
      : dateWindowDays

    const { receiptSuggestions, paymentSuggestions } = buildAutoCompleteSuggestions({
      receiptsFull,
      paymentsFull,
      creditsFull,
      debitsFull,
      receiptBank,
      paymentBank,
      matchedCbIds,
      matchedBankIds,
      amountTolerance,
      dateWindowDays,
      clearingDateWindowDays,
      scbActive: scbProfile.active,
      ecobankActive: ecobankProfile.active,
      useDate,
      useDocRef,
      useChequeNo,
    })

    const allSuggestions = [...receiptSuggestions, ...paymentSuggestions]
    const roundPairs: ResidualMatchPair[] = []
    let phaseTag: keyof typeof phases = 'A'

    for (const phase of ['A', 'B', 'C'] as const) {
      const phasePairs = collectPhasedBulkMatches(allSuggestions, phase)
      if (phasePairs.length) {
        roundPairs.push(...phasePairs)
        phaseTag = phase
        break
      }
    }

    if (!roundPairs.length) {
      const corroborated = collectCorroboratedDuplicatePairs(
        allSuggestions.filter((s) => s.duplicateWarning),
        matchedCbIds,
        matchedBankIds
      )
      if (corroborated.length) {
        roundPairs.push(...corroborated.slice(0, BULK_MATCH_LIMIT))
        phaseTag = 'C'
      }
    }

    if (!roundPairs.length) {
      const residual = collectScbResidualPairs({
        receipts: receiptsFull,
        payments: paymentsFull,
        credits: creditsFull,
        debits: debitsFull,
        matchedCbIds,
        matchedBankIds,
        sideInverted: inversion.inverted,
        amountTolerance,
      })
      if (residual.length) {
        roundPairs.push(...residual.slice(0, BULK_MATCH_LIMIT))
        phaseTag = 'residual'
      }
    }

    if (!roundPairs.length) break

    const created = await createBulkMatches(
      projectId,
      orgId,
      orgPlan,
      project.currency || 'GHS',
      roundPairs.slice(0, BULK_MATCH_LIMIT)
    )
    if (!created) break

    totalCreated += created
    phases[phaseTag] += created
    rounds++
  }

  if (totalCreated > 0 && options.userId) {
    await logAudit({
      organizationId: orgId,
      userId: options.userId,
      projectId,
      action: 'match_auto_complete',
      details: { created: totalCreated, rounds, phases },
    })
  }

  return { created: totalCreated, rounds, phases }
}
