import { Router } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { resolveProjectId } from '../lib/project-resolve.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { canReconcile, isProjectEditable } from '../lib/permissions.js'
import { hasPlanFeature, BULK_MATCH_LIMIT } from '../config/planFeatures.js'
import { suggestMatches, type Tx } from '../services/matching.js'
import { getMatchingRule, type BankRule } from '../services/bankRules.js'
import { getPlatformDefaults } from '../lib/platformDefaults.js'
import { logAudit } from '../services/audit.js'

const router = Router()
router.use(authMiddleware)

const RECONCILE_DEFAULT_LIMIT = 1500
const RECONCILE_MAX_LIMIT = 5000

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
  const limit = Math.min(
    parseInt(req.query.limit as string) || RECONCILE_DEFAULT_LIMIT,
    RECONCILE_MAX_LIMIT
  )
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
    include: {
      bankAccounts: true,
      documents: {
        include: { transactions: true, bankAccount: true },
      },
      matches: { include: { matchItems: true } },
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

  const toTx = (t: { id: string; date: Date | null; name: string | null; details: string | null; docRef: string | null; chqNo: string | null; amount: unknown }): Tx => ({
    id: t.id,
    date: t.date,
    name: t.name,
    details: t.details,
    amount: Number(t.amount),
    docRef: t.docRef,
    chqNo: t.chqNo,
  })

  const receiptsFull = receiptsDocs.flatMap((d) => (d.transactions || []).map(toTx))
  const paymentsFull = paymentsDocs.flatMap((d) => (d.transactions || []).map(toTx))
  const creditsFull = creditsDocs.flatMap((d) => (d.transactions || []).map(toTx))
  const debitsFull = debitsDocs.flatMap((d) => (d.transactions || []).map(toTx))
  const perCategory = Math.ceil(limit / 4)
  const truncate = <T>(arr: T[]) => {
    if (arr.length <= perCategory) return { arr, truncated: false, totalCount: arr.length }
    return { arr: arr.slice(0, perCategory), truncated: true, totalCount: arr.length }
  }
  const rRec = truncate(receiptsFull)
  const rCred = truncate(creditsFull)
  const rPay = truncate(paymentsFull)
  const rDeb = truncate(debitsFull)
  const receipts = rRec.arr
  const credits = rCred.arr
  const payments = rPay.arr
  const debits = rDeb.arr

  const matchedCbIds = new Set<string>()
  const matchedBankIds = new Set<string>()
  const matchList: { matchId: string; cashBookTxId: string; bankTxId: string; cbTx: Tx; bankTx: Tx }[] = []
  const allTxs = new Map<string, Tx>()
  ;[...receipts, ...credits, ...payments, ...debits].forEach((t) => allTxs.set(t.id, t))
  for (const m of project.matches) {
    const cbIds: string[] = []
    const bankIds: string[] = []
    for (const mi of m.matchItems) {
      if (mi.side === 'cash_book') {
        matchedCbIds.add(mi.transactionId)
        cbIds.push(mi.transactionId)
      } else {
        matchedBankIds.add(mi.transactionId)
        bankIds.push(mi.transactionId)
      }
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
    for (const [cbTxId, bankTxId] of pairs) {
      const cbTx = allTxs.get(cbTxId)
      const bankTx = allTxs.get(bankTxId)
      if (cbTx && bankTx) matchList.push({ matchId: m.id, cashBookTxId: cbTxId, bankTxId, cbTx, bankTx })
    }
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  })
  const plan = org?.plan ?? 'basic'
  const hasAiSuggestions = hasPlanFeature(plan, 'ai_suggestions')
  const hasBankRulesPlan = hasPlanFeature(plan, 'bank_rules')

  const platformDefaults = await getPlatformDefaults()
  const matchOptions = {
    amountTolerance: platformDefaults.amountTolerance ?? 0.01,
    dateWindowDays: platformDefaults.dateWindowDays ?? 3,
  }

  // Matching suggestions for all plans (intelligent matching clues)
  const receiptSuggestions = suggestMatches(receipts, credits, matchedCbIds, matchedBankIds, { ...matchOptions, requireDateMatch: true })
  const paymentSuggestions = suggestMatches(payments, debits, matchedCbIds, matchedBankIds, { ...matchOptions, requireRefForCheques: true })

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
  addRuleSuggestions(receipts, credits, receiptSuggestions)
  addRuleSuggestions(payments, debits, paymentSuggestions)

  // AI-style boost: learn from confirmed matches — if suggestion resembles a past match, boost confidence
  const learnedPatterns = matchList.map(({ cbTx, bankTx }) => ({
    amount: cbTx.amount,
    cbDesc: (cbTx.details || cbTx.name || '').toLowerCase().slice(0, 25).trim(),
    bankDesc: (bankTx.details || bankTx.name || '').toLowerCase().slice(0, 25).trim(),
  }))
  const applyLearnedBoost = (list: { cashBookTx: Tx; bankTx: Tx; confidence: number; reason: string }[]) => {
    for (const s of list) {
      const cbDesc = (s.cashBookTx.details || s.cashBookTx.name || '').toLowerCase().slice(0, 25).trim()
      const bankDesc = (s.bankTx.details || s.bankTx.name || '').toLowerCase().slice(0, 25).trim()
      const matchesPattern = (p: { amount: number; cbDesc: string; bankDesc: string }) => {
        if (Math.abs(p.amount - s.cashBookTx.amount) > tol) return false
        if (cbDesc && p.cbDesc && (cbDesc.includes(p.cbDesc) || p.cbDesc.includes(cbDesc))) return true
        if (bankDesc && p.bankDesc && (bankDesc.includes(p.bankDesc) || p.bankDesc.includes(bankDesc))) return true
        return false
      }
      const match = learnedPatterns.some(matchesPattern)
      if (match) {
        s.confidence = Math.min(1, s.confidence + 0.1)
        if (!s.reason.includes('learned')) s.reason = s.reason + (s.reason ? ', learned' : 'Learned from past match')
      }
    }
  }
  applyLearnedBoost(receiptSuggestions)
  applyLearnedBoost(paymentSuggestions)

  receiptSuggestions.sort((a, b) => b.confidence - a.confidence)
  paymentSuggestions.sort((a, b) => b.confidence - a.confidence)

  res.json({
    project: { id: project.id, name: project.name, status: project.status, currency: project.currency || 'GHS' },
    bankAccounts: project.bankAccounts || [],
    bankAccountId: bankAccountId || null,
    receipts: { transactions: receipts, documentId: receiptsDocs[0]?.id, truncated: rRec.truncated, totalCount: rRec.totalCount },
    credits: { transactions: credits, documentIds: creditsDocs.map((d) => d.id), truncated: rCred.truncated, totalCount: rCred.totalCount },
    payments: { transactions: payments, documentId: paymentsDocs[0]?.id, truncated: rPay.truncated, totalCount: rPay.totalCount },
    debits: { transactions: debits, documentIds: debitsDocs.map((d) => d.id), truncated: rDeb.truncated, totalCount: rDeb.totalCount },
    /** @deprecated Use matchedCashBookIds */
    matchedReceiptIds: Array.from(matchedCbIds),
    /** @deprecated Use matchedBankIds (includes credits and debits) */
    matchedCreditIds: Array.from(matchedBankIds),
    suggestions: {
      receipts: receiptSuggestions.slice(0, 50),
      payments: paymentSuggestions.slice(0, 50),
    },
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
    return res.status(403).json({ error: 'Project is locked (submitted for review or approved). Reopen to edit.' })
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

    const match = await prisma.match.create({
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
    await prisma.project.update({ where: { id: projectId }, data: { status: 'reconciling' } })
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
    return res.status(403).json({ error: 'Project is locked (submitted for review or approved). Reopen to edit.' })
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
    const match = await prisma.match.create({
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
    await prisma.project.update({ where: { id: projectId }, data: { status: 'reconciling' } })
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
    return res.status(403).json({ error: 'Project is locked (submitted for review or approved). Reopen to edit.' })
  }
  try {
    const body = bulkMatchSchema.parse(req.body)
    if (body.matches.length > BULK_MATCH_LIMIT) {
      return res.status(400).json({
        error: `Maximum ${BULK_MATCH_LIMIT} matches per bulk request. You sent ${body.matches.length}.`,
      })
    }
    // Validate all pairs first
    const toCreate: { cbTx: { id: string }; bankTx: { id: string } }[] = []
    const requestedTxIds = new Set<string>()
    for (const pair of body.matches) {
      requestedTxIds.add(pair.cashBookTransactionId)
      requestedTxIds.add(pair.bankTransactionId)
      const cbTx = await prisma.transaction.findFirst({
        where: { id: pair.cashBookTransactionId },
        include: { document: true },
      })
      const bankTx = await prisma.transaction.findFirst({
        where: { id: pair.bankTransactionId },
        include: { document: true },
      })
      if (!cbTx || !bankTx) {
        return res.status(400).json({ error: `Transaction not found: ${pair.cashBookTransactionId}/${pair.bankTransactionId}` })
      }
      if (cbTx.document.projectId !== projectId || bankTx.document.projectId !== projectId) {
        return res.status(400).json({ error: 'Transaction not in project' })
      }
      toCreate.push({ cbTx, bankTx })
    }
    if (requestedTxIds.size !== body.matches.length * 2) {
      return res.status(409).json({ error: 'Bulk payload contains duplicate transaction IDs across pairs' })
    }
    const alreadyMatched = await findAlreadyMatchedIds(projectId, Array.from(requestedTxIds))
    if (alreadyMatched.length > 0) {
      return res.status(409).json({ error: 'One or more transactions are already matched', transactionIds: alreadyMatched })
    }
    const created = await prisma.$transaction(async (tx) => {
      const ids: { id: string }[] = []
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
      }
      if (ids.length > 0) {
        await tx.project.update({ where: { id: projectId }, data: { status: 'reconciling' } })
      }
      return ids
    })
    if (created.length > 0) {
      await logAudit({
        organizationId: orgId,
        userId: req.auth!.userId,
        projectId,
        action: 'match_bulk',
        details: { count: created.length },
      })
    }
    res.status(201).json({
      created: created.length,
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
    return res.status(403).json({ error: 'Project is locked (submitted for review or approved). Reopen to edit.' })
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
