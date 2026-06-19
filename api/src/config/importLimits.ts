/**
 * Central limits for document import, PDF/OCR extraction, and large transaction volumes.
 * Override via env without code changes (see .env.example).
 */

function readPositiveInt(envVal: string | undefined, fallback: number): number {
  const n = parseInt(envVal ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Default PDF pages processed on OCR path (native text extraction has no page cap). */
export const DEFAULT_PDF_OCR_MAX_PAGES = 200

/** Default max upload size per document (MB). */
export const DEFAULT_MAX_UPLOAD_SIZE_MB = 50

/** Reconcile fetch default (split across 4 lanes: receipts, credits, payments, debits). */
export const RECONCILE_DEFAULT_LIMIT = 16_000

/** Hard cap on transactions returned per reconcile request (4 × perCategory). */
export const RECONCILE_MAX_LIMIT = 40_000

/** Match suggestions returned per reconcile GET (aligned with reconcile max). */
export const SUGGESTION_DEFAULT_CAP = RECONCILE_MAX_LIMIT
export const SUGGESTION_MAX_LIMIT = RECONCILE_MAX_LIMIT

/** Sign-classification warnings shown in map UI (full count still returned separately). */
export const SIGN_WARNINGS_PREVIEW_MAX = 100

/** Sample rows in map preview (does not limit extraction). */
export const MAP_PREVIEW_ROW_SAMPLE = 50

/** Monthly imported transaction quotas per plan (-1 = unlimited). */
export const TIER_TRANSACTION_LIMITS: Record<string, number> = {
  basic: 5_000,
  standard: 50_000,
  premium: 200_000,
  firm: -1,
}

export function resolvePdfOcrMaxPages(): number {
  return readPositiveInt(process.env.PDF_OCR_MAX_PAGES, DEFAULT_PDF_OCR_MAX_PAGES)
}

export function resolveMaxUploadSizeMb(): number {
  return readPositiveInt(process.env.MAX_UPLOAD_SIZE_MB, DEFAULT_MAX_UPLOAD_SIZE_MB)
}

export function resolveMaxUploadSizeBytes(): number {
  return resolveMaxUploadSizeMb() * 1024 * 1024
}

export function resolveReconcileMaxLimit(): number {
  return readPositiveInt(process.env.RECONCILE_MAX_LIMIT, RECONCILE_MAX_LIMIT)
}
