/**
 * Same-amount in/out pairs that can offset on a BRS.
 * Blank cheque/reference values ("0", "00") are not keys — GT Bank statements
 * use 0 when there is no cheque, and pairing on that value invents reversals.
 */

export type ReversalTx = {
  id: string
  date: Date | string | null
  name: string | null
  details: string | null
  chqNo?: string | null
  docRef?: string | null
  amount: number
}

export type ReversalCandidate = {
  reference: string
  stream: 'cash_book' | 'bank'
  amount: number
  incomingDate: string | null
  outgoingDate: string | null
  incomingNarration: string
  outgoingNarration: string
  dayDiff: number
}

const RETURNED_CHEQUE_RE = /RETURNED\s+CHEQUES?|RETURNED\s+CHECKS?|CHEQUE\s+RETURN|CHQ\.?\s*RETURN/i
const GENERIC_WINDOW_DAYS = 31
const RETURNED_CHEQUE_WINDOW_DAYS = 120

function narration(t: ReversalTx): string {
  return [t.details, t.name].filter(Boolean).join(' ')
}

/** Cheque/reference token that can identify a pair. "0" and blanks are not tokens. */
export function meaningfulReversalRef(value: string | null | undefined): string {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '')
  if (!digits) return ''
  return raw.replace(/[^a-z0-9]/g, '')
}

function dayDiff(a: ReversalTx, b: ReversalTx): number {
  const da = a.date ? new Date(a.date) : null
  const db = b.date ? new Date(b.date) : null
  if (!da || !db || Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 0
  return Math.abs((da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24))
}

function amountsEqual(a: number, b: number): boolean {
  return Math.abs(Math.abs(a) - Math.abs(b)) <= 0.01
}

function pairKey(t: ReversalTx): string {
  const ref = meaningfulReversalRef(t.docRef)
  if (ref) return `ref:${ref}`
  const chq = meaningfulReversalRef(t.chqNo)
  if (chq) return `chq:${chq}`
  return ''
}

function chequeTokens(t: ReversalTx): string[] {
  const fromFields = [meaningfulReversalRef(t.chqNo), meaningfulReversalRef(t.docRef)].filter(Boolean)
  const fromText = [...narration(t).matchAll(/CHQ#\s*0*(\d{1,6})\b/gi)].map((m) => m[1]!.replace(/^0+/, ''))
  return [...new Set([...fromFields, ...fromText])]
}

function toCandidate(
  incoming: ReversalTx,
  outgoing: ReversalTx,
  stream: 'cash_book' | 'bank',
  reference: string
): ReversalCandidate {
  return {
    reference,
    stream,
    amount: Math.abs(incoming.amount),
    incomingDate: incoming.date ? new Date(incoming.date).toISOString() : null,
    outgoingDate: outgoing.date ? new Date(outgoing.date).toISOString() : null,
    incomingNarration: narration(incoming),
    outgoingNarration: narration(outgoing),
    dayDiff: Math.round(dayDiff(incoming, outgoing)),
  }
}

export function detectReversalCandidates(
  receipts: ReversalTx[],
  payments: ReversalTx[],
  credits: ReversalTx[],
  debits: ReversalTx[]
): ReversalCandidate[] {
  const candidates: ReversalCandidate[] = []
  const seen = new Set<string>()

  const add = (incoming: ReversalTx, outgoing: ReversalTx, stream: 'cash_book' | 'bank', reference: string) => {
    const id = `${stream}:${incoming.id}:${outgoing.id}`
    if (seen.has(id)) return
    seen.add(id)
    candidates.push(toCandidate(incoming, outgoing, stream, reference))
  }

  const collectPairs = (incoming: ReversalTx[], outgoing: ReversalTx[], stream: 'cash_book' | 'bank') => {
    const outSorted = [...outgoing].sort((a, b) => {
      const ad = a.date ? new Date(a.date).getTime() : 0
      const bd = b.date ? new Date(b.date).getTime() : 0
      return ad - bd
    })
    for (const inc of incoming) {
      const keyInc = pairKey(inc)
      if (!keyInc || Math.abs(inc.amount) <= 0) continue
      for (const out of outSorted) {
        const keyOut = pairKey(out)
        if (keyInc !== keyOut || Math.abs(out.amount) <= 0) continue
        if (!amountsEqual(inc.amount, out.amount)) continue
        if (dayDiff(inc, out) > GENERIC_WINDOW_DAYS) continue
        add(inc, out, stream, keyInc)
        break
      }
    }
  }

  collectPairs(receipts, payments, 'cash_book')
  collectPairs(credits, debits, 'bank')

  // Returned / postdated cheques often clear weeks later and use a different reference token
  // (for example "327////" against "CHQ#327"). Pair them by amount and cheque number.
  for (const credit of credits) {
    if (!RETURNED_CHEQUE_RE.test(narration(credit))) continue
    const creditCheques = chequeTokens(credit)
    const hits = debits.filter((debit) => {
      if (!amountsEqual(credit.amount, debit.amount)) return false
      if (dayDiff(credit, debit) > RETURNED_CHEQUE_WINDOW_DAYS) return false
      if (!creditCheques.length) return /CLEARING\s+WITHDRAWAL|RETURNED\s+CHEQUES?/i.test(narration(debit))
      const debitCheques = chequeTokens(debit)
      return creditCheques.some((c) => debitCheques.includes(c))
    })
    if (hits.length !== 1) continue
    const debit = hits[0]!
    const chq = creditCheques[0] || pairKey(credit) || 'returned-cheque'
    add(credit, debit, 'bank', chq.startsWith('chq:') || chq.startsWith('ref:') ? chq : `chq:${chq}`)
  }

  return candidates.slice(0, 100)
}

/**
 * Returned-cheque pairs that sit on both bank-only lists.
 * Callers pass the unmatched credit and debit rows only, so a cheque that
 * already cleared in the cash book is not treated as the offset. Both sides
 * leave the supporting lists together; dropping one side changes the summary.
 */
export function withoutOffsettingReturnedChequePairs<T extends ReversalTx>(
  credits: T[],
  debits: T[]
): { credits: T[]; debits: T[] } {
  const usedDebits = new Set<string>()
  const dropCredits = new Set<string>()
  const dropDebits = new Set<string>()

  for (const credit of credits) {
    if (!RETURNED_CHEQUE_RE.test(narration(credit))) continue
    const creditCheques = chequeTokens(credit)
    const hits = debits.filter((debit) => {
      if (usedDebits.has(debit.id)) return false
      if (!amountsEqual(credit.amount, debit.amount)) return false
      if (dayDiff(credit, debit) > RETURNED_CHEQUE_WINDOW_DAYS) return false
      if (!creditCheques.length) return /CLEARING\s+WITHDRAWAL|RETURNED\s+CHEQUES?/i.test(narration(debit))
      const debitCheques = chequeTokens(debit)
      return creditCheques.some((c) => debitCheques.includes(c))
    })
    if (hits.length !== 1) continue
    const debit = hits[0]!
    usedDebits.add(debit.id)
    dropCredits.add(credit.id)
    dropDebits.add(debit.id)
  }

  if (dropCredits.size === 0) return { credits, debits }
  return {
    credits: credits.filter((t) => !dropCredits.has(t.id)),
    debits: debits.filter((t) => !dropDebits.has(t.id)),
  }
}
