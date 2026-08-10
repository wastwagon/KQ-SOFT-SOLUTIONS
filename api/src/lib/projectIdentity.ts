/**
 * Project naming + printed BRS entity identity.
 * Safe defaults: missing statement business name falls back to organization name.
 */

export function formatReconciliationDateLabel(
  value: string | Date | null | undefined
): string | null {
  if (!value) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }
  const s = String(value).trim()
  if (!s) return null
  // Accept YYYY-MM-DD or ISO datetime
  const day = s.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}

/** Compose a tracking-friendly project name from structured create fields. */
export function composeProjectDisplayName(parts: {
  statementBusinessName?: string | null
  bankAccountName?: string | null
  accountNo?: string | null
  reconciliationDate?: string | Date | null
}): string {
  const bits: string[] = []
  const biz = parts.statementBusinessName?.trim()
  if (biz) bits.push(biz)

  const acct = parts.bankAccountName?.trim()
  const no = parts.accountNo?.trim()
  if (acct && no) bits.push(`${acct} (${no})`)
  else if (acct) bits.push(acct)
  else if (no) bits.push(`Acct ${no}`)

  const dateLabel = formatReconciliationDateLabel(parts.reconciliationDate)
  if (dateLabel) bits.push(`as at ${dateLabel}`)

  return bits.join(' — ')
}

/**
 * Entity name shown as the main company line on the printed BRS.
 * Prefer statement business name; never blank — fall back to preparer org name.
 */
export function resolveReportEntityName(
  statementBusinessName: string | null | undefined,
  organizationName: string
): string {
  const s = statementBusinessName?.trim()
  if (s) return s
  return (organizationName || 'Organization').trim() || 'Organization'
}
