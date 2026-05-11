/**
 * Legacy invite role `member` is treated as `preparer` everywhere we persist roles.
 */
export function normalizeOrgMemberRole(role: string): string {
  return role === 'member' ? 'preparer' : role
}
