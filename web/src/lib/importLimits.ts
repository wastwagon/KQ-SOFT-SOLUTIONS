/**
 * Client-side defaults aligned with `api/src/config/importLimits.ts`.
 * Override upload size with VITE_MAX_UPLOAD_SIZE_MB when the API env differs.
 */

export const DEFAULT_MAX_UPLOAD_SIZE_MB = 50
export const DEFAULT_PDF_OCR_MAX_PAGES = 200
/** Default reconcile fetch limit (matches API RECONCILE_MAX_LIMIT). */
export const RECONCILE_CLIENT_LIMIT = 40_000
export const SIGN_WARNINGS_PREVIEW_MAX = 100

const mb = parseInt(import.meta.env.VITE_MAX_UPLOAD_SIZE_MB ?? String(DEFAULT_MAX_UPLOAD_SIZE_MB), 10)
export const MAX_UPLOAD_SIZE_MB =
  Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_UPLOAD_SIZE_MB
