import { Navigate } from 'react-router-dom'
import { useAuth } from '../store/auth'

export default function PlatformAdminRoute({ children }: { children: React.ReactNode }) {
  const isPlatformAdmin = useAuth((s) => s.isPlatformAdmin)
  if (!isPlatformAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}
