import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  FileCheck,
  Settings,
  ShieldCheck,
  Menu,
  LogOut,
  X,
  Bell,
  FileText,
} from 'lucide-react'
import { useAuth } from '../store/auth'
import { settings, getLogoDisplayUrl } from '../lib/api'

const preloadProjectsPage = () => import('../pages/Projects')
const preloadSettingsPage = () => import('../pages/Settings')

const mainNavItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderKanban, preload: preloadProjectsPage },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/clients', label: 'Clients', icon: Users },
]

const adminNavItems = [
  { to: '/audit', label: 'Audit log', icon: FileCheck },
  { to: '/settings', label: 'Settings', icon: Settings, preload: preloadSettingsPage },
]

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
    isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  }`

export default function AppLayout() {
  const navigate = useNavigate()
  const { user, org, role, logout, isPlatformAdmin } = useAuth()
  const roleLabel = role === 'admin' ? 'Admin' : role === 'reviewer' ? 'Reviewer' : role === 'preparer' ? 'Preparer' : role === 'viewer' ? 'Viewer' : null
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [logoLoadFailed, setLogoLoadFailed] = useState(false)
  const { data: branding } = useQuery({
    queryKey: ['settings', 'branding'],
    queryFn: settings.getBranding,
  })
  const logoUrl = (branding as { logoUrl?: string } | undefined)?.logoUrl
  const showLogo = logoUrl && !logoLoadFailed
  useEffect(() => { setLogoLoadFailed(false) }, [logoUrl])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Top header bar: logo + nav + user */}
      <header className="sticky top-0 z-40 flex items-center h-14 px-4 sm:px-6 bg-white border-b border-border shadow-sm">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded">
          {showLogo ? (
            <img
              src={getLogoDisplayUrl(logoUrl)}
              alt="Organisation logo"
              className="max-h-8 w-auto max-w-[140px] object-contain object-left"
              onError={() => setLogoLoadFailed(true)}
            />
          ) : (
            <span className="text-lg font-semibold text-primary-600">BRS</span>
          )}
        </NavLink>

        {/* Main nav (desktop) */}
        <nav className="hidden md:flex items-center gap-1 ml-6" aria-label="Main navigation">
          {mainNavItems.map(({ to, label, icon: Icon, preload }) => (
            <NavLink key={to} to={to} end={to === '/'} className={navLinkClass} onMouseEnter={preload} onFocus={preload}>
              <Icon className="w-4 h-4 opacity-80" />
              {label}
            </NavLink>
          ))}
          <span className="mx-2 text-gray-200">|</span>
          {adminNavItems.map(({ to, label, icon: Icon, preload }) => (
            <NavLink key={to} to={to} className={navLinkClass} onMouseEnter={preload} onFocus={preload}>
              <Icon className="w-4 h-4 opacity-80" />
              {label}
            </NavLink>
          ))}
          {isPlatformAdmin && (
            <>
              <span className="mx-2 text-gray-200">|</span>
              <NavLink to="/platform-admin" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-amber-50 text-amber-800 hover:bg-amber-100">
                <ShieldCheck className="w-4 h-4" />
                Platform Admin
              </NavLink>
            </>
          )}
        </nav>

        {/* Spacer */}
        <div className="flex-1 min-w-4" />

        {/* Top bar items: org, role, notifications, user, logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          {org?.name && (
            <span className="hidden lg:inline text-sm text-gray-500 truncate max-w-[120px]" title={org.name}>
              {org.name}
            </span>
          )}
          {roleLabel && (
            <span
              className={`hidden sm:inline-flex px-2 py-0.5 text-xs font-semibold rounded uppercase tracking-wide ${
                role === 'admin' ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {roleLabel}
            </span>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationOpen((o) => !o)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              title="Notifications"
              aria-label="Notifications"
              aria-expanded={notificationOpen}
            >
              <Bell className="w-5 h-5" />
            </button>
            {notificationOpen && (
              <>
                <div className="fixed inset-0 z-40" aria-hidden onClick={() => setNotificationOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-gray-200 bg-white py-2 shadow-lg">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">Notifications</p>
                  </div>
                  <div className="px-4 py-6 text-center text-sm text-gray-500">No new notifications</div>
                </div>
              </>
            )}
          </div>
          <div
            className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm shrink-0"
            title={user?.email ?? ''}
          >
            {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline text-sm font-medium">Log out</span>
          </button>

          {/* Mobile menu trigger */}
          <div className="md:hidden relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" aria-hidden onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-gray-200 bg-white py-2 shadow-xl">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Main</p>
                  </div>
                  {mainNavItems.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === '/'}
                      onClick={() => setMenuOpen(false)}
                      onMouseEnter={to === '/projects' ? preloadProjectsPage : undefined}
                      onFocus={to === '/projects' ? preloadProjectsPage : undefined}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2.5 text-sm font-medium ${isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}`
                      }
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </NavLink>
                  ))}
                  <div className="px-3 py-2 mt-2 border-t border-gray-100">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
                  </div>
                  {adminNavItems.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={() => setMenuOpen(false)}
                      onMouseEnter={to === '/settings' ? preloadSettingsPage : undefined}
                      onFocus={to === '/settings' ? preloadSettingsPage : undefined}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2.5 text-sm font-medium ${isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}`
                      }
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </NavLink>
                  ))}
                  {isPlatformAdmin && (
                    <NavLink
                      to="/platform-admin"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-50"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Platform Admin
                    </NavLink>
                  )}
                  {org?.name && (
                    <div className="px-4 py-2 mt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500">Org: {org.name}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  )
}
