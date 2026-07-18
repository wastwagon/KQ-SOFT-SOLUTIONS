import { Router } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { resolveProjectId } from '../lib/project-resolve.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { canReconcile, isProjectEditable, PROJECT_LOCKED_ERROR } from '../lib/permissions.js'
import { hasPlanFeature, BULK_MATCH_LIMIT } from '../config/planFeatures.js'
import { suggestMatches, suggestSplitMatches, type Tx, type SuggestedSplitMatch } from '../services/matching.js'
import { resolveMatchSides } from '../services/sideInversion.js'
import {
  detectDuplicateChequePayments,
  isEcobankPatternMatchReason,
  mergePaymentSuggestions,
  resolveEcobankGhanaProfileForScope,
  resolveGhanaBankFormatLabel,
  suggestEcobankClearingMatches,
  suggestEcobankPaymentDebitMatches,
  suggestEcobankStatutoryDepositMatches,
} from '../services/ecobankClearingMatcher.js'
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
} from '../services/scbSweepMatcher.js'
import { getMatchingRule, type BankRule } from '../services/bankRules.js'
import {
  amountToMinor,
  applyOrganisationMatchMemoryBoost,
  applyOrganisationSplitMatchMemoryBoost,
  loadOrganisationMatchMemoriesBatch,
  pruneMatchMemoryIfOverCap,
  rememberOrganisationMatch,
  rememberOrganisationSplitMatch,
  sideKindFromCashBookDocType,
} from '../services/organizationMatchMemory.js'
import {
  countReconcileLanes,
  loadReconcileLane,
  loadTransactionsByIds,
} from '../services/reconcileTransactionLoad.js'
import { incOpsMetric } from '../lib/opsMetrics.js'
import { getPlatformDefaults } from '../lib/platformDefaults.js'
import { resolveWorkbookNetting } from '../lib/brsQueryFlags.js'
import { logAudit } from '../services/audit.js'
import { requireOrgSubscriptionForApp } from '../middleware/requireOrgSubscriptionForApp.js'
import { heavyOrgRouteLimiter } from '../middleware/heavyRouteLimiter.js'

const router = Router()
router.use(authMiddleware)
router.use(requireOrgSubscriptionForApp)
router.use(heavyOrgRouteLimiter)

import {
  RECONCILE_DEFAULT_LIMIT,
  resolveReconcileMaxLimit,
  SUGGESTION_DEFAULT_CAP,
} from '../config/importLimits.js'

/** Auto-raise display limit when any lane exceeds default RECONCILE_DEFAULT_LIMIT / 4. */
export function resolveReconcileFetchLimit(
  requestedLimit: number | undefined,
  categoryCounts: number[]
): number {
  const maxCategory = Math.max(0, ...categoryCounts)
  const maxLimit = resolveReconcileMaxLimit()
  const defaultPerCategory = Math.ceil(RECONCILE_DEFAULT_LIMIT / 4)
  const defaultLimit =
    maxCategory > defaultPerCategory ? maxLimit : RECONCILE_DEFAULT_LIMIT
  const parsed = requestedLimit && requestedLimit > 0 ? requestedLimit : defaultLimit
  return Math.min(parsed, maxLimit)
}

export function resolveSuggestionCap(
  requestedCap: number | undefined,
  categoryCounts: number[]
): number {
  const maxCategory = Math.max(0, ...categoryCounts)
  const maxCap = resolveReconcileMaxLimit()
  const defaultPerCategory = Math.ceil(RECONCILE_DEFAULT_LIMIT / 4)
  const defaultCap =
    maxCategory > defaultPerCategory ? maxCap : SUGGESTION_DEFAULT_CAP
  const parsed = requestedCap && requestedCap > 0 ? requestedCap : defaultCap
  return Math.min(parsed, maxCap)
}

function parseBooleanQuery(value: unknown, defaultValue: boolean): boolean {
  if (typeof value !== 'string') return defaultValue
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1') return true
  if (normalized === 'false' || normalized === '0') return false
  return defaultValue
}

async function findAlreadyMatchedIds(projectId: string, transactionIds: string[]) {
  if (transactionIds.length === 0) return []
  const rows = await prisma.matchItem.findMany({
    where: {
      transactionId: { in: transactionIds },
      match: { projectId },
    },
    select: { transactionId: true },
  })
  return [...new Set(rows.map((r) => r.transactionId))]
}

export function isUniqueConstraintError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

export function getMatchConflictErrorBody(e: unknown) {
  if (!isUniqueConstraintError(e)) return null
  return { error: 'One or more transactions are already matched' }
}

router.get('/:projectId', async (req: AuthRequest, res) => {
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.params.projectId, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const bankAccountId = (req.query.bankAccountId as string) || undefined
  const requestedLimit = parseInt(req.query.limit as string) || undefined
  const requestedSuggestionCap = parseInt(req.query.suggestionLimit as string) || undefined
  const useDate = parseBooleanQuery(req.query.useDate, true)
  const useDocRef = parseBooleanQuery(req.query.useDocRef, true)
  const useChequeNo = parseBooleanQuery(req.query.useChequeNo, true)
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
    include: {
      organization: { select: { plan: true, branding: true } },
      bankAccounts: true,
      documents: {
        select: { id: true, type: true, bankAccountId: true, filename: true },
      },
      matches: { include: { matchItems: true, attachments: true } },
    },
  })
  if (!project) return res.status(404).json({ error: 'Project not found' })

  const receiptsDocs = project.documents.filter((d) => d.type === 'cash_book_receipts')
  const paymentsDocs = project.documents.filter((d) => d.type === 'cash_book_payments')
  const creditsDocs = project.documents.filter(
    (d) => d.type === 'bank_credits' && (!bankAccountId || d.bankAccountId === bankAccountId)
  )
  const debitsDocs = project.documents.filter(
    (d) => d.type === 'bank_debits' && (!bankAccountId || d.bankAccountId === bankAccountId)
  )

  const receiptDocIds = receiptsDocs.map((d) => d.id)
  const paymentDocIds = paymentsDocs.map((d) => d.id)
  const creditDocIds = creditsDocs.map((d) => d.id)
  const debitDocIds = debitsDocs.map((d) => d.id)

  const categoryCounts = await countReconcileLanes({
    receiptDocIds,
    paymentDocIds,
    creditDocIds,
    debitDocIds,
  })
  const limit = resolveReconcileFetchLimit(requestedLimit, [...categoryCounts])
  const suggestionCap = resolveSuggestionCap(requestedSuggestionCap, [...categoryCounts])
  const perCategory = Math.ceil(limit / 4)

  const [rRecLane, rCredLane, rPayLane, rDebLane] = await Promise.all([
    loadReconcileLane({ documentIds: receiptDocIds, perCategory }),
    loadReconcileLane({ documentIds: creditDocIds, perCategory }),
    loadReconcileLane({ documentIds: paymentDocIds, perCategory }),
    loadReconcileLane({ documentIds: debitDocIds, perCategory }),
  ])

  const receiptsFull = rRecLane.full
  const paymentsFull = rPayLane.full
  const creditsFull = rCredLane.full
  const debitsFull = rDebLane.full
  const rRec = {
    arr: rRecLane.display,
    truncated: rRecLane.truncated,
    totalCount: rRecLane.totalCount,
  }
  const rCred = {
    arr: rCredLane.display,
    truncated: rCredLane.truncated,
    totalCount: rCredLane.totalCount,
  }
  const rPay = {
    arr: rPayLane.display,
    truncated: rPayLane.truncated,
    totalCount: rPayLane.totalCount,
  }
  const rDeb = {
    arr: rDebLane.display,
    truncated: rDebLane.truncated,
    totalCount: rDebLane.totalCount,
  }
  const receipts = rRec.arr
  const credits = rCred.arr
  const payments = rPay.arr
  const debits = rDeb.arr

  const matchedCbIds = new Set<string>()
  const matchedBankIds = new Set<string>()
  const matchList: {
    matchId: string
    cashBookTxId: string
    bankTxId: string
    cbTx: Tx
    bankTx: Tx
    attachments: any[]
  }[] = []
  const allTxs = new Map<string, Tx>()
  ;[...receiptsFull, ...creditsFull, ...paymentsFull, ...debitsFull].forEach((t) =>
    allTxs.set(t.id, t)
  )

  const pairIds: string[] = []
  for (const m of project.matches) {
    for (const mi of m.matchItems) {
      if (mi.side === 'cash_book') matchedCbIds.add(mi.transactionId)
      else matchedBankIds.add(mi.transactionId)
      if (!allTxs.has(mi.transactionId)) pairIds.push(mi.transactionId)
    }
  }
  if (pairIds.length) {
    for (const t of await loadTransactionsByIds(pairIds)) {
      allTxs.set(t.id, t)
    }
  }

  for (const m of project.matches) {
    const cbIds: string[] = []
    const bankIds: string[] = []
    for (const mi of m.matchItems) {
      if (mi.side === 'cash_book') cbIds.push(mi.transactionId)
      else bankIds.push(mi.transactionId)
    }
    // Expand 1-to-many, many-to-1, 1-to-1, and many-to-many into pairs for display
    const pairs: [string, string][] = []
    if (cbIds.length === 1 && bankIds.length >= 1) {
      bankIds.forEach((bid) => pairs.push([cbIds[0]!, bid]))
    } else if (cbIds.length >= 1 && bankIds.length === 1) {
      cbIds.forEach((cid) => pairs.push([cid, bankIds[0]!]))
    } else if (cbIds.length === 1 && bankIds.length === 1) {
      pairs.push([cbIds[0]!, bankIds[0]!])
    } else if (cbIds.length >= 2 && bankIds.length >= 2) {
      // many_to_many: pairwise by index, cycling if lengths differ
      const n = Math.max(cbIds.length, bankIds.length)
      for (let i = 0; i < n; i++) {
        pairs.push([cbIds[i % cbIds.length]!, bankIds[i % bankIds.length]!])
      }
    }
    for (const [cid, bid] of pairs) {
      const cbTx = allTxs.get(cid)
      const bankTx = allTxs.get(bid)
      if (cbTx && bankTx) {
        matchList.push({
          matchId: m.id,
          cashBookTxId: cid,
          bankTxId: bid,
          cbTx: cbTx,
          bankTx: bankTx,
          attachments: (m as any).attachments || [],
        })
      }
    }
  }

  const plan = project.organization?.plan ?? 'basic'
  const hasAiSuggestions = hasPlanFeature(plan, 'ai_suggestions')
  const hasBankRulesPlan = hasPlanFeature(plan, 'bank_rules')
  const hasSplitMatchingPlan = hasPlanFeature(plan, 'one_to_many')

  const platformDefaults = await getPlatformDefaults()
  const orgBranding = (project.organization?.branding as { ghanaBrsWorkbookNettingDefault?: boolean }) || {}
  const workbookNettingResolution = resolveWorkbookNetting({
    queryValue: req.query.workbookNetting,
    projectMode: (project as { workbookNettingMode?: string }).workbookNettingMode,
    orgDefault: orgBranding.ghanaBrsWorkbookNettingDefault,
    platformDefault: platformDefaults.ghanaBrsWorkbookNetting,
  })
  const workbookNettingRequested = workbookNettingResolution.enabled
  const sampleBankText = [...creditsFull, ...debitsFull]
    .slice(0, 12)
    .map((t) => [t.details, t.name].filter(Boolean).join(' '))
    .join('\n')
  const ecobankProfile = resolveEcobankGhanaProfileForScope({
    bankAccounts: project.bankAccounts || [],
    bankAccountId,
    sampleBankText,
    workbookNetting: workbookNettingRequested,
  })
  const scbProfile = resolveScbProfile({
    bankAccounts: project.bankAccounts || [],
    bankAccountId,
    sampleBankText,
  })
  const ghanaBankFormat = ecobankProfile.active
    ? 'ecobank'
    : resolveGhanaBankFormatLabel(project.bankAccounts || [], bankAccountId)
  const matchOptions = {
    amountTolerance: platformDefaults.amountTolerance ?? 0.01,
    dateWindowDays: platformDefaults.dateWindowDays ?? 3,
  }
  const clearingDateWindowDays = ecobankProfile.active
    ? Math.max(matchOptions.dateWindowDays, ecobankProfile.clearingDateWindowDays)
    : matchOptions.dateWindowDays

  const annotateSuggestions = (
    list: {
      cashBookTx: Tx
      bankTx: Tx
      confidence: number
      reason: string
      orgMemoryBoosted?: boolean
      orgMemoryId?: string
      orgMemoryConfirmations?: number
    }[],
    matchKind: 'receipt' | 'payment'
  ) =>
    list.map((s) => ({
      ...s,
      matchKind,
      orgMemoryBoosted: s.orgMemoryBoosted || /org memory/i.test(s.reason) || undefined,
      orgMemoryId: s.orgMemoryId,
      orgMemoryConfirmations: s.orgMemoryConfirmations,
      ecobankPattern:
        matchKind === 'payment' &&
        (isEcobankPatternMatchReason(s.reason) || isScbPatternMatchReason(s.reason)),
    }))

  const scbSweepSuggestions = scbProfile.active
    ? suggestScbSweepMatches(
        receiptsFull,
        creditsFull,
        matchedCbIds,
        matchedBankIds,
        matchOptions.amountTolerance
      )
    : []
  const scbInwardClearingSuggestions = scbProfile.active
    ? mergeScbPaymentSuggestions(
        suggestScbInwardClearingDebitMatches(
          paymentsFull,
          debitsFull,
          matchedCbIds,
          matchedBankIds,
          matchOptions.amountTolerance
        ),
        suggestScbInwardClearingCrossRefMatches(
          paymentsFull,
          debitsFull,
          matchedCbIds,
          matchedBankIds,
          matchOptions.amountTolerance
        ),
        suggestScbInwardClearingAlternateDebitMatches(
          paymentsFull,
          debitsFull,
          matchedCbIds,
          matchedBankIds,
          matchOptions.amountTolerance
        ),
        suggestScbInwardClearingFooterAmountMatches(
          paymentsFull,
          debitsFull,
          matchedCbIds,
          matchedBankIds,
          matchOptions.amountTolerance
        ),
        suggestScbWithdrawnToInwClgMatches(
          paymentsFull,
          debitsFull,
          matchedCbIds,
          matchedBankIds,
          matchOptions.amountTolerance
        )
      )
    : []

  const scbReturnedChequeSuggestions = scbProfile.active
    ? suggestScbReturnedChequeCreditMatches(
        receiptsFull,
        creditsFull,
        matchedCbIds,
        matchedBankIds,
        matchOptions.amountTolerance
      )
    : []
  const scbCashWithdrawalSuggestions = scbProfile.active
    ? suggestScbCashWithdrawalMatches(
        paymentsFull,
        debitsFull,
        matchedCbIds,
        matchedBankIds,
        matchOptions.amountTolerance
      )
    : []
  const scbChqRefSuggestions = scbProfile.active
    ? suggestScbChqRefDebitMatches(
        paymentsFull,
        debitsFull,
        matchedCbIds,
        matchedBankIds,
        matchOptions.amountTolerance
      )
    : []
  const scbOtRefSuggestions = scbProfile.active
    ? suggestScbOtRefMatches(
        paymentsFull,
        debitsFull,
        matchedCbIds,
        matchedBankIds,
        matchOptions.amountTolerance
      )
    : []

  // Matching suggestions for all plans (intelligent matching clues)
  const { inversion: sideInversion, receiptBank, paymentBank } = resolveMatchSides({
    receipts: receiptsFull,
    payments: paymentsFull,
    credits: creditsFull,
    debits: debitsFull,
  })
  const receiptSuggestions = mergeReceiptSuggestions(
    scbSweepSuggestions,
    scbReturnedChequeSuggestions,
    suggestMatches(receiptsFull, receiptBank, matchedCbIds, matchedBankIds, {
      ...matchOptions,
      requireDateMatch: useDate,
      useDate,
      useDocRef,
      useChequeNo,
    })
  )
  const standardPaymentSuggestions = suggestMatches(
    paymentsFull,
    paymentBank,
    matchedCbIds,
    matchedBankIds,
    {
      ...matchOptions,
      requireDateMatch: useDate,
      requireRefForCheques: useDocRef || useChequeNo,
      useDate,
      useDocRef,
      useChequeNo,
    }
  ).filter((s) => !scbClearingRefsConflict(s.cashBookTx, s.bankTx))
  const clearingPaymentSuggestions = ecobankProfile.active
    ? suggestEcobankClearingMatches(
        paymentsFull,
        creditsFull,
        matchedCbIds,
        matchedBankIds,
        {
          amountTolerance: matchOptions.amountTolerance,
          dateWindowDays: clearingDateWindowDays,
        }
      )
    : []
  const ecobankPaymentDebitSuggestions = ecobankProfile.active
    ? suggestEcobankPaymentDebitMatches(
        paymentsFull,
        debitsFull,
        matchedCbIds,
        matchedBankIds,
        matchOptions.amountTolerance
      )
    : []
  const statutoryDepositSuggestions = ecobankProfile.active
    ? suggestEcobankStatutoryDepositMatches(
        paymentsFull,
        creditsFull,
        matchedCbIds,
        matchedBankIds,
        matchOptions.amountTolerance,
        debitsFull
      )
    : []
  const paymentSuggestions = ecobankProfile.active
    ? mergePaymentSuggestions(
        mergePaymentSuggestions(
          mergePaymentSuggestions(clearingPaymentSuggestions, statutoryDepositSuggestions),
          ecobankPaymentDebitSuggestions
        ),
        mergeScbPaymentSuggestions(
          scbInwardClearingSuggestions,
          scbCashWithdrawalSuggestions,
          scbChqRefSuggestions,
          scbOtRefSuggestions,
          standardPaymentSuggestions
        )
      )
    : scbProfile.active
      ? mergeScbPaymentSuggestions(
          scbInwardClearingSuggestions,
          scbCashWithdrawalSuggestions,
          scbChqRefSuggestions,
          scbOtRefSuggestions,
          standardPaymentSuggestions
        )
      : standardPaymentSuggestions
  const duplicateChequeWarnings = detectDuplicateChequePayments(paymentsFull)

  // Apply bank rules for rule-based suggestions and flagged txs (Standard+ only)
  const bankRules = hasBankRulesPlan ? await prisma.bankRule.findMany({
    where: { organizationId: orgId },
    orderBy: { priority: 'asc' },
  }) : []
  const rules: BankRule[] = bankRules.map((r) => ({
    id: r.id,
    name: r.name,
    priority: r.priority,
    conditions: (r.conditions as unknown) as BankRule['conditions'],
    action: r.action,
  }))
  const toTxLike = (t: Tx) => ({ id: t.id, date: t.date, name: t.name, details: t.details, amount: t.amount })
  const flaggedBankIds: string[] = []
  const tol = matchOptions.amountTolerance
  const addRuleSuggestions = (cbTxs: Tx[], bankTxs: Tx[], base: { cashBookTx: Tx; bankTx: Tx; confidence: number; reason: string }[]) => {
    for (const bk of bankTxs) {
      if (matchedBankIds.has(bk.id)) continue
      const rule = getMatchingRule(toTxLike(bk), rules)
      if (!rule) continue
      if (rule.action === 'flag_for_review') {
        flaggedBankIds.push(bk.id)
        continue
      }
      if (rule.action === 'suggest_match') {
        const amtMatch = (cb: Tx) => Math.abs(cb.amount - bk.amount) <= tol
        const cbMatch = cbTxs.find((cb) => !matchedCbIds.has(cb.id) && amtMatch(cb))
        if (cbMatch && !base.some((s) => s.cashBookTx.id === cbMatch.id && s.bankTx.id === bk.id)) {
          base.push({
            cashBookTx: cbMatch,
            bankTx: bk,
            confidence: 0.85,
            reason: `Rule: ${rule.name}`,
          })
        }
      }
    }
  }
  addRuleSuggestions(receiptsFull, receiptBank, receiptSuggestions)
  addRuleSuggestions(paymentsFull, paymentBank, paymentSuggestions)

  let splitSuggestions: { receipts: SuggestedSplitMatch[]; payments: SuggestedSplitMatch[] } = {
    receipts: [],
    payments: [],
  }
  if (hasSplitMatchingPlan) {
    splitSuggestions.receipts = suggestSplitMatches(
      receiptsFull,
      receiptBank,
      matchedCbIds,
      matchedBankIds,
      { ...matchOptions }
    )
    splitSuggestions.payments = suggestSplitMatches(
      paymentsFull,
      paymentBank,
      matchedCbIds,
      matchedBankIds,
      { ...matchOptions }
    )
  }

  // Organisation match memory (Standard+): one DB query for all suggestion amounts
  const currency = project.currency || 'GHS'
  if (hasAiSuggestions) {
    const receiptAmounts = [
      ...receiptSuggestions.map((s) => amountToMinor(s.cashBookTx.amount)),
      ...splitSuggestions.receipts.map((s) =>
        amountToMinor(
          s.cashBookTxs.length === 1
            ? s.cashBookTxs[0]!.amount
            : s.bankTxs[0]?.amount ?? s.cashBookTxs.reduce((n, t) => n + t.amount, 0)
        )
      ),
    ]
    const paymentAmounts = [
      ...paymentSuggestions.map((s) => amountToMinor(s.cashBookTx.amount)),
      ...splitSuggestions.payments.map((s) =>
        amountToMinor(
          s.cashBookTxs.length === 1
            ? s.cashBookTxs[0]!.amount
            : s.bankTxs[0]?.amount ?? s.cashBookTxs.reduce((n, t) => n + t.amount, 0)
        )
      ),
    ]
    if (receiptAmounts.length || paymentAmounts.length) {
      const memories = await loadOrganisationMatchMemoriesBatch({
        organizationId: orgId,
        currency,
        bySide: {
          receipt: receiptAmounts,
          payment: paymentAmounts,
        },
      })
      const boostReceipt = applyOrganisationMatchMemoryBoost(
        receiptSuggestions,
        memories.receipt,
        matchOptions.amountTolerance
      )
      const boostPayment = applyOrganisationMatchMemoryBoost(
        paymentSuggestions,
        memories.payment,
        matchOptions.amountTolerance
      )
      if (boostReceipt + boostPayment > 0) {
        incOpsMetric('match.memory_boost_1to1', {
          by: boostReceipt + boostPayment,
          detail: { projectId, receipt: boostReceipt, payment: boostPayment },
        })
      }
      if (hasSplitMatchingPlan) {
        const boostSplitR = applyOrganisationSplitMatchMemoryBoost(
          splitSuggestions.receipts,
          memories.receipt,
          matchOptions.amountTolerance
        )
        const boostSplitP = applyOrganisationSplitMatchMemoryBoost(
          splitSuggestions.payments,
          memories.payment,
          matchOptions.amountTolerance
        )
        if (boostSplitR + boostSplitP > 0) {
          incOpsMetric('match.memory_boost_split', {
            by: boostSplitR + boostSplitP,
            detail: { projectId, receipt: boostSplitR, payment: boostSplitP },
          })
        }
      }
    }
  }

  receiptSuggestions.sort((a, b) => b.confidence - a.confidence)
  paymentSuggestions.sort((a, b) => b.confidence - a.confidence)
  const receiptSuggestionsOut = annotateSuggestions(receiptSuggestions, 'receipt')
  const paymentSuggestionsOut = annotateSuggestions(paymentSuggestions, 'payment')

  if (hasSplitMatchingPlan) {
    splitSuggestions.receipts.sort((a, b) => b.confidence - a.confidence)
    splitSuggestions.payments.sort((a, b) => b.confidence - a.confidence)
  }

  res.json({
    project: { id: project.id, name: project.name, status: project.status, currency: project.currency || 'GHS' },
    bankAccounts: project.bankAccounts || [],
    bankAccountId: bankAccountId || null,
    features: {
      ai_suggestions: hasAiSuggestions,
      bank_rules: hasBankRulesPlan,
      one_to_many: hasSplitMatchingPlan,
      many_to_many: hasPlanFeature(plan, 'many_to_many'),
      bulk_match: hasPlanFeature(plan, 'bulk_match'),
    },
    receipts: { transactions: receipts, documentId: receiptsDocs[0]?.id, truncated: rRec.truncated, totalCount: rRec.totalCount },
    credits: { transactions: credits, documentIds: creditsDocs.map((d) => d.id), truncated: rCred.truncated, totalCount: rCred.totalCount },
    payments: { transactions: payments, documentId: paymentsDocs[0]?.id, truncated: rPay.truncated, totalCount: rPay.totalCount },
    debits: { transactions: debits, documentIds: debitsDocs.map((d) => d.id), truncated: rDeb.truncated, totalCount: rDeb.totalCount },
    /** @deprecated Use matchedCashBookIds */
    matchedReceiptIds: Array.from(matchedCbIds),
    /** @deprecated Use matchedBankIds (includes credits and debits) */
    matchedCreditIds: Array.from(matchedBankIds),
    suggestions: {
      receipts: receiptSuggestionsOut.slice(0, suggestionCap),
      payments: paymentSuggestionsOut.slice(0, suggestionCap),
      clearingPayments: clearingPaymentSuggestions.slice(0, suggestionCap),
      split: splitSuggestions,
    },
    sideInversion: {
      inverted: sideInversion.inverted,
      standardOverlap: sideInversion.standardOverlap,
      crossedOverlap: sideInversion.crossedOverlap,
      reason: sideInversion.reason,
    },
    reconcileFetchLimit: limit,
    suggestionCap,
    reconcileProfile: ecobankProfile.active
      ? {
          bankFormat: 'ecobank' as const,
          ghanaBrs: true,
          clearingDateWindowDays,
          workbookNetting: ecobankProfile.workbookNetting,
          workbookNettingMode: workbookNettingResolution.mode,
          workbookNettingSource: workbookNettingResolution.source,
        }
      : ghanaBankFormat
        ? {
            bankFormat: ghanaBankFormat,
            ghanaBrs: true,
            clearingDateWindowDays: matchOptions.dateWindowDays,
            workbookNetting: false,
          }
        : null,
    duplicateChequeWarnings,
    flaggedBankIds,
    existingMatches: project.matches.length,
    matchedCashBookIds: Array.from(matchedCbIds),
    matchedBankIds: Array.from(matchedBankIds),
    matches: matchList,
  })
})

const matchSchema = z.object({
  cashBookTransactionId: z.string(),
  bankTransactionId: z.string(),
})

const bulkMatchSchema = z.object({
  matches: z.array(
    z.object({
      cashBookTransactionId: z.string(),
      bankTransactionId: z.string(),
    })
  ).min(1).max(100),
})

const multiMatchSchema = z.union([
  z.object({
    cashBookTransactionId: z.string(),
    bankTransactionIds: z.array(z.string()).min(2).max(25),
  }),
  z.object({
    cashBookTransactionIds: z.array(z.string()).min(2).max(25),
    bankTransactionId: z.string(),
  }),
  z.object({
    cashBookTransactionIds: z.array(z.string()).min(2).max(25),
    bankTransactionIds: z.array(z.string()).min(2).max(25),
  }),
])

router.post('/:projectId/match/multi', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canReconcile(role)) {
    return res.status(403).json({ error: 'Insufficient permission to reconcile' })
  }
  const orgId = req.auth!.orgId
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  })
  if (!org || !hasPlanFeature(org.plan, 'one_to_many') || !hasPlanFeature(org.plan, 'many_to_many')) {
    return res.status(403).json({ error: 'One-to-many and many-to-many matching require Premium plan or higher.' })
  }
  const projectId = await resolveProjectId(req.params.projectId, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
  })
  if (!project) return res.status(404).json({ error: 'Project not found' })
  if (!isProjectEditable(project.status)) {
    return res.status(403).json({ error: PROJECT_LOCKED_ERROR })
  }
  try {
    const body = multiMatchSchema.parse(req.body)
    let type: string
    const matchItems: { transactionId: string; side: string }[] = []

    if ('cashBookTransactionId' in body && body.bankTransactionIds && !('cashBookTransactionIds' in body)) {
      type = 'one_to_many'
      matchItems.push({ transactionId: body.cashBookTransactionId, side: 'cash_book' })
      body.bankTransactionIds.forEach((id: string) => matchItems.push({ transactionId: id, side: 'bank' }))
    } else if ('cashBookTransactionIds' in body && 'bankTransactionId' in body && !('bankTransactionIds' in body)) {
      const b = body as { cashBookTransactionIds: string[]; bankTransactionId: string }
      type = 'many_to_one'
      b.cashBookTransactionIds.forEach((id: string) => matchItems.push({ transactionId: id, side: 'cash_book' }))
      matchItems.push({ transactionId: b.bankTransactionId, side: 'bank' })
    } else if ('cashBookTransactionIds' in body && 'bankTransactionIds' in body) {
      const b = body as { cashBookTransactionIds: string[]; bankTransactionIds: string[] }
      type = 'many_to_many'
      b.cashBookTransactionIds.forEach((id: string) => matchItems.push({ transactionId: id, side: 'cash_book' }))
      b.bankTransactionIds.forEach((id: string) => matchItems.push({ transactionId: id, side: 'bank' }))
    } else {
      return res.status(400).json({ error: 'Invalid match payload' })
    }

    const txs = await prisma.transaction.findMany({
      where: { id: { in: matchItems.map((m) => m.transactionId) } },
      include: { document: true },
    })
    if (txs.length !== matchItems.length) return res.status(404).json({ error: 'One or more transactions not found' })
    if (txs.some((t) => t.document.projectId !== projectId)) {
      return res.status(403).json({ error: 'Transactions must belong to this project' })
    }
    const alreadyMatched = await findAlreadyMatchedIds(projectId, matchItems.map((m) => m.transactionId))
    if (alreadyMatched.length > 0) {
      return res.status(409).json({ error: 'One or more transactions are already matched', transactionIds: alreadyMatched })
    }

    const shouldRememberSplit =
      (type === 'one_to_many' || type === 'many_to_one') &&
      hasPlanFeature(org.plan, 'ai_suggestions')
    const cbTxs = shouldRememberSplit
      ? matchItems
          .filter((m) => m.side === 'cash_book')
          .map((m) => txs.find((t) => t.id === m.transactionId)!)
          .filter(Boolean)
      : []
    const bankTxs = shouldRememberSplit
      ? matchItems
          .filter((m) => m.side === 'bank')
          .map((m) => txs.find((t) => t.id === m.transactionId)!)
          .filter(Boolean)
      : []

    const { match, remembered } = await prisma.$transaction(async (tx) => {
      const match = await tx.match.create({
        data: {
          projectId,
          type,
          status: 'confirmed',
          confidence: 1,
          matchItems: {
            create: matchItems.map((m) => ({ transactionId: m.transactionId, side: m.side })),
          },
        },
      })
      await tx.project.update({ where: { id: projectId }, data: { status: 'reconciling' } })

      let remembered = false
      if (shouldRememberSplit) {
        const sideKind = sideKindFromCashBookDocType(cbTxs[0]?.document.type || 'cash_book_receipts')
        remembered = await rememberOrganisationSplitMatch({
          organizationId: orgId,
          currency: project.currency,
          sideKind,
          structure: type as 'one_to_many' | 'many_to_one',
          cashBookTxs: cbTxs.map((t) => ({
            amount: Number(t.amount),
            name: t.name,
            details: t.details,
            docRef: t.docRef,
            chqNo: t.chqNo,
          })),
          bankTxs: bankTxs.map((t) => ({
            amount: Number(t.amount),
            name: t.name,
            details: t.details,
            docRef: t.docRef,
            chqNo: t.chqNo,
          })),
          db: tx,
          prune: false,
        })
      }
      return { match, remembered }
    })
    if (remembered) {
      incOpsMetric('match.memory_remember_split', {
        detail: { projectId, structure: type },
      })
      void pruneMatchMemoryIfOverCap(orgId).catch(() => undefined)
    }

    await logAudit({
      organizationId: orgId,
      userId: req.auth!.userId,
      projectId,
      action: 'match_created',
      details: { matchId: match.id, type },
    })
    res.status(201).json(match)
  } catch (e) {
    const conflict = getMatchConflictErrorBody(e)
    if (conflict) {
      return res.status(409).json(conflict)
    }
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message })
    }
    res.status(500).json({ error: (e as Error).message })
  }
})

router.post('/:projectId/match', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canReconcile(role)) {
    return res.status(403).json({ error: 'Insufficient permission to reconcile' })
  }
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.params.projectId, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
  })
  if (!project) return res.status(404).json({ error: 'Project not found' })
  if (!isProjectEditable(project.status)) {
    return res.status(403).json({ error: PROJECT_LOCKED_ERROR })
  }
  try {
    const body = matchSchema.parse(req.body)
    const cbTx = await prisma.transaction.findFirst({
      where: { id: body.cashBookTransactionId },
      include: { document: true },
    })
    const bankTx = await prisma.transaction.findFirst({
      where: { id: body.bankTransactionId },
      include: { document: true },
    })
    if (!cbTx || !bankTx) return res.status(404).json({ error: 'Transaction not found' })
    if (cbTx.document.projectId !== projectId || bankTx.document.projectId !== projectId) {
      return res.status(403).json({ error: 'Transaction not in project' })
    }
    const alreadyMatched = await findAlreadyMatchedIds(projectId, [cbTx.id, bankTx.id])
    if (alreadyMatched.length > 0) {
      return res.status(409).json({ error: 'One or more transactions are already matched', transactionIds: alreadyMatched })
    }
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true },
    })
    const shouldRemember = !!(org && hasPlanFeature(org.plan, 'ai_suggestions'))
    const { match, remembered } = await prisma.$transaction(async (tx) => {
      const match = await tx.match.create({
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
      await tx.project.update({ where: { id: projectId }, data: { status: 'reconciling' } })
      let remembered = false
      if (shouldRemember) {
        remembered = await rememberOrganisationMatch({
          organizationId: orgId,
          currency: project.currency,
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
        })
      }
      return { match, remembered }
    })
    if (remembered) {
      incOpsMetric('match.memory_remember_1to1', { detail: { projectId } })
      void pruneMatchMemoryIfOverCap(orgId).catch(() => undefined)
    }
    await logAudit({
      organizationId: orgId,
      userId: req.auth!.userId,
      projectId,
      action: 'match_created',
      details: { matchId: match.id },
    })
    res.status(201).json(match)
  } catch (e) {
    const conflict = getMatchConflictErrorBody(e)
    if (conflict) {
      return res.status(409).json(conflict)
    }
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message })
    }
    res.status(500).json({ error: (e as Error).message })
  }
})

router.post('/:projectId/match/bulk', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canReconcile(role)) {
    return res.status(403).json({ error: 'Insufficient permission to reconcile' })
  }
  const orgId = req.auth!.orgId
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  })
  if (!org || !hasPlanFeature(org.plan, 'bulk_match')) {
    return res.status(403).json({ error: 'Bulk match requires Standard plan or higher.' })
  }
  const projectId = await resolveProjectId(req.params.projectId, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
  })
  if (!project) return res.status(404).json({ error: 'Project not found' })
  if (!isProjectEditable(project.status)) {
    return res.status(403).json({ error: PROJECT_LOCKED_ERROR })
  }
  try {
    const body = bulkMatchSchema.parse(req.body)
    if (body.matches.length > BULK_MATCH_LIMIT) {
      return res.status(400).json({
        error: `Maximum ${BULK_MATCH_LIMIT} matches per bulk request. You sent ${body.matches.length}.`,
      })
    }
    // Validate all pairs in a single round-trip rather than 2 queries per pair.
    const requestedTxIds = new Set<string>()
    for (const pair of body.matches) {
      requestedTxIds.add(pair.cashBookTransactionId)
      requestedTxIds.add(pair.bankTransactionId)
    }
    if (requestedTxIds.size !== body.matches.length * 2) {
      return res.status(409).json({ error: 'Bulk payload contains duplicate transaction IDs across pairs' })
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
    const toCreate: {
      cbTx: (typeof txRows)[number]
      bankTx: (typeof txRows)[number]
    }[] = []
    for (const pair of body.matches) {
      const cbTx = txById.get(pair.cashBookTransactionId)
      const bankTx = txById.get(pair.bankTransactionId)
      if (!cbTx || !bankTx) {
        return res.status(400).json({ error: `Transaction not found: ${pair.cashBookTransactionId}/${pair.bankTransactionId}` })
      }
      if (cbTx.document.projectId !== projectId || bankTx.document.projectId !== projectId) {
        return res.status(400).json({ error: 'Transaction not in project' })
      }
      toCreate.push({ cbTx, bankTx })
    }
    const alreadyMatched = await findAlreadyMatchedIds(projectId, Array.from(requestedTxIds))
    if (alreadyMatched.length > 0) {
      return res.status(409).json({ error: 'One or more transactions are already matched', transactionIds: alreadyMatched })
    }
    const shouldRemember = hasPlanFeature(org.plan, 'ai_suggestions')
    const created = await prisma.$transaction(async (tx) => {
      const ids: { id: string }[] = []
      let rememberedCount = 0
      for (const { cbTx, bankTx } of toCreate) {
        const match = await tx.match.create({
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
        ids.push({ id: match.id })
        if (shouldRemember) {
          const ok = await rememberOrganisationMatch({
            organizationId: orgId,
            currency: project.currency,
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
          })
          if (ok) rememberedCount++
        }
      }
      if (ids.length > 0) {
        await tx.project.update({ where: { id: projectId }, data: { status: 'reconciling' } })
      }
      return { ids, rememberedCount }
    })
    if (created.ids.length > 0) {
      if (created.rememberedCount > 0) {
        for (let i = 0; i < created.rememberedCount; i++) {
          incOpsMetric('match.memory_remember_1to1', {
            detail: { projectId, source: 'bulk' },
            log: false,
          })
        }
        void pruneMatchMemoryIfOverCap(orgId).catch(() => undefined)
      }
      await logAudit({
        organizationId: orgId,
        userId: req.auth!.userId,
        projectId,
        action: 'match_bulk',
        details: { count: created.ids.length },
      })
    }
    res.status(201).json({
      created: created.ids.length,
    })
  } catch (e) {
    const conflict = getMatchConflictErrorBody(e)
    if (conflict) {
      return res.status(409).json(conflict)
    }
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message })
    }
    res.status(500).json({ error: (e as Error).message })
  }
})

/** Clear all confirmed matches while project is still editable (reconciling / mapping). */
router.delete('/:projectId/matches', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canReconcile(role)) {
    return res.status(403).json({ error: 'Insufficient permission to reconcile' })
  }
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.params.projectId, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
  })
  if (!project) return res.status(404).json({ error: 'Project not found' })
  if (!isProjectEditable(project.status)) {
    return res.status(403).json({ error: PROJECT_LOCKED_ERROR })
  }
  const deleted = await prisma.match.deleteMany({ where: { projectId } })
  await logAudit({
    organizationId: orgId,
    userId: req.auth!.userId,
    projectId,
    action: 'matches_cleared',
    details: { count: deleted.count },
  })
  res.json({ deleted: deleted.count })
})

router.delete('/:projectId/match/:matchId', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canReconcile(role)) {
    return res.status(403).json({ error: 'Insufficient permission to reconcile' })
  }
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.params.projectId, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const { matchId } = req.params
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
  })
  if (!project) return res.status(404).json({ error: 'Project not found' })
  if (!isProjectEditable(project.status)) {
    return res.status(403).json({ error: PROJECT_LOCKED_ERROR })
  }
  const match = await prisma.match.findFirst({
    where: { id: matchId, projectId },
  })
  if (!match) return res.status(404).json({ error: 'Match not found' })
  await prisma.match.delete({ where: { id: matchId } })
  await logAudit({
    organizationId: orgId,
    userId: req.auth!.userId,
    projectId,
    action: 'match_deleted',
    details: { matchId },
  })
  res.json({ deleted: true })
})

export default router
