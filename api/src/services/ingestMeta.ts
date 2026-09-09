import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import type { ImportLocale } from './importLocale.js'
import {
  checksumBlocksReconcile,
  type StatementChecksumResult,
} from './statementBalanceChecksum.js'

export type IngestMeta = {
  detectedBankFormat?: string | null
  parseMethod?: string
  autoMap?: { status: string; reason?: string }
  checksum?: StatementChecksumResult
  checksumAcknowledged?: boolean
  locale?: ImportLocale
}

export function readIngestMeta(raw: unknown): IngestMeta {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return raw as IngestMeta
}

export async function mergeDocumentIngestMeta(
  documentId: string,
  patch: Partial<IngestMeta>
): Promise<IngestMeta> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { ingestMeta: true },
  })
  const prev = readIngestMeta(doc?.ingestMeta)
  const next: IngestMeta = {
    ...prev,
    ...patch,
    checksum: patch.checksum ?? prev.checksum,
    locale: patch.locale ?? prev.locale,
    autoMap: patch.autoMap ?? prev.autoMap,
  }
  if (patch.checksumAcknowledged != null) {
    next.checksumAcknowledged = patch.checksumAcknowledged
  }
  await prisma.document.update({
    where: { id: documentId },
    data: { ingestMeta: next as Prisma.InputJsonValue },
  })
  return next
}

export type IngestBlockPayload = {
  blocked: true
  code: 'INGEST_CHECKSUM_FAILED'
  message: string
  documents: { id: string; filename: string; message?: string }[]
}

export function ingestBlockFromDocuments(
  docs: { id: string; filename: string; type: string; bankAccountId?: string | null; ingestMeta?: unknown }[],
  bankAccountId?: string
): IngestBlockPayload | null {
  const bankDocs = docs.filter((d) => {
    if (!d.type.startsWith('bank_')) return false
    if (bankAccountId && d.bankAccountId && d.bankAccountId !== bankAccountId) return false
    return true
  })
  const blocked = bankDocs.filter((d) => checksumBlocksReconcile(readIngestMeta(d.ingestMeta)))
  if (!blocked.length) return null
  const details = blocked.map((d) => ({
    id: d.id,
    filename: d.filename,
    message: readIngestMeta(d.ingestMeta).checksum?.message,
  }))
  return {
    blocked: true,
    code: 'INGEST_CHECKSUM_FAILED',
    message:
      'Bank statement opening and closing balances do not tie to the imported lines. Remap columns or export Excel, CSV, OFX, MT940, or CAMT.053, then try again. Confirm only after you have checked the extract.',
    documents: details,
  }
}

export async function getProjectIngestBlock(
  projectId: string,
  bankAccountId?: string
): Promise<IngestBlockPayload | null> {
  const docs = await prisma.document.findMany({
    where: { projectId, type: { in: ['bank_credits', 'bank_debits'] } },
    select: { id: true, filename: true, type: true, bankAccountId: true, ingestMeta: true },
  })
  return ingestBlockFromDocuments(docs, bankAccountId)
}

export async function acknowledgeIngestChecksum(opts: {
  documentId: string
  organizationId: string
}): Promise<IngestMeta> {
  const doc = await prisma.document.findFirst({
    where: { id: opts.documentId },
    include: { project: true },
  })
  if (!doc || doc.project.organizationId !== opts.organizationId) {
    const err = new Error('Document not found') as Error & { status?: number }
    err.status = 404
    throw err
  }
  const siblings = await prisma.document.findMany({
    where: {
      projectId: doc.projectId,
      type: { in: ['bank_credits', 'bank_debits'] },
      ...(doc.bankAccountId ? { bankAccountId: doc.bankAccountId } : {}),
    },
    select: { id: true },
  })
  let last: IngestMeta = {}
  for (const s of siblings) {
    last = await mergeDocumentIngestMeta(s.id, { checksumAcknowledged: true })
  }
  return last
}
