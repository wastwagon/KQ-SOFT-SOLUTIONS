import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

type Crumb = { label: string; href?: string }

const SETTINGS_TABS: Record<string, string> = {
  branding: 'Branding',
  billing: 'Billing',
  members: 'Team members',
  connections: 'Connections',
  'api-keys': 'API keys',
  'bank-rules': 'Bank rules',
}

function crumbsFor(pathname: string): Crumb[] {
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    return [{ label: 'Dashboard' }]
  }
  if (pathname === '/projects/new') {
    return [{ label: 'Projects', href: '/projects' }, { label: 'New project' }]
  }
  if (pathname.startsWith('/projects/') && pathname !== '/projects') {
    return [{ label: 'Projects', href: '/projects' }, { label: 'Current project' }]
  }
  if (pathname === '/projects') return [{ label: 'Projects' }]
  if (pathname === '/reports' || pathname.startsWith('/reports/')) return [{ label: 'Reports' }]
  if (pathname === '/clients' || pathname.startsWith('/clients/')) return [{ label: 'Clients' }]
  if (pathname.startsWith('/settings/')) {
    const tab = pathname.slice('/settings/'.length)
    const tabLabel = SETTINGS_TABS[tab] || 'Settings'
    return [{ label: 'Settings', href: '/settings/branding' }, { label: tabLabel }]
  }
  if (pathname === '/settings') return [{ label: 'Settings' }]
  if (pathname === '/audit' || pathname.startsWith('/audit/')) return [{ label: 'Audit log' }]
  if (pathname === '/manual' || pathname.startsWith('/manual/')) return [{ label: 'Help' }]
  if (pathname.startsWith('/tools/clean-bank-statement')) {
    return [{ label: 'Tools' }, { label: 'Clean bank statement' }]
  }
  if (pathname.startsWith('/tools/clean-cash-book')) {
    return [{ label: 'Tools' }, { label: 'Clean cash book' }]
  }
  if (pathname.startsWith('/platform-admin/tools/clean-bank-statement')) {
    return [{ label: 'Platform' }, { label: 'Clean bank statement' }]
  }
  if (pathname.startsWith('/platform-admin/tools/clean-cash-book')) {
    return [{ label: 'Platform' }, { label: 'Clean cash book' }]
  }
  if (pathname === '/platform-admin') return [{ label: 'Platform admin' }]
  if (pathname.startsWith('/platform-admin/')) {
    const rest = pathname.slice('/platform-admin/'.length).split('/')[0] || ''
    const labels: Record<string, string> = {
      organizations: 'Organizations',
      users: 'Users',
      plans: 'Plans',
      payments: 'Payments',
      revenue: 'Revenue',
      'ops-metrics': 'Ops metrics',
      leads: 'Leads',
      retention: 'Data retention',
      'generation-settings': 'Generation settings',
      database: 'Database',
    }
    return [{ label: 'Platform admin', href: '/platform-admin' }, { label: labels[rest] || rest }]
  }
  return []
}

export default function TopBarCrumbs() {
  const { pathname } = useLocation()
  const crumbs = crumbsFor(pathname)
  if (crumbs.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1 text-sm text-gray-500">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />}
              {c.href && !last ? (
                <Link
                  to={c.href}
                  className="truncate font-medium text-gray-500 hover:text-gray-900 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  className="truncate font-semibold text-gray-800"
                  aria-current={last ? 'page' : undefined}
                >
                  {c.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
