/** Local preparer sign-off for count-match compact UI (see docs/RECONCILE_COUNT_MATCH_UX_TEST.md). */
export type CountMatchUxSignoff = {
  projectId: string
  result: 'pass' | 'fail'
  tester: string
  date: string
  notes?: string
}

const STORAGE_KEY = 'kq_count_match_ux_signoff_v1'

function readAll(): Record<string, CountMatchUxSignoff> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, CountMatchUxSignoff>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function getCountMatchUxSignoff(projectId: string): CountMatchUxSignoff | null {
  if (!projectId) return null
  return readAll()[projectId] ?? null
}

export function saveCountMatchUxSignoff(signoff: CountMatchUxSignoff): void {
  const all = readAll()
  all[signoff.projectId] = signoff
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function clearCountMatchUxSignoff(projectId: string): void {
  const all = readAll()
  delete all[projectId]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}
