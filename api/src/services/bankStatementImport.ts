/**
 * Skip non-transaction rows when importing bank statement Excel/PDF extracts.
 * SCB exports sometimes put clearing totals on "END OF STATEMENT" lines — keep those when amount > 0.
 */
export function shouldSkipBankStatementImportRow(
  details: string | null | undefined,
  amount?: number
): boolean {
  const text = String(details ?? '').trim()
  if (!text) return false
  if (/^END\s+OF\s+STATEMENT\b/i.test(text)) {
    return !(amount != null && Math.abs(amount) > 0.001)
  }
  if (/^OPENING\s+BALANCE\b/i.test(text)) return true
  if (/^CLOSING\s+BALANCE\b/i.test(text) && !/\bCHQ\b/i.test(text)) return true
  return false
}

export function isEndOfStatementAmountLine(tx: {
  details?: string | null
  name?: string | null
  amount?: number
}): boolean {
  const text = [tx.details, tx.name].filter(Boolean).join(' ')
  return /^END\s+OF\s+STATEMENT\b/i.test(text) && (tx.amount ?? 0) > 0.001
}

export function isBankStatementNoiseLine(tx: { details?: string | null; name?: string | null }): boolean {
  const text = [tx.details, tx.name].filter(Boolean).join(' ')
  if (/^END\s+OF\s+STATEMENT\b/i.test(text)) return false
  return shouldSkipBankStatementImportRow(text)
}
