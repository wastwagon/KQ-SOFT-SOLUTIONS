import { isPlatformAdmin } from './platformAdmin.js'

export type MembershipAccessSnapshot = {
  role: string
  userEmail: string
  userSuspendedAt: Date | null
  orgSuspendedAt: Date | null
}

/** Block suspended users; block suspended orgs unless platform admin. */
export function membershipAccessBlocked(snapshot: MembershipAccessSnapshot): {
  blocked: boolean
  code?: 'USER_SUSPENDED' | 'ORG_SUSPENDED'
  message?: string
} {
  if (snapshot.userSuspendedAt != null) {
    return {
      blocked: true,
      code: 'USER_SUSPENDED',
      message: 'Account suspended. Contact support.',
    }
  }
  if (
    snapshot.orgSuspendedAt != null &&
    !isPlatformAdmin(snapshot.userEmail)
  ) {
    return {
      blocked: true,
      code: 'ORG_SUSPENDED',
      message: 'Organization suspended. Contact support.',
    }
  }
  return { blocked: false }
}
