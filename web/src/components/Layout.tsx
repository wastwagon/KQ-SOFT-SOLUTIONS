import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../store/auth'
import { subscription } from '../lib/api'

export default function Layout() {
  const navigate = useNavigate()
  const { user, org, logout, isAdmin } = useAuth()
  const { data: usageData } = useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: subscription.getUsage,
  })
  const features = (usageData?.features || {}) as Record<string, boolean>

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="text-xl font-semibold text-primary-600">
                BRS
              </Link>
              <nav className="flex gap-4">
                <Link
                  to="/"
                  className="text-gray-600 hover:text-gray-900 px-2 py-1 rounded"
                >
                  Dashboard
                </Link>
                <Link
                  to="/projects"
                  className="text-gray-600 hover:text-gray-900 px-2 py-1 rounded"
                >
                  Projects
                </Link>
                <Link
                  to="/clients"
                  className="text-gray-600 hover:text-gray-900 px-2 py-1 rounded"
                >
                  Clients
                </Link>
                {features.audit_trail && (
                <Link
                  to="/audit"
                  className="text-gray-600 hover:text-gray-900 px-2 py-1 rounded"
                >
                  Audit
                </Link>
                )}
                <Link
                  to="/settings"
                  className="text-gray-600 hover:text-gray-900 px-2 py-1 rounded"
                >
                  Settings
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              {isAdmin?.() && (
                <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded">Admin</span>
              )}
              <span className="text-sm text-gray-500">{org?.name}</span>
              <span className="text-sm text-gray-500">{user?.email}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
                {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}
