/**
 * Deterministic command-palette ranking. Long natural-language queries also call
 * `POST /workspace/agent-search` (see `workspaceAgentSearch.ts`).
 */

export type SearchableItem = {
  label: string
  hint?: string
  keywords?: string
  group: string
}

const SYNONYMS: Record<string, readonly string[]> = {
  rec: ['reconcile', 'reconciling', 'matching'],
  reconcile: ['reconciling', 'matching', 'match'],
  matching: ['reconcile', 'reconciling'],
  match: ['reconcile', 'reconciling'],
  brs: ['report', 'completed', 'approved'],
  report: ['brs', 'completed'],
  review: ['submitted', 'submitted_for_review'],
  map: ['mapping', 'columns'],
  upload: ['draft', 'statements'],
  draft: ['upload'],
  client: ['clients'],
  clients: ['client'],
  bill: ['billing', 'subscription', 'paystack'],
  billing: ['subscription', 'plan'],
  team: ['members', 'invite'],
  audit: ['trail', 'log'],
  admin: ['platform', 'settings'],
  help: ['manual', 'docs'],
}

function expandToken(token: string): string[] {
  const t = token.toLowerCase()
  const extra = SYNONYMS[t] ?? []
  return [t, ...extra]
}

function haystack(item: SearchableItem): string {
  return `${item.label} ${item.hint ?? ''} ${item.keywords ?? ''} ${item.group}`.toLowerCase()
}

/** Higher = better match. Returns -1 when the item should be hidden. */
export function scorePaletteItem(item: SearchableItem, rawQuery: string): number {
  const query = normalizePaletteQuery(rawQuery).toLowerCase()
  if (!query) {
    return item.group === 'Projects' ? 0 : 10
  }

  const tokens = query.split(/\s+/).filter(Boolean)
  const hay = haystack(item)
  let score = 0

  for (const token of tokens) {
    const variants = expandToken(token)
    const hit = variants.some((v) => hay.includes(v))
    if (!hit) return -1
    if (item.label.toLowerCase().startsWith(token)) score += 12
    else if (hay.includes(` ${token}`) || hay.startsWith(token)) score += 6
    else score += 3
  }

  if (item.group === 'Projects') score += 2
  if (item.group === 'Clients') score += 1
  if (item.group === 'Quick filters' && tokens.some((t) => ['rec', 'reconcile', 'filter', 'draft', 'review'].includes(t))) {
    score += 4
  }
  return score
}

/** Strip light “agent-style” prefixes — still deterministic, not an LLM. */
export function normalizePaletteQuery(raw: string): string {
  return raw.trim().replace(/^(open|go to|goto|show|find|jump to)\s+/i, '')
}

export function rankPaletteItems<T extends SearchableItem>(items: T[], rawQuery: string): T[] {
  const query = normalizePaletteQuery(rawQuery)
  if (!query) return items

  return items
    .map((item) => ({ item, score: scorePaletteItem(item, query) }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.item)
}
