import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FolderKanban, X } from 'lucide-react'
import { projects, subscription, audit } from '../lib/api'
import { useAuth } from '../store/auth'
import { canCreateProject } from '../lib/permissions'
import { formatDate } from '../lib/format'
import MetricCard from '../components/ui/MetricCard'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Skeleton, { MetricCardSkeleton } from '../components/ui/Skeleton'

const GET_STARTED_DISMISSED_KEY = 'brs_dashboard_get_started_dismissed'

export default function Dashboard() {
  const org = useAuth((s) => s.org)
  const role = useAuth((s) => s.role)
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
  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projects.list(),
  })
  const projectsList = projectsData?.projects || []

  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: subscription.getUsage,
  })
  const features = (usage?.features || {}) as Record<string, boolean>
  const { data: auditData } = useQuery({
    queryKey: ['audit', { limit: 5 }],
    queryFn: () => audit.list({ limit: 5 }),
    enabled: isAdmin && features.audit_trail,
  })
  const projectsUsed = usage?.usage?.projectsUsed ?? projectsList.length
  const projectsLimit = usage?.usage?.projectsLimit ?? 20
  const projectsUnlimited = usage?.usage?.projectsUnlimited ?? false
  const transactionsUsed = usage?.usage?.transactionsUsed ?? 0
  const transactionsLimit = usage?.usage?.transactionsLimit ?? 2000
  const transactionsUnlimited = usage?.usage?.transactionsUnlimited ?? false
  const inProgressCount = projectsList.filter((p: { status: string }) => p.status !== 'completed').length
  const completedCount = projectsList.filter((p: { status: string }) => p.status === 'completed').length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Link
            to="/manual"
            className="inline-flex items-center justify-center font-medium px-3 py-1.5 text-sm rounded-lg border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Help / User Manual
          </Link>
            <span className={`px-2.5 py-1 text-xs font-bold rounded-lg uppercase tracking-wider ${
              isAdmin ? 'bg-primary-100 text-primary-800' : 
              role === 'reviewer' ? 'bg-green-100 text-green-800' :
              role === 'preparer' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {role}
            </span>
        </div>
      </div>

      {!isLoading && projectsList.length === 0 && !getStartedDismissed && (
        <div className="flex items-start gap-4 rounded-lg border border-primary-200 bg-primary-50/50 p-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold tracking-tight text-primary-900">Get started</h3>
            <p className="mt-1 text-sm text-primary-800">
              Create a project, upload your cash book and bank statement, then match transactions and export your BRS report.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {canCreateProject(role) && (
                <Link
                  to="/projects/new"
                  className="inline-flex items-center justify-center font-medium px-3 py-1.5 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  Create first project
                </Link>
              )}
              <a href="#recent-projects" className="text-sm font-medium text-primary-700 hover:text-primary-800 underline">
                See recent projects
              </a>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissGetStarted}
            className="flex-shrink-0 rounded p-1 text-primary-600 hover:bg-primary-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {usageLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <div className="lg:col-span-2 space-y-4">
              <MetricCard
                label="Plan usage"
                value={`${usage?.organization?.plan ? String(usage.organization.plan).charAt(0).toUpperCase() + String(usage.organization.plan).slice(1).toLowerCase() : (org?.name ?? '—')}`}
                sublabel={
                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500 mb-1">
                        <span>Projects</span>
                        <span>{projectsUsed} / {projectsUnlimited ? '∞' : projectsLimit}</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${projectsUsed / projectsLimit > 0.9 ? 'bg-red-500' : 'bg-primary-500'}`}
                          style={{ width: `${projectsUnlimited ? 0 : Math.min(100, (projectsUsed / projectsLimit) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500 mb-1">
                        <span>Transactions</span>
                        <span>{transactionsUsed} / {transactionsUnlimited ? '∞' : transactionsLimit}</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${transactionsUsed / transactionsLimit > 0.9 ? 'bg-red-500' : 'bg-primary-500'}`}
                          style={{ width: `${transactionsUnlimited ? 0 : Math.min(100, (transactionsUsed / transactionsLimit) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                }
              />
            </div>
            <MetricCard
              label="Status"
              value={usage?.subscription?.status ? String(usage.subscription.status).charAt(0).toUpperCase() + String(usage.subscription.status).slice(1).toLowerCase() : 'Active'}
              sublabel={usage?.subscription?.currentPeriodEnd ? `Renews ${formatDate(usage.subscription.currentPeriodEnd)}` : 'On Trial'}
            />
            <MetricCard
              label="In progress"
              value={String(inProgressCount)}
              sublabel="Active projects"
            />
            <MetricCard
              label="Completed"
              value={String(completedCount)}
              sublabel="Archived reports"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title="What’s new">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                {latestRelease ? (
                  <>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium text-gray-900">Version {latestRelease.version}</span> - {latestRelease.changes}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Released: {latestRelease.date}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">No changelog entry found yet.</p>
                    <p className="text-xs text-gray-500 mt-1">Add a row under the manual changelog table to display updates here.</p>
                  </>
                )}
              </div>
              <Link
                to="/manual"
                className="inline-flex items-center justify-center font-medium px-3 py-1.5 text-sm rounded-lg border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                View full changelog
              </Link>
            </div>
          </Card>

          <Card title="Go-live checklist">
            <p className="text-sm text-gray-600 mb-3">
              Use this quick checklist when onboarding a new customer team.
            </p>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-primary-600">-</span>
                <span>Review user onboarding steps in the manual.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-primary-600">-</span>
                <span>Assign member roles (`admin`, `reviewer`, `preparer`, `viewer`).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-primary-600">-</span>
                <span>Configure branding and billing before client training.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-primary-600">-</span>
                <span>Create a pilot project and run one full reconciliation cycle.</span>
              </li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/manual"
                className="inline-flex items-center justify-center font-medium px-3 py-1.5 text-sm rounded-lg border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                Open manual
              </Link>
              <Link
                to="/settings/members"
                className="inline-flex items-center justify-center font-medium px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                Manage members
              </Link>
              <Link
                to="/projects/new"
                className="inline-flex items-center justify-center font-medium px-3 py-1.5 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                Create pilot project
              </Link>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Plan features">
            <p className="text-xs text-gray-500 mb-4 uppercase font-bold tracking-widest">Included in your plan</p>
            <ul className="space-y-2.5">
              {[
                { id: 'bulk_match', label: 'Bulk Match (50 items)' },
                { id: 'audit_trail', label: 'Full Audit Trail' },
                { id: 'one_to_many', label: 'One-to-Many Matching' },
                { id: 'discrepancy_report', label: 'Discrepancy Reporting' },
                { id: 'full_branding', label: 'Custom Branding' },
                { id: 'multi_client', label: 'Multi-Client Support' },
              ].map(f => (
                <li key={f.id} className={`flex items-center gap-2.5 text-sm ${features[f.id] ? 'text-gray-900' : 'text-gray-400 grayscale opacity-60'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${features[f.id] ? 'bg-primary-500' : 'bg-gray-300'}`} />
                  {f.label}
                  {!features[f.id] && <span className="ml-auto text-[10px] font-bold text-gray-400">UPGRADE</span>}
                </li>
              ))}
            </ul>
            {isAdmin && (
              <Link 
                to="/settings/billing" 
                className="mt-6 block w-full text-center px-4 py-2 text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors border border-primary-200"
              >
                Manage subscription
              </Link>
            )}
          </Card>
        </div>
      </div>

      {isAdmin && (
        <Card title="Manage app & settings">
          <p className="text-sm text-gray-600 mb-4">Control branding, billing, bank rules, API keys, and view activity.</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Link to="/settings/branding" className="flex flex-col p-4 rounded-lg border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <span className="font-semibold tracking-tight text-gray-900">Branding</span>
              <span className="text-xs text-gray-500 mt-0.5">Logo, colours, report title</span>
            </Link>
            <Link to="/settings/billing" className="flex flex-col p-4 rounded-lg border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <span className="font-semibold tracking-tight text-gray-900">Billing</span>
              <span className="text-xs text-gray-500 mt-0.5">Plan & payment</span>
            </Link>
            <Link to="/settings/members" className="flex flex-col p-4 rounded-lg border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <span className="font-semibold tracking-tight text-gray-900">Members</span>
              <span className="text-xs text-gray-500 mt-0.5">Add & manage team</span>
            </Link>
            {features.api_access && (
            <Link to="/settings/api-keys" className="flex flex-col p-4 rounded-lg border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <span className="font-semibold tracking-tight text-gray-900">API keys</span>
              <span className="text-xs text-gray-500 mt-0.5">Create & manage API access</span>
            </Link>
            )}
            {features.bank_rules && (
            <Link to="/settings/bank-rules" className="flex flex-col p-4 rounded-lg border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <span className="font-semibold tracking-tight text-gray-900">Bank rules</span>
              <span className="text-xs text-gray-500 mt-0.5">Auto-suggest & flag rules</span>
            </Link>
            )}
            {features.audit_trail && (
            <Link to="/audit" className="flex flex-col p-4 rounded-lg border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <span className="font-semibold tracking-tight text-gray-900">Audit log</span>
              <span className="text-xs text-gray-500 mt-0.5">All actions & exports</span>
            </Link>
            )}
          </div>
          {auditData?.logs?.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold tracking-tight text-gray-800 mb-2">Recent activity</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                {auditData.logs.slice(0, 5).map((l: { id: string; actionLabel: string; details?: unknown; createdAt: string }) => (
                  <li key={l.id}>
                    {l.actionLabel} — {formatDate(l.createdAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </li>
                ))}
              </ul>
              <Link to="/audit" className="inline-block mt-2 text-sm text-primary-600 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">View full audit →</Link>
            </div>
          )}
        </Card>
      )}

      {!isAdmin && (
        <Card title="Settings">
          <p className="text-sm text-gray-600 mb-4">Branding, billing, and team — manage your organisation.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Link to="/settings/branding" className="flex flex-col p-4 rounded-lg border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <span className="font-semibold tracking-tight text-gray-900">Branding</span>
              <span className="text-xs text-gray-500 mt-0.5">Logo, colours, report title</span>
            </Link>
            <Link to="/settings/billing" className="flex flex-col p-4 rounded-lg border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <span className="font-semibold tracking-tight text-gray-900">Billing</span>
              <span className="text-xs text-gray-500 mt-0.5">Plan & payment</span>
            </Link>
            <Link to="/settings/members" className="flex flex-col p-4 rounded-lg border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <span className="font-semibold tracking-tight text-gray-900">Members</span>
              <span className="text-xs text-gray-500 mt-0.5">Add & manage team</span>
            </Link>
            {features.bank_rules && (
              <Link to="/settings/bank-rules" className="flex flex-col p-4 rounded-lg border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                <span className="font-semibold tracking-tight text-gray-900">Bank rules</span>
                <span className="text-xs text-gray-500 mt-0.5">Auto-suggest & flag rules</span>
              </Link>
            )}
            {features.audit_trail && (
              <Link to="/audit" className="flex flex-col p-4 rounded-lg border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                <span className="font-semibold tracking-tight text-gray-900">Audit log</span>
                <span className="text-xs text-gray-500 mt-0.5">Actions & exports</span>
              </Link>
            )}
          </div>
        </Card>
      )}

      <Card
        id="recent-projects"
        title="Recent Projects"
        sublabel={projectsList.length > 0 ? `${inProgressCount} in progress · ${completedCount} completed` : undefined}
        actions={
          <div className="flex gap-2">
            <Link
              to="/projects"
              className="inline-flex items-center justify-center font-medium px-3 py-1.5 text-sm rounded-lg border border-border bg-white text-gray-700 hover:bg-surface shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
            >
              View all
            </Link>
            {canCreateProject(role) && (
            <Link
              to="/projects/new"
              className="inline-flex items-center justify-center font-medium px-3 py-1.5 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
            >
              + New Project
            </Link>
            )}
          </div>
        }
      >
        <div className="divide-y divide-border-muted -mx-6">
          {isLoading ? (
            <div className="px-6 py-4 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-5 w-32 mb-1" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-4 w-12 rounded" />
                </div>
              ))}
            </div>
          ) : projectsList.length === 0 ? (
            <EmptyState
              icon={<FolderKanban className="w-6 h-6" />}
              title="No projects yet"
              description="Create your first project to start reconciling cash book and bank statement. Upload files, match transactions, then export your BRS report."
              action={
            canCreateProject(role) ? (
            <Link
              to="/projects/new"
              className="inline-flex items-center justify-center font-medium px-4 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
            >
              + New Project
            </Link>
            ) : undefined
              }
            />
          ) : (
            projectsList.map((p: { id: string; name: string; slug: string; status: string; createdAt: string }) => (
              <div key={p.id} className="px-6 py-4 flex justify-between items-center hover:bg-surface/50 transition-colors">
                <div>
                  <p className="font-medium text-gray-900">{p.name}</p>
                  <p className="text-sm text-gray-500">
                    {p.status} • {formatDate(p.createdAt)}
                  </p>
                </div>
                <Link
                  to={`/projects/${p.slug ?? p.id}`}
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                >
                  {p.status === 'completed' ? 'View' : 'Resume'}
                </Link>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
