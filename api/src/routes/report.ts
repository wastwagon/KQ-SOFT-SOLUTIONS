import { Router } from 'express'
import { formatAmountForReport } from '../lib/currency.js'
import { getPlatformDefaults } from '../lib/platformDefaults.js'
import * as XLSX from 'xlsx'
import PDFDocument from 'pdfkit'
import path from 'path'
import fs from 'fs'
import { prisma } from '../lib/prisma.js'
import { resolveProjectId } from '../lib/project-resolve.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { canExportReport } from '../lib/permissions.js'
import { hasPlanFeature } from '../config/planFeatures.js'
import { logAudit } from '../services/audit.js'
import { summarizeSignBuckets } from '../services/signClassifier.js'
import { detectFileType, parseCsv, parseExcel } from '../services/parser.js'
import { requireOrgSubscriptionForApp } from '../middleware/requireOrgSubscriptionForApp.js'

const router = Router()
router.use(authMiddleware)
router.use(requireOrgSubscriptionForApp)

interface TxLike {
  id: string
  date: Date | string | null
  name: string | null
  details: string | null
  chqNo?: string | null
  docRef?: string | null
  amount: number
}

interface BrsComputationInput {
  balancePerCashBook: number
  uncreditedLodgmentsTotal: number
  uncreditedLodgmentsTimingTotal: number
  unpresentedChequesTotal: number
  bankOnlyCreditsNotInCashBookTotal: number
  bankOnlyDebitsNotInCashBookTotal: number
  bankStatementClosingBalance: number | null
}

interface UnpresentedChequeLike {
  date: Date | string | null
  name: string | null
  chqNo?: string | null
  amount: number
  fromProject?: string
}

function toNumOrNull(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'object' && v !== null && 'toString' in v) return Number(String((v as { toString: () => string }).toString()))
  return Number.isFinite(Number(v)) ? Number(v) : null
}

export function computeBrsMetrics(input: BrsComputationInput) {
  const {
    balancePerCashBook,
    uncreditedLodgmentsTotal,
    uncreditedLodgmentsTimingTotal,
    unpresentedChequesTotal,
    bankOnlyCreditsNotInCashBookTotal,
    bankOnlyDebitsNotInCashBookTotal,
    bankStatementClosingBalance,
  } = input
  const bankOnlyReconcilingNet = bankOnlyCreditsNotInCashBookTotal - bankOnlyDebitsNotInCashBookTotal
  const bankClosingBalanceLegacy = balancePerCashBook - uncreditedLodgmentsTotal + unpresentedChequesTotal
  const bankClosingBalanceGhanaStyle =
    balancePerCashBook -
    uncreditedLodgmentsTimingTotal +
    unpresentedChequesTotal +
    bankOnlyReconcilingNet
  const bankClosingBalance = bankStatementClosingBalance ?? bankClosingBalanceGhanaStyle
  return {
    bankOnlyReconcilingNet,
    bankClosingBalanceLegacy,
    bankClosingBalanceGhanaStyle,
    bankClosingBalance,
  }
}

/**
 * Two-column workbook schedule (same order as the printed BRS block):
 * cash book = bank closing + timing uncredited − unpresented + bank-only debits − bank-only credits.
 * Unpresented and bank-only credits are stored as positive magnitudes in the schedule.
 * Use for tie-out checks and for subsequent periods where timing uncredited and unpresented include
 * current-period items plus brought-forward slices (see brsStatement composition fields).
 */
export function deriveCashBookFromWorkbookSchedule(payload: {
  bankClosingBalance: number
  uncreditedLodgmentsTimingTotal: number
  unpresentedChequesTotal: number
  bankOnlyDebitsNotInCashBookTotal: number
  bankOnlyCreditsNotInCashBookTotal: number
}): number {
  return (
    payload.bankClosingBalance +
    payload.uncreditedLodgmentsTimingTotal -
    payload.unpresentedChequesTotal +
    payload.bankOnlyDebitsNotInCashBookTotal -
    payload.bankOnlyCreditsNotInCashBookTotal
  )
}

function buildMissingChequesAgeing(
  items: UnpresentedChequeLike[],
  referenceDate: Date
) {
  return items.map((t) => {
    const txDate = t.date ? new Date(t.date) : referenceDate
    const daysOutstanding = Math.floor((referenceDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24))
    let ageingBand: string
    if (daysOutstanding <= 30) ageingBand = '0–30'
    else if (daysOutstanding <= 60) ageingBand = '31–60'
    else if (daysOutstanding <= 90) ageingBand = '61–90'
    else ageingBand = '90+'
    return {
      date: t.date ? new Date(t.date).toISOString().slice(0, 10) : '',
      name: t.name || '—',
      chqNo: t.chqNo ?? null,
      amount: t.amount,
      daysOutstanding,
      ageingBand,
      fromProject: t.fromProject,
    }
  })
}

function toTx(t: { id: string; date: Date | null; name: string | null; details: string | null; chqNo?: string | null; docRef?: string | null; amount: unknown }): TxLike {
  return {
    id: t.id,
    date: t.date,
    name: t.name,
    details: t.details,
    chqNo: t.chqNo,
    docRef: t.docRef,
    amount: Number(t.amount),
  }
}

function dedupeTransactions<T extends TxLike>(txs: T[]): T[] {
  const seen = new Set<string>()
  return txs.filter((t) => {
    const dStr = t.date ? new Date(t.date).toISOString().slice(0, 10) : ''
    const key = `${dStr}|${Number(t.amount).toFixed(2)}|${(t.chqNo || '').toLowerCase()}|${(t.docRef || '').toLowerCase()}|${(t.name || t.details || '').toLowerCase().trim()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function normalizeRefToken(value: string | null | undefined): string {
  return (value || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

export function refTokensEquivalent(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizeRefToken(a)
  const y = normalizeRefToken(b)
  if (!x || !y) return false
  if (x === y) return true
  if (/^\d+$/.test(x) && /^\d+$/.test(y)) {
    return x.endsWith(y) || y.endsWith(x)
  }
  return false
}

export function hasChequeOrRefLink(left: TxLike, right: TxLike): boolean {
  const normalizeText = (value: string | null | undefined): string =>
    (value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const extractRefsFromText = (text: string | null | undefined): string[] => {
    const src = (text || '').toString()
    if (!src) return []
    const out = new Set<string>()
    const re = /\b(?:chq|cheque|ref)(?:\s*(?:no|number)\.?)?\s*[#:.]?\s*([a-z0-9-]{3,20})\b/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      if (m[1]) out.add(m[1])
    }
    return Array.from(out)
  }
  const leftRefs = [
    left.chqNo,
    left.docRef,
    ...extractRefsFromText(left.details),
    ...extractRefsFromText(left.name),
  ]
  const rightRefs = [
    right.chqNo,
    right.docRef,
    ...extractRefsFromText(right.details),
    ...extractRefsFromText(right.name),
  ]
  for (const a of leftRefs) {
    for (const b of rightRefs) {
      if (refTokensEquivalent(a, b)) return true
    }
  }
  const leftName = normalizeText(left.name || left.details)
  const rightName = normalizeText(right.name || right.details)
  if (
    leftName &&
    rightName &&
    leftName === rightName &&
    Math.abs(left.amount - right.amount) <= 0.01
  ) {
    return true
  }
  return (
    refTokensEquivalent(left.chqNo, right.chqNo) ||
    refTokensEquivalent(left.docRef, right.docRef) ||
    refTokensEquivalent(left.chqNo, right.docRef) ||
    refTokensEquivalent(left.docRef, right.chqNo)
  )
}

function formatGeneratedAt(date: Date): string {
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Africa/Accra',
  })
}

export function parseImportedAmount(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v).trim().replace(/,/g, '')
  if (!s) return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

export function extractCashBookClosingBalanceFromDoc(filepath: string): number | null {
  if (!filepath || !fs.existsSync(filepath)) return null
  const fileType = detectFileType(filepath)
  const parsed =
    fileType === 'excel' ? parseExcel(filepath) :
    fileType === 'csv' ? parseCsv(filepath) :
    null
  if (!parsed?.headers?.length || !parsed.rows?.length) return null
  const balanceCol = parsed.headers.findIndex((h) => /balance/i.test(h || ''))
  if (balanceCol < 0) return null
  for (let i = parsed.rows.length - 1; i >= 0; i--) {
    const row = parsed.rows[i] as unknown[]
    const amt = parseImportedAmount(row?.[balanceCol])
    if (Math.abs(amt) > 0) return amt
  }
  return null
}

export function extractSourceClosingBalanceFromDocs(filepaths: string[]): number | null {
  for (const fp of filepaths) {
    const value = extractCashBookClosingBalanceFromDoc(fp)
    if (value != null) return value
  }
  return null
}

function detectReversalCandidates(
  receipts: TxLike[],
  payments: TxLike[],
  credits: TxLike[],
  debits: TxLike[]
) {
  type Candidate = {
    key: string
    incoming: TxLike
    outgoing: TxLike
    stream: 'cash_book' | 'bank'
    dayDiff: number
  }
  const candidates: Candidate[] = []
  const keyFor = (t: TxLike) => {
    const ref = (t.docRef || '').trim()
    if (ref) return `ref:${ref.toLowerCase()}`
    const chq = (t.chqNo || '').trim()
    if (chq) return `chq:${chq.toLowerCase()}`
    const desc = (t.details || t.name || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 24)
    return desc ? `desc:${desc}` : ''
  }
  const collectPairs = (
    incoming: TxLike[],
    outgoing: TxLike[],
    stream: 'cash_book' | 'bank'
  ) => {
    const outSorted = [...outgoing].sort((a, b) => {
      const ad = a.date ? new Date(a.date).getTime() : 0
      const bd = b.date ? new Date(b.date).getTime() : 0
      return ad - bd
    })
    for (const inc of incoming) {
      const keyInc = keyFor(inc)
      if (!keyInc || Math.abs(inc.amount) <= 0) continue
      for (const out of outSorted) {
        const keyOut = keyFor(out)
        if (keyInc !== keyOut || Math.abs(out.amount) <= 0) continue
        if (Math.abs(Math.abs(inc.amount) - Math.abs(out.amount)) > 0.01) continue
        const da = inc.date ? new Date(inc.date) : null
        const db = out.date ? new Date(out.date) : null
        const dayDiff = da && db ? Math.abs((da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24)) : 0
        if (dayDiff > 31) continue
        candidates.push({ key: keyInc, incoming: inc, outgoing: out, stream, dayDiff })
        break
      }
    }
  }
  collectPairs(receipts, payments, 'cash_book')
  collectPairs(credits, debits, 'bank')
  return candidates.slice(0, 100).map((c) => ({
    reference: c.key,
    stream: c.stream,
    amount: Math.abs(c.incoming.amount),
    incomingDate: c.incoming.date ? new Date(c.incoming.date).toISOString() : null,
    outgoingDate: c.outgoing.date ? new Date(c.outgoing.date).toISOString() : null,
    incomingNarration: c.incoming.details || c.incoming.name || '',
    outgoingNarration: c.outgoing.details || c.outgoing.name || '',
    dayDiff: Math.round(c.dayDiff),
  }))
}

function resolveBrandingLogoPath(logoUrl: unknown): string | null {
  if (!logoUrl || typeof logoUrl !== 'string') return null
  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
  let filename = ''
  try {
    const parsed = new URL(logoUrl)
    filename = path.basename(parsed.pathname)
  } catch {
    filename = path.basename(logoUrl)
  }
  if (!filename) return null
  const localPath = path.join(uploadDir, 'branding', filename)
  return fs.existsSync(localPath) ? localPath : null
}

/** Bank row shown under the BRS title (common regional workbook layout). */
type ReportBankAccountRow = {
  id: string
  name: string
  bankName: string | null
  accountNo: string | null
}

function resolveBankAccountForReportHeader(
  bankAccounts: ReportBankAccountRow[] | undefined,
  bankAccountId: string | undefined
): ReportBankAccountRow | null {
  const list = bankAccounts?.filter(Boolean) ?? []
  if (!list.length) return null
  if (bankAccountId) {
    const found = list.find((a) => a.id === bankAccountId)
    if (found) return found
  }
  if (list.length === 1) return list[0]
  return null
}

/** Worksheet row format, e.g. "Ecobank Account Number 5565668889". */
function formatBankAccountHeaderLine(account: ReportBankAccountRow): string | null {
  const bankLabel = (account.bankName || account.name || '').trim()
  const acctNo = (account.accountNo || '').trim()
  if (bankLabel && acctNo) return `${bankLabel} Account Number ${acctNo}`
  if (acctNo) return `Account Number ${acctNo}`
  if (bankLabel) return bankLabel
  return null
}

router.get('/:projectId', async (req: AuthRequest, res) => {
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.params.projectId, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })
  const bankAccountId = (req.query.bankAccountId as string) || undefined
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
    include: {
      organization: true,
      bankAccounts: true,
      rollForwardFrom: { select: { id: true, name: true } },
      documents: { include: { transactions: true, bankAccount: true } },
      matches: { include: { matchItems: true } },
      preparedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
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

  const receipts = dedupeTransactions(receiptsDocs.flatMap((d) => (d.transactions || []).map(toTx)))
  const payments = dedupeTransactions(paymentsDocs.flatMap((d) => (d.transactions || []).map(toTx)))
  const credits = dedupeTransactions(creditsDocs.flatMap((d) => (d.transactions || []).map(toTx)))
  const debits = dedupeTransactions(debitsDocs.flatMap((d) => (d.transactions || []).map(toTx)))

  let broughtForwardItems: { date: string; name: string; chqNo: string | null; amount: number; fromProject: string }[] = []
  let broughtForwardLodgments: { date: string; name: string; docRef: string | null; amount: number; fromProject: string; source: 'cash_book_receipts' | 'bank_credits' }[] = []
  if (project.rollForwardFromProjectId && project.rollForwardFrom) {
    const prevProject = await prisma.project.findFirst({
      where: { id: project.rollForwardFromProjectId, organizationId: orgId },
      include: {
        documents: { include: { transactions: true } },
        matches: { include: { matchItems: true } },
      },
    })
    if (prevProject) {
      const prevPaymentsDocs = prevProject.documents.filter((d) => d.type === 'cash_book_payments')
      const prevReceiptsDocs = prevProject.documents.filter((d) => d.type === 'cash_book_receipts')
      const prevCreditsDocs = prevProject.documents.filter(
        (d) => d.type === 'bank_credits' && (!bankAccountId || d.bankAccountId === bankAccountId)
      )
      const prevDebitsDocs = prevProject.documents.filter(
        (d) => d.type === 'bank_debits' && (!bankAccountId || d.bankAccountId === bankAccountId)
      )
      const prevReceipts = prevReceiptsDocs.flatMap((d) => (d.transactions || []).map((t) => toTx(t)))
      const prevPayments = prevPaymentsDocs.flatMap((d) => (d.transactions || []).map((t) => toTx(t)))
      const prevCredits = prevCreditsDocs.flatMap((d) => (d.transactions || []).map((t) => toTx(t)))
      const prevMatchedCbIds = new Set<string>()
      const prevMatchedBankIds = new Set<string>()
      for (const m of prevProject.matches) {
        for (const mi of m.matchItems) {
          if (mi.side === 'cash_book') prevMatchedCbIds.add(mi.transactionId)
          else prevMatchedBankIds.add(mi.transactionId)
        }
      }
      const prevUnmatchedPayments = prevPayments.filter((t) => !prevMatchedCbIds.has(t.id))
      const prevUnmatchedReceipts = prevReceipts.filter((t) => !prevMatchedCbIds.has(t.id))
      const prevUnmatchedCredits = prevCredits.filter((t) => !prevMatchedBankIds.has(t.id))
      const prevFmt = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '')
      
      const isAlreadyInCurrent = (t: TxLike, currentSet: TxLike[]) => {
        const dStr = t.date ? new Date(t.date).toISOString().slice(0, 10) : ''
        const key = `${dStr}|${Number(t.amount).toFixed(2)}|${(t.chqNo || '').toLowerCase()}|${(t.docRef || '').toLowerCase()}|${(t.name || t.details || '').toLowerCase().trim()}`
        return currentSet.some(c => {
          const cdStr = c.date ? new Date(c.date).toISOString().slice(0, 10) : ''
          const cKey = `${cdStr}|${Number(c.amount).toFixed(2)}|${(c.chqNo || '').toLowerCase()}|${(c.docRef || '').toLowerCase()}|${(c.name || c.details || '').toLowerCase().trim()}`
          return key === cKey
        })
      }

      broughtForwardItems = prevUnmatchedPayments
        .filter(t => !isAlreadyInCurrent(t, payments))
        .map((t) => ({
          date: prevFmt(t.date),
          name: t.name || t.details || '—',
          chqNo: t.chqNo || null,
          amount: t.amount,
          fromProject: prevProject.name,
        }))
      broughtForwardLodgments = [
        ...prevUnmatchedReceipts
          .filter(t => !isAlreadyInCurrent(t, receipts))
          .map((t) => ({
            date: prevFmt(t.date),
            name: t.name || t.details || '—',
            docRef: t.docRef || null,
            amount: t.amount,
            fromProject: prevProject.name,
            source: 'cash_book_receipts' as const,
          })),
        ...prevUnmatchedCredits
          .filter(t => !isAlreadyInCurrent(t, credits))
          .map((t) => ({
            date: prevFmt(t.date),
            name: t.name || t.details || '—',
            docRef: t.docRef || null,
            amount: t.amount,
            fromProject: prevProject.name,
            source: 'bank_credits' as const,
          })),
      ]
    }
  }
  const reversalCandidates = detectReversalCandidates(receipts, payments, credits, debits)

  const matchedCbIds = new Set<string>()
  const matchedBankIds = new Set<string>()
  const matchPairs: { cb: TxLike; bank: TxLike }[] = []
  const allTxs = receipts.concat(payments).concat(credits).concat(debits)

  for (const m of project.matches) {
    const cbIds: string[] = []
    const bankIds: string[] = []
    for (const mi of m.matchItems) {
      const tx = allTxs.find((t: TxLike) => t.id === mi.transactionId)
      if (!tx) continue
      if (mi.side === 'cash_book') {
        matchedCbIds.add(tx.id)
        cbIds.push(tx.id)
      } else {
        matchedBankIds.add(tx.id)
        bankIds.push(tx.id)
      }
    }
    const cbTxs = cbIds.map((id) => allTxs.find((t: TxLike) => t.id === id)).filter(Boolean) as TxLike[]
    const bankTxs = bankIds.map((id) => allTxs.find((t: TxLike) => t.id === id)).filter(Boolean) as TxLike[]
    if (cbTxs.length === 0 || bankTxs.length === 0) continue
    if (cbTxs.length === 1 && bankTxs.length >= 1) {
      bankTxs.forEach((bt) => matchPairs.push({ cb: cbTxs[0]!, bank: bt }))
    } else if (cbTxs.length >= 1 && bankTxs.length === 1) {
      cbTxs.forEach((ct) => matchPairs.push({ cb: ct, bank: bankTxs[0]! }))
    } else if (cbTxs.length === 1 && bankTxs.length === 1) {
      matchPairs.push({ cb: cbTxs[0]!, bank: bankTxs[0]! })
    } else {
      const n = Math.max(cbTxs.length, bankTxs.length)
      for (let i = 0; i < n; i++) {
        matchPairs.push({ cb: cbTxs[i % cbTxs.length]!, bank: bankTxs[i % bankTxs.length]! })
      }
    }
  }

  const unmatchedReceipts = receipts.filter((t) => !matchedCbIds.has(t.id))
  const unmatchedCredits = credits.filter((t) => !matchedBankIds.has(t.id))
  const unmatchedPayments = payments.filter((t) => !matchedCbIds.has(t.id))
  const unmatchedDebits = debits.filter((t) => !matchedBankIds.has(t.id))
  const sourceFilterLogic = {
    cashBookReceipts: summarizeSignBuckets('cash_book_receipts', receipts.map((t) => t.amount)),
    cashBookPayments: summarizeSignBuckets('cash_book_payments', payments.map((t) => t.amount)),
    bankStatementDebits: summarizeSignBuckets('bank_debits', debits.map((t) => t.amount)),
    bankStatementCredits: summarizeSignBuckets('bank_credits', credits.map((t) => t.amount)),
  }
  const receiptIds = new Set(receipts.map((t) => t.id))
  const matchedReceiptsVsCredits = matchPairs.filter((p) => receiptIds.has(p.cb.id))
  const matchedPaymentsVsDebits = matchPairs.filter((p) => !receiptIds.has(p.cb.id))

  const fmt = (d: Date | string | null) =>
    d ? new Date(d).toISOString().slice(0, 10) : ''

  // Phase 6: Missing Cheques Report with ageing (0–30, 31–60, 61–90, 90+ days)
  const refDate = project.reconciliationDate ? new Date(project.reconciliationDate) : new Date()
  const allUnpresented = [
    ...unmatchedPayments.map((t) => ({ ...t, fromProject: project.name })),
    ...broughtForwardItems.map((t) => ({ date: t.date, name: t.name, chqNo: t.chqNo, amount: t.amount, fromProject: t.fromProject })),
  ]
  const missingChequesWithAgeing = buildMissingChequesAgeing(allUnpresented, refDate)
  const missingChequesAgeingSummary = {
    band0_30: { count: missingChequesWithAgeing.filter((x) => x.ageingBand === '0–30').length, total: missingChequesWithAgeing.filter((x) => x.ageingBand === '0–30').reduce((s, x) => s + x.amount, 0) },
    band31_60: { count: missingChequesWithAgeing.filter((x) => x.ageingBand === '31–60').length, total: missingChequesWithAgeing.filter((x) => x.ageingBand === '31–60').reduce((s, x) => s + x.amount, 0) },
    band61_90: { count: missingChequesWithAgeing.filter((x) => x.ageingBand === '61–90').length, total: missingChequesWithAgeing.filter((x) => x.ageingBand === '61–90').reduce((s, x) => s + x.amount, 0) },
    band90_plus: { count: missingChequesWithAgeing.filter((x) => x.ageingBand === '90+').length, total: missingChequesWithAgeing.filter((x) => x.ageingBand === '90+').reduce((s, x) => s + x.amount, 0) },
  }

  const receiptIdsForDisc = new Set(receipts.map((t) => t.id))
  // Phase 6: Reconciliation Discrepancy Report — summary by variance band
  const discList = matchPairs.filter((p) => {
    const amountDiff = Math.abs(p.cb.amount - p.bank.amount)
    const cbDate = p.cb.date ? new Date(p.cb.date) : null
    const bankDate = p.bank.date ? new Date(p.bank.date) : null
    const dateDiffDays = cbDate && bankDate ? Math.abs((cbDate.getTime() - bankDate.getTime()) / (1000 * 60 * 60 * 24)) : 0
    return amountDiff > 0.01 || dateDiffDays > 0
  }).map((p) => {
    const amountVariance = Math.abs(p.cb.amount - p.bank.amount)
    const dateVarianceDays = p.cb.date && p.bank.date ? Math.abs((new Date(p.cb.date).getTime() - new Date(p.bank.date).getTime()) / (1000 * 60 * 60 * 24)) : 0
    const isReceipt = receiptIdsForDisc.has(p.cb.id)
    return {
      cbDate: fmt(p.cb.date),
      cbName: p.cb.name || p.cb.details || '—',
      cbChqNo: p.cb.chqNo || null,
      cbDocRef: p.cb.docRef || null,
      cbAmount: p.cb.amount,
      cbAmountReceived: isReceipt ? p.cb.amount : null,
      cbAmountPaid: !isReceipt ? p.cb.amount : null,
      bankDate: fmt(p.bank.date),
      bankDescription: p.bank.name || p.bank.details || '—',
      bankChqNo: p.bank.chqNo || null,
      bankDocRef: p.bank.docRef || null,
      bankAmount: p.bank.amount,
      amountVariance,
      dateVarianceDays,
      amountVarianceBand: amountVariance <= 1 ? '0–1' : amountVariance <= 100 ? '1–100' : amountVariance <= 500 ? '100–500' : '500+',
      dateVarianceBand: dateVarianceDays <= 7 ? '0–7 days' : dateVarianceDays <= 30 ? '7–30 days' : '30+ days',
    }
  })
  // Paid-out explicit classification from matched payment/debit pairs:
  // - more_in_cb_than_bs: cash book payment amount > bank debit amount
  // - more_in_bs_than_cb: bank debit amount > cash book payment amount
  const paidOutVarianceRows = matchPairs.map((p) => {
    const isReceipt = receiptIdsForDisc.has(p.cb.id)
    const cbAmount = p.cb.amount
    const bankAmount = p.bank.amount
    const variance = cbAmount - bankAmount
    return {
      isReceipt,
      cbDate: fmt(p.cb.date),
      cbName: p.cb.name || p.cb.details || '—',
      cbChqNo: p.cb.chqNo || null,
      cbDocRef: p.cb.docRef || null,
      cbAmount,
      bankDate: fmt(p.bank.date),
      bankDescription: p.bank.name || p.bank.details || '—',
      bankChqNo: p.bank.chqNo || null,
      bankDocRef: p.bank.docRef || null,
      bankAmount,
      variance,
      absoluteVariance: Math.abs(variance),
    }
  }).filter((r) => !r.isReceipt && Math.abs(r.variance) > 0.01)
  const paidOutVarianceBreakdown = {
    moreInCbThanBs: paidOutVarianceRows.filter((r) => r.variance > 0),
    moreInBsThanCb: paidOutVarianceRows.filter((r) => r.variance < 0),
  }
  const hasDiscrepancyReport = hasPlanFeature(project.organization.plan, 'discrepancy_report')
  const hasMissingChequesReport = hasPlanFeature(project.organization.plan, 'missing_cheques_report')

  const discrepancySummary = hasDiscrepancyReport ? {
    byAmountBand: [
      { band: '0–1', count: discList.filter((d) => d.amountVarianceBand === '0–1').length, totalVariance: discList.filter((d) => d.amountVarianceBand === '0–1').reduce((s, d) => s + d.amountVariance, 0) },
      { band: '1–100', count: discList.filter((d) => d.amountVarianceBand === '1–100').length, totalVariance: discList.filter((d) => d.amountVarianceBand === '1–100').reduce((s, d) => s + d.amountVariance, 0) },
      { band: '100–500', count: discList.filter((d) => d.amountVarianceBand === '100–500').length, totalVariance: discList.filter((d) => d.amountVarianceBand === '100–500').reduce((s, d) => s + d.amountVariance, 0) },
      { band: '500+', count: discList.filter((d) => d.amountVarianceBand === '500+').length, totalVariance: discList.filter((d) => d.amountVarianceBand === '500+').reduce((s, d) => s + d.amountVariance, 0) },
    ].filter((r) => r.count > 0),
    byDateBand: [
      { band: '0–7 days', count: discList.filter((d) => d.dateVarianceBand === '0–7 days').length },
      { band: '7–30 days', count: discList.filter((d) => d.dateVarianceBand === '7–30 days').length },
      { band: '30+ days', count: discList.filter((d) => d.dateVarianceBand === '30+ days').length },
    ].filter((r) => r.count > 0),
  } : null

  const effectiveDiscList = hasDiscrepancyReport ? discList : []
  const effectiveMissingCheques = hasMissingChequesReport ? missingChequesWithAgeing : []
  const effectiveMissingChequesSummary = hasMissingChequesReport ? missingChequesAgeingSummary : null

  // Legacy BRS statement block (GHANA_BRS_V1 shape) used by current UI consumers.
  // Note: "uncredited lodgments" here includes unmatched bank credits for backward compatibility.
  // Unpresented cheques = unmatched payments (cheques not in bank) + brought forward
  const computedCashBookBalance = receipts.reduce((s, t) => s + t.amount, 0) - payments.reduce((s, t) => s + t.amount, 0)
  const declaredCashBookBalance = extractCashBookClosingBalanceFromDoc(receiptsDocs[0]?.filepath || paymentsDocs[0]?.filepath || '')
  const balancePerCashBook = declaredCashBookBalance ?? computedCashBookBalance
  const unmatchedReceiptsTotal = unmatchedReceipts.reduce((s, t) => s + t.amount, 0)
  const unmatchedCreditsTotal = unmatchedCredits.reduce((s, t) => s + t.amount, 0)
  const broughtForwardLodgmentsTotal = broughtForwardLodgments.reduce((s, t) => s + t.amount, 0)
  const broughtForwardReceiptLodgmentsTotal = broughtForwardLodgments
    .filter((t) => t.source === 'cash_book_receipts')
    .reduce((s, t) => s + t.amount, 0)
  const broughtForwardBankCreditsTotal = broughtForwardLodgments
    .filter((t) => t.source === 'bank_credits')
    .reduce((s, t) => s + t.amount, 0)
  const uncreditedLodgmentsTotal = unmatchedReceiptsTotal + unmatchedCreditsTotal + broughtForwardLodgmentsTotal
  const uncreditedLodgmentsTimingTotal = unmatchedReceiptsTotal + broughtForwardReceiptLodgmentsTotal
  const unmatchedPaymentsTotal = unmatchedPayments.reduce((s, t) => s + t.amount, 0)
  const unmatchedPaymentsWithoutDetailsTotal = unmatchedPayments
    .filter((t) => !(t.details || '').trim())
    .reduce((s, t) => s + t.amount, 0)
  const broughtForwardTotal = broughtForwardItems.reduce((s, t) => s + t.amount, 0)
  // Manual-template alignment:
  // "Unpresented cheques" excludes rows parked as unmatched payments with blank details.
  const unpresentedChequesTotal = unmatchedPaymentsTotal + broughtForwardTotal
  const unmatchedDebitsLinkedToCashBookTotal = unmatchedDebits
    .filter((d) => payments.some((p) => hasChequeOrRefLink(p, d)))
    .reduce((s, t) => s + t.amount, 0)
  const unmatchedDebitsTotal = unmatchedDebits.reduce((s, t) => s + t.amount, 0)
  // Final-facing report excludes bank-only items from displayed as-at sections.
  const asAtUncreditedTotal = unmatchedReceiptsTotal
  const asAtUnpresentedTotal = unmatchedPaymentsTotal
  const bankOnlyCreditsNotInCashBookTotal = unmatchedCreditsTotal + broughtForwardBankCreditsTotal
  // Debits with cheque/ref linkage to cash-book payments are not treated as "bank-only" in manual workbook style.
  const bankOnlyDebitsNotInCashBookTotal = unmatchedDebitsTotal
  const bankStatementClosingBalanceValue =
    toNumOrNull((project as { bankStatementClosingBalance?: unknown }).bankStatementClosingBalance) ??
    extractSourceClosingBalanceFromDocs(creditsDocs.concat(debitsDocs).map((d) => d.filepath))
  const {
    bankOnlyReconcilingNet,
    bankClosingBalanceLegacy,
    bankClosingBalanceGhanaStyle,
    bankClosingBalance,
  } = computeBrsMetrics({
    balancePerCashBook,
    uncreditedLodgmentsTotal,
    uncreditedLodgmentsTimingTotal,
    unpresentedChequesTotal,
    bankOnlyCreditsNotInCashBookTotal,
    bankOnlyDebitsNotInCashBookTotal,
    bankStatementClosingBalance: bankStatementClosingBalanceValue,
  })
  const unpresentedCurrentCashBookPeriod = unmatchedPaymentsTotal
  const timingUncreditedCurrentPeriod = unmatchedReceiptsTotal
  const timingUncreditedBroughtForwardPrior = broughtForwardReceiptLodgmentsTotal
  const unpresentedBroughtForwardPrior = broughtForwardTotal
  const bankOnlyCreditsCurrentPeriod = unmatchedCreditsTotal
  const bankOnlyCreditsBroughtForwardPrior = broughtForwardBankCreditsTotal
  const workbookScheduleDerivedCashBook = deriveCashBookFromWorkbookSchedule({
    bankClosingBalance,
    uncreditedLodgmentsTimingTotal,
    unpresentedChequesTotal,
    bankOnlyDebitsNotInCashBookTotal,
    bankOnlyCreditsNotInCashBookTotal,
  })
  const workbookScheduleTieOutVariance = balancePerCashBook - workbookScheduleDerivedCashBook
  const headerBankAccount = resolveBankAccountForReportHeader(
    project.bankAccounts as ReportBankAccountRow[] | undefined,
    bankAccountId
  )
  const bankAccountHeaderLine = headerBankAccount ? formatBankAccountHeaderLine(headerBankAccount) : null

  // Status is set to 'completed' only when the project is approved (see projects approve handler)
  await logAudit({
    organizationId: orgId,
    userId: req.auth!.userId,
    projectId,
    action: 'report_generated',
  })

  const branding = (project.organization.branding as Record<string, unknown>) || {}
  const curr = project.currency || 'GHS'
  const fmtAmt = (n: number) => formatAmountForReport(n, curr)
  const defaultNarrative =
    project.reportNarrative ||
    `This reconciliation shows ${matchPairs.length} matched transaction(s). Unpresented cheques total ${fmtAmt(unpresentedChequesTotal)}; uncredited lodgments total ${fmtAmt(uncreditedLodgmentsTimingTotal)}.`
  const reportLanguageProfile = {
    code: 'GHANA_BRS_V1',
    label: 'Standard BRS terminology profile',
    signedAmountSupport: true,
    asAtAndPostPeriodMovement: true,
    labels: {
      openingBankStatementBalance: 'As per bank statement (input/source file)',
      closingBankStatementBalance: 'Closing balance per bank statement',
      addUncreditedLodgments: 'Add: Uncredited lodgments / uncleared deposits',
      /** Main BRS workbook lines — wording aligned with common regional worksheet layouts. */
      addBankOnlyDebitsNotInCashBookLine: 'Add: Bank-only debits not in cash book',
      deductBankOnlyCreditsNotInCashBookLine: 'Deduct: Bank-only credits not in cash book',
      addBankOnlyCredits: 'Deduct: Bank-only credits not in cash book',
      lessBankOnlyDebits: 'Add: Bank-only debits not in cash book',
      lessUnpresentedCheques: 'Less: Unpresented cheques',
      cashBookBalanceEnd: 'Cash book balance at end of period',
      additionalInformationTitle: 'Additional information (BRS terminology profile)',
      asAtReconciliationPosition: 'As-at reconciliation position',
      postPeriodMovement: 'Post-period movement (carried forward)',
      uncreditedLodgmentsOrUnclearedDeposits: 'Uncredited lodgments / uncleared deposits',
      bankOnlyCreditsNotInCashBook: 'Bank-only credits not in cash book',
      bankOnlyDebitsNotInCashBook: 'Bank-only debits not in cash book',
      unpresentedChequesOrUnclearedPayments: 'Unpresented cheques / uncleared payments',
      broughtForwardUncreditedLodgments: 'Brought-forward uncredited lodgments',
      broughtForwardBankOnlyCredits: 'Brought-forward bank-only credits',
      broughtForwardUnpresentedCheques: 'Brought-forward unpresented cheques',
      workbookCompositionTimingUncreditedCurrent: 'Thereof — current-period timing uncredited',
      workbookCompositionTimingUncreditedPrior: 'Thereof — brought-forward timing uncredited (prior period)',
      workbookCompositionUnpresentedCurrent: 'Thereof — current-period unpresented cheques',
      workbookCompositionUnpresentedPrior: 'Thereof — brought-forward unpresented cheques (prior period)',
      workbookCompositionBankCreditsCurrent: 'Thereof — current-period bank-only credits',
      workbookCompositionBankCreditsPrior: 'Thereof — brought-forward bank-only credits (prior period)',
    },
  }
  const reportCompletedAt = project.approvedAt || project.reviewedAt || project.preparedAt || new Date()

  res.json({
    bankAccounts: project.bankAccounts || [],
    bankAccountId: bankAccountId || null,
    selectedBankAccountName: headerBankAccount ? headerBankAccount.name : null,
    selectedBankAccountNo: headerBankAccount?.accountNo || null,
    bankAccountHeaderLine,
    narrative: defaultNarrative,
    preparerComment: (project as { preparerComment?: string | null }).preparerComment ?? null,
    reviewerComment: (project as { reviewerComment?: string | null }).reviewerComment ?? null,
    reportLanguageProfile,
    brsStatement: {
      bankClosingBalance,
      bankClosingBalanceLegacy,
      bankClosingBalanceGhanaStyle,
      uncreditedLodgmentsTotal,
      uncreditedLodgmentsTimingTotal,
      broughtForwardLodgmentsTotal,
      unpresentedChequesTotal,
      bankOnlyCreditsNotInCashBookTotal,
      bankOnlyDebitsNotInCashBookTotal,
      bankOnlyReconcilingNet,
      balancePerCashBook,
      bankStatementClosingBalance: bankStatementClosingBalanceValue,
      workbookScheduleDerivedCashBook,
      workbookScheduleTieOutVariance,
      timingUncreditedCurrentPeriod,
      timingUncreditedBroughtForwardPrior,
      unpresentedCurrentCashBookPeriod,
      unpresentedBroughtForwardPrior,
      bankOnlyCreditsCurrentPeriod,
      bankOnlyCreditsBroughtForwardPrior,
    },
    additionalInformation: {
      asAtReconciliationPosition: {
        uncreditedLodgmentsOrUnclearedDeposits: asAtUncreditedTotal,
        bankOnlyCreditsNotInCashBook: unmatchedCreditsTotal,
        bankOnlyDebitsNotInCashBook: unmatchedDebitsTotal,
        unpresentedChequesOrUnclearedPayments: asAtUnpresentedTotal,
      },
      postPeriodMovement: {
        broughtForwardUncreditedLodgments: broughtForwardLodgmentsTotal,
        broughtForwardBankOnlyCredits: broughtForwardBankCreditsTotal,
        broughtForwardUnpresentedCheques: broughtForwardTotal,
      },
    },
    project: {
      id: project.id,
      name: project.name,
      reconciliationDate: project.reconciliationDate,
      status: project.status,
      bankStatementClosingBalance: bankStatementClosingBalanceValue,
      reportNarrative: (project as { reportNarrative?: string | null }).reportNarrative ?? null,
      preparerComment: (project as { preparerComment?: string | null }).preparerComment ?? null,
      reviewerComment: (project as { reviewerComment?: string | null }).reviewerComment ?? null,
      preparedBy: project.preparedBy ? { name: project.preparedBy.name, email: project.preparedBy.email } : null,
      preparedAt: project.preparedAt?.toISOString() ?? null,
      reviewedBy: project.reviewedBy ? { name: project.reviewedBy.name, email: project.reviewedBy.email } : null,
      reviewedAt: project.reviewedAt?.toISOString() ?? null,
      approvedBy: project.approvedBy ? { name: project.approvedBy.name, email: project.approvedBy.email } : null,
      approvedAt: project.approvedAt?.toISOString() ?? null,
    },
    organization: { name: project.organization.name, branding },
    summary: {
      matchedCount: project.matches.length,
      matchedReceiptsCreditsCount: matchedReceiptsVsCredits.length,
      matchedPaymentsDebitsCount: matchedPaymentsVsDebits.length,
      unmatchedReceipts: unmatchedReceipts.length,
      unmatchedCredits: unmatchedCredits.length,
      unmatchedPayments: unmatchedPayments.length,
      unmatchedDebits: unmatchedDebits.length,
      totalTransactions:
        receipts.length + credits.length + payments.length + debits.length,
    },
    sourceFilterLogic,
    matchedPairs: (() => {
      return matchPairs.map((p) => {
        const isReceipt = receiptIds.has(p.cb.id)
        return {
          cbDate: fmt(p.cb.date),
          cbName: p.cb.name || p.cb.details || '—',
          cbChqNo: p.cb.chqNo || null,
          cbDocRef: p.cb.docRef || null,
          cbAmount: p.cb.amount,
          cbAmountReceived: isReceipt ? p.cb.amount : null,
          cbAmountPaid: !isReceipt ? p.cb.amount : null,
          bankDate: fmt(p.bank.date),
          bankDescription: p.bank.name || p.bank.details || '—',
          bankChqNo: p.bank.chqNo || null,
          bankDocRef: p.bank.docRef || null,
          bankAmount: p.bank.amount,
        }
      })
    })(),
    matchedReceiptsVsCredits: matchedReceiptsVsCredits.map((p) => ({
      cbDate: fmt(p.cb.date),
      cbName: p.cb.name || p.cb.details || '—',
      cbChqNo: p.cb.chqNo || null,
      cbDocRef: p.cb.docRef || null,
      cbAmount: p.cb.amount,
      bankDate: fmt(p.bank.date),
      bankDescription: p.bank.name || p.bank.details || '—',
      bankChqNo: p.bank.chqNo || null,
      bankDocRef: p.bank.docRef || null,
      bankAmount: p.bank.amount,
    })),
    matchedPaymentsVsDebits: matchedPaymentsVsDebits.map((p) => ({
      cbDate: fmt(p.cb.date),
      cbName: p.cb.name || p.cb.details || '—',
      cbChqNo: p.cb.chqNo || null,
      cbDocRef: p.cb.docRef || null,
      cbAmount: p.cb.amount,
      bankDate: fmt(p.bank.date),
      bankDescription: p.bank.name || p.bank.details || '—',
      bankChqNo: p.bank.chqNo || null,
      bankDocRef: p.bank.docRef || null,
      bankAmount: p.bank.amount,
    })),
    discrepancies: effectiveDiscList.map(({ cbDate, cbName, cbChqNo, cbDocRef, cbAmount, cbAmountReceived, cbAmountPaid, bankDate, bankDescription, bankChqNo, bankDocRef, bankAmount, amountVariance, dateVarianceDays }) => ({
      cbDate,
      cbName,
      cbChqNo: cbChqNo ?? null,
      cbDocRef: cbDocRef ?? null,
      cbAmount,
      cbAmountReceived: cbAmountReceived ?? null,
      cbAmountPaid: cbAmountPaid ?? null,
      bankDate,
      bankDescription,
      bankChqNo: bankChqNo ?? null,
      bankDocRef: bankDocRef ?? null,
      bankAmount,
      amountVariance,
      dateVarianceDays,
    })),
    paidOutVarianceBreakdown,
    missingChequesWithAgeing: effectiveMissingCheques,
    missingChequesAgeingSummary: effectiveMissingChequesSummary,
    discrepancySummary,
    reversalCandidates,
    unmatchedReceipts: unmatchedReceipts.map((t) => ({
      date: fmt(t.date),
      name: t.name || '—',
      details: t.details || '—',
      chqNo: t.chqNo || null,
      docRef: t.docRef || null,
      amount: t.amount,
      amountReceived: t.amount,
      amountPaid: null as number | null,
    })),
    unmatchedCredits: unmatchedCredits.map((t) => ({
      date: fmt(t.date),
      description: t.name || t.details || '—',
      chqNo: t.chqNo || null,
      docRef: t.docRef || null,
      amount: t.amount,
      debit: '',
      credit: t.amount,
    })),
    unmatchedPayments: unmatchedPayments.map((t) => ({
      date: fmt(t.date),
      name: t.name || '—',
      details: t.details || '—',
      chqNo: t.chqNo || null,
      docRef: t.docRef || null,
      amount: t.amount,
      amountReceived: null as number | null,
      amountPaid: t.amount,
    })),
    unmatchedDebits: unmatchedDebits.map((t) => ({
      date: fmt(t.date),
      description: t.name || t.details || '—',
      chqNo: t.chqNo || null,
      docRef: t.docRef || null,
      amount: t.amount,
      debit: t.amount,
      credit: '',
    })),
    broughtForwardItems,
    broughtForwardLodgments,
    currency: project.currency || 'GHS',
    reportCompletedAt: reportCompletedAt.toISOString(),
    generatedAt: new Date().toISOString(),
  })
})

router.get('/:projectId/export', async (req: AuthRequest, res) => {
  // Keep export table columns aligned with docs/REPORT_LAYOUT_SCHEMA.md (compact layout).
  const role = req.auth!.role
  if (!canExportReport(role)) {
    return res.status(403).json({ error: 'Insufficient permission to export reports' })
  }
  const format = (req.query.format as string)?.toLowerCase() || 'excel'
  const bankAccountId = (req.query.bankAccountId as string) || undefined
  const scopeRaw = ((req.query.scope as string) || 'full').toLowerCase()
  const brsOnlyExport = scopeRaw === 'brs_only'
  const signedAmounts = String(req.query.signedAmounts || '').toLowerCase()
  const useSignedAmounts = signedAmounts === '1' || signedAmounts === 'true' || signedAmounts === 'yes'
  const orgId = req.auth!.orgId
  const projectId = await resolveProjectId(req.params.projectId, orgId)
  if (!projectId) return res.status(404).json({ error: 'Project not found' })

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
    include: {
      organization: true,
      bankAccounts: true,
      rollForwardFrom: { select: { id: true, name: true } },
      documents: { include: { transactions: true } },
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

  const receipts = dedupeTransactions(receiptsDocs.flatMap((d) => (d.transactions || []).map(toTx)))
  const payments = dedupeTransactions(paymentsDocs.flatMap((d) => (d.transactions || []).map(toTx)))
  const credits = dedupeTransactions(creditsDocs.flatMap((d) => (d.transactions || []).map(toTx)))
  const debits = dedupeTransactions(debitsDocs.flatMap((d) => (d.transactions || []).map(toTx)))

  let broughtForwardItemsExport: { date: string; name: string; chqNo: string | null; amount: number; fromProject: string }[] = []
  let broughtForwardLodgmentsExport: { amount: number; source: 'cash_book_receipts' | 'bank_credits' }[] = []
  if (project.rollForwardFromProjectId && project.rollForwardFrom) {
    const prevProject = await prisma.project.findFirst({
      where: { id: project.rollForwardFromProjectId, organizationId: orgId },
      include: {
        documents: { include: { transactions: true } },
        matches: { include: { matchItems: true } },
      },
    })
    if (prevProject) {
      const prevPaymentsDocs = prevProject.documents.filter((d) => d.type === 'cash_book_payments')
      const prevReceiptsDocs = prevProject.documents.filter((d) => d.type === 'cash_book_receipts')
      const prevCreditsDocs = prevProject.documents.filter(
        (d) => d.type === 'bank_credits' && (!bankAccountId || d.bankAccountId === bankAccountId)
      )
      const prevDebitsDocs = prevProject.documents.filter(
        (d) => d.type === 'bank_debits' && (!bankAccountId || d.bankAccountId === bankAccountId)
      )
      const prevReceipts = prevReceiptsDocs.flatMap((d) => (d.transactions || []).map((t) => toTx(t)))
      const prevPayments = prevPaymentsDocs.flatMap((d) => (d.transactions || []).map((t) => toTx(t)))
      const prevCredits = prevCreditsDocs.flatMap((d) => (d.transactions || []).map((t) => toTx(t)))
      const prevMatchedCbIds = new Set<string>()
      const prevMatchedBankIds = new Set<string>()
      for (const m of prevProject.matches) {
        for (const mi of m.matchItems) {
          if (mi.side === 'cash_book') prevMatchedCbIds.add(mi.transactionId)
          else prevMatchedBankIds.add(mi.transactionId)
        }
      }
      const prevFmt = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '')
      
      const isAlreadyInCurrent = (t: TxLike, currentSet: TxLike[]) => {
        const dStr = t.date ? new Date(t.date).toISOString().slice(0, 10) : ''
        const key = `${dStr}|${Number(t.amount).toFixed(2)}|${(t.chqNo || '').toLowerCase()}|${(t.docRef || '').toLowerCase()}|${(t.name || t.details || '').toLowerCase().trim()}`
        return currentSet.some(c => {
          const cdStr = c.date ? new Date(c.date).toISOString().slice(0, 10) : ''
          const cKey = `${cdStr}|${Number(c.amount).toFixed(2)}|${(c.chqNo || '').toLowerCase()}|${(c.docRef || '').toLowerCase()}|${(c.name || c.details || '').toLowerCase().trim()}`
          return key === cKey
        })
      }

      broughtForwardItemsExport = prevPayments
        .filter((t) => !prevMatchedCbIds.has(t.id))
        .filter(t => !isAlreadyInCurrent(t, payments))
        .map((t) => ({
          date: prevFmt(t.date),
          name: t.name || t.details || '—',
          chqNo: t.chqNo || null,
          amount: t.amount,
          fromProject: prevProject.name,
        }))
      broughtForwardLodgmentsExport = [
        ...prevReceipts
          .filter((t) => !prevMatchedCbIds.has(t.id))
          .filter(t => !isAlreadyInCurrent(t, receipts))
          .map((t) => ({ amount: t.amount, source: 'cash_book_receipts' as const })),
        ...prevCredits
          .filter((t) => !prevMatchedBankIds.has(t.id))
          .filter(t => !isAlreadyInCurrent(t, credits))
          .map((t) => ({ amount: t.amount, source: 'bank_credits' as const })),
      ]
    }
  }

  const matchedCbIds = new Set<string>()
  const matchedBankIds = new Set<string>()
  const matchPairs: { cb: TxLike; bank: TxLike }[] = []
  const allTxsExport = receipts.concat(payments).concat(credits).concat(debits)

  for (const m of project.matches) {
    const cbIds: string[] = []
    const bankIds: string[] = []
    for (const mi of m.matchItems) {
      const tx = allTxsExport.find((t: TxLike) => t.id === mi.transactionId)
      if (!tx) continue
      if (mi.side === 'cash_book') {
        matchedCbIds.add(tx.id)
        cbIds.push(tx.id)
      } else {
        matchedBankIds.add(tx.id)
        bankIds.push(tx.id)
      }
    }
    const cbTxs = cbIds.map((id) => allTxsExport.find((t: TxLike) => t.id === id)).filter(Boolean) as TxLike[]
    const bankTxs = bankIds.map((id) => allTxsExport.find((t: TxLike) => t.id === id)).filter(Boolean) as TxLike[]
    if (cbTxs.length === 0 || bankTxs.length === 0) continue
    if (cbTxs.length === 1 && bankTxs.length >= 1) {
      bankTxs.forEach((bt) => matchPairs.push({ cb: cbTxs[0]!, bank: bt }))
    } else if (cbTxs.length >= 1 && bankTxs.length === 1) {
      cbTxs.forEach((ct) => matchPairs.push({ cb: ct, bank: bankTxs[0]! }))
    } else if (cbTxs.length === 1 && bankTxs.length === 1) {
      matchPairs.push({ cb: cbTxs[0]!, bank: bankTxs[0]! })
    } else {
      const n = Math.max(cbTxs.length, bankTxs.length)
      for (let i = 0; i < n; i++) {
        matchPairs.push({ cb: cbTxs[i % cbTxs.length]!, bank: bankTxs[i % bankTxs.length]! })
      }
    }
  }

  const fmt = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '')
  const branding = (project.organization.branding as Record<string, unknown>) || {}
  const platformDefaults = await getPlatformDefaults()
  const reportTitle = (branding.reportTitle as string) || platformDefaults.defaultReportTitle
  const curr = project.currency || 'GHS'
  const hasDiscrepancyReportExport = hasPlanFeature(project.organization.plan, 'discrepancy_report')
  const hasMissingChequesReportExport = hasPlanFeature(project.organization.plan, 'missing_cheques_report')
  const reportLanguageProfile = {
    code: 'GHANA_BRS_V1',
    label: 'Standard BRS terminology profile',
    signedAmountSupport: true,
    asAtAndPostPeriodMovement: true,
    labels: {
      openingBankStatementBalance: 'As per bank statement (input)',
      closingBankStatementBalance: 'Closing balance per bank statement',
      addUncreditedLodgments: 'Add: Uncredited lodgments / uncleared deposits',
      addBankOnlyDebitsNotInCashBookLine: 'Add: Bank-only debits not in cash book',
      deductBankOnlyCreditsNotInCashBookLine: 'Deduct: Bank-only credits not in cash book',
      addBankOnlyCredits: 'Deduct: Bank-only credits not in cash book',
      lessBankOnlyDebits: 'Add: Bank-only debits not in cash book',
      lessUnpresentedCheques: 'Less: Unpresented cheques',
      cashBookBalanceEnd: 'Cash book balance at end of period',
      additionalInformationTitle: 'NOTES',
      asAtReconciliationPosition: 'As-at reconciliation position',
      postPeriodMovement: 'Post-period movement (carried forward)',
      uncreditedLodgmentsOrUnclearedDeposits: 'Uncredited lodgments / uncleared deposits',
      bankOnlyCreditsNotInCashBook: 'Bank-only credits not in cash book',
      bankOnlyDebitsNotInCashBook: 'Bank-only debits not in cash book',
      unpresentedChequesOrUnclearedPayments: 'Unpresented cheques / uncleared payments',
      broughtForwardUncreditedLodgments: 'Brought-forward uncredited lodgments',
      broughtForwardBankOnlyCredits: 'Brought-forward bank-only credits',
      broughtForwardUnpresentedCheques: 'Brought-forward unpresented cheques',
      workbookCompositionTimingUncreditedCurrent: 'Thereof — current-period timing uncredited',
      workbookCompositionTimingUncreditedPrior: 'Thereof — brought-forward timing uncredited (prior period)',
      workbookCompositionUnpresentedCurrent: 'Thereof — current-period unpresented cheques',
      workbookCompositionUnpresentedPrior: 'Thereof — brought-forward unpresented cheques (prior period)',
      workbookCompositionBankCreditsCurrent: 'Thereof — current-period bank-only credits',
      workbookCompositionBankCreditsPrior: 'Thereof — brought-forward bank-only credits (prior period)',
    },
  }
  const exportLabels = reportLanguageProfile.labels
  const primaryColor = (branding.primaryColor as string) || platformDefaults.defaultPrimaryColor

  const receiptIds = new Set(receipts.map((t) => t.id))
  const matchedRows = matchPairs.map((p) => {
    const cbAmount = p.cb.amount
    const variance = Math.abs(cbAmount - p.bank.amount)
    return {
      'Cash Book': `${fmt(p.cb.date)} - ${p.cb.name || p.cb.details || '—'}`,
      [`Cash Book Amount (${curr})`]: cbAmount,
      'Bank': `${fmt(p.bank.date)} - ${p.bank.name || p.bank.details || '—'}`,
      [`Bank Amount (${curr})`]: p.bank.amount,
      [`Variance (${curr})`]: variance,
    }
  })

  const unmatchedReceiptsRaw = receipts.filter((t) => !matchedCbIds.has(t.id))
  const unmatchedReceipts = unmatchedReceiptsRaw.map((t) => {
    return {
      Date: fmt(t.date),
      Details: t.name || t.details || '',
      [`Amount (${curr})`]: t.amount,
    }
  })

  const unmatchedCreditsRaw = credits.filter((t) => !matchedBankIds.has(t.id))
  const unmatchedCredits = unmatchedCreditsRaw.map((t) => {
    return {
      Date: fmt(t.date),
      Description: t.name || t.details || '',
      [`Amount (${curr})`]: t.amount,
    }
  })

  const unmatchedPaymentsRaw = payments.filter((t) => !matchedCbIds.has(t.id))
  const unmatchedPayments = unmatchedPaymentsRaw.map((t) => {
    return {
      Date: fmt(t.date),
      Details: t.name || t.details || '',
      [`Amount (${curr})`]: t.amount,
    }
  })
  const refDateExport = project.reconciliationDate ? new Date(project.reconciliationDate) : new Date()
  const allUnpresentedExport = [
    ...payments.filter((t) => !matchedCbIds.has(t.id)).map((t) => ({
      date: t.date ? new Date(t.date).toISOString().slice(0, 10) : '',
      name: t.name || t.details || '—',
      chqNo: t.chqNo || null,
      amount: t.amount,
    })),
    ...broughtForwardItemsExport.map((t) => ({
      date: t.date,
      name: t.name,
      chqNo: t.chqNo,
      amount: t.amount,
    })),
  ]
  const missingChequesAgeingExport = buildMissingChequesAgeing(allUnpresentedExport, refDateExport).map((t) => ({
    Date: t.date,
    'CHQ NO': t.chqNo || '',
    'DOC REF': '',
    Name: t.name || '',
    [`Amount (${curr})`]: t.amount,
    'Days Outstanding': t.daysOutstanding,
    'Ageing Band': t.ageingBand,
  }))
  const receiptIdsExport = new Set(receipts.map((t) => t.id))
  const discrepancies = matchPairs.filter((p) => {
    const amountDiff = Math.abs(p.cb.amount - p.bank.amount)
    const cbDate = p.cb.date ? new Date(p.cb.date) : null
    const bankDate = p.bank.date ? new Date(p.bank.date) : null
    const dateDiffDays = cbDate && bankDate ? Math.abs((cbDate.getTime() - bankDate.getTime()) / (1000 * 60 * 60 * 24)) : 0
    return amountDiff > 0.01 || dateDiffDays > 0
  }).map((p) => {
    const isReceipt = receiptIdsExport.has(p.cb.id)
    return {
      'Cash Book Date': fmt(p.cb.date),
      'Cash Book Desc': (p.cb.name || p.cb.details || '').slice(0, 40),
      'Cash Book Chq No': p.cb.chqNo || '',
      'DOC REF': p.cb.docRef || '',
      [`AMT RECEIVED (${curr})`]: isReceipt ? p.cb.amount : '',
      [`AMT PAID (${curr})`]: !isReceipt ? p.cb.amount : '',
      'Bank Date': fmt(p.bank.date),
      'Bank Desc': (p.bank.name || p.bank.details || '').slice(0, 40),
      'Bank Chq No': p.bank.chqNo || '',
      'DOC REF (BANK)': p.bank.docRef || '',
      [`Bank Amount (${curr})`]: p.bank.amount,
      [`Amount Variance (${curr})`]: Math.abs(p.cb.amount - p.bank.amount),
      'Date Diff Days': p.cb.date && p.bank.date ? Math.abs((new Date(p.cb.date).getTime() - new Date(p.bank.date).getTime()) / (1000 * 60 * 60 * 24)) : 0,
    }
  })
  const unmatchedDebitsRaw = debits.filter((t) => !matchedBankIds.has(t.id))
  const unmatchedDebits = unmatchedDebitsRaw.map((t) => {
    return {
      Date: fmt(t.date),
      Description: t.name || t.details || '',
      [`Amount (${curr})`]: t.amount,
    }
  })

  const computedCashBookBalance = receipts.reduce((s, t) => s + t.amount, 0) - payments.reduce((s, t) => s + t.amount, 0)
  const declaredCashBookBalance = extractCashBookClosingBalanceFromDoc(receiptsDocs[0]?.filepath || paymentsDocs[0]?.filepath || '')
  const balancePerCashBook = declaredCashBookBalance ?? computedCashBookBalance
  const unmatchedReceiptsTotalExport = receipts.filter((t) => !matchedCbIds.has(t.id)).reduce((s, t) => s + t.amount, 0)
  const unmatchedCreditsTotalExport = credits.filter((t) => !matchedBankIds.has(t.id)).reduce((s, t) => s + t.amount, 0)
  const unmatchedPaymentsOnlyExport = payments.filter((t) => !matchedCbIds.has(t.id))
  const unmatchedDebitsOnlyExport = debits.filter((t) => !matchedBankIds.has(t.id))
  const unmatchedPaymentsTotalExport = unmatchedPaymentsOnlyExport.reduce((s, t) => s + t.amount, 0)
  const unmatchedPaymentsWithoutDetailsTotalExport = unmatchedPaymentsOnlyExport
    .filter((t) => !(t.details || '').trim())
    .reduce((s, t) => s + t.amount, 0)
  const unmatchedDebitsTotalExport = unmatchedDebitsOnlyExport.reduce((s, t) => s + t.amount, 0)
  const unmatchedDebitsLinkedToCashBookTotalExport = unmatchedDebitsOnlyExport
    .filter((d) => payments.some((p) => hasChequeOrRefLink(p, d)))
    .reduce((s, t) => s + t.amount, 0)
  const broughtForwardLodgmentsTotalExport = broughtForwardLodgmentsExport.reduce((s, t) => s + t.amount, 0)
  const broughtForwardReceiptLodgmentsTotalExport = broughtForwardLodgmentsExport
    .filter((t) => t.source === 'cash_book_receipts')
    .reduce((s, t) => s + t.amount, 0)
  const broughtForwardBankCreditsTotalExport = broughtForwardLodgmentsExport
    .filter((t) => t.source === 'bank_credits')
    .reduce((s, t) => s + t.amount, 0)
  const uncreditedLodgmentsTotal = unmatchedReceiptsTotalExport + unmatchedCreditsTotalExport + broughtForwardLodgmentsTotalExport
  const uncreditedLodgmentsTimingTotalExport = unmatchedReceiptsTotalExport + broughtForwardReceiptLodgmentsTotalExport
  const unpresentedChequesTotal =
    unmatchedPaymentsTotalExport +
    broughtForwardItemsExport.reduce((s, t) => s + t.amount, 0)
  const broughtForwardChequesTotalExport = broughtForwardItemsExport.reduce((s, t) => s + t.amount, 0)
  const asAtUncreditedTotalExport = unmatchedReceiptsTotalExport
  const asAtUnpresentedTotalExport = unmatchedPaymentsTotalExport
  const bankOnlyCreditsNotInCashBookTotalExport = unmatchedCreditsTotalExport + broughtForwardBankCreditsTotalExport
  const bankOnlyDebitsNotInCashBookTotalExport = unmatchedDebitsTotalExport
  const bankStatementClosingBalanceExport =
    toNumOrNull((project as { bankStatementClosingBalance?: unknown }).bankStatementClosingBalance) ??
    extractSourceClosingBalanceFromDocs(creditsDocs.concat(debitsDocs).map((d) => d.filepath))
  const {
    bankOnlyReconcilingNet: bankOnlyReconcilingNetExport,
    bankClosingBalanceGhanaStyle: bankClosingBalanceGhanaStyleExport,
    bankClosingBalance,
  } = computeBrsMetrics({
    balancePerCashBook,
    uncreditedLodgmentsTotal,
    uncreditedLodgmentsTimingTotal: uncreditedLodgmentsTimingTotalExport,
    unpresentedChequesTotal,
    bankOnlyCreditsNotInCashBookTotal: bankOnlyCreditsNotInCashBookTotalExport,
    bankOnlyDebitsNotInCashBookTotal: bankOnlyDebitsNotInCashBookTotalExport,
    bankStatementClosingBalance: bankStatementClosingBalanceExport,
  })
  const epsComposition = 0.005
  const unpresentedCurrentCashBookPeriodExport = unmatchedPaymentsTotalExport
  const timingUncreditedCurrentPeriodExport = unmatchedReceiptsTotalExport
  const timingUncreditedBroughtForwardPriorExport = broughtForwardReceiptLodgmentsTotalExport
  const unpresentedBroughtForwardPriorExport = broughtForwardChequesTotalExport
  const bankOnlyCreditsCurrentPeriodExport = unmatchedCreditsTotalExport
  const bankOnlyCreditsBroughtForwardPriorExport = broughtForwardBankCreditsTotalExport
  const workbookScheduleDerivedCashBookExport = deriveCashBookFromWorkbookSchedule({
    bankClosingBalance,
    uncreditedLodgmentsTimingTotal: uncreditedLodgmentsTimingTotalExport,
    unpresentedChequesTotal,
    bankOnlyDebitsNotInCashBookTotal: bankOnlyDebitsNotInCashBookTotalExport,
    bankOnlyCreditsNotInCashBookTotal: bankOnlyCreditsNotInCashBookTotalExport,
  })
  const workbookScheduleTieOutVarianceExport = balancePerCashBook - workbookScheduleDerivedCashBookExport
  const headerBankAccountExport = resolveBankAccountForReportHeader(
    project.bankAccounts as ReportBankAccountRow[] | undefined,
    bankAccountId
  )
  const bankAccountHeaderLineExport = headerBankAccountExport
    ? formatBankAccountHeaderLine(headerBankAccountExport)
    : null
  const reconciliationDateExport = project.reconciliationDate
  const fmtBRSTitle = (d: Date | string | null) => {
    if (!d) return '—'
    const date = typeof d === 'string' ? new Date(d) : d
    if (Number.isNaN(date.getTime())) return '—'
    const day = date.getDate()
    const month = date.toLocaleString('en-GB', { month: 'long' }).toUpperCase()
    const year = date.getFullYear()
    return `${day}-${month}-${year}`
  }

  if (format === 'excel' || format === 'xlsx') {
    const wb = XLSX.utils.book_new()
    const footerExport = (branding.footer as string | undefined) || platformDefaults.defaultFooter
    const maybeSigned = (n: number, opts?: { forceNegative?: boolean }): string | number => {
      const forceNegative = !!opts?.forceNegative
      if (!useSignedAmounts) return n
      if (forceNegative) return `-${Math.abs(n).toFixed(2)}`
      if (n > 0) return `+${n.toFixed(2)}`
      if (n < 0) return `-${Math.abs(n).toFixed(2)}`
      return n.toFixed(2)
    }
    const wbAmt = (n: number) => Number(Math.abs(n).toFixed(2))
    // Client-facing workbook: match standard 4-line BRS handout (see LICL template). Full detail stays on web report, NOTES sheet, and other tabs.
    const brsStatementRows: (string | number)[][] = [
      [`${project.organization.name}`],
      [],
      [`Bank Reconciliation Statement as at ${fmtBRSTitle(reconciliationDateExport)}`],
      ...(bankAccountHeaderLineExport ? [[bankAccountHeaderLineExport]] : []),
      [],
      ['Description', `Amount (${curr})`],
      [exportLabels.closingBankStatementBalance, wbAmt(bankClosingBalance)],
      [exportLabels.addUncreditedLodgments, wbAmt(uncreditedLodgmentsTimingTotalExport)],
      [exportLabels.lessUnpresentedCheques, wbAmt(unpresentedChequesTotal)],
      [exportLabels.addBankOnlyDebitsNotInCashBookLine, wbAmt(bankOnlyDebitsNotInCashBookTotalExport)],
      [exportLabels.deductBankOnlyCreditsNotInCashBookLine, wbAmt(bankOnlyCreditsNotInCashBookTotalExport)],
      [exportLabels.cashBookBalanceEnd, wbAmt(workbookScheduleDerivedCashBookExport)],
      [],
      [
        'Note: timing items are transactions already in the cash book but not yet reflected by the bank at the reconciliation date. Bank charges, credits, and other bank-only movements are explained in the NOTES sheet and supporting schedules.',
        '',
      ],
      [],
      ['Checked By:', ''],
      ['Signed off By:', ''],
      ['Date:', ''],
      ...(footerExport ? [[], [footerExport]] : []),
    ]
    const brsStatementSheet = XLSX.utils.aoa_to_sheet(brsStatementRows)
    XLSX.utils.book_append_sheet(wb, brsStatementSheet, 'BANK RECONCILIATION')
    if (!brsOnlyExport) {
    const additionalInformationRows: (string | number)[][] = [
      [`${project.organization.name} - ${reportTitle}`],
      [project.name],
      ...(bankAccountHeaderLineExport ? [[bankAccountHeaderLineExport]] : []),
      [`${exportLabels.additionalInformationTitle} - As-at vs Post-period movement`],
      [`Language profile: ${reportLanguageProfile.label}`],
      [],
      [exportLabels.asAtReconciliationPosition, `Amount (${curr})`],
      [exportLabels.uncreditedLodgmentsOrUnclearedDeposits, maybeSigned(asAtUncreditedTotalExport)],
      [exportLabels.unpresentedChequesOrUnclearedPayments, maybeSigned(-Math.abs(asAtUnpresentedTotalExport), { forceNegative: true })],
      [],
      [exportLabels.postPeriodMovement, `Amount (${curr})`],
      [exportLabels.broughtForwardUncreditedLodgments, maybeSigned(broughtForwardLodgmentsTotalExport)],
      [exportLabels.broughtForwardBankOnlyCredits, maybeSigned(broughtForwardBankCreditsTotalExport)],
      [exportLabels.broughtForwardUnpresentedCheques, maybeSigned(-Math.abs(broughtForwardChequesTotalExport), { forceNegative: true })],
    ]
    const additionalInformationSheet = XLSX.utils.aoa_to_sheet(additionalInformationRows)
    XLSX.utils.book_append_sheet(wb, additionalInformationSheet, 'NOTES')
    const generatedAt = new Date()
    const reportCompletedAt = project.approvedAt || project.reviewedAt || project.preparedAt || generatedAt
    if (hasMissingChequesReportExport && missingChequesAgeingExport.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(missingChequesAgeingExport), 'Missing Cheques Ageing')
    }

    // --- AUDIT WORKING PAPERS (INTERNAL USE) ---
    if (unmatchedReceipts.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unmatchedReceipts), 'UNMATCHED RECEIPTS')
    }
    if (unmatchedPayments.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unmatchedPayments), 'UNMATCHED PAYMENTS')
    }
    if (unmatchedDebits.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unmatchedDebits), 'BANK-ONLY DEBITS (ADD)')
    }
    if (unmatchedCredits.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unmatchedCredits), 'BANK-ONLY CREDITS (DEDUCT)')
    }
    if (matchedRows.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matchedRows), 'MATCHED AUDIT LOG')
    }
    if (hasDiscrepancyReportExport && discrepancies.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(discrepancies), 'DISCREPANCIES')
    }
    }
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filenamePrefix = brsOnlyExport ? 'BRS_statement_only_' : 'BRS_'
    const filename = `${filenamePrefix}${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    await logAudit({
      organizationId: orgId,
      userId: req.auth!.userId,
      projectId,
      action: 'report_exported',
      details: { format: 'excel', scope: brsOnlyExport ? 'brs_only' : 'full' },
    })
    return res.send(buf)
  }

  if (format === 'pdf') {
    // BRS-only exports are typically one page; buffering + footer iteration has produced
    // trailing blank pages in some viewers — disable buffering for statement-only PDFs.
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: !brsOnlyExport })
    const pdfNamePrefix = brsOnlyExport ? 'BRS_statement_only_' : 'BRS_'
    const filename = `${pdfNamePrefix}${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    doc.pipe(res)
    const pdfPrintAt = new Date()
    const pageWidth = doc.page.width
    const margin = 50
    const contentWidth = pageWidth - margin * 2
    const letterheadCaps = (s: string) => s.toLocaleUpperCase('en-US')
    /** Keep table/text body above the footer block (rule + prepared + print date + page no.). */
    const pdfBodyMaxY = doc.page.height - 78
    const logoPath = resolveBrandingLogoPath((branding.logoUrl as string | undefined) || '')
    doc.y = 48
    if (logoPath) {
      try {
        doc.image(logoPath, (pageWidth - 120) / 2, doc.y, { fit: [120, 48], align: 'center', valign: 'center' })
        doc.y += 54
      } catch {
        // ignore logo render failures and continue with text header
      }
    }
    doc.fillColor(primaryColor).fontSize(20).text(letterheadCaps(`${project.organization.name}`), { align: 'center' }).fillColor('#000000')
    doc.moveDown(0.35)
    const letterhead = branding.letterheadAddress as string | undefined
    if (letterhead) {
      doc.fontSize(9).fillColor('#444444').text(letterheadCaps(letterhead), { align: 'center' }).fillColor('#000000').moveDown(0.3)
    }
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(letterheadCaps(`Bank Reconciliation Statement as at ${fmtBRSTitle(reconciliationDateExport)}`), { align: 'center' })
      .font('Helvetica')
    if (bankAccountHeaderLineExport) {
      doc.moveDown(0.2)
      doc.fontSize(9).text(letterheadCaps(bankAccountHeaderLineExport), { align: 'center' })
    }
    doc.moveDown(0.45)
    const dividerY = doc.y + 2
    doc.save()
    doc.moveTo(margin, dividerY).lineTo(pageWidth - margin, dividerY).lineWidth(1.5).strokeColor(primaryColor).stroke()
    doc.restore()
    doc.y = dividerY + 15

    const amtNum = (n: number) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    const fmtPdfDate = (d: string) => {
      const x = new Date(d)
      if (Number.isNaN(x.getTime())) return d || '—'
      const dd = String(x.getDate()).padStart(2, '0')
      const mm = String(x.getMonth() + 1).padStart(2, '0')
      const yyyy = x.getFullYear()
      return `${dd}/${mm}/${yyyy}`
    }
    const drawTable = (
      title: string,
      rows: Array<{ date: string; ref: string; details: string; amount: number }>,
      opts?: { allowEmptyText?: string; refLabel?: string; hideAmount?: boolean }
    ) => {
      const x = margin
      const tableWidth = contentWidth
      const cDate = 90
      const cRef = 100
      const cAmount = opts?.hideAmount ? 0 : 120
      const cDesc = tableWidth - cDate - cRef - cAmount
      const rowH = 18
      const ensureRoom = (needed: number, redrawHeader = false) => {
        if (doc.y + needed < pdfBodyMaxY) return
        doc.addPage()
        doc.x = margin
        doc.y = 50
        if (redrawHeader) {
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#0F172A').text(title, { width: contentWidth, align: 'left' })
          doc.moveDown(0.35)
          drawHeader()
        }
      }
      const drawHeader = () => {
        const headerTop = doc.y
        doc.save()
        doc.rect(x, headerTop, tableWidth, rowH).fill('#F8FAFC')
        doc.restore()
        const textY = headerTop + 5
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827')
        doc.text('DATE', x + 6, textY, { width: cDate - 8 })
        doc.text(opts?.refLabel || 'DOC REF', x + cDate + 6, textY, { width: cRef - 8 })
        doc.text(opts?.hideAmount ? 'EVENT DETAILS' : 'NAME - DETAILS', x + cDate + cRef + 6, textY, { width: cDesc - 8 })
        if (!opts?.hideAmount) {
          doc.text(`AMT (${curr})`, x + cDate + cRef + cDesc + 6, textY, { width: cAmount - 12, align: 'right' })
        }
        doc.moveTo(x, headerTop + rowH).lineTo(x + tableWidth, headerTop + rowH).strokeColor('#CBD5E1').lineWidth(1).stroke()
        doc.y = headerTop + rowH
      }
      doc.x = margin
      ensureRoom(36)
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#0F172A').text(title, { width: contentWidth, align: 'left' })
      doc.moveDown(0.35)
      drawHeader()
      if (!rows.length) {
        const emptyTop = doc.y
        doc.fontSize(9).font('Helvetica').fillColor('#6B7280').text(opts?.allowEmptyText || 'None', x + 6, emptyTop + 4)
        doc.y = emptyTop + rowH + 6
        return
      }
      let total = 0
      rows.forEach((r, idx) => {
        ensureRoom(rowH + 8, true)
        const rowTop = doc.y
        if (idx % 2 === 1) {
          doc.save()
          doc.rect(x, rowTop, tableWidth, rowH).fill('#F1F5F9')
          doc.restore()
        }
        const textY = rowTop + 4
        total += r.amount
        doc.fontSize(9).font('Helvetica').fillColor('#111827')
        doc.text(fmtPdfDate(r.date), x + 6, textY, { width: cDate - 8 })
        doc.text(r.ref || '—', x + cDate + 6, textY, { width: cRef - 8 })
        doc.text((r.details || '—').slice(0, opts?.hideAmount ? 120 : 62), x + cDate + cRef + 6, textY, { width: cDesc - 8 })
        if (!opts?.hideAmount) {
          doc.text(amtNum(r.amount), x + cDate + cRef + cDesc + 6, textY, { width: cAmount - 12, align: 'right' })
        }
        doc.moveTo(x, rowTop + rowH).lineTo(x + tableWidth, rowTop + rowH).strokeColor('#E5E7EB').lineWidth(0.7).stroke()
        doc.y = rowTop + rowH
      })
      if (!opts?.hideAmount) {
        ensureRoom(24)
        const totalTop = doc.y
        doc.font('Helvetica-Bold').fillColor('#111827')
        doc.text('Total', x + 6, totalTop + 6, { width: tableWidth - cAmount - 12 })
        doc.text(amtNum(total), x + tableWidth - cAmount + 6, totalTop + 6, { width: cAmount - 12, align: 'right' })
        doc.moveTo(x, totalTop + 24).lineTo(x + tableWidth, totalTop + 24).strokeColor('#94A3B8').lineWidth(1).stroke()
        doc.y = totalTop + 30
      } else {
        doc.y += 12
      }
    }
    const drawAmountSummaryTable = (
      title: string,
      rows: Array<{
        label: string
        amount: number
        forceNegative?: boolean
        /** Plain positive/display magnitudes — classic BRS worksheet-style amounts */
        workbookStyle?: boolean
        bold?: boolean
        /** Indented workbook composition line (does not contribute to PDF subtotal totals). */
        subRow?: boolean
      }>,
      opts?: {
        drawTotal?: boolean
        hideTitle?: boolean
        hideColumnHeaders?: boolean
        leftHeaderLabel?: string
      }
    ) => {
      const x = margin
      const tableWidth = contentWidth
      const cLabel = tableWidth - 150
      const cAmount = 150
      const rowH = 18
      const hideTitle = !!opts?.hideTitle
      const hideColumnHeaders = !!opts?.hideColumnHeaders
      const ensureRoom = (needed: number, redrawHeader = false) => {
        if (doc.y + needed < pdfBodyMaxY) return
        doc.addPage()
        doc.x = margin
        doc.y = 50
        if (redrawHeader) {
          if (!hideTitle) {
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#0F172A').text(title, { width: contentWidth, align: 'left' })
            doc.moveDown(0.35)
          }
          if (!hideColumnHeaders) drawHeader()
        }
      }
      const drawHeader = () => {
        const headerTop = doc.y
        doc.save()
        doc.rect(x, headerTop, tableWidth, rowH).fill('#F8FAFC')
        doc.restore()
        const textY = headerTop + 5
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827')
        doc.text(opts?.leftHeaderLabel ?? 'Description', x + 6, textY, { width: cLabel - 8 })
        doc.text(`Amount (${curr})`, x + cLabel + 6, textY, { width: cAmount - 12, align: 'right' })
        doc.moveTo(x, headerTop + rowH).lineTo(x + tableWidth, headerTop + rowH).strokeColor('#CBD5E1').lineWidth(1).stroke()
        doc.y = headerTop + rowH
      }
      doc.x = margin
      ensureRoom(36)
      if (!hideTitle) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#0F172A').text(title, { width: contentWidth, align: 'left' })
        doc.moveDown(0.35)
      }
      if (!hideColumnHeaders) {
        drawHeader()
      } else {
        doc.moveTo(x, doc.y).lineTo(x + tableWidth, doc.y).strokeColor('#94A3B8').lineWidth(1).stroke()
        doc.y += 4
      }
      let total = 0
      for (const r of rows) {
        ensureRoom(rowH + 8, true)
        const rowTop = doc.y
        if (!r.subRow) total += r.amount
        const textY = rowTop + 4
        const amountText =
          r.workbookStyle ?
            amtNum(Math.abs(r.amount)) :
            signedAmt(r.forceNegative ? -Math.abs(r.amount) : r.amount, { forceNegative: !!r.forceNegative })
        const fontBody = r.bold ? 'Helvetica-Bold' : 'Helvetica'
        const fs = r.subRow ? 8 : 9
        const fill = r.subRow ? '#374151' : '#111827'
        doc.fontSize(fs).font(fontBody).fillColor(fill)
        doc.text(r.label, x + 6, textY, { width: cLabel - 8 })
        doc.text(amountText, x + cLabel + 6, textY, { width: cAmount - 12, align: 'right' })
        doc.font('Helvetica')
        doc.moveTo(x, rowTop + rowH).lineTo(x + tableWidth, rowTop + rowH).strokeColor('#E5E7EB').lineWidth(0.7).stroke()
        doc.y = rowTop + rowH
      }
      if (opts?.drawTotal) {
        ensureRoom(24)
        const totalTop = doc.y
        doc.font('Helvetica-Bold').fillColor('#111827')
        doc.text('Total', x + 6, totalTop + 6, { width: cLabel - 8 })
        doc.text(amtNum(total), x + cLabel + 6, totalTop + 6, { width: cAmount - 12, align: 'right' })
        doc.moveTo(x, totalTop + 24).lineTo(x + tableWidth, totalTop + 24).strokeColor('#94A3B8').lineWidth(1).stroke()
        doc.y = totalTop + 30
      } else {
        doc.y += 8
      }
      doc.x = margin
    }
    const signedAmt = (n: number, opts?: { forceNegative?: boolean }) => {
      const forceNegative = !!opts?.forceNegative
      const plain = amtNum(Math.abs(n))
      if (!useSignedAmounts) return amtNum(n)
      if (forceNegative) return `-${plain}`
      if (n > 0) return `+${plain}`
      if (n < 0) return `-${plain}`
      return amtNum(0)
    }
    const pdfPrimaryBrsRows: Array<{
      label: string
      amount: number
      workbookStyle?: boolean
      bold?: boolean
      subRow?: boolean
    }> = [
      {
        label: exportLabels.closingBankStatementBalance,
        amount: bankClosingBalance,
        workbookStyle: true,
        bold: true,
      },
      { label: exportLabels.addUncreditedLodgments, amount: uncreditedLodgmentsTimingTotalExport, workbookStyle: true },
      {
        label: exportLabels.lessUnpresentedCheques,
        amount: Math.abs(unpresentedChequesTotal),
        workbookStyle: true,
      },
      {
        label: exportLabels.addBankOnlyDebitsNotInCashBookLine,
        amount: bankOnlyDebitsNotInCashBookTotalExport,
        workbookStyle: true,
      },
      {
        label: exportLabels.deductBankOnlyCreditsNotInCashBookLine,
        amount: bankOnlyCreditsNotInCashBookTotalExport,
        workbookStyle: true,
      },
      {
        label: exportLabels.cashBookBalanceEnd,
        amount: workbookScheduleDerivedCashBookExport,
        workbookStyle: true,
        bold: true,
      },
    ]
    drawAmountSummaryTable('Bank Reconciliation Statement', pdfPrimaryBrsRows, {
      drawTotal: false,
      hideTitle: true,
      hideColumnHeaders: false,
      leftHeaderLabel: '',
    })
    const pdfNoteText = brsOnlyExport
      ? 'Note: timing items are transactions already in the cash book but not yet reflected by the bank at the reconciliation date. Bank-only items are transactions on the bank statement not yet recorded in the cash book.'
      : 'Note: timing items are transactions already in the cash book but not yet reflected by the bank at the reconciliation date. Bank charges, credits, and other bank-only movements are explained in the NOTES section below and supporting tables.'
    doc.x = margin
    doc
      .fontSize(8)
      .fillColor('#444444')
      .text(pdfNoteText, margin, doc.y, { width: contentWidth, lineGap: 2 })
      .fillColor('#000000')
    doc.moveDown(1)

    const labelColW = 122
    const gapAfterLabel = 12
    const lineLeft = margin + labelColW + gapAfterLabel
    const lineRight = pageWidth - margin
    const rowStep = 28
    const ruleDrop = 13
    const signLabelsPdf = ['Checked By', 'Signed off By', 'Date'] as const
    let rowY = doc.y
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a')
    for (const lab of signLabelsPdf) {
      doc.text(`${lab}:`, margin, rowY, { width: labelColW, align: 'right', lineBreak: false })
      const ruleY = rowY + ruleDrop
      doc
        .moveTo(lineLeft, ruleY)
        .lineTo(lineRight, ruleY)
        .strokeColor('#475569')
        .lineWidth(0.9)
        .stroke()
      rowY += rowStep
    }
    doc.y = rowY + 4
    doc.font('Helvetica').fillColor('#000000')
    doc.moveDown(0.6)

    // Full export: NOTES + narrative on their own page(s); brs_only stops after sign-off.
    if (!brsOnlyExport) {
      doc.addPage()
      doc.x = margin
      doc.y = 50

      doc.fontSize(11).fillColor('#000000').text(exportLabels.additionalInformationTitle, { width: contentWidth, align: 'left' })
      doc.moveDown(0.2)
      drawAmountSummaryTable(exportLabels.asAtReconciliationPosition, [
        { label: exportLabels.uncreditedLodgmentsOrUnclearedDeposits, amount: asAtUncreditedTotalExport },
        { label: exportLabels.unpresentedChequesOrUnclearedPayments, amount: asAtUnpresentedTotalExport, forceNegative: true },
      ])
      drawAmountSummaryTable(exportLabels.postPeriodMovement, [
        { label: exportLabels.broughtForwardUncreditedLodgments, amount: broughtForwardLodgmentsTotalExport },
        { label: exportLabels.broughtForwardUnpresentedCheques, amount: broughtForwardChequesTotalExport, forceNegative: true },
      ])

      const exportNarrative =
        (project as { reportNarrative?: string | null }).reportNarrative ||
        `Matched: ${matchPairs.length} transaction(s). Unpresented Cheques: ${amtNum(Math.abs(unpresentedChequesTotal))}. Uncredited Lodgments: ${amtNum(uncreditedLodgmentsTimingTotalExport)}.`
      doc.fontSize(9).fillColor('#444444').text(exportNarrative, { align: 'left', width: contentWidth }).fillColor('#000000').moveDown(0.5)
      const prepComment = (project as { preparerComment?: string | null }).preparerComment
      const revComment = (project as { reviewerComment?: string | null }).reviewerComment
      if (prepComment?.trim()) {
        doc.fontSize(8).fillColor('#333333').text('Preparer note: ' + prepComment.trim().slice(0, 200), { width: contentWidth }).moveDown(0.3)
      }
      if (revComment?.trim()) {
        doc.fontSize(8).fillColor('#333333').text('Reviewer note: ' + revComment.trim().slice(0, 200), { width: contentWidth }).moveDown(0.3)
      }
      if (prepComment?.trim() || revComment?.trim()) doc.moveDown(0.5)
    }

    // --- INTERNAL AUDIT WORKING PAPERS (DIAGNOSTICS) ---
    if (!brsOnlyExport) {
    doc.addPage()
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1E293B').text('INTERNAL AUDIT WORKING PAPERS (DIAGNOSTICS)')
    doc.moveDown(0.2)
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#64748B').text('This section contains detailed reconciliation evidence and diagnostic reports for internal audit purposes.')
    doc.moveDown(1)

    const matchedTableRows = matchPairs.map((p) => ({
      date: fmt(p.cb.date),
      ref: p.cb.docRef || p.cb.chqNo || p.bank.docRef || p.bank.chqNo || '',
      details: (p.cb.name || p.cb.details || p.bank.name || p.bank.details || '—').slice(0, 60),
      amount: p.cb.amount,
    }))
    drawTable('MATCHED AUDIT LOG', matchedTableRows, { allowEmptyText: 'None', refLabel: 'DOC REF / CHQ NO' })

    if (discrepancies.length) {
      const discRows = discrepancies.map((d: any) => ({
        date: d['Cash Book Date'],
        ref: d['Cash Book Chq No'] || d['DOC REF'] || '',
        details: (d['Cash Book Desc'] + ' -> ' + d['Bank Desc']).slice(0, 60),
        amount: Number(d[`Amount Variance (${curr})`] || 0),
      }))
      drawTable('DISCREPANCY AUDIT LOG', discRows, { allowEmptyText: 'None', refLabel: 'REF' })
    }

    const pickField = (row: Record<string, unknown>, prefix: string): unknown => {
      const key = Object.keys(row).find((k) => k === prefix || k.startsWith(`${prefix} (`))
      return key ? row[key] : undefined
    }
    const unmatchedReceiptRows = unmatchedReceipts.map((t) => ({
      date: (t as { Date: string }).Date,
      ref: String(pickField(t as Record<string, unknown>, 'DOC REF') || ''),
      details: (t as { Details?: string }).Details || '—',
      amount: Number(pickField(t as Record<string, unknown>, 'Amount') || 0),
    }))
    drawTable('UNMATCHED RECEIPTS IN CASH BOOK', unmatchedReceiptRows, { allowEmptyText: 'None', refLabel: 'DOC REF' })

    const unmatchedPaymentRows = unmatchedPayments.map((t) => ({
      date: (t as { Date: string }).Date,
      ref: String(pickField(t as Record<string, unknown>, 'CHQ NO') || pickField(t as Record<string, unknown>, 'DOC REF') || ''),
      details: (t as { Details?: string }).Details || '—',
      amount: Number(pickField(t as Record<string, unknown>, 'Amount') || 0),
    }))
    drawTable('UNMATCHED PAYMENTS IN CASH BOOK', unmatchedPaymentRows, { allowEmptyText: 'None', refLabel: 'CHQ NO / DOC REF' })

    const unmatchedDebitRows = unmatchedDebits.map((t) => ({
      date: (t as { Date: string }).Date,
      ref: String(pickField(t as Record<string, unknown>, 'DOC REF') || ''),
      details: (t as { Description?: string }).Description || '—',
      amount: Number(pickField(t as Record<string, unknown>, 'Amount') || 0),
    }))
    drawTable('BANK-ONLY DEBITS (ADD)', unmatchedDebitRows, { allowEmptyText: 'None', refLabel: 'DOC REF' })

    const unmatchedCreditRows = unmatchedCredits.map((t) => ({
      date: (t as { Date: string }).Date,
      ref: String(pickField(t as Record<string, unknown>, 'DOC REF') || ''),
      details: (t as { Description?: string }).Description || '—',
      amount: Number(pickField(t as Record<string, unknown>, 'Amount') || 0),
    }))
    drawTable('BANK-ONLY CREDITS (DEDUCT)', unmatchedCreditRows, { allowEmptyText: 'None', refLabel: 'DOC REF' })

    // --- REVISION HISTORY ---
    const logs = await prisma.auditLog.findMany({
      where: {
        projectId,
        action: { in: ['project_submitted', 'project_approved', 'project_reopened', 'document_uploaded'] }
      },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { name: true } } }
    })
    const revisionRows = logs.map(l => ({
      date: fmt(l.createdAt),
      ref: l.action.replace('project_', '').replace('document_', '').toUpperCase(),
      details: `${l.user?.name || 'System'} - ${l.action === 'document_uploaded' ? 'New data added' : 'Status change'}`,
      amount: 0
    }))
    drawTable('PROJECT REVISION HISTORY', revisionRows, { allowEmptyText: 'No revisions found', refLabel: 'ACTION', hideAmount: true })
    }

    const footerText = (branding.footer as string | undefined) || platformDefaults.defaultFooter
    const printDateFooter = `Print date: ${formatGeneratedAt(pdfPrintAt)} (Africa/Accra)`
    /** Footer sits above the physical bottom edge so it is not flush with the page trim. */
    const footerBlockTop = doc.page.height - 58
    const drawPdfFooter = (pageIndex: number, totalPages: number) => {
      doc.x = margin
      const ruleY = footerBlockTop - 6
      doc.moveTo(margin, ruleY).lineTo(doc.page.width - margin, ruleY).strokeColor('#E2E8F0').lineWidth(0.5).stroke()
      const leftColW = contentWidth - 88
      const textY = footerBlockTop
      if (footerText) {
        doc.fontSize(7).fillColor('#64748B').text(footerText, margin, textY, { width: leftColW, align: 'left' })
      }
      doc.fontSize(7).fillColor('#64748B').text(printDateFooter, margin, textY + 9, { width: leftColW, align: 'left' })
      doc.fontSize(7).fillColor('#64748B').text(`Page ${pageIndex + 1} of ${totalPages}`, margin, textY, { width: contentWidth, align: 'right' })
      doc.fillColor('#000000')
    }
    if (brsOnlyExport) {
      drawPdfFooter(0, 1)
    } else {
      const range = doc.bufferedPageRange()
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i)
        drawPdfFooter(i, range.count)
      }
    }
    doc.end()
    await logAudit({
      organizationId: orgId,
      userId: req.auth!.userId,
      projectId,
      action: 'report_exported',
      details: { format: 'pdf', scope: brsOnlyExport ? 'brs_only' : 'full' },
    })
    return
  }

  res.status(400).json({ error: 'Unsupported format. Use format=excel or format=pdf' })
})

export default router
