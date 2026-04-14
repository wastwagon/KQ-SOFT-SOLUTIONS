/**
 * Platform admin (superadmin) — env-based.
 * Set PLATFORM_ADMIN_EMAILS=admin@qsoft.com,other@example.com (comma-separated).
 */
const PLATFORM_ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS || 'admin@qsoft.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export function isPlatformAdmin(email: string): boolean {
  return PLATFORM_ADMIN_EMAILS.includes(email.trim().toLowerCase())
}
