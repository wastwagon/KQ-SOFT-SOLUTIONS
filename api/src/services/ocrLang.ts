/**
 * Resolve Tesseract language string from env.
 * - OCR_LANGS: comma-separated list, e.g. "eng+fra" or "eng, fra"
 * - OCR_LANG: single override (default eng)
 */
/** Tesseract 3-letter language codes joined by + (e.g. eng+fra). */
const ALLOWED_LANG = /^[a-zA-Z]{3}(?:\+[a-zA-Z]{3})*$/

export function resolveOcrLanguages(): string {
  const fromList = (process.env.OCR_LANGS || '').trim()
  if (fromList) {
    const langs = fromList
      .split(/[,+]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    const joined = langs.join('+')
    if (ALLOWED_LANG.test(joined)) return joined
  }
  const single = (process.env.OCR_LANG || 'eng').trim().toLowerCase()
  if (ALLOWED_LANG.test(single)) return single
  return 'eng'
}
