import { useState } from 'react'
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  DollarSign,
  Receipt,
  Settings,
  Server,
  ArrowLeft,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '../store/auth'
import BrandLogo from './BrandLogo'

const adminNavItems = [
  { to: '/platform-admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/platform-admin/organizations', label: 'Organizations', icon: Building2, end: false },
  { to: '/platform-admin/users', label: 'Users', icon: Users, end: false },
  { to: '/platform-admin/plans', label: 'Plans', icon: CreditCard, end: false },
  { to: '/platform-admin/payments', label: 'Payments', icon: Receipt, end: false },
  { to: '/platform-admin/revenue', label: 'Revenue', icon: DollarSign, end: false },
  { to: '/platform-admin/generation-settings', label: 'Generation settings', icon: Settings, end: false },
  { to: '/platform-admin/database', label: 'Database', icon: Server, end: false },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const { user, logout, isPlatformAdmin } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (!isPlatformAdmin) {
    navigate('/')
    return null
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-surface flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-border flex flex-col
          transform transition-transform duration-200 ease-out lg:transform-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        aria-label="Admin navigation"
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-border-muted lg:px-5">
          <div className="flex items-center gap-2 min-w-0">
            <BrandLogo variant="icon" className="h-9 w-9 shrink-0" />
            <span className="text-lg font-semibold text-primary-600 truncate">Platform Admin</span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {adminNavItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between gap-4 px-4 lg:px-6 border-b border-border bg-white">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0" />
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to app
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto px-4 py-6 lg:px-8 lg:py-8">
          <div className="max-w-[1600px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
