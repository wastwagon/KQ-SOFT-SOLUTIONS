import type { SuggestedMatch } from '../components/reconcile/types'

export type BulkMatchPair = { cashBookTransactionId: string; bankTransactionId: string }

const ECOBANK_REASON_RE =
  /Ecobank clearing|Ecobank transfer|Ecobank withdrawal|Ecobank statutory deposit/i
const SCB_REASON_RE = /SCB sweep|SCB inward clearing|ref shifted|via bank/i

/** Collect non-overlapping bulk pairs for one reconcile round (mirrors integration test scripts). */
export function collectPhasedBulkMatches(
  suggestions: SuggestedMatch[],
  phase: 'A' | 'B',
  limit = 50
): BulkMatchPair[] {
  const minConf = phase === 'A' ? 0.9 : 0.85
  const filtered =
    phase === 'B'
      ? suggestions.filter(
          (s) =>
            s.confidence >= minConf &&
            !s.duplicateWarning &&
            ((s.matchKind === 'receipt' && SCB_REASON_RE.test(s.reason || '')) ||
              (s.matchKind === 'payment' &&
                (s.ecobankPattern ||
                  ECOBANK_REASON_RE.test(s.reason || '') ||
                  SCB_REASON_RE.test(s.reason || ''))))
        )
      : suggestions.filter((s) => s.confidence >= minConf && !s.duplicateWarning)

  const sorted = [...filtered].sort((a, b) => b.confidence - a.confidence)
  const usedCb = new Set<string>()
  const usedBank = new Set<string>()
  const pairs: BulkMatchPair[] = []

  for (const s of sorted) {
    const cbId = s.cashBookTx.id
    const bankId = s.bankTx.id
    if (usedCb.has(cbId) || usedBank.has(bankId)) continue
    usedCb.add(cbId)
    usedBank.add(bankId)
    pairs.push({ cashBookTransactionId: cbId, bankTransactionId: bankId })
    if (pairs.length >= limit) break
  }
  return pairs
}

export async function runPhasedAutoMatchRounds(
  fetchSuggestions: () => Promise<{ suggestions?: { payments?: SuggestedMatch[]; receipts?: SuggestedMatch[] } }>,
  bulkMatch: (pairs: BulkMatchPair[]) => Promise<{ created?: number }>,
  opts?: { maxRoundsPerPhase?: number }
): Promise<{ totalMatched: number; rounds: number }> {
  const maxRounds = opts?.maxRoundsPerPhase ?? 8
  let totalMatched = 0
  let rounds = 0

  for (const phase of ['A', 'B'] as const) {
    for (let round = 0; round < maxRounds; round++) {
      const rec = await fetchSuggestions()
      const all = [...(rec.suggestions?.receipts ?? []), ...(rec.suggestions?.payments ?? [])]
      const pairs = collectPhasedBulkMatches(all, phase)
      if (!pairs.length) break
      const resp = await bulkMatch(pairs)
      totalMatched += resp.created ?? pairs.length
      rounds++
    }
  }

  return { totalMatched, rounds }
}
