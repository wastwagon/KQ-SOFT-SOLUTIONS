import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
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
  BookOpen,
  ChevronDown,
  UserCircle2,
} from 'lucide-react'
import { useAuth } from '../store/auth'
import { settings, getLogoDisplayUrl } from '../lib/api'
import BrandLogo from './BrandLogo'

const preloadProjectsPage = () => import('../pages/Projects')
const preloadSettingsPage = () => import('../pages/Settings')

const workNavItems = [
  { to: '/projects', label: 'Projects', icon: FolderKanban, preload: preloadProjectsPage },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/reports', label: 'Reports', icon: FileText },
]

const administrationNavItems = [
  { to: '/audit', label: 'Audit log', icon: FileCheck },
  { to: '/manual', label: 'User manual', icon: BookOpen },
  { to: '/settings', label: 'Settings', icon: Settings, preload: preloadSettingsPage },
]

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
    isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  }`

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, org, role, logout, isPlatformAdmin } = useAuth()
  const roleLabel = role === 'admin' ? 'Admin' : role === 'reviewer' ? 'Reviewer' : role === 'preparer' ? 'Preparer' : role === 'viewer' ? 'Viewer' : null
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [workMenuOpen, setWorkMenuOpen] = useState(false)
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)
  const [platformMenuOpen, setPlatformMenuOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null)
  const { data: branding } = useQuery({
    queryKey: ['settings', 'branding'],
    queryFn: settings.getBranding,
  })
  const logoUrl = (branding as { logoUrl?: string } | undefined)?.logoUrl
  const showOrgLogo = !!logoUrl?.trim() && failedLogoUrl !== logoUrl
  const path = location.pathname
  const workActive = path === '/projects' || path.startsWith('/projects/') || path === '/clients' || path.startsWith('/clients/') || path === '/reports' || path.startsWith('/reports/')
  const administrationActive = path === '/audit' || path.startsWith('/audit/') || path === '/manual' || path.startsWith('/manual/') || path === '/settings' || path.startsWith('/settings/')
  const platformActive = path === '/platform-admin' || path.startsWith('/platform-admin/')

  function closeDesktopMenus() {
    setWorkMenuOpen(false)
    setAdminMenuOpen(false)
    setPlatformMenuOpen(false)
    setProfileMenuOpen(false)
  }

  function handleLogout() {
    closeDesktopMenus()
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Top header bar: logo + nav + user */}
      <header className="sticky top-0 z-40 flex items-center h-14 px-4 sm:px-6 bg-white border-b border-border shadow-sm">
        {/* Logo */}
        <NavLink
          to="/"
          className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded"
        >
          <BrandLogo className="h-9 w-auto min-w-[140px] max-w-[min(100%,240px)] object-left object-contain" />
          {showOrgLogo && (
            <>
              <span className="hidden sm:block w-px h-7 bg-gray-200 shrink-0" aria-hidden />
              <img
                src={getLogoDisplayUrl(logoUrl!)}
                alt="Organisation logo"
                className="max-h-7 sm:max-h-8 w-auto max-w-[120px] object-contain object-left"
                onError={() => setFailedLogoUrl(logoUrl ?? '')}
              />
            </>
          )}
        </NavLink>

        {/* Main nav (desktop) */}
        <nav className="hidden md:flex items-center gap-1 ml-6" aria-label="Main navigation">
          <NavLink to="/" end className={navLinkClass}>
            <LayoutDashboard className="w-4 h-4 opacity-80" />
            Dashboard
          </NavLink>

          <div className="relative">
            <button
              type="button"
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                workActive || workMenuOpen ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
              onClick={() => {
                setWorkMenuOpen((v) => !v)
                setAdminMenuOpen(false)
                setPlatformMenuOpen(false)
                setProfileMenuOpen(false)
              }}
              aria-expanded={workMenuOpen}
            >
              Work
              <ChevronDown className="w-4 h-4" />
            </button>
            {workMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" aria-hidden onClick={() => setWorkMenuOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-40 w-52 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                  {workNavItems.map(({ to, label, icon: Icon, preload }) => (
                    <NavLink
                      key={to}
                      to={to}
                      className={navLinkClass}
                      onMouseEnter={preload}
                      onFocus={preload}
                      onClick={() => setWorkMenuOpen(false)}
                    >
                      <Icon className="w-4 h-4 opacity-80" />
                      {label}
                    </NavLink>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                administrationActive || adminMenuOpen ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
              onClick={() => {
                setAdminMenuOpen((v) => !v)
                setWorkMenuOpen(false)
                setPlatformMenuOpen(false)
                setProfileMenuOpen(false)
              }}
              aria-expanded={adminMenuOpen}
            >
              Administration
              <ChevronDown className="w-4 h-4" />
            </button>
            {adminMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" aria-hidden onClick={() => setAdminMenuOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-40 w-52 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                  {administrationNavItems.map(({ to, label, icon: Icon, preload }) => (
                    <NavLink
                      key={to}
                      to={to}
                      className={navLinkClass}
                      onMouseEnter={preload}
                      onFocus={preload}
                      onClick={() => setAdminMenuOpen(false)}
                    >
                      <Icon className="w-4 h-4 opacity-80" />
                      {label}
                    </NavLink>
                  ))}
                </div>
              </>
            )}
          </div>

          {isPlatformAdmin && (
            <div className="relative">
              <button
                type="button"
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  platformActive || platformMenuOpen ? 'bg-amber-50 text-amber-800' : 'text-amber-800 hover:bg-amber-50'
                }`}
                onClick={() => {
                  setPlatformMenuOpen((v) => !v)
                  setWorkMenuOpen(false)
                  setAdminMenuOpen(false)
                  setProfileMenuOpen(false)
                }}
                aria-expanded={platformMenuOpen}
              >
                <ShieldCheck className="w-4 h-4" />
                Platform
                <ChevronDown className="w-4 h-4" />
              </button>
              {platformMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" aria-hidden onClick={() => setPlatformMenuOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 z-40 w-60 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                    <NavLink to="/platform-admin" end className={navLinkClass} onClick={() => setPlatformMenuOpen(false)}>
                      Overview
                    </NavLink>
                    <NavLink to="/platform-admin/organizations" className={navLinkClass} onClick={() => setPlatformMenuOpen(false)}>
                      Organizations
                    </NavLink>
                    <NavLink to="/platform-admin/users" className={navLinkClass} onClick={() => setPlatformMenuOpen(false)}>
                      Users
                    </NavLink>
                    <NavLink to="/platform-admin/plans" className={navLinkClass} onClick={() => setPlatformMenuOpen(false)}>
                      Plans
                    </NavLink>
                    <NavLink to="/platform-admin/payments" className={navLinkClass} onClick={() => setPlatformMenuOpen(false)}>
                      Payments
                    </NavLink>
                    <NavLink to="/platform-admin/revenue" className={navLinkClass} onClick={() => setPlatformMenuOpen(false)}>
                      Revenue
                    </NavLink>
                    <NavLink to="/platform-admin/generation-settings" className={navLinkClass} onClick={() => setPlatformMenuOpen(false)}>
                      Generation settings
                    </NavLink>
                    <NavLink to="/platform-admin/database" className={navLinkClass} onClick={() => setPlatformMenuOpen(false)}>
                      Database
                    </NavLink>
                  </div>
                </>
              )}
            </div>
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
          <div className="relative hidden md:block">
            <button
              type="button"
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              onClick={() => {
                setProfileMenuOpen((v) => !v)
                setWorkMenuOpen(false)
                setAdminMenuOpen(false)
                setPlatformMenuOpen(false)
              }}
              aria-expanded={profileMenuOpen}
            >
              <div
                className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm shrink-0"
                title={user?.email ?? ''}
              >
                {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <ChevronDown className="w-4 h-4" />
            </button>
            {profileMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" aria-hidden onClick={() => setProfileMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-40 w-60 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'User'}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => {
                      setProfileMenuOpen(false)
                      handleLogout()
                    }}
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>

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
                  <NavLink
                    to="/"
                    end
                    onClick={() => {
                      setMenuOpen(false)
                      closeDesktopMenus()
                    }}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-4 py-2.5 text-sm font-medium ${isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}`
                    }
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </NavLink>

                  <div className="px-3 py-2 mt-2 border-t border-gray-100">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Work</p>
                  </div>
                  {workNavItems.map(({ to, label, icon: Icon, preload }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={() => {
                        setMenuOpen(false)
                        closeDesktopMenus()
                      }}
                      onMouseEnter={preload}
                      onFocus={preload}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2.5 text-sm font-medium ${isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}`
                      }
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </NavLink>
                  ))}
                  <div className="px-3 py-2 mt-2 border-t border-gray-100">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Administration</p>
                  </div>
                  {administrationNavItems.map(({ to, label, icon: Icon, preload }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={() => {
                        setMenuOpen(false)
                        closeDesktopMenus()
                      }}
                      onMouseEnter={preload}
                      onFocus={preload}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2.5 text-sm font-medium ${isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}`
                      }
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </NavLink>
                  ))}
                  {isPlatformAdmin && (
                    <>
                      <div className="px-3 py-2 mt-2 border-t border-gray-100">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Platform</p>
                      </div>
                      <NavLink to="/platform-admin" end onClick={() => setMenuOpen(false)} className={navLinkClass}>Overview</NavLink>
                      <NavLink to="/platform-admin/organizations" onClick={() => setMenuOpen(false)} className={navLinkClass}>Organizations</NavLink>
                      <NavLink to="/platform-admin/users" onClick={() => setMenuOpen(false)} className={navLinkClass}>Users</NavLink>
                      <NavLink to="/platform-admin/plans" onClick={() => setMenuOpen(false)} className={navLinkClass}>Plans</NavLink>
                      <NavLink to="/platform-admin/payments" onClick={() => setMenuOpen(false)} className={navLinkClass}>Payments</NavLink>
                      <NavLink to="/platform-admin/revenue" onClick={() => setMenuOpen(false)} className={navLinkClass}>Revenue</NavLink>
                      <NavLink to="/platform-admin/generation-settings" onClick={() => setMenuOpen(false)} className={navLinkClass}>Generation settings</NavLink>
                      <NavLink to="/platform-admin/database" onClick={() => setMenuOpen(false)} className={navLinkClass}>Database</NavLink>
                    </>
                  )}
                  {org?.name && (
                    <div className="px-4 py-2 mt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500">Org: {org.name}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 border-t border-gray-100 mt-2"
                    onClick={() => {
                      setMenuOpen(false)
                      handleLogout()
                    }}
                  >
                    <UserCircle2 className="w-4 h-4" />
                    Account
                    <span className="ml-auto text-xs text-gray-400">Sign out</span>
                  </button>
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
