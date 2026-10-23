const STORAGE_KEY = 'kq_workspace_recent_nav'
const MAX = 5

export type RecentNavEntry = {
  id: string
  label: string
  to: string
  hint?: string
}

export function readRecentNav(): RecentNavEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentNavEntry[]
    return Array.isArray(parsed) ? parsed.filter((e) => e?.id && e?.to && e?.label) : []
  } catch {
    return []
  }
}

export function rememberRecentNav(entry: RecentNavEntry) {
  try {
    const next = [entry, ...readRecentNav().filter((e) => e.id !== entry.id)].slice(0, MAX)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* private mode */
  }
}
