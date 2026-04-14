import { prisma } from './prisma.js'

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
