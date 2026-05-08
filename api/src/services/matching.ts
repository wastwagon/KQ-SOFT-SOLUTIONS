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

  // Optimization: Index bank transactions by amount to avoid O(N*M) complexity
  // We round amounts to 2 decimal places to handle float precision issues in keys
  const bankByAmt = new Map<string, Tx[]>()
  for (const bk of bankTxs) {
    if (matchedBankIds.has(bk.id)) continue
    const key = bk.amount.toFixed(2)
    if (!bankByAmt.has(key)) bankByAmt.set(key, [])
    bankByAmt.get(key)!.push(bk)
  }

  for (const cb of cashBookTxs) {
    if (matchedCashBookIds.has(cb.id)) continue
    
    // Quick lookup instead of inner loop
    const candidates = bankByAmt.get(cb.amount.toFixed(2)) || []
    
    for (const bk of candidates) {
      const dateMatch = datesWithinWindow(cb.date, bk.date, dateWindowDays)
      if (requireDateMatch && useDate && !dateMatch) continue
      
      const chqMatch = useChequeNo ? chequeNumbersMatch(cb, bk) : false
      const docRefMatch = useDocRef ? docRefsMatch(cb, bk) : false
      const textRefMatch = useDocRef || useChequeNo ? refsMatch(cb, bk) : false
      const refMatch = chqMatch || docRefMatch || textRefMatch
      
      if (requireRefForCheques && cb.chqNo?.trim() && !refMatch) continue
      
      let confidence = 0
      confidence += 0.6 // Base amount match
      if (useDate && dateMatch) confidence += 0.3
      
      const descMatch = cb.details && bk.details &&
        (cb.details.toLowerCase().includes(bk.details.slice(0, 20).toLowerCase()) ||
         bk.details.toLowerCase().includes(cb.details.slice(0, 20).toLowerCase()))
      if (descMatch) confidence += 0.1
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

  // 1-to-Many: One Cash Book vs Multiple Bank (e.g. one deposit matching multiple cleared items)
  for (const cb of unmatchedCb) {
    const windowBank = unmatchedBank.filter((bk) => datesWithinWindow(cb.date, bk.date, dateWindowDays))
    if (windowBank.length < 2) continue
    
    // Strategy: Consecutive or same-day items that sum up
    for (let i = 0; i < windowBank.length; i++) {
      let currentSum = 0
      const subset: Tx[] = []
      for (let j = i; j < Math.min(i + 5, windowBank.length); j++) {
        currentSum += windowBank[j]!.amount
        subset.push(windowBank[j]!)
        if (subset.length >= 2 && amountsMatch(cb.amount, currentSum, amountTolerance)) {
          results.push({
            cashBookTxs: [cb],
            bankTxs: [...subset],
            confidence: 0.8,
            reason: `One-to-many: Total matches ${cb.amount.toFixed(2)}`,
          })
          break
        }
      }
    }
  }

  // Many-to-1: Multiple Cash Book vs One Bank (e.g. multiple cheques matching one bulk debit)
  for (const bk of unmatchedBank) {
    const windowCb = unmatchedCb.filter((cb) => datesWithinWindow(cb.date, bk.date, dateWindowDays))
    if (windowCb.length < 2) continue
    
    for (let i = 0; i < windowCb.length; i++) {
      let currentSum = 0
      const subset: Tx[] = []
      for (let j = i; j < Math.min(i + 5, windowCb.length); j++) {
        currentSum += windowCb[j]!.amount
        subset.push(windowCb[j]!)
        if (subset.length >= 2 && amountsMatch(bk.amount, currentSum, amountTolerance)) {
          results.push({
            cashBookTxs: [...subset],
            bankTxs: [bk],
            confidence: 0.8,
            reason: `Many-to-one: Total matches ${bk.amount.toFixed(2)}`,
          })
          break
        }
      }
    }
  }

  return results
}

export interface SuggestedSplitMatch {
  cashBookTxs: Tx[]
  bankTxs: Tx[]
  confidence: number
  reason: string
}
