/**
 * Organisation match memory: learn from confirmed 1:1 matches and boost
 * future suggestions that share amount + ref/cheque/narration fingerprints.
 */
import { prisma } from '../lib/prisma.js'
import { tokenizeNarration, type Tx } from './matching.js'

export type MatchSideKind = 'receipt' | 'payment'

const MEMORY_BOOST = 0.1
const MEMORY_CONFIDENCE_CAP = 0.95
const NARR_JACCARD_THRESHOLD = 0.55

export type MatchMemoryTx = {
  name?: string | null
  details?: string | null
  docRef?: string | null
  chqNo?: string | null
  amount: number
}

export function amountToMinor(amount: number): number {
  return Math.round(Math.abs(amount) * 100)
}

function normalizeRefToken(value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = String(value).trim()
  if (!trimmed) return ''
  const digits = trimmed.replace(/\D/g, '')
  if (digits) return digits.replace(/^0+/, '') || '0'
  return trimmed.toLowerCase().replace(/\s+/g, '')
}

/** Stable side fingerprint — prefer cheque/ref, else sorted narration tokens. */
export function buildSideFingerprint(tx: MatchMemoryTx): {
  fingerprint: string
  learnable: boolean
} {
  const chq = normalizeRefToken(tx.chqNo)
  if (chq) return { fingerprint: `chq:${chq}`, learnable: true }
  const doc = normalizeRefToken(tx.docRef)
  if (doc) return { fingerprint: `ref:${doc}`, learnable: true }

  const tokens = [...tokenizeNarration(`${tx.name || ''} ${tx.details || ''}`)].sort()
  if (tokens.length < 2) return { fingerprint: '', learnable: false }
  return { fingerprint: `narr:${tokens.slice(0, 8).join('|')}`, learnable: true }
}

function fingerprintTokens(fp: string): Set<string> {
  if (fp.startsWith('narr:')) {
    return new Set(fp.slice(5).split('|').filter(Boolean))
  }
  if (fp.startsWith('chq:') || fp.startsWith('ref:')) {
    return new Set([fp.slice(4)])
  }
  return new Set()
}

/** Exact, truncated-ref, or narration Jaccard soft match (single-side only). */
export function fingerprintsMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a.startsWith('mset:') || b.startsWith('mset:')) return false
  if (a === b) return true

  const kindA = a.slice(0, 4)
  const kindB = b.slice(0, 4)
  if ((kindA === 'chq:' || kindA === 'ref:') && kindA === kindB) {
    const na = a.slice(4)
    const nb = b.slice(4)
    if (na === nb) return true
    if (na.length >= 3 && nb.length >= 3 && (na.endsWith(nb) || nb.endsWith(na))) return true
    return false
  }

  if (a.startsWith('narr:') && b.startsWith('narr:')) {
    const ta = fingerprintTokens(a)
    const tb = fingerprintTokens(b)
    if (!ta.size || !tb.size) return false
    let inter = 0
    for (const t of ta) if (tb.has(t)) inter++
    const jaccard = inter / (ta.size + tb.size - inter)
    return jaccard >= NARR_JACCARD_THRESHOLD
  }

  // Cross-kind: chq/ref vs narr containing the same digit token
  if (
    (a.startsWith('chq:') || a.startsWith('ref:')) &&
    b.startsWith('narr:') &&
    fingerprintTokens(b).has(a.slice(4))
  ) {
    return true
  }
  if (
    (b.startsWith('chq:') || b.startsWith('ref:')) &&
    a.startsWith('narr:') &&
    fingerprintTokens(a).has(b.slice(4))
  ) {
    return true
  }
  return false
}

/** Fingerprint for 2+ transactions on one side of a split match. */
export function buildMultiSideFingerprint(txs: MatchMemoryTx[]): {
  fingerprint: string
  learnable: boolean
} {
  if (txs.length < 2) return { fingerprint: '', learnable: false }
  const parts: string[] = []
  for (const tx of txs) {
    const fp = buildSideFingerprint(tx)
    if (!fp.learnable) return { fingerprint: '', learnable: false }
    parts.push(fp.fingerprint)
  }
  parts.sort()
  return { fingerprint: `mset:${parts.join('+')}`, learnable: true }
}

/** Soft-match multi-set fingerprints (bijection of member fingerprints). */
export function multiFingerprintsMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  if (!a.startsWith('mset:') || !b.startsWith('mset:')) {
    return fingerprintsMatch(a, b)
  }
  const pa = a.slice(5).split('+').filter(Boolean)
  const pb = b.slice(5).split('+').filter(Boolean)
  if (pa.length !== pb.length || pa.length === 0) return false
  const used = new Set<number>()
  for (const x of pa) {
    let found = -1
    for (let i = 0; i < pb.length; i++) {
      if (used.has(i)) continue
      if (fingerprintsMatch(x, pb[i]!)) {
        found = i
        break
      }
    }
    if (found < 0) return false
    used.add(found)
  }
  return true
}

function pairFingerprintsMatch(storedCb: string, storedBk: string, cb: string, bk: string): boolean {
  const cbOk = storedCb.startsWith('mset:')
    ? multiFingerprintsMatch(storedCb, cb)
    : fingerprintsMatch(storedCb, cb)
  const bkOk = storedBk.startsWith('mset:')
    ? multiFingerprintsMatch(storedBk, bk)
    : fingerprintsMatch(storedBk, bk)
  return cbOk && bkOk
}

export type MatchMemoryRecord = {
  amountMinor: number
  cashBookFingerprint: string
  bankFingerprint: string
  confirmationCount: number
}

export function applyOrganisationMatchMemoryBoost(
  suggestions: { cashBookTx: Tx; bankTx: Tx; confidence: number; reason: string; orgMemoryBoosted?: boolean }[],
  memories: MatchMemoryRecord[],
  amountTolerance = 0.01
): number {
  if (!suggestions.length || !memories.length) return 0
  let boosted = 0
  const tolMinor = Math.max(1, Math.round(amountTolerance * 100))

  for (const s of suggestions) {
    const cb = buildSideFingerprint(s.cashBookTx)
    const bk = buildSideFingerprint(s.bankTx)
    if (!cb.learnable || !bk.learnable) continue
    const amt = amountToMinor(s.cashBookTx.amount)
    const hit = memories.some((m) => {
      // 1:1 boost ignores split (mset) memories
      if (m.cashBookFingerprint.startsWith('mset:') || m.bankFingerprint.startsWith('mset:')) {
        return false
      }
      if (Math.abs(m.amountMinor - amt) > tolMinor) return false
      return (
        fingerprintsMatch(m.cashBookFingerprint, cb.fingerprint) &&
        fingerprintsMatch(m.bankFingerprint, bk.fingerprint)
      )
    })
    if (!hit) continue
    const before = s.confidence
    s.confidence = Math.min(MEMORY_CONFIDENCE_CAP, s.confidence + MEMORY_BOOST)
    if (s.confidence > before || hit) {
      s.orgMemoryBoosted = true
      if (s.confidence > before) boosted++
      if (!/org memory/i.test(s.reason)) {
        s.reason = s.reason
          ? `${s.reason}, org memory`
          : 'Organisation match memory'
      }
    }
  }
  return boosted
}

export async function rememberOrganisationMatch(opts: {
  organizationId: string
  currency?: string | null
  sideKind: MatchSideKind
  cashBookTx: MatchMemoryTx
  bankTx: MatchMemoryTx
}): Promise<boolean> {
  const cb = buildSideFingerprint(opts.cashBookTx)
  const bk = buildSideFingerprint(opts.bankTx)
  if (!cb.learnable || !bk.learnable) return false

  const currency = (opts.currency || 'GHS').toUpperCase()
  const amountMinor = amountToMinor(opts.cashBookTx.amount)

  await prisma.organizationMatchMemory.upsert({
    where: {
      organizationId_currency_sideKind_amountMinor_cashBookFingerprint_bankFingerprint: {
        organizationId: opts.organizationId,
        currency,
        sideKind: opts.sideKind,
        amountMinor,
        cashBookFingerprint: cb.fingerprint,
        bankFingerprint: bk.fingerprint,
      },
    },
    create: {
      organizationId: opts.organizationId,
      currency,
      sideKind: opts.sideKind,
      amountMinor,
      cashBookFingerprint: cb.fingerprint,
      bankFingerprint: bk.fingerprint,
      confirmationCount: 1,
      lastConfirmedAt: new Date(),
    },
    update: {
      confirmationCount: { increment: 1 },
      lastConfirmedAt: new Date(),
    },
  })
  return true
}

/** Remember a confirmed 1:N or N:1 split — never invents pairwise Cartesian memories. */
export async function rememberOrganisationSplitMatch(opts: {
  organizationId: string
  currency?: string | null
  sideKind: MatchSideKind
  structure: 'one_to_many' | 'many_to_one'
  cashBookTxs: MatchMemoryTx[]
  bankTxs: MatchMemoryTx[]
}): Promise<boolean> {
  let cbFp: { fingerprint: string; learnable: boolean }
  let bkFp: { fingerprint: string; learnable: boolean }
  let amountMinor: number

  if (opts.structure === 'one_to_many') {
    if (opts.cashBookTxs.length !== 1 || opts.bankTxs.length < 2) return false
    cbFp = buildSideFingerprint(opts.cashBookTxs[0]!)
    bkFp = buildMultiSideFingerprint(opts.bankTxs)
    amountMinor = amountToMinor(opts.cashBookTxs[0]!.amount)
  } else {
    if (opts.bankTxs.length !== 1 || opts.cashBookTxs.length < 2) return false
    cbFp = buildMultiSideFingerprint(opts.cashBookTxs)
    bkFp = buildSideFingerprint(opts.bankTxs[0]!)
    amountMinor = amountToMinor(opts.bankTxs[0]!.amount)
  }
  if (!cbFp.learnable || !bkFp.learnable) return false

  const currency = (opts.currency || 'GHS').toUpperCase()
  await prisma.organizationMatchMemory.upsert({
    where: {
      organizationId_currency_sideKind_amountMinor_cashBookFingerprint_bankFingerprint: {
        organizationId: opts.organizationId,
        currency,
        sideKind: opts.sideKind,
        amountMinor,
        cashBookFingerprint: cbFp.fingerprint,
        bankFingerprint: bkFp.fingerprint,
      },
    },
    create: {
      organizationId: opts.organizationId,
      currency,
      sideKind: opts.sideKind,
      amountMinor,
      cashBookFingerprint: cbFp.fingerprint,
      bankFingerprint: bkFp.fingerprint,
      confirmationCount: 1,
      lastConfirmedAt: new Date(),
    },
    update: {
      confirmationCount: { increment: 1 },
      lastConfirmedAt: new Date(),
    },
  })
  return true
}

export function applyOrganisationSplitMatchMemoryBoost(
  suggestions: {
    cashBookTxs: Tx[]
    bankTxs: Tx[]
    confidence: number
    reason: string
    orgMemoryBoosted?: boolean
  }[],
  memories: MatchMemoryRecord[],
  amountTolerance = 0.01
): number {
  if (!suggestions.length || !memories.length) return 0
  const splitMemories = memories.filter(
    (m) => m.cashBookFingerprint.startsWith('mset:') || m.bankFingerprint.startsWith('mset:')
  )
  if (!splitMemories.length) return 0

  let boosted = 0
  const tolMinor = Math.max(1, Math.round(amountTolerance * 100))

  for (const s of suggestions) {
    const oneToMany = s.cashBookTxs.length === 1 && s.bankTxs.length >= 2
    const manyToOne = s.bankTxs.length === 1 && s.cashBookTxs.length >= 2
    if (!oneToMany && !manyToOne) continue

    let cbFp: { fingerprint: string; learnable: boolean }
    let bkFp: { fingerprint: string; learnable: boolean }
    let amt: number
    if (oneToMany) {
      cbFp = buildSideFingerprint(s.cashBookTxs[0]!)
      bkFp = buildMultiSideFingerprint(s.bankTxs)
      amt = amountToMinor(s.cashBookTxs[0]!.amount)
    } else {
      cbFp = buildMultiSideFingerprint(s.cashBookTxs)
      bkFp = buildSideFingerprint(s.bankTxs[0]!)
      amt = amountToMinor(s.bankTxs[0]!.amount)
    }
    if (!cbFp.learnable || !bkFp.learnable) continue

    const hit = splitMemories.some((m) => {
      if (Math.abs(m.amountMinor - amt) > tolMinor) return false
      return pairFingerprintsMatch(
        m.cashBookFingerprint,
        m.bankFingerprint,
        cbFp.fingerprint,
        bkFp.fingerprint
      )
    })
    if (!hit) continue
    const before = s.confidence
    s.confidence = Math.min(MEMORY_CONFIDENCE_CAP, s.confidence + MEMORY_BOOST)
    s.orgMemoryBoosted = true
    if (s.confidence > before) boosted++
    if (!/org memory/i.test(s.reason)) {
      s.reason = s.reason ? `${s.reason}, org memory` : 'Organisation match memory'
    }
  }
  return boosted
}

export async function loadOrganisationMatchMemories(opts: {
  organizationId: string
  currency?: string | null
  sideKind: MatchSideKind
  amountMinors: number[]
}): Promise<MatchMemoryRecord[]> {
  if (!opts.amountMinors.length) return []
  const currency = (opts.currency || 'GHS').toUpperCase()
  const expanded = new Set<number>()
  for (const a of opts.amountMinors) {
    expanded.add(a)
    expanded.add(a - 1)
    expanded.add(a + 1)
  }
  const rows = await prisma.organizationMatchMemory.findMany({
    where: {
      organizationId: opts.organizationId,
      currency,
      sideKind: opts.sideKind,
      amountMinor: { in: [...expanded] },
    },
    orderBy: [{ confirmationCount: 'desc' }, { lastConfirmedAt: 'desc' }],
    take: 400,
    select: {
      amountMinor: true,
      cashBookFingerprint: true,
      bankFingerprint: true,
      confirmationCount: true,
    },
  })
  return rows
}

export function sideKindFromCashBookDocType(docType: string): MatchSideKind {
  return docType === 'cash_book_payments' ? 'payment' : 'receipt'
}
