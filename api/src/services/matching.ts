/**
 * Matching engine: amount ± tolerance, date ± window days
 * Returns suggested matches between cash book and bank transactions
 */

function parseAmount(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  const s = String(v).replace(/[^0-9.-]/g, '')
  return parseFloat(s) || 0
}

function parseDate(v: unknown): Date | null {
  if (!v) return null
  if (v instanceof Date) return v
  const d = new Date(String(v))
  return isNaN(d.getTime()) ? null : d
}

function datesWithinWindow(d1: Date | null, d2: Date | null, windowDays: number): boolean {
  if (!d1 || !d2) return true
  const ms = Math.abs(d1.getTime() - d2.getTime())
  const days = ms / (1000 * 60 * 60 * 24)
  return days <= windowDays
}

function amountsMatch(a1: number, a2: number, tolerance: number): boolean {
  return Math.abs(a1 - a2) <= tolerance
}

/** Cent-level equality: treated as an exact amount match (full base confidence). */
function amountsExact(a1: number, a2: number): boolean {
  return Math.abs(a1 - a2) < 0.005
}

/**
 * Tokens that carry no identifying signal in bank/cash book narrations
 * (transaction-type words, filler, common Ghana banking abbreviations).
 */
const NARRATION_NOISE_TOKENS = new Set([
  'trf', 'transfer', 'tfr', 'chq', 'cheque', 'check', 'payment', 'pay', 'pmt',
  'paid', 'to', 'of', 'the', 'for', 'and', 'from', 'ref', 'no', 'nos',
  'ltd', 'limited', 'co', 'company', 'ghs', 'gh', 'acct', 'account', 'acc',
  'txn', 'trans', 'ib', 'mb', 'atm', 'pos', 'deposit', 'withdrawal', 'wdl',
  'being', 'against', 'via', 'per',
])

export function tokenizeNarration(text: string | null | undefined): Set<string> {
  const tokens = new Set<string>()
  if (!text) return tokens
  for (const raw of String(text).toLowerCase().split(/[^a-z0-9]+/)) {
    if (!raw) continue
    // Keep digit runs of 3+ (refs, cheque nos) and words of 3+ chars
    if (/^\d+$/.test(raw)) {
      if (raw.length >= 3) tokens.add(raw.replace(/^0+/, '') || '0')
      continue
    }
    if (raw.length < 3) continue
    if (NARRATION_NOISE_TOKENS.has(raw)) continue
    tokens.add(raw)
  }
  return tokens
}

/**
 * Token-based narration similarity (0..1). Order-independent, noise-word
 * aware — so "TRANSFER TO KOFI MENSAH" vs "KOFI MENSAH TRF" scores high.
 */
export function descriptionSimilarity(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const ta = tokenizeNarration(a)
  const tb = tokenizeNarration(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let intersection = 0
  for (const t of ta) if (tb.has(t)) intersection++
  if (intersection === 0) return 0
  // Overlap coefficient (relative to smaller set) blended with Jaccard so a
  // short narration fully contained in a longer one still scores well.
  const overlap = intersection / Math.min(ta.size, tb.size)
  const jaccard = intersection / (ta.size + tb.size - intersection)
  return 0.6 * overlap + 0.4 * jaccard
}

/**
 * Extract cheque/reference numbers from text (e.g. "CHQ 002038", "REF 12345", "Cheque No. 001957").
 * Also returns 4–8 digit sequences that may be cheque numbers.
 */
function extractRefsFromText(text: string | null): string[] {
  if (!text || typeof text !== 'string') return []
  const refs = new Set<string>()
  // Explicit patterns: CHQ 12345, Cheque 12345, REF 12345, Ref # 12345
  const explicitRe = /\b(?:CHQ|Cheque|REF|Ref)(?:\s*(?:No|NO|no)\.?)?\s*[#:.]?\s*(\d{3,10})\b/gi
  let m: RegExpExecArray | null
  while ((m = explicitRe.exec(text)) !== null) {
    refs.add(m[1]!)
  }
  // Standalone 4–8 digit numbers (common cheque number length)
  const standaloneRe = /\b(\d{4,8})\b/g
  while ((m = standaloneRe.exec(text)) !== null) {
    refs.add(m[1]!)
  }
  return Array.from(refs)
}

function normalizeRefToken(value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = String(value).trim()
  if (!trimmed) return ''
  const digits = trimmed.replace(/\D/g, '')
  if (digits) return digits.replace(/^0+/, '') || '0'
  return trimmed.toLowerCase().replace(/\s+/g, '')
}

function refTokensEquivalent(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeRefToken(a)
  const nb = normalizeRefToken(b)
  if (!na || !nb) return false
  if (na === nb) return true
  // Handle common truncated cheque formats, e.g. 122347 vs 347.
  if (na.length >= 3 && nb.length >= 3) {
    if (na.endsWith(nb) || nb.endsWith(na)) return true
  }
  return false
}

/**
 * Returns true if cash book chqNo matches bank description/refs, or vice versa.
 */
function refsMatch(cb: Tx, bk: Tx): boolean {
  const cbChq = cb.chqNo?.trim()
  const bkChq = bk.chqNo?.trim()
  if (refTokensEquivalent(cbChq, bkChq)) return true
  const bkText = [bk.details, bk.name].filter(Boolean).join(' ')
  const cbText = [cb.details, cb.name].filter(Boolean).join(' ')
  const bkRefs = extractRefsFromText(bkText)
  const cbRefs = extractRefsFromText(cbText)
  if (cbChq && (bkRefs.some((r) => refTokensEquivalent(r, cbChq)) || bkText.includes(cbChq))) return true
  if (bkChq && (cbRefs.some((r) => refTokensEquivalent(r, bkChq)) || cbText.includes(bkChq))) return true
  return false
}

function docRefsMatch(cb: Tx, bk: Tx): boolean {
  const cbRef = cb.docRef?.trim()
  const bkRef = bk.docRef?.trim()
  if (refTokensEquivalent(cbRef, bkRef)) return true
  if (!cbRef && !bkRef) return false
  const cbText = [cb.details, cb.name].filter(Boolean).join(' ')
  const bkText = [bk.details, bk.name].filter(Boolean).join(' ')
  if (cbRef && bkText.includes(cbRef)) return true
  if (bkRef && cbText.includes(bkRef)) return true
  return false
}

function chequeNumbersMatch(cb: Tx, bk: Tx): boolean {
  const cbChq = cb.chqNo?.trim()
  const bkChq = bk.chqNo?.trim()
  if (refTokensEquivalent(cbChq, bkChq)) return true
  if (!cbChq && !bkChq) return false
  const cbText = [cb.details, cb.name].filter(Boolean).join(' ')
  const bkText = [bk.details, bk.name].filter(Boolean).join(' ')
  if (cbChq && bkText.includes(cbChq)) return true
  if (bkChq && cbText.includes(bkChq)) return true
  return false
}

export interface Tx {
  id: string
  date: Date | null
  name: string | null
  details: string | null
  amount: number
  docRef?: string | null
  chqNo?: string | null
}

export interface SuggestedMatch {
  cashBookTx: Tx
  bankTx: Tx
  confidence: number
  reason: string
  /** True when multiple bank txns match this cash book (same amount+date) — user should verify */
  duplicateWarning?: boolean
}

export interface SuggestMatchesOptions {
  /** When true (e.g. payments vs debits), require ref/chq match when cash book tx has chqNo (cheque rule). */
  requireRefForCheques?: boolean
  /** When true, require dates to be within window for a match candidate. */
  requireDateMatch?: boolean
  /** Amount tolerance for match. Default 0.01 */
  amountTolerance?: number
  /** Date window in days. Default 3 */
  dateWindowDays?: number
  /** Include date as a matching parameter. Default true. */
  useDate?: boolean
  /** Include reference document number as a matching parameter. Default true. */
  useDocRef?: boolean
  /** Include cheque number as a matching parameter. Default true. */
  useChequeNo?: boolean
  /** When true, enable many-to-one and one-to-many sum matching suggestions. */
  enableSplitMatching?: boolean
}

export function suggestMatches(
  cashBookTxs: Tx[],
  bankTxs: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  options: SuggestMatchesOptions = {}
): SuggestedMatch[] {
  const {
    requireRefForCheques = false,
    requireDateMatch = false,
    amountTolerance = 0.01,
    dateWindowDays = 3,
    useDate = true,
    useDocRef = true,
    useChequeNo = true,
  } = options
  const suggestions: SuggestedMatch[] = []

  // Optimization: Index bank transactions by amount (integer cents) to avoid
  // O(N*M) complexity, while still honouring amountTolerance by probing all
  // cent buckets within the tolerance range.
  const bankByCents = new Map<number, Tx[]>()
  const unmatchedBank: Tx[] = []
  for (const bk of bankTxs) {
    if (matchedBankIds.has(bk.id)) continue
    unmatchedBank.push(bk)
    const key = Math.round(bk.amount * 100)
    if (!bankByCents.has(key)) bankByCents.set(key, [])
    bankByCents.get(key)!.push(bk)
  }

  const toleranceCents = Math.max(0, Math.round(amountTolerance * 100))
  // Guard against pathological tolerances producing huge bucket scans.
  const MAX_BUCKET_SPAN = 1000

  const candidatesFor = (cb: Tx): Tx[] => {
    if (toleranceCents === 0) return bankByCents.get(Math.round(cb.amount * 100)) || []
    if (toleranceCents * 2 + 1 > MAX_BUCKET_SPAN) {
      return unmatchedBank.filter((bk) => amountsMatch(cb.amount, bk.amount, amountTolerance))
    }
    const center = Math.round(cb.amount * 100)
    const out: Tx[] = []
    for (let key = center - toleranceCents; key <= center + toleranceCents; key++) {
      const bucket = bankByCents.get(key)
      if (bucket) out.push(...bucket)
    }
    return out
  }

  for (const cb of cashBookTxs) {
    if (matchedCashBookIds.has(cb.id)) continue

    for (const bk of candidatesFor(cb)) {
      if (!amountsMatch(cb.amount, bk.amount, amountTolerance)) continue
      const dateMatch = datesWithinWindow(cb.date, bk.date, dateWindowDays)
      if (requireDateMatch && useDate && !dateMatch) continue
      
      const chqMatch = useChequeNo ? chequeNumbersMatch(cb, bk) : false
      const docRefMatch = useDocRef ? docRefsMatch(cb, bk) : false
      const textRefMatch = useDocRef || useChequeNo ? refsMatch(cb, bk) : false
      const refMatch = chqMatch || docRefMatch || textRefMatch
      
      if (requireRefForCheques && cb.chqNo?.trim() && !refMatch) continue

      const exactAmount = amountsExact(cb.amount, bk.amount)
      // Within-tolerance (non-exact) amounts are only suggested with
      // corroborating evidence — a date or reference match — to keep the
      // false-match rate low.
      if (!exactAmount && !(useDate && dateMatch) && !refMatch) continue

      const descScore = descriptionSimilarity(
        [cb.details, cb.name].filter(Boolean).join(' '),
        [bk.details, bk.name].filter(Boolean).join(' ')
      )
      const descMatch = descScore >= 0.3

      let confidence = exactAmount ? 0.6 : 0.5 // Base amount match
      if (useDate && dateMatch) confidence += 0.3
      if (descMatch) confidence += 0.1 + 0.05 * descScore
      if ((useDocRef || useChequeNo) && refMatch) confidence += 0.15

      confidence = Math.min(confidence, 1)
      if (confidence >= 0.6) {
        const reasons: string[] = []
        if (useDate && dateMatch) reasons.push('date')
        if (descMatch) reasons.push('description')
        if ((useDocRef || useChequeNo) && refMatch) {
          if (useDocRef && useChequeNo) reasons.push('chq/ref')
          else if (useDocRef) reasons.push('reference doc')
          else reasons.push('cheque no.')
        }
        const amountLabel = exactAmount
          ? 'Amount'
          : `Amount within tolerance (Δ${Math.abs(cb.amount - bk.amount).toFixed(2)})`
        const reason = reasons.length ? `${amountLabel} + ${reasons.join(', ')} match` : `${amountLabel} match`
        suggestions.push({
          cashBookTx: cb,
          bankTx: bk,
          confidence,
          reason,
        })
      }
    }
  }
  // Ambiguity guard: when one bank txn has multiple cash book candidates (same amount),
  // keep suggestions only if a unique tie-breaker identifies exactly one candidate.
  const byBankId = new Map<string, SuggestedMatch[]>()
  for (const s of suggestions) {
    const key = s.bankTx.id
    if (!byBankId.has(key)) byBankId.set(key, [])
    byBankId.get(key)!.push(s)
  }
  const excluded = new Set<string>()
  for (const list of byBankId.values()) {
    if (list.length <= 1) continue
    const refList = useDocRef || useChequeNo
      ? list.filter((s) => refsMatch(s.cashBookTx, s.bankTx))
      : []
    if (refList.length === 1) {
      for (const s of list) {
        if (s.cashBookTx.id !== refList[0]!.cashBookTx.id) {
          excluded.add(`${s.cashBookTx.id}::${s.bankTx.id}`)
        }
      }
      continue
    }
    const dateList = useDate
      ? list.filter((s) => datesWithinWindow(s.cashBookTx.date, s.bankTx.date, dateWindowDays))
      : []
    if (dateList.length === 1) {
      for (const s of list) {
        if (s.cashBookTx.id !== dateList[0]!.cashBookTx.id) {
          excluded.add(`${s.cashBookTx.id}::${s.bankTx.id}`)
        }
      }
      continue
    }
    // Description tie-break: keep the candidate whose narration clearly
    // matches while all others clearly do not.
    const scored = list.map((s) => ({
      s,
      score: descriptionSimilarity(
        [s.cashBookTx.details, s.cashBookTx.name].filter(Boolean).join(' '),
        [s.bankTx.details, s.bankTx.name].filter(Boolean).join(' ')
      ),
    }))
    const strong = scored.filter((x) => x.score >= 0.5)
    if (strong.length === 1 && scored.every((x) => x === strong[0] || x.score < 0.2)) {
      for (const s of list) {
        if (s.cashBookTx.id !== strong[0]!.s.cashBookTx.id) {
          excluded.add(`${s.cashBookTx.id}::${s.bankTx.id}`)
        }
      }
      continue
    }
    // No unique tie-breaker. 
    // If we're NOT in a strict mode (i.e. user is looking for broader matches),
    // we should keep the suggestions but they will be flagged as duplicates later.
    if (!useDate && !useDocRef && !useChequeNo) {
      // Amount-only mode: Keep them all, user will pick.
      continue
    }

    // Otherwise, block them to stay safe.
    for (const s of list) {
      excluded.add(`${s.cashBookTx.id}::${s.bankTx.id}`)
    }
  }
  const filtered = suggestions.filter((s) => !excluded.has(`${s.cashBookTx.id}::${s.bankTx.id}`))
  // Duplicate detection: flag when multiple bank txns match same cash book (or vice-versa)
  const byCbId = new Map<string, SuggestedMatch[]>()
  const byBankIdFinal = new Map<string, SuggestedMatch[]>()
  for (const s of filtered) {
    const cbKey = s.cashBookTx.id
    if (!byCbId.has(cbKey)) byCbId.set(cbKey, [])
    byCbId.get(cbKey)!.push(s)

    const bkKey = s.bankTx.id
    if (!byBankIdFinal.has(bkKey)) byBankIdFinal.set(bkKey, [])
    byBankIdFinal.get(bkKey)!.push(s)
  }
  for (const list of byCbId.values()) {
    if (list.length > 1) {
      for (const s of list) s.duplicateWarning = true
    }
  }
  for (const list of byBankIdFinal.values()) {
    if (list.length > 1) {
      for (const s of list) s.duplicateWarning = true
    }
  }
  return filtered.sort((a, b) => b.confidence - a.confidence)
}
/** Max items in a split combination (keeps search tractable). */
const SPLIT_MAX_SIZE = 5
/** Cap candidates considered per target after amount pruning. */
const SPLIT_MAX_CANDIDATES = 24
/** Max subset solutions kept per single target transaction. */
const SPLIT_MAX_RESULTS_PER_TARGET = 2

/**
 * Bounded subset-sum: find non-adjacent combinations of 2..maxSize items whose
 * amounts sum to `target` within tolerance. Candidates are pruned by amount and
 * capped so large windows stay fast.
 */
export function findSummingSubsets(
  candidates: Tx[],
  target: number,
  tolerance: number,
  options: { maxSize?: number; maxCandidates?: number; maxResults?: number } = {}
): Tx[][] {
  const maxSize = options.maxSize ?? SPLIT_MAX_SIZE
  const maxCandidates = options.maxCandidates ?? SPLIT_MAX_CANDIDATES
  const maxResults = options.maxResults ?? SPLIT_MAX_RESULTS_PER_TARGET
  if (!(target > 0) || candidates.length < 2) return []

  const targetMin = target - tolerance
  const targetMax = target + tolerance
  // Drop items that alone exceed the target; prefer larger items first so we
  // find compact combinations quickly, then prune when the running sum blows past.
  const items = candidates
    .filter((t) => t.amount > 0 && t.amount <= targetMax)
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id))
    .slice(0, maxCandidates)

  if (items.length < 2) return []

  const results: Tx[][] = []
  const seen = new Set<string>()

  function dfs(start: number, subset: Tx[], sum: number): void {
    if (results.length >= maxResults) return
    if (subset.length >= 2 && sum >= targetMin && sum <= targetMax) {
      const key = subset
        .map((t) => t.id)
        .sort()
        .join('|')
      if (!seen.has(key)) {
        seen.add(key)
        results.push([...subset])
      }
      // Prefer compact hits; still explore siblings for alternate combinations.
      if (results.length >= maxResults) return
    }
    if (subset.length >= maxSize) return

    for (let i = start; i < items.length; i++) {
      const next = items[i]!
      const newSum = sum + next.amount
      // Later items are smaller; skipping oversized picks still allows smaller siblings.
      if (newSum > targetMax) continue
      subset.push(next)
      dfs(i + 1, subset, newSum)
      subset.pop()
      if (results.length >= maxResults) return
    }
  }

  dfs(0, [], 0)
  return results
}

function splitNarration(tx: Tx): string {
  return [tx.details, tx.name].filter(Boolean).join(' ')
}

function scoreSplitMatch(
  singles: Tx[],
  group: Tx[],
  targetAmount: number
): { confidence: number; reasonBits: string[] } {
  const groupSum = group.reduce((s, t) => s + t.amount, 0)
  const exact = amountsExact(targetAmount, groupSum)
  const reasonBits: string[] = []

  let confidence = exact ? 0.82 : 0.72
  if (!exact) {
    reasonBits.push(`Δ${Math.abs(targetAmount - groupSum).toFixed(2)}`)
  }

  // Reference / cheque corroboration across the group
  let refHits = 0
  for (const s of singles) {
    for (const g of group) {
      if (refsMatch(s, g) || docRefsMatch(s, g) || chequeNumbersMatch(s, g)) {
        refHits++
        break
      }
    }
  }
  if (refHits > 0) {
    confidence += Math.min(0.12, 0.06 * refHits)
    reasonBits.push('chq/ref')
  }

  // Narration corroboration: average best similarity from each group item to singles
  let descHits = 0
  for (const g of group) {
    let best = 0
    for (const s of singles) {
      best = Math.max(best, descriptionSimilarity(splitNarration(s), splitNarration(g)))
    }
    if (best >= 0.3) descHits++
  }
  if (descHits > 0) {
    confidence += Math.min(0.08, 0.04 * descHits)
    reasonBits.push('description')
  }

  // Prefer tighter groups
  if (group.length === 2) confidence += 0.03
  else if (group.length >= 4) confidence -= 0.03

  return { confidence: Math.min(0.95, Math.max(0, confidence)), reasonBits }
}

function preferNonOverlapping(matches: SuggestedSplitMatch[]): SuggestedSplitMatch[] {
  const used = new Set<string>()
  const kept: SuggestedSplitMatch[] = []
  for (const m of matches.sort((a, b) => b.confidence - a.confidence)) {
    const ids = [...m.cashBookTxs, ...m.bankTxs].map((t) => t.id)
    if (ids.some((id) => used.has(id))) continue
    for (const id of ids) used.add(id)
    kept.push(m)
  }
  return kept
}

export function suggestSplitMatches(
  cashBookTxs: Tx[],
  bankTxs: Tx[],
  matchedCbIds: Set<string>,
  matchedBankIds: Set<string>,
  options: SuggestMatchesOptions = {}
): SuggestedSplitMatch[] {
  const { amountTolerance = 0.01, dateWindowDays = 3 } = options
  const results: SuggestedSplitMatch[] = []
  const unmatchedCb = cashBookTxs.filter((t) => !matchedCbIds.has(t.id))
  const unmatchedBank = bankTxs.filter((t) => !matchedBankIds.has(t.id))

  // 1-to-Many: one cash-book row vs multiple bank rows (e.g. one deposit covering several clearings)
  for (const cb of unmatchedCb) {
    const windowBank = unmatchedBank.filter((bk) => datesWithinWindow(cb.date, bk.date, dateWindowDays))
    if (windowBank.length < 2) continue
    for (const subset of findSummingSubsets(windowBank, cb.amount, amountTolerance)) {
      const { confidence, reasonBits } = scoreSplitMatch([cb], subset, cb.amount)
      const extra = reasonBits.length ? ` (${reasonBits.join(', ')})` : ''
      results.push({
        cashBookTxs: [cb],
        bankTxs: subset,
        confidence,
        reason: `One-to-many: ${subset.length} bank items sum to ${cb.amount.toFixed(2)}${extra}`,
      })
    }
  }

  // Many-to-one: multiple cash-book rows vs one bank row (e.g. several cheques in one bulk debit)
  for (const bk of unmatchedBank) {
    const windowCb = unmatchedCb.filter((cb) => datesWithinWindow(cb.date, bk.date, dateWindowDays))
    if (windowCb.length < 2) continue
    for (const subset of findSummingSubsets(windowCb, bk.amount, amountTolerance)) {
      const { confidence, reasonBits } = scoreSplitMatch([bk], subset, bk.amount)
      const extra = reasonBits.length ? ` (${reasonBits.join(', ')})` : ''
      results.push({
        cashBookTxs: subset,
        bankTxs: [bk],
        confidence,
        reason: `Many-to-one: ${subset.length} cash-book items sum to ${bk.amount.toFixed(2)}${extra}`,
      })
    }
  }

  return preferNonOverlapping(results)
}

export interface SuggestedSplitMatch {
  cashBookTxs: Tx[]
  bankTxs: Tx[]
  confidence: number
  reason: string
  orgMemoryBoosted?: boolean
}
