/**
 * User-visible labels aligned with Ghana BRS practice (Prepared / Checked / Approved)
 * and SHS accounting vocabulary (cash book, bank statement, lodgments, unpresented cheques).
 * API role slugs and route names are unchanged.
 */

export const ORGANISATION = 'organisation'
export const ORGANISATION_TITLE = 'Organisation'
export const ORGANISATIONS_TITLE = 'Organisations'

/** Display labels for member roles (values sent to API stay admin | preparer | reviewer | viewer). */
export const ROLE_LABELS: Record<'admin' | 'preparer' | 'reviewer' | 'viewer', string> = {
  admin: 'Administrator',
  preparer: 'Preparer',
  reviewer: 'Checker',
  viewer: 'View only',
}

export function roleLabel(role: string): string {
  if (role === 'member') return ROLE_LABELS.preparer
  return ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role
}

/** Short helper for reconcile UI — avoids “assistants” / internal product jargon. */
export const MATCHING_HELPERS_LABEL = 'Matching helpers'

/** Review step: difference between unmatched cash book and unmatched bank totals. */
export const UNMATCHED_TOTALS_DIFFERENCE = 'Difference in unmatched totals'

/** Platform admin: enter a customer organisation in support mode. */
export const SUPPORT_OPEN_ORG = 'Open for support'
export const SUPPORT_OPEN_ORG_CONFIRM = 'Open for support?'

/** e.g. roleListLabel('admin', 'reviewer') → "administrator or checker" */
export function roleListLabel(...keys: (keyof typeof ROLE_LABELS)[]): string {
  const labels = keys.map((k) => ROLE_LABELS[k].toLowerCase())
  if (labels.length <= 1) return labels[0] ?? ''
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, or ${labels.at(-1)}`
}
