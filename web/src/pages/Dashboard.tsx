import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FileCheck, FolderKanban, LayoutDashboard, Users, X } from 'lucide-react'
import { projects, subscription, settings as settingsApi, isSubscriptionInactiveError } from '../lib/api'
import { useAuth } from '../store/auth'
import { canCreateProject } from '../lib/permissions'
import { formatDate } from '../lib/format'
import MetricCard from '../components/ui/MetricCard'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Skeleton, { MetricCardSkeleton } from '../components/ui/Skeleton'
import SubscriptionRenewalPanel from '../components/SubscriptionRenewalPanel'

const GET_STARTED_DISMISSED_KEY = 'brs_dashboard_get_started_dismissed'

export default function Dashboard() {
  const queryClient = useQueryClient()
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
  const projectsLimit = usage?.usage?.projectsLimit ?? 20
  const projectsUnlimited = usage?.usage?.projectsUnlimited ?? false
  const transactionsUsed = usage?.usage?.transactionsUsed ?? 0
  const transactionsLimit = usage?.usage?.transactionsLimit ?? 2000
  const transactionsUnlimited = usage?.usage?.transactionsUnlimited ?? false
  const inProgressCount = projectsList.filter((p: { status: string }) => p.status !== 'completed').length
  const completedCount = projectsList.filter((p: { status: string }) => p.status === 'completed').length

  const subStatus = usage?.subscription?.status
  const showSubscriptionPaywallBanner =
    !!usage?.paywallEnabled && (subStatus === 'free' || subStatus === 'expired')

  if (projectsLoadFailed) {
    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 max-w-xl">
          <p className="font-medium text-red-900">Could not load projects</p>
          <p className="mt-1">
            {projectsError instanceof Error ? projectsError.message : 'Something went wrong.'}
          </p>
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['projects'] })}
            className="mt-3 px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-red-300 text-red-900 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
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

      {showSubscriptionPaywallBanner && (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <strong className="font-semibold">Subscription inactive.</strong> Core reconciliation features are
          unavailable until an admin renews. Ask an organisation admin to open{' '}
          <Link to="/settings/billing" className="font-semibold underline hover:no-underline">
            Settings → Billing
          </Link>{' '}
          and complete payment, or contact support if you are on a custom plan.
        </div>
      )}

      {isAdmin && membersQueryFailed && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 max-w-2xl">
          <span>Team member count could not be loaded. </span>
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['settings', 'members'] })}
            className="font-semibold text-amber-900 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && projectsList.length === 0 && !getStartedDismissed && !projectsPaywallBlocked && (
        <Card className="border-l-4 border-l-primary-500 bg-primary-50/30 overflow-hidden">
          <div className="flex items-start justify-between gap-6 p-5 sm:p-7">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold tracking-tight text-primary-900 mb-2">Welcome to your new workspace</h2>
              <p className="text-sm text-primary-800 mb-8 max-w-2xl leading-relaxed">
                Follow these best practices to set up your firm for professional bank reconciliation and collaboration.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/70 border border-primary-100 shadow-sm">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 text-white text-sm font-bold flex items-center justify-center">1</div>
                  <div>
                    <h3 className="text-sm font-semibold text-primary-900">Branding</h3>
                    <p className="text-sm text-gray-600 mt-1.5 mb-3 leading-snug">Set your logo and colors for professional reports.</p>
                    <Link to="/settings/branding" className="text-sm font-semibold text-primary-600 hover:underline">Configure branding →</Link>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/70 border border-primary-100 shadow-sm">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 text-white text-sm font-bold flex items-center justify-center">2</div>
                  <div>
                    <h3 className="text-sm font-semibold text-primary-900">Team</h3>
                    <p className="text-sm text-gray-600 mt-1.5 mb-3 leading-snug">Invite employees for a clear audit trail.</p>
                    <Link to="/settings/members" className="text-sm font-semibold text-primary-600 hover:underline">Invite members →</Link>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/70 border border-primary-100 shadow-sm">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 text-white text-sm font-bold flex items-center justify-center">3</div>
                  <div>
                    <h3 className="text-sm font-semibold text-primary-900">Clients</h3>
                    <p className="text-sm text-gray-600 mt-1.5 mb-3 leading-snug">Add the entities you are reconciling for.</p>
                    <Link to="/clients" className="text-sm font-semibold text-primary-600 hover:underline">Add clients →</Link>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/70 border border-primary-100 shadow-sm">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 text-white text-sm font-bold flex items-center justify-center">4</div>
                  <div>
                    <h3 className="text-sm font-semibold text-primary-900">Projects</h3>
                    <p className="text-sm text-gray-600 mt-1.5 mb-3 leading-snug">Start your first reconciliation project.</p>
                    {canCreateProject(role) && (
                      <Link to="/projects/new" className="text-sm font-semibold text-primary-600 hover:underline">New Project →</Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissGetStarted}
              className="flex-shrink-0 rounded p-1 text-primary-600 hover:bg-primary-100 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
        {usageLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              label="Total Projects"
              value={usage?.usage?.projectsUsed ?? projectsList.length}
              sublabel={
                <div className="mt-4">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500 mb-1">
                    <span>Usage</span>
                    <span>{projectsUsed} / {projectsUnlimited ? '∞' : projectsLimit}</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${projectsUsed / projectsLimit > 0.9 ? 'bg-red-500' : 'bg-primary-500'}`}
                      style={{ width: `${projectsUnlimited ? 0 : Math.min(100, (projectsUsed / projectsLimit) * 100)}%` }}
                    />
                  </div>
                </div>
              }
              icon={<FolderKanban />}
              accent="primary"
            />
            <MetricCard
              label="Pending Review"
              value={inProgressCount}
              sublabel="Active reconciliation cycles"
              icon={<FileCheck />}
              accent="amber"
            />
            <MetricCard
              label="Monthly Transactions"
              value={usage?.usage?.transactionsUsed ?? 0}
              sublabel={
                <div className="mt-4">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500 mb-1">
                    <span>Usage</span>
                    <span>{transactionsUsed} / {transactionsUnlimited ? '∞' : transactionsLimit}</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${transactionsUsed / transactionsLimit > 0.9 ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{ width: `${transactionsUnlimited ? 0 : Math.min(100, (transactionsUsed / transactionsLimit) * 100)}%` }}
                    />
                  </div>
                </div>
              }
              icon={<LayoutDashboard />}
              accent="green"
            />
            <MetricCard
              label="Team Members"
              value={memberCount}
              sublabel="Active firm accounts"
              icon={<Users />}
              accent="indigo"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
        </div>

        <div className="space-y-6">
          <Card title="Plan features">
            <p className="text-xs text-gray-500 mb-5 uppercase font-bold tracking-widest">Included in your plan</p>
            <ul className="space-y-3">
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
          <p className="text-sm text-gray-600 mb-5">Control branding, billing, bank rules, API keys, and view activity.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Link to="/settings/branding" className="flex flex-col p-5 rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <span className="font-semibold tracking-tight text-gray-900">Branding</span>
              <span className="text-xs text-gray-500 mt-0.5">Logo, colours, report title</span>
            </Link>
            <Link to="/settings/billing" className="flex flex-col p-5 rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <span className="font-semibold tracking-tight text-gray-900">Billing</span>
              <span className="text-xs text-gray-500 mt-0.5">Plan & payment</span>
            </Link>
            <Link to="/settings/members" className="flex flex-col p-5 rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <span className="font-semibold tracking-tight text-gray-900">Members</span>
              <span className="text-xs text-gray-500 mt-0.5">Add & manage team</span>
            </Link>
            {features.api_access && (
            <Link to="/settings/api-keys" className="flex flex-col p-5 rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <span className="font-semibold tracking-tight text-gray-900">API keys</span>
              <span className="text-xs text-gray-500 mt-0.5">Create & manage API access</span>
            </Link>
            )}
            {features.bank_rules && (
            <Link to="/settings/bank-rules" className="flex flex-col p-5 rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <span className="font-semibold tracking-tight text-gray-900">Bank rules</span>
              <span className="text-xs text-gray-500 mt-0.5">Auto-suggest & flag rules</span>
            </Link>
            )}
            {features.audit_trail && (
            <Link to="/audit" className="flex flex-col p-5 rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <span className="font-semibold tracking-tight text-gray-900">Audit log</span>
              <span className="text-xs text-gray-500 mt-0.5">All actions & exports</span>
            </Link>
            )}
          </div>
        </Card>
      )}

      {!isAdmin && (
        <Card title="Settings">
          <p className="text-sm text-gray-600 mb-5">Branding, billing, and team — manage your organisation.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Link to="/settings/branding" className="flex flex-col p-5 rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <span className="font-semibold tracking-tight text-gray-900">Branding</span>
              <span className="text-xs text-gray-500 mt-0.5">Logo, colours, report title</span>
            </Link>
            <Link to="/settings/billing" className="flex flex-col p-5 rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <span className="font-semibold tracking-tight text-gray-900">Billing</span>
              <span className="text-xs text-gray-500 mt-0.5">Plan & payment</span>
            </Link>
            <Link to="/settings/members" className="flex flex-col p-5 rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <span className="font-semibold tracking-tight text-gray-900">Members</span>
              <span className="text-xs text-gray-500 mt-0.5">Add & manage team</span>
            </Link>
            {features.bank_rules && (
              <Link to="/settings/bank-rules" className="flex flex-col p-5 rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                <span className="font-semibold tracking-tight text-gray-900">Bank rules</span>
                <span className="text-xs text-gray-500 mt-0.5">Auto-suggest & flag rules</span>
              </Link>
            )}
            {features.audit_trail && (
              <Link to="/audit" className="flex flex-col p-5 rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
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
          ) : projectsPaywallBlocked ? (
            <div className="px-6 py-8">
              <SubscriptionRenewalPanel />
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
              <div key={p.id} className="px-6 py-5 flex justify-between items-center hover:bg-surface/50 transition-colors">
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
