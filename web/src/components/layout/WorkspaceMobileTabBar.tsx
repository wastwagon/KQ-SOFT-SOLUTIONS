import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  Menu,
  FileText,
  FileCheck,
  Wrench,
  BookOpen,
  ShieldCheck,
} from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

const MAIN_TABS = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban, end: false },
  { to: '/clients', label: 'Clients', icon: Users, end: true },
  { to: '/settings/branding', label: 'Settings', icon: Settings, end: false },
] as const

function isSettingsPath(path: string) {
  return path === '/settings' || path.startsWith('/settings/')
}

type WorkspaceMobileTabBarProps = {
  showAudit?: boolean
  isPlatformAdmin?: boolean
}

/**
 * iOS-style bottom navigation for phones. Hidden on `lg+` where the sidebar is always visible.
 * **More** opens Reports, Audit, Tools, Help — keeps Audit out of Settings only.
 */
export default function WorkspaceMobileTabBar({
  showAudit = true,
  isPlatformAdmin = false,
}: WorkspaceMobileTabBarProps) {
  const path = useLocation().pathname
  const [moreOpen, setMoreOpen] = useState(false)

  const moreActive =
    path === '/reports' ||
    path.startsWith('/reports/') ||
    path === '/audit' ||
    path.startsWith('/audit/') ||
    path.startsWith('/tools/') ||
    path === '/manual' ||
    path.startsWith('/manual/') ||
    (isPlatformAdmin && path.startsWith('/platform-admin'))

  const moreLinkClass =
    'flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'

  return (
    <>
      <nav
        aria-label="Primary navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/90 safe-bottom"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-around px-0.5 pt-1">
          {MAIN_TABS.map(({ to, label, icon: Icon, end }) => {
            const settingsTab = to.startsWith('/settings')
            return (
              <li key={to} className="flex-1 min-w-0">
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) => {
                    const active =
                      isActive ||
                      (settingsTab && isSettingsPath(path)) ||
                      (to === '/projects' &&
                        (path.startsWith('/projects/') || path === '/reports'))
                    return [
                      'flex flex-col items-center justify-center gap-0.5 min-h-[52px] rounded-xl px-0.5 text-[10px] font-semibold transition-colors',
                      active ? 'text-primary-600' : 'text-gray-500 hover:text-gray-800',
                    ].join(' ')
                  }}
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                  <span className="truncate max-w-full">{label}</span>
                </NavLink>
              </li>
            )
          })}
          <li className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              className={[
                'flex w-full flex-col items-center justify-center gap-0.5 min-h-[52px] rounded-xl px-0.5 text-[10px] font-semibold transition-colors',
                moreActive ? 'text-primary-600' : 'text-gray-500 hover:text-gray-800',
              ].join(' ')}
            >
              <Menu className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              <span className="truncate max-w-full">More</span>
            </button>
          </li>
        </ul>
      </nav>

      <Modal
        open={moreOpen}
        title="More"
        onClose={() => setMoreOpen(false)}
        footer={
          <Button type="button" variant="primary" onClick={() => setMoreOpen(false)}>
            Done
          </Button>
        }
      >
        <div className="space-y-2" role="navigation" aria-label="More menu">
          <Link to="/reports" className={moreLinkClass} onClick={() => setMoreOpen(false)}>
            <FileText className="w-5 h-5 text-gray-500" aria-hidden />
            Reports
          </Link>
          {showAudit && (
            <Link to="/audit" className={moreLinkClass} onClick={() => setMoreOpen(false)}>
              <FileCheck className="w-5 h-5 text-gray-500" aria-hidden />
              Audit log
            </Link>
          )}
          <Link to="/tools" className={moreLinkClass} onClick={() => setMoreOpen(false)}>
            <Wrench className="w-5 h-5 text-gray-500" aria-hidden />
            Tools
          </Link>
          <Link to="/manual" className={moreLinkClass} onClick={() => setMoreOpen(false)}>
            <BookOpen className="w-5 h-5 text-gray-500" aria-hidden />
            Help
          </Link>
          {isPlatformAdmin && (
            <Link to="/platform-admin" className={moreLinkClass} onClick={() => setMoreOpen(false)}>
              <ShieldCheck className="w-5 h-5 text-amber-700" aria-hidden />
              Platform admin
            </Link>
          )}
        </div>
      </Modal>
    </>
  )
}
