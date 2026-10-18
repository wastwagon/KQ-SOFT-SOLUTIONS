import { featureDepth } from '../config/planFeatures.js'
import { getPlanBySlug } from '../services/plan.js'
import { prisma } from './prisma.js'

export type ThresholdWarning = {
  variance: number
  threshold: number
  message: string
}

function thresholdWarningMessage(variance: number, threshold: number): string {
  return `Discrepancy of GH₵${Math.abs(variance).toFixed(2)} is above the warning amount of GH₵${threshold.toFixed(2)}. You can still approve. Firm blocks a reviewer above this amount.`
}

/** Team stores a threshold and warns. Firm and Custom block a reviewer in the approve route. */
export async function getPartialThresholdWarning(
  orgId: string,
  projectId: string,
  plan: string
): Promise<ThresholdWarning | null> {
  await getPlanBySlug(plan)
  if (featureDepth(plan, 'threshold_approval') !== 'partial') return null
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { branding: true },
  })
  const threshold = (org?.branding as { approvalThresholdAmount?: number | null } | null)?.approvalThresholdAmount
  if (threshold == null || threshold <= 0) return null
  const variance = await getProjectVariance(projectId, orgId)
  if (variance === null || Math.abs(variance) <= threshold) return null
  return { variance, threshold, message: thresholdWarningMessage(variance, threshold) }
}

/**
 * Compute the variance (total unmatched cash book - total unmatched bank) for a project.
 * Used for threshold approval: when |variance| exceeds threshold, only admins can approve.
 */
export async function getProjectVariance(projectId: string, orgId: string): Promise<number | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
    include: {
      documents: { include: { transactions: true } },
      matches: { include: { matchItems: true } },
    },
  })
  if (!project) return null

  const receiptsDoc = project.documents.find((d) => d.type === 'cash_book_receipts')
  const creditsDoc = project.documents.find((d) => d.type === 'bank_credits')
  const paymentsDoc = project.documents.find((d) => d.type === 'cash_book_payments')
  const debitsDoc = project.documents.find((d) => d.type === 'bank_debits')

  const matchedCbIds = new Set<string>()
  const matchedBankIds = new Set<string>()
  for (const m of project.matches) {
    for (const mi of m.matchItems) {
      if (mi.side === 'cash_book') matchedCbIds.add(mi.transactionId)
      else matchedBankIds.add(mi.transactionId)
    }
  }

  const amt = (t: { amount: unknown }) => Number(t.amount)
  const receipts = receiptsDoc?.transactions || []
  const credits = creditsDoc?.transactions || []
  const payments = paymentsDoc?.transactions || []
  const debits = debitsDoc?.transactions || []

  const totalUnmatchedReceipts = receipts.filter((t) => !matchedCbIds.has(t.id)).reduce((s, t) => s + amt(t), 0)
  const totalUnmatchedCredits = credits.filter((t) => !matchedBankIds.has(t.id)).reduce((s, t) => s + amt(t), 0)
  const totalUnmatchedPayments = payments.filter((t) => !matchedCbIds.has(t.id)).reduce((s, t) => s + amt(t), 0)
  const totalUnmatchedDebits = debits.filter((t) => !matchedBankIds.has(t.id)).reduce((s, t) => s + amt(t), 0)

  const totalUnmatchedCb = totalUnmatchedReceipts + totalUnmatchedPayments
  const totalUnmatchedBank = totalUnmatchedCredits + totalUnmatchedDebits
  return totalUnmatchedCb - totalUnmatchedBank
}
