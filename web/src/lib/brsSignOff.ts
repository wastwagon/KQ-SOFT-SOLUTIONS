/** Ghana workbook sign-off grid — shared labels and workflow field mapping. */

export const BRS_SIGN_OFF_ROW_LABELS = ['NAME', 'SIGNATURE', 'DATE'] as const
export type BrsSignOffRowLabel = (typeof BRS_SIGN_OFF_ROW_LABELS)[number]

export const BRS_SIGN_OFF_COLUMN_HEADERS = ['Prepared By', 'Checked By', 'Approved By'] as const

export interface BrsSignOffPerson {
  name?: string | null
  email?: string | null
}

export interface BrsSignOffColumn {
  header: (typeof BRS_SIGN_OFF_COLUMN_HEADERS)[number]
  name: string
  date: string
}

export interface BrsSignOffProjectInput {
  preparedBy?: BrsSignOffPerson | null
  preparedAt?: string | Date | null
  reviewedBy?: BrsSignOffPerson | null
  reviewedAt?: string | Date | null
  approvedBy?: BrsSignOffPerson | null
  approvedAt?: string | Date | null
}

function displaySignatoryName(person: BrsSignOffPerson | null | undefined): string {
  if (!person) return ''
  const name = (person.name || '').trim()
  if (name) return name
  return (person.email || '').trim()
}

/** DD MMM YYYY — matches on-screen report dates. */
export function formatBrsSignOffDate(date: string | Date | null | undefined): string {
  if (date == null) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Three-column grid: Prepared / Checked (reviewer) / Approved — NAME & DATE pre-filled when workflow data exists. */
export function buildBrsSignOffColumns(project: BrsSignOffProjectInput | null | undefined): BrsSignOffColumn[] {
  const p = project ?? {}
  return [
    {
      header: 'Prepared By',
      name: displaySignatoryName(p.preparedBy),
      date: formatBrsSignOffDate(p.preparedAt),
    },
    {
      header: 'Checked By',
      name: displaySignatoryName(p.reviewedBy),
      date: formatBrsSignOffDate(p.reviewedAt),
    },
    {
      header: 'Approved By',
      name: displaySignatoryName(p.approvedBy),
      date: formatBrsSignOffDate(p.approvedAt),
    },
  ]
}
