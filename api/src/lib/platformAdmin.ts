/**
 * Platform admin (superadmin) — env-based.
 * Set PLATFORM_ADMIN_EMAILS=admin@kqsoftwaresolutions.com,other@example.com (comma-separated).
 * Default includes admin@qsoft.com so already-seeded databases keep platform access.
 */
const PLATFORM_ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS
  || 'admin@kqsoftwaresolutions.com,admin@qsoft.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export function isPlatformAdmin(email: string): boolean {
  return PLATFORM_ADMIN_EMAILS.includes(email.trim().toLowerCase())
}
