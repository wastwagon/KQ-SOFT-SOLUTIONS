import { lazy, Suspense } from 'react'
import { useAuth } from '../store/auth'

const Forbidden = lazy(() => import('../pages/Forbidden'))

/**
 * Guard for platform-admin routes.  Non-admins see a branded 403 page rather
 * than being silently redirected to "/".
 */
export default function PlatformAdminRoute({ children }: { children: React.ReactNode }) {
  const isPlatformAdmin = useAuth((s) => s.isPlatformAdmin)
  if (!isPlatformAdmin) {
    return (
      <Suspense fallback={null}>
        <Forbidden />
      </Suspense>
    )
  }
  return <>{children}</>
}
