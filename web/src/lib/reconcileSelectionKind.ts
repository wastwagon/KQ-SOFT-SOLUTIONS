/** Which matching workspace a selected cash-book × bank set belongs to. */
export type ReconcileSelectionKind = 'receipts' | 'payments'

/**
 * Receipts must pair with credits; payments with debits.
 * Mixed sides (or an empty side) cannot be confirmed as a match.
 */
export function reconcileSelectionKind(
  cbIds: Iterable<string>,
  bankIds: Iterable<string>,
  idSets: {
    receipts: ReadonlySet<string>
    payments: ReadonlySet<string>
    credits: ReadonlySet<string>
    debits: ReadonlySet<string>
  }
): ReconcileSelectionKind | null {
  const cb = Array.from(cbIds)
  const bank = Array.from(bankIds)
  if (!cb.length || !bank.length) return null
  const allCbReceipts = cb.every((id) => idSets.receipts.has(id))
  const allCbPayments = cb.every((id) => idSets.payments.has(id))
  const allBankCredits = bank.every((id) => idSets.credits.has(id))
  const allBankDebits = bank.every((id) => idSets.debits.has(id))
  if (allCbReceipts && allBankCredits) return 'receipts'
  if (allCbPayments && allBankDebits) return 'payments'
  return null
}
