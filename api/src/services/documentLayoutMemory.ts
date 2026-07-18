/**
 * Organisation layout memory: learn column mappings from successful maps
 * and replay them on similar uploads (header-name based, not column index).
 */
import type { DocumentType } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { normHeader, type MappingConfidence } from './suggestedMapping.js'

const SOFT_MATCH_THRESHOLD = 0.72

export function fingerprintHeaders(headers: string[]): string {
  return headers.map((h) => normHeader(String(h ?? ''))).join('|')
}

export function headerTokenSet(headers: string[]): Set<string> {
  const tokens = new Set<string>()
  for (const h of headers) {
    for (const t of normHeader(String(h ?? '')).split(' ')) {
      if (t.length >= 2) tokens.add(t)
    }
  }
  return tokens
}

/** Jaccard similarity over header tokens (0–1). */
export function scoreHeaderSimilarity(a: string[], b: string[]): number {
  const sa = headerTokenSet(a)
  const sb = headerTokenSet(b)
  if (sa.size === 0 && sb.size === 0) return 1
  if (sa.size === 0 || sb.size === 0) return 0
  let inter = 0
  for (const t of sa) if (sb.has(t)) inter++
  return inter / (sa.size + sb.size - inter)
}

/** Convert index mapping → field → original header name. */
export function fieldMappingFromIndices(
  headers: string[],
  mapping: Record<string, number>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [field, idx] of Object.entries(mapping)) {
    if (typeof idx !== 'number' || idx < 0 || idx >= headers.length) continue
    const name = String(headers[idx] ?? '').trim()
    if (name) out[field] = name
  }
  return out
}

/**
 * Resolve learned field→header names onto current headers.
 * Prefer exact normalized match; fall back to unique substring contains.
 */
export function applyLearnedFieldMapping(
  headers: string[],
  fieldMapping: Record<string, string>
): Record<string, number> {
  const normalized = headers.map((h) => normHeader(String(h ?? '')))
  const out: Record<string, number> = {}
  for (const [field, headerName] of Object.entries(fieldMapping)) {
    const want = normHeader(headerName)
    if (!want) continue
    let idx = normalized.findIndex((h) => h === want)
    if (idx < 0) {
      const candidates = normalized
        .map((h, i) => ({ h, i }))
        .filter(({ h }) => h.includes(want) || want.includes(h))
      if (candidates.length === 1) idx = candidates[0].i
    }
    if (idx >= 0) out[field] = idx
  }
  return out
}

export function mergeLearnedMapping(
  base: Record<string, number>,
  learned: Record<string, number>
): { mapping: Record<string, number>; appliedFields: string[] } {
  const mapping = { ...base }
  const appliedFields: string[] = []
  for (const [field, idx] of Object.entries(learned)) {
    if (mapping[field] == null) {
      mapping[field] = idx
      appliedFields.push(field)
    } else if (mapping[field] !== idx) {
      // Prefer learned layout for this org — user already confirmed it once.
      mapping[field] = idx
      appliedFields.push(field)
    } else {
      appliedFields.push(field)
    }
  }
  return { mapping, appliedFields: [...new Set(appliedFields)] }
}

export function boostLearnedConfidence(
  confidence: Record<string, MappingConfidence>,
  appliedFields: string[]
): Record<string, MappingConfidence> {
  const out = { ...confidence }
  for (const field of appliedFields) {
    out[field] = 'high'
  }
  return out
}

export type LayoutMemoryMatch = {
  id: string
  similarity: number
  exact: boolean
  fieldMapping: Record<string, string>
  useCount: number
}

export function pickBestLayoutCandidate(
  headers: string[],
  candidates: Array<{
    id: string
    headerFingerprint: string
    headerSignature: unknown
    fieldMapping: unknown
    useCount: number
  }>
): LayoutMemoryMatch | null {
  if (!candidates.length) return null
  const fp = fingerprintHeaders(headers)
  const exact = candidates.find((c) => c.headerFingerprint === fp)
  if (exact) {
    return {
      id: exact.id,
      similarity: 1,
      exact: true,
      fieldMapping: (exact.fieldMapping || {}) as Record<string, string>,
      useCount: exact.useCount,
    }
  }

  let best: LayoutMemoryMatch | null = null
  for (const c of candidates) {
    const sig = Array.isArray(c.headerSignature)
      ? (c.headerSignature as string[])
      : []
    const similarity = scoreHeaderSimilarity(headers, sig)
    if (similarity < SOFT_MATCH_THRESHOLD) continue
    if (
      !best ||
      similarity > best.similarity ||
      (similarity === best.similarity && c.useCount > best.useCount)
    ) {
      best = {
        id: c.id,
        similarity,
        exact: false,
        fieldMapping: (c.fieldMapping || {}) as Record<string, string>,
        useCount: c.useCount,
      }
    }
  }
  return best
}

export async function findBestLayoutMemory(
  organizationId: string,
  documentType: DocumentType,
  headers: string[]
): Promise<LayoutMemoryMatch | null> {
  const candidates = await prisma.documentLayoutMemory.findMany({
    where: { organizationId, documentType },
    orderBy: [{ useCount: 'desc' }, { lastUsedAt: 'desc' }],
    take: 40,
  })
  return pickBestLayoutCandidate(headers, candidates)
}

export async function rememberDocumentLayout(opts: {
  organizationId: string
  documentType: DocumentType
  headers: string[]
  mapping: Record<string, number>
  parseMethodHint?: string | null
}): Promise<void> {
  const fieldMapping = fieldMappingFromIndices(opts.headers, opts.mapping)
  if (Object.keys(fieldMapping).length < 2) return

  const headerFingerprint = fingerprintHeaders(opts.headers)
  const headerSignature = opts.headers.map((h) => String(h ?? ''))

  await prisma.documentLayoutMemory.upsert({
    where: {
      organizationId_documentType_headerFingerprint: {
        organizationId: opts.organizationId,
        documentType: opts.documentType,
        headerFingerprint,
      },
    },
    create: {
      organizationId: opts.organizationId,
      documentType: opts.documentType,
      headerFingerprint,
      headerSignature,
      fieldMapping,
      parseMethodHint: opts.parseMethodHint || null,
      useCount: 1,
      lastUsedAt: new Date(),
    },
    update: {
      headerSignature,
      fieldMapping,
      parseMethodHint: opts.parseMethodHint || null,
      useCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  })
}

export async function touchLayoutMemoryUse(id: string): Promise<void> {
  await prisma.documentLayoutMemory.update({
    where: { id },
    data: {
      useCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  })
}

/** Apply org layout memory onto a suggested mapping (pure + DB lookup). */
export async function applyOrganisationLayoutMemory(
  organizationId: string,
  documentType: DocumentType,
  headers: string[],
  baseMapping: Record<string, number>
): Promise<{
  mapping: Record<string, number>
  appliedFields: string[]
  match: LayoutMemoryMatch | null
}> {
  const match = await findBestLayoutMemory(organizationId, documentType, headers)
  if (!match) {
    return { mapping: baseMapping, appliedFields: [], match: null }
  }
  const learned = applyLearnedFieldMapping(headers, match.fieldMapping)
  if (Object.keys(learned).length === 0) {
    return { mapping: baseMapping, appliedFields: [], match: null }
  }
  const { mapping, appliedFields } = mergeLearnedMapping(baseMapping, learned)
  return { mapping, appliedFields, match }
}
