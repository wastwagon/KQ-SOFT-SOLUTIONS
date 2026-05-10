/**
 * Shared types for the reconcile workflow.  Lifted out of ProjectReconcile.tsx
 * so the per-panel components can share a single contract for transactions,
 * suggested matches, and confirmed match pairs.
 */

export interface Tx {
  id: string
  date: string | null
  name: string | null
  details: string | null
  amount: number
  chqNo?: string | null
  docRef?: string | null
}

export interface SuggestedMatch {
  cashBookTx: Tx
  bankTx: Tx
  confidence: number
  reason: string
  duplicateWarning?: boolean
}

export interface SuggestedSplitMatch {
  cashBookTxs: Tx[]
  bankTxs: Tx[]
  confidence: number
  reason: string
}

export interface AttachmentInfo {
  id: string
  filename: string
  mimeType?: string | null
  size?: number | null
}

export interface MatchedPair {
  matchId: string
  cbTx: Tx
  bankTx: Tx
  attachments?: AttachmentInfo[]
}

/** Which side of the workflow the user is currently looking at. */
export type ReconcileView = 'receipts' | 'payments' | 'all'

/** Per-org matching preset preferences (also persisted in localStorage). */
export interface MatchParams {
  useDate: boolean
  useDocRef: boolean
  useChequeNo: boolean
}
