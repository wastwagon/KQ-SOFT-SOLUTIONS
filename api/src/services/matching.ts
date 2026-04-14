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

/**
 * Extract cheque/reference numbers from text (e.g. "CHQ 002038", "REF 12345", "Cheque No. 001957").
 * Also returns 4–8 digit sequences that may be cheque numbers.
 */
function extractRefsFromText(text: string | null): string[] {
  if (!text || typeof text !== 'string') return []
  const refs = new Set<string>()
  // Explicit patterns: CHQ 12345, Cheque 12345, REF 12345, Ref # 12345
  const explicitRe = /\b(?:CHQ|Cheque|REF|Ref)\s*[#:.]?\s*(\d{3,10})\b/gi
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

/**
 * Returns true if cash book chqNo matches bank description/refs, or vice versa.
 */
function refsMatch(cb: Tx, bk: Tx): boolean {
  const cbChq = cb.chqNo?.trim()
  const bkChq = bk.chqNo?.trim()
  if (cbChq && bkChq && cbChq === bkChq) return true
  const bkText = [bk.details, bk.name].filter(Boolean).join(' ')
  const cbText = [cb.details, cb.name].filter(Boolean).join(' ')
  const bkRefs = extractRefsFromText(bkText)
  const cbRefs = extractRefsFromText(cbText)
  if (cbChq && (bkRefs.includes(cbChq) || bkText.includes(cbChq))) return true
  if (bkChq && (cbRefs.includes(bkChq) || cbText.includes(bkChq))) return true
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
}

export function suggestMatches(
  cashBookTxs: Tx[],
  bankTxs: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  options: SuggestMatchesOptions = {}
): SuggestedMatch[] {
  const { requireRefForCheques = false, requireDateMatch = false, amountTolerance = 0.01, dateWindowDays = 3 } = options
  const suggestions: SuggestedMatch[] = []
  for (const cb of cashBookTxs) {
    if (matchedCashBookIds.has(cb.id)) continue
    for (const bk of bankTxs) {
      if (matchedBankIds.has(bk.id)) continue
      const amtMatch = amountsMatch(cb.amount, bk.amount, amountTolerance)
      const dateMatch = datesWithinWindow(cb.date, bk.date, dateWindowDays)
      if (!amtMatch) continue
      if (requireDateMatch && !dateMatch) continue
      const refMatch = refsMatch(cb, bk)
      if (requireRefForCheques && cb.chqNo?.trim() && !refMatch) continue
      let confidence = 0
      if (amtMatch) confidence += 0.6
      if (dateMatch) confidence += 0.3
      const descMatch = cb.details && bk.details &&
        (cb.details.toLowerCase().includes(bk.details.slice(0, 20).toLowerCase()) ||
         bk.details.toLowerCase().includes(cb.details.slice(0, 20).toLowerCase()))
      if (descMatch) confidence += 0.1
      if (refMatch) confidence += 0.15
      confidence = Math.min(confidence, 1)
      if (confidence >= 0.6) {
        const reasons: string[] = []
        if (dateMatch) reasons.push('date')
        if (descMatch) reasons.push('description')
        if (refMatch) reasons.push('chq/ref')
        const reason = reasons.length ? `Amount + ${reasons.join(', ')} match` : 'Amount match'
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
    const refList = list.filter((s) => refsMatch(s.cashBookTx, s.bankTx))
    if (refList.length === 1) {
      for (const s of list) {
        if (s.cashBookTx.id !== refList[0]!.cashBookTx.id) {
          excluded.add(`${s.cashBookTx.id}::${s.bankTx.id}`)
        }
      }
      continue
    }
    const dateList = list.filter((s) => datesWithinWindow(s.cashBookTx.date, s.bankTx.date, dateWindowDays))
    if (dateList.length === 1) {
      for (const s of list) {
        if (s.cashBookTx.id !== dateList[0]!.cashBookTx.id) {
          excluded.add(`${s.cashBookTx.id}::${s.bankTx.id}`)
        }
      }
      continue
    }
    // No unique tie-breaker -> block all auto-suggestions for this bank transaction.
    for (const s of list) {
      excluded.add(`${s.cashBookTx.id}::${s.bankTx.id}`)
    }
  }
  const filtered = suggestions.filter((s) => !excluded.has(`${s.cashBookTx.id}::${s.bankTx.id}`))
  // Duplicate detection: flag when multiple bank txns match same cash book (amount+date)
  const byCbId = new Map<string, SuggestedMatch[]>()
  for (const s of filtered) {
    const key = s.cashBookTx.id
    if (!byCbId.has(key)) byCbId.set(key, [])
    byCbId.get(key)!.push(s)
  }
  for (const list of byCbId.values()) {
    if (list.length > 1) {
      for (const s of list) s.duplicateWarning = true
    }
  }
  return filtered.sort((a, b) => b.confidence - a.confidence)
}
