import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { projects } from '../../lib/api'
import { isProjectStepId, PROJECT_STEP_LABELS, projectStepPath } from '../../lib/projectRoutes'

type Crumb = { label: string; href?: string }

const SETTINGS_TABS: Record<string, string> = {
  branding: 'Branding',
  billing: 'Billing',
  members: 'Team members',
  connections: 'Bank import',
  'api-keys': 'API keys',
  'bank-rules': 'Bank rules',
}

function crumbsFor(pathname: string, projectName?: string): Crumb[] {
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    return [{ label: 'Dashboard' }]
  }
  if (pathname === '/projects/new') {
    return [{ label: 'Projects', href: '/projects' }, { label: 'New project' }]
  }
  if (pathname.startsWith('/projects/') && pathname !== '/projects') {
    const segments = pathname.split('/').filter(Boolean)
    const slug = segments[1]
    const maybeStep = segments[2]?.toLowerCase()
    const crumbs: Crumb[] = [
      { label: 'Projects', href: '/projects' },
      {
        label: projectName?.trim() || 'Project',
        href: slug ? projectStepPath(slug, 'upload') : undefined,
      },
    ]
    if (maybeStep && isProjectStepId(maybeStep)) {
      crumbs.push({ label: PROJECT_STEP_LABELS[maybeStep] })
    }
    return crumbs
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
    return [{ label: 'Tools', href: '/tools' }, { label: 'Clean bank statement' }]
  }
  if (pathname.startsWith('/tools/clean-cash-book')) {
    return [{ label: 'Tools', href: '/tools' }, { label: 'Clean cash book' }]
  }
  if (pathname === '/tools') {
    return [{ label: 'Tools' }]
  }
  if (pathname.startsWith('/platform-admin/tools/clean-bank-statement')) {
    return [{ label: 'Platform admin', href: '/platform-admin' }, { label: 'Tools', href: '/platform-admin/tools' }, { label: 'Clean bank statement' }]
  }
  if (pathname.startsWith('/platform-admin/tools/clean-cash-book')) {
    return [{ label: 'Platform admin', href: '/platform-admin' }, { label: 'Tools', href: '/platform-admin/tools' }, { label: 'Clean cash book' }]
  }
  if (pathname === '/platform-admin/tools') {
    return [{ label: 'Platform admin', href: '/platform-admin' }, { label: 'Tools' }]
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
      ops: 'Ops hub',
      leads: 'Leads',
      retention: 'Data retention',
      'generation-settings': 'Generation settings',
      database: 'Database',
      'pricing-page': 'Pricing layout',
      tools: 'Tools',
    }
    return [{ label: 'Platform admin', href: '/platform-admin' }, { label: labels[rest] || rest }]
  }
  return []
}

function projectSlugFromPath(pathname: string): string | null {
  if (!pathname.startsWith('/projects/')) return null
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] !== 'projects' || !segments[1] || segments[1] === 'new') return null
  return segments[1]
}

export default function TopBarCrumbs() {
  const { pathname } = useLocation()
  const projectSlug = useMemo(() => projectSlugFromPath(pathname), [pathname])
  const { data: projectName } = useQuery({
    queryKey: ['project', projectSlug],
    queryFn: () => projects.get(projectSlug!) as Promise<{ name?: string }>,
    enabled: !!projectSlug,
    staleTime: 120_000,
    select: (p) => p.name,
  })
  const crumbs = crumbsFor(pathname, projectName)
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
