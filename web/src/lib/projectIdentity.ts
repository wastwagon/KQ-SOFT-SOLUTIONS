/** Client-side helpers mirroring api/src/lib/projectIdentity.ts */

export function composeProjectDisplayName(parts: {
  statementBusinessName?: string | null
  bankAccountName?: string | null
  accountNo?: string | null
  reconciliationDate?: string | null
}): string {
  const bits: string[] = []
  const biz = parts.statementBusinessName?.trim()
  if (biz) bits.push(biz)

  const acct = parts.bankAccountName?.trim()
  const no = parts.accountNo?.trim()
  if (acct && no) bits.push(`${acct} (${no})`)
  else if (acct) bits.push(acct)
  else if (no) bits.push(`Acct ${no}`)

  const day = parts.reconciliationDate?.trim().slice(0, 10)
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) bits.push(`as at ${day}`)

  return bits.join(' — ')
}
