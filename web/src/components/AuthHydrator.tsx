import { useEffect } from 'react'
import { auth } from '../lib/api'
import { useAuth } from '../store/auth'

/**
 * Refreshes session from server on load so isPlatformAdmin is always correct.
 * Fixes stale persisted state (e.g. user logged in before platform admin was set).
 */
export default function AuthHydrator() {
  const token = useAuth((s) => s.token)
  const refreshSession = useAuth((s) => s.refreshSession)

  useEffect(() => {
    if (!token) return
    auth
      .me()
      .then((data) => refreshSession({ user: data.user, org: data.org, role: data.role, isPlatformAdmin: data.isPlatformAdmin }))
      .catch(() => {})
  }, [token, refreshSession])

  return null
}
