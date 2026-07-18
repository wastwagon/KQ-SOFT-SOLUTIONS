/**
 * Change a document’s family (cash book ↔ bank statement), preserving side
 * (receipts↔credits, payments↔debits). Clears mapped transactions so the
 * user remaps under the correct canonical fields.
 */
import type { DocumentType } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { logAudit } from './audit.js'
import {
  documentFamilyOf,
  remapDocumentTypeToFamily,
  type DocumentFamily,
} from './documentTypeInference.js'

export type ChangeDocumentTypeResult = {
  from: DocumentType
  to: DocumentType
  clearedTransactions: number
  clearedMatches: number
}

export async function changeDocumentType(opts: {
  documentId: string
  organizationId: string
  userId: string
  /** Target family — side is preserved from the current type. */
  family: Exclude<DocumentFamily, 'unknown'>
}): Promise<ChangeDocumentTypeResult> {
  const doc = await prisma.document.findFirst({
    where: { id: opts.documentId },
    include: { project: true },
  })
  if (!doc || doc.project.organizationId !== opts.organizationId) {
    throw Object.assign(new Error('Document not found'), { status: 404 })
  }

  const currentFamily = documentFamilyOf(doc.type)
  if (currentFamily === opts.family) {
    throw Object.assign(
      new Error(`Document is already a ${opts.family === 'cash_book' ? 'cash book' : 'bank statement'}`),
      { status: 400 }
    )
  }

  const nextType = remapDocumentTypeToFamily(doc.type, opts.family)

  // Same file may already exist under the target type (e.g. uploaded as both).
  if (doc.contentHash) {
    const duplicate = await prisma.document.findFirst({
      where: {
        projectId: doc.projectId,
        type: nextType,
        contentHash: doc.contentHash,
        id: { not: doc.id },
        bankAccountId: opts.family === 'cash_book' ? null : doc.bankAccountId,
      },
      select: { id: true, filename: true },
    })
    if (duplicate) {
      throw Object.assign(
        new Error(
          `A ${nextType.replace(/_/g, ' ')} document with the same file already exists (${duplicate.filename}). Remove it first, or keep this upload and delete the duplicate.`
        ),
        { status: 409 }
      )
    }
  }

  const txIds = (
    await prisma.transaction.findMany({
      where: { documentId: doc.id },
      select: { id: true },
    })
  ).map((t) => t.id)

  let clearedMatches = 0
  if (txIds.length) {
    const matchItems = await prisma.matchItem.findMany({
      where: { transactionId: { in: txIds } },
      select: { matchId: true },
    })
    const matchIds = [...new Set(matchItems.map((m) => m.matchId))]
    // Deleting transactions cascades match items; remove emptied matches.
    await prisma.transaction.deleteMany({ where: { documentId: doc.id } })
    if (matchIds.length) {
      for (const matchId of matchIds) {
        const remaining = await prisma.matchItem.count({ where: { matchId } })
        if (remaining === 0) {
          await prisma.match.delete({ where: { id: matchId } })
          clearedMatches++
        }
      }
    }
  }

  await prisma.document.update({
    where: { id: doc.id },
    data: {
      type: nextType,
      ...(opts.family === 'cash_book' ? { bankAccountId: null } : {}),
    },
  })

  await logAudit({
    organizationId: opts.organizationId,
    userId: opts.userId,
    projectId: doc.projectId,
    action: 'document_mapped',
    details: {
      documentId: doc.id,
      action: 'document_type_changed',
      from: doc.type,
      to: nextType,
      clearedTransactions: txIds.length,
      clearedMatches,
    },
  })

  return {
    from: doc.type,
    to: nextType,
    clearedTransactions: txIds.length,
    clearedMatches,
  }
}
