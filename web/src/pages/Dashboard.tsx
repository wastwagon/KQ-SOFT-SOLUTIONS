import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  FileCheck,
  FolderKanban,
  LayoutDashboard,
  Users,
  X,
  ChevronRight,
  Palette,
  CreditCard,
  Key,
  Landmark,
  Shield,
  FileSpreadsheet,
  Building2,
} from 'lucide-react'
import { projects, subscription, settings as settingsApi, isSubscriptionInactiveError } from '../lib/api'
import { useAuth } from '../store/auth'
import { canCreateProject } from '../lib/permissions'
import { formatDate } from '../lib/format'
import MetricCard from '../components/ui/MetricCard'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import { MetricCardSkeleton, TableRowSkeleton } from '../components/ui/Skeleton'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../components/ui/Table'
import Button, { buttonClassName } from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Alert from '../components/ui/Alert'
import SubscriptionRenewalPanel from '../components/SubscriptionRenewalPanel'
import PageHeader from '../components/layout/PageHeader'
import BrsVarianceBadge from '../components/project/BrsVarianceBadge'
import ProjectStatusPill from '../components/project/ProjectStatusPill'

const BRS_SUMMARY_STATUSES = new Set([
  'reconciling',
  'submitted_for_review',
  'approved',
  'completed',
])

function DashLinkCard({
  to,
  icon,
  title,
  description,
}: {
  to: string
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-xl border border-border bg-white p-4 transition-colors hover:border-primary-200 hover:bg-primary-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500 group-hover:bg-primary-50 group-hover:text-primary-700">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold tracking-tight text-gray-900">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-gray-500">{description}</span>
      </span>
    </Link>
  )
}

const GET_STARTED_DISMISSED_KEY = 'brs_dashboard_get_started_dismissed'

function RecentProjectsHead() {
  return (
    <TableHead>
      <tr>
        <TableTh>Project</TableTh>
        <TableTh>Status</TableTh>
        <TableTh>Tie-out</TableTh>
        <TableTh>Created</TableTh>
        <TableTh className="w-10">
          <span className="sr-only">Open</span>
        </TableTh>
      </tr>
    </TableHead>
  )
}

export default function Dashboard() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const role = useAuth((s) => s.role)
  const org = useAuth((s) => s.org)
  const isAdmin = useAuth((s) => s.isAdmin())
  const [getStartedDismissed, setGetStartedDismissed] = useState(() => {
    try {
      return localStorage.getItem(GET_STARTED_DISMISSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const dismissGetStarted = () => {
    try {
      localStorage.setItem(GET_STARTED_DISMISSED_KEY, '1')
      setGetStartedDismissed(true)
    } catch {
      setGetStartedDismissed(true)
    }
  }
  const [latestRelease, setLatestRelease] = useState<{ date: string; version: string; changes: string } | null>(null)
  useEffect(() => {
    let mounted = true
    fetch('/user-manual.md')
      .then(async (res) => {
        if (!res.ok) return ''
        return res.text()
      })
      .then((text) => {
        if (!mounted || !text) return
        const changelogSectionMatch = text.match(/##\s+Changelog([\s\S]*?)(?:\n##\s+|\s*$)/i)
        const changelogSection = changelogSectionMatch?.[1] || ''
        const rows = changelogSection.match(/^\|\s*\d{4}-\d{2}-\d{2}\s*\|.*\|.*\|$/gm) || []
        if (!rows.length) return
        const firstRow = rows.at(0)
        if (!firstRow) return
        const first = firstRow.split('|').map((p) => p.trim()).filter(Boolean)
        if (first.length < 3) return
        setLatestRelease({ date: first[0], version: first[1], changes: first[2] })
      })
      .catch(() => {
        // Keep dashboard usable even if manual file is temporarily unavailable.
      })
    return () => {
      mounted = false
    }
  }, [])
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: () => projects.list(),
  })
  const { data: projectsData, isLoading, isError: projectsQueryFailed, error: projectsError } = projectsQuery
  const projectsList = projectsData?.projects || []
  const projectsPaywallBlocked = isSubscriptionInactiveError(projectsError)
  const projectsLoadFailed = !projectsPaywallBlocked && projectsQueryFailed

  const usageQuery = useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: subscription.getUsage,
  })
  const { data: usage, isLoading: usageLoading } = usageQuery
  const features = (usage?.features || {}) as Record<string, boolean>
  const membersQuery = useQuery({
    queryKey: ['settings', 'members'],
    queryFn: settingsApi.getMembers,
    enabled: isAdmin,
  })
  const { data: membersData, isError: membersQueryFailed } = membersQuery
  const memberCount = membersData?.currentCount ?? 1
  const projectsUsed = usage?.usage?.projectsUsed ?? projectsList.length
  const projectsLimit = usage?.usage?.projectsLimit ?? 10
  const projectsUnlimited = usage?.usage?.projectsUnlimited ?? false
  const transactionsUsed = usage?.usage?.transactionsUsed ?? 0
  const transactionsLimit = usage?.usage?.transactionsLimit ?? 1000
  const transactionsUnlimited = usage?.usage?.transactionsUnlimited ?? false
  const bankAccountsUsed = usage?.usage?.bankAccountsUsed ?? 0
  const bankAccountsLimit = usage?.usage?.bankAccountsLimit ?? usage?.limits?.bankAccounts ?? 5
  const bankAccountsUnlimited = usage?.usage?.bankAccountsUnlimited ?? false
  const pendingReviewCount = projectsList.filter(
    (p: { status: string }) => p.status === 'submitted_for_review'
  ).length
  const inProgressCount = projectsList.filter(
    (p: { status: string }) => p.status !== 'completed' && p.status !== 'approved'
  ).length
  const completedCount = projectsList.filter((p: { status: string }) => p.status === 'completed').length

  const nextActions = useMemo(() => {
    type ProjectRow = { id: string; name: string; slug?: string; status: string }
    const href = (p: ProjectRow, hash?: string) =>
      `/projects/${p.slug ?? p.id}${hash ? `#${hash}` : ''}`
    const items: { key: string; title: string; hint: string; to: string }[] = []
    for (const p of projectsList as ProjectRow[]) {
      if (p.status === 'submitted_for_review') {
        items.push({ key: p.id, title: `Review ${p.name}`, hint: 'Submitted for review', to: href(p, 'review') })
      } else if (p.status === 'reconciling') {
        items.push({ key: p.id, title: `Continue matching ${p.name}`, hint: 'Reconciling', to: href(p, 'reconcile') })
      } else if (p.status === 'mapping') {
        items.push({ key: p.id, title: `Finish mapping ${p.name}`, hint: 'Map columns', to: href(p, 'map') })
      } else if (p.status === 'draft') {
        items.push({ key: p.id, title: `Upload statements for ${p.name}`, hint: 'Draft', to: href(p, 'upload') })
      }
    }
    return items.slice(0, 5)
  }, [projectsList])

  if (projectsLoadFailed) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Overview" title="Dashboard" />
        <Alert
          tone="error"
          title="Could not load projects"
          onRetry={() => queryClient.invalidateQueries({ queryKey: ['projects'] })}
        >
          {projectsError instanceof Error ? projectsError.message : 'Something went wrong.'}
        </Alert>
      </div>
    )
  }

  const roleLabel =
    role === 'admin'
      ? 'Admin'
      : role === 'reviewer'
        ? 'Reviewer'
        : role === 'preparer'
          ? 'Preparer'
          : role === 'viewer'
            ? 'Viewer'
            : role ?? 'Member'

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        subtitle={
          <>
            {org?.name ? <p className="text-gray-700 font-medium">{org.name}</p> : null}
            <p className="text-gray-500">Track projects, usage, and team activity in one place.</p>
          </>
        }
        actions={
          <Badge
            tone={
              isAdmin
                ? 'brand'
                : role === 'reviewer'
                  ? 'success'
                  : role === 'preparer'
                    ? 'brand'
                    : 'neutral'
            }
            aria-label={`Your role: ${roleLabel}`}
          >
            {roleLabel}
          </Badge>
        }
      />

      {isAdmin && membersQueryFailed && (
        <Alert
          tone="warning"
          title="Team member count could not be loaded"
          onRetry={() => queryClient.invalidateQueries({ queryKey: ['settings', 'members'] })}
          className="max-w-2xl"
        />
      )}

      {!isLoading && projectsList.length === 0 && !getStartedDismissed && !projectsPaywallBlocked && (
        <Card
          title="Get started"
          sublabel="Set up your firm, then start the first reconciliation."
          actions={
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={dismissGetStarted}
              className="flex-shrink-0 p-1"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </Button>
          }
        >
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="w-5 shrink-0 tabular-nums font-medium text-gray-400">1.</span>
              <span>
                <Link to="/settings/branding" className="font-medium text-primary-700 hover:underline">
                  Branding
                </Link>
                <span className="text-gray-600"> — logo and colours for reports</span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="w-5 shrink-0 tabular-nums font-medium text-gray-400">2.</span>
              <span>
                <Link to="/settings/members" className="font-medium text-primary-700 hover:underline">
                  Team
                </Link>
                <span className="text-gray-600"> — invite members for an audit trail</span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="w-5 shrink-0 tabular-nums font-medium text-gray-400">3.</span>
              <span>
                <Link to="/clients" className="font-medium text-primary-700 hover:underline">
                  Clients
                </Link>
                <span className="text-gray-600"> — entities you reconcile for</span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="w-5 shrink-0 tabular-nums font-medium text-gray-400">4.</span>
              <span>
                {canCreateProject(role) ? (
                  <Link to="/projects/new" className="font-medium text-primary-700 hover:underline">
                    New project
                  </Link>
                ) : (
                  <span className="font-medium text-gray-900">Projects</span>
                )}
                <span className="text-gray-600"> — start your first reconciliation</span>
              </span>
            </li>
          </ol>
        </Card>
      )}

      <section aria-labelledby="dashboard-metrics-heading" className="space-y-3">
        <h2 id="dashboard-metrics-heading" className="text-sm font-medium text-gray-600">
          At a glance
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(15.5rem,1fr))] gap-4">
        {usageLoading ? (
          <>
            <MetricCardSkeleton compact />
            <MetricCardSkeleton compact />
            <MetricCardSkeleton compact />
            <MetricCardSkeleton compact />
            <MetricCardSkeleton compact />
          </>
        ) : (
          <>
            <MetricCard
              compact
              label="Total Projects"
              value={usage?.usage?.projectsUsed ?? projectsList.length}
              sublabel={
                projectsUnlimited
                  ? 'Unlimited on plan'
                  : `${projectsUsed} of ${projectsLimit} on plan`
              }
              icon={<FolderKanban />}
              accent="none"
            />
            <MetricCard
              compact
              label="Pending review"
              value={pendingReviewCount}
              sublabel={`${inProgressCount} in progress`}
              icon={<FileCheck />}
              accent="none"
            />
            <MetricCard
              compact
              label="Monthly Transactions"
              value={usage?.usage?.transactionsUsed ?? 0}
              sublabel={
                transactionsUnlimited
                  ? 'Unlimited on plan'
                  : `${transactionsUsed.toLocaleString('en-GH')} of ${transactionsLimit.toLocaleString('en-GH')} this month`
              }
              sublabelTitle={
                transactionsUnlimited
                  ? undefined
                  : `${transactionsUsed.toLocaleString('en-GH')} of ${transactionsLimit.toLocaleString('en-GH')} this calendar month. Resets on the 1st.`
              }
              icon={<LayoutDashboard />}
              accent="none"
            />
            <MetricCard
              compact
              label="Bank Accounts"
              value={bankAccountsUsed}
              sublabel={
                bankAccountsUnlimited
                  ? 'Unlimited org seats'
                  : `${bankAccountsUsed} of ${bankAccountsLimit} org seats`
              }
              icon={<Building2 />}
              accent="none"
            />
            <MetricCard
              compact
              label="Team Members"
              value={memberCount}
              sublabel="Active firm accounts"
              icon={<Users />}
              accent="none"
            />
          </>
        )}
        </div>
      </section>

      {features.firm_dashboard && (
        <Card title="Practice overview">
          <p className="text-sm text-gray-600 mb-5">
            Multi-entity snapshot for this workspace — clients, open jobs, and reports.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-5">
            <DashLinkCard
              to="/clients"
              icon={<Building2 className="w-4 h-4" aria-hidden />}
              title="Clients"
              description="Entities you reconcile for"
            />
            <DashLinkCard
              to="/projects"
              icon={<FolderKanban className="w-4 h-4" aria-hidden />}
              title="Projects"
              description={`${inProgressCount} in progress · ${completedCount} completed`}
            />
            <DashLinkCard
              to="/reports"
              icon={<FileSpreadsheet className="w-4 h-4" aria-hidden />}
              title="Reports"
              description={`${pendingReviewCount} waiting for review`}
            />
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-8">
        <Card title="Next actions">
            {nextActions.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nothing waiting on you. Start a project or open{' '}
                <Link to="/settings/billing" className="font-medium text-primary-600 hover:underline">
                  Billing
                </Link>{' '}
                to review plan features.
              </p>
            ) : (
              <ul className="space-y-1">
                {nextActions.map((item) => (
                  <li key={item.key}>
                    <Link
                      to={item.to}
                      className="flex items-start justify-between gap-3 rounded-xl px-3 py-3 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900 truncate">{item.title}</span>
                        <span className="block text-xs text-gray-500 mt-0.5">{item.hint}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 mt-1" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {isAdmin && (
              <Link
                to="/settings/billing"
                className={`${buttonClassName('outline', 'sm')} mt-4 w-full`}
              >
                Manage subscription
              </Link>
            )}
          </Card>

        <Card title="What’s new">
            <div className="flex flex-col items-start gap-4">
              <div>
                {latestRelease ? (
                  <>
                    <p className="text-sm leading-relaxed text-gray-600">
                      <span className="font-medium text-gray-900">Version {latestRelease.version}</span> — {latestRelease.changes}
                    </p>
                    <p className="text-xs text-gray-500 mt-1.5">Released {latestRelease.date}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-600">No recent release notes on the dashboard.</p>
                )}
              </div>
              <Link to="/manual" className={buttonClassName('outline', 'sm')}>
                Open user manual
              </Link>
            </div>
          </Card>
      </div>

      <Card title="Clean & export tools">
        <p className="text-sm text-gray-600 mb-5">
          Validate bank or cash-book formats with the same parsers. Preview is free; sample downloads
          are truncated and watermarked; full Excel/PDF uses your plan’s monthly clean-export quota.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5">
          <DashLinkCard
            to="/tools/clean-bank-statement"
            icon={<Landmark className="w-4 h-4" aria-hidden />}
            title="Clean bank statement"
            description="Upload PDF/Excel → preview, sample, or full cleaned file"
          />
          <DashLinkCard
            to="/tools/clean-cash-book"
            icon={<FileSpreadsheet className="w-4 h-4" aria-hidden />}
            title="Clean cash book"
            description="Upload cash book → preview, sample, or full cleaned file"
          />
        </div>
      </Card>

      <Card
        title={isAdmin ? 'Manage app & settings' : 'Settings'}
      >
        <p className="text-sm text-gray-600 mb-5">
          {isAdmin
            ? 'Control branding, billing, bank rules, API keys, and view activity.'
            : 'Branding, billing, and team — manage your organisation.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
          <DashLinkCard
            to="/settings/branding"
            icon={<Palette className="w-4 h-4" aria-hidden />}
            title="Branding"
            description="Logo, colours, report title"
          />
          <DashLinkCard
            to="/settings/billing"
            icon={<CreditCard className="w-4 h-4" aria-hidden />}
            title="Billing"
            description="Plan & payment"
          />
          <DashLinkCard
            to="/settings/members"
            icon={<Users className="w-4 h-4" aria-hidden />}
            title="Members"
            description="Add & manage team"
          />
          {isAdmin && features.api_access && (
            <DashLinkCard
              to="/settings/api-keys"
              icon={<Key className="w-4 h-4" aria-hidden />}
              title="API keys"
              description="Create & manage API access"
            />
          )}
          {features.bank_rules && (
            <DashLinkCard
              to="/settings/bank-rules"
              icon={<Landmark className="w-4 h-4" aria-hidden />}
              title="Bank rules"
              description="Auto-suggest & flag rules"
            />
          )}
          {features.audit_trail && (
            <DashLinkCard
              to="/audit"
              icon={<Shield className="w-4 h-4" aria-hidden />}
              title="Audit log"
              description="All actions & exports"
            />
          )}
        </div>
      </Card>

      <Card
        id="recent-projects"
        noPadding
        title="Recent projects"
        sublabel={projectsList.length > 0 ? `${inProgressCount} in progress · ${completedCount} completed` : undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => navigate('/projects')}>
              View all
            </Button>
            {canCreateProject(role) && (
              <Button size="sm" type="button" onClick={() => navigate('/projects/new')}>
                New project
              </Button>
            )}
          </div>
        }
      >
        {isLoading ? (
          <Table>
            <RecentProjectsHead />
            <TableBody>
              {[1, 2, 3, 4, 5].map((i) => (
                <TableRowSkeleton key={i} cols={5} />
              ))}
            </TableBody>
          </Table>
        ) : projectsPaywallBlocked ? (
          <div className="px-6 py-6">
            <SubscriptionRenewalPanel />
          </div>
        ) : projectsList.length === 0 ? (
          <div className="px-6 py-8">
            <EmptyState
              icon={<FolderKanban className="w-6 h-6" />}
              title="No projects yet"
              description="Create your first project to start reconciling cash book and bank statement. Upload files, match transactions, then export your BRS report."
              action={
                canCreateProject(role) ? (
                  <Link to="/projects/new" className={buttonClassName('primary', 'md')}>
                    New project
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
            <Table>
            <caption className="sr-only">Recent projects</caption>
            <RecentProjectsHead />
            <TableBody>
              {projectsList.map((p: { id: string; name: string; slug: string; status: string; createdAt: string }) => (
                <TableRow key={p.id} className="group relative">
                  <TableTd className="max-w-[28rem]">
                    <Link
                      to={`/projects/${p.slug ?? p.id}`}
                      className="block truncate font-medium text-gray-900 group-hover:text-primary-800 after:absolute after:inset-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                      title={p.name}
                    >
                      {p.name}
                    </Link>
                  </TableTd>
                  <TableTd className="whitespace-nowrap">
                    <ProjectStatusPill status={p.status} size="sm" />
                  </TableTd>
                  <TableTd className="whitespace-nowrap">
                    {BRS_SUMMARY_STATUSES.has(p.status) ? (
                      <BrsVarianceBadge projectId={p.id} compact />
                    ) : (
                      <span className="text-gray-400" aria-label="No tie-out yet">—</span>
                    )}
                  </TableTd>
                  <TableTd className="whitespace-nowrap text-gray-500 tabular-nums">
                    {formatDate(p.createdAt)}
                  </TableTd>
                  <TableTd className="text-right">
                    <ChevronRight
                      className="inline w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors"
                      aria-hidden
                    />
                  </TableTd>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
