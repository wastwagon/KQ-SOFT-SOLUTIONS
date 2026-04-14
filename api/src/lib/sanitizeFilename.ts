/**
 * Sanitize filename for safe storage and Content-Disposition headers.
 * Removes path traversal, control chars, and characters that could cause header injection.
 */
export function sanitizeFilename(name: string): string {
  if (!name || typeof name !== 'string') return 'file'
  // Strip path components
  const base = name.replace(/^.*[/\\]/, '').trim()
  if (!base) return 'file'
  // Remove control chars, quotes, newlines (header injection)
  const safe = base.replace(/[\x00-\x1f\x7f"\\\r\n]/g, '').replace(/\.\./g, '')
  return safe.slice(0, 255) || 'file'
}
