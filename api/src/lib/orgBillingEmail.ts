/**
 * Email used for Paystack checkout: prefer an organisation admin, then any member.
 */
export function pickOrgBillingEmail(
  members: ReadonlyArray<{ role: string; user: { email: string } | null }>
): string | undefined {
  const admin = members.find((m) => m.role === 'admin' && m.user?.email)
  if (admin?.user?.email) return admin.user.email
  return members.find((m) => m.user?.email)?.user?.email
}
