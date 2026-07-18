/**
 * Document parse/auto-map job status persisted on Document rows.
 * pending → processing → ready | failed
 */
import { prisma } from './prisma.js'

export type DocumentParseStatus = 'pending' | 'processing' | 'ready' | 'failed'

export function isParseJobInFlight(status: string | null | undefined): boolean {
  return status === 'pending' || status === 'processing'
}

export async function setDocumentParseStatus(
  documentId: string,
  status: DocumentParseStatus,
  message?: string | null
): Promise<void> {
  const now = new Date()
  await prisma.document.update({
    where: { id: documentId },
    data: {
      parseStatus: status,
      parseStatusMessage: message ?? null,
      ...(status === 'processing'
        ? { parseStartedAt: now, parseFinishedAt: null }
        : {}),
      ...(status === 'pending'
        ? { parseStartedAt: null, parseFinishedAt: null }
        : {}),
      ...(status === 'ready' || status === 'failed'
        ? { parseFinishedAt: now }
        : {}),
    },
  })
}

export async function markDocumentParsePending(documentId: string): Promise<void> {
  await setDocumentParseStatus(documentId, 'pending', 'Queued for parse / auto-map')
}

export async function markDocumentParseProcessing(documentId: string): Promise<void> {
  await setDocumentParseStatus(documentId, 'processing', 'Parsing document…')
}

export async function markDocumentParseReady(
  documentId: string,
  message?: string
): Promise<void> {
  await setDocumentParseStatus(documentId, 'ready', message ?? 'Ready')
}

export async function markDocumentParseFailed(
  documentId: string,
  error: string
): Promise<void> {
  await setDocumentParseStatus(documentId, 'failed', error.slice(0, 500))
}
