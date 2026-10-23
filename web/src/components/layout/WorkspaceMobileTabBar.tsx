import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, FolderKanban, Users, Settings } from 'lucide-react'

const TABS = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban, end: false },
  { to: '/clients', label: 'Clients', icon: Users, end: true },
  { to: '/settings/branding', label: 'Settings', icon: Settings, end: false },
] as const

function isSettingsPath(path: string) {
  return path === '/settings' || path.startsWith('/settings/')
}

/**
 * iOS-style bottom navigation for phones. Hidden on `lg+` where the sidebar is always visible.
 */
export default function WorkspaceMobileTabBar() {
  const path = useLocation().pathname

  return (
    <nav
      aria-label="Primary workspace"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/90 safe-bottom"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        {TABS.map(({ to, label, icon: Icon, end }) => {
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
                    'flex flex-col items-center justify-center gap-0.5 min-h-[52px] rounded-xl px-1 text-[10px] font-semibold transition-colors',
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
      </ul>
    </nav>
  )
}
