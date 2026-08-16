import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Users,
  Building2,
  CreditCard,
  DollarSign,
  ArrowRight,
  Server,
  Activity,
  Archive,
  Settings,
  Inbox,
  Landmark,
  FileSpreadsheet,
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Alert from '../../components/ui/Alert'
import MetricCard from '../../components/ui/MetricCard'
import PageHeader from '../../components/layout/PageHeader'
import { MetricCardSkeleton } from '../../components/ui/Skeleton'
import { api, platformAdminOps } from '../../lib/api'

function formatUptime(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${sec}s`
}

function gauge(metrics: { gauges?: Record<string, number> } | undefined, key: string) {
  return metrics?.gauges?.[key]
}

function counter(metrics: { counters?: Record<string, number> } | undefined, key: string) {
  return metrics?.counters?.[key] ?? 0
}

export default function AdminOverview() {
  const overviewQuery = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () =>
      api('/admin/overview') as Promise<{
        usersCount: number
        orgsCount: number
        plansCount: number
        recentPayments?: number
        openLeadsCount?: number
      }>,
  })
  const metricsQuery = useQuery({
    queryKey: ['admin', 'ops-metrics'],
    queryFn: platformAdminOps.getMetrics,
    refetchInterval: 30_000,
  })

  const { data: stats, isLoading, isError, error, refetch } = overviewQuery
  const metrics = metricsQuery.data
  const derived = metrics?.derived as
    | {
        parseQualityAvg?: number | null
        memoryBoostTotal?: number
        autoMapOutcomes?: { mapped: number; skipped: number; failed: number }
      }
    | undefined

  const queueLag = gauge(metrics, 'parse.queue_oldest_lag_sec')
  const queuePending = gauge(metrics, 'parse.queue_pending_docs')
  const jobsFailed = counter(metrics, 'parse.job_failed')
  const jobsCompleted = counter(metrics, 'parse.job_completed')
  const webhookConfigured = metrics?.alerts?.webhookConfigured
  const parseFailed = derived?.autoMapOutcomes?.failed ?? 0

  const jumpLinks = [
    { to: '/platform-admin/ops-metrics', label: 'Ops metrics', hint: 'Parse / OCR / match counters', icon: Activity },
    { to: '/platform-admin/leads', label: 'Leads', hint: 'Newsletter & bank-feed waitlist', icon: Inbox },
    { to: '/platform-admin/revenue', label: 'Revenue', hint: 'Payments analytics', icon: DollarSign },
    { to: '/platform-admin/retention', label: 'Data retention', hint: 'Preview or prune old projects', icon: Archive },
    { to: '/platform-admin/database', label: 'Database', hint: 'Migrations & seed', icon: Server },
    { to: '/platform-admin/generation-settings', label: 'Generation settings', hint: 'Platform report defaults', icon: Settings },
    {
      to: '/platform-admin/tools/clean-bank-statement',
      label: 'Clean bank statement',
      hint: 'Preview / sample / full cleaned export',
      icon: Landmark,
    },
    {
      to: '/platform-admin/tools/clean-cash-book',
      label: 'Clean cash book',
      hint: 'Preview / sample / full cleaned export',
      icon: FileSpreadsheet,
    },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Overview"
        subtitle={
          <p className="text-gray-500">
            Live tenants and process health. Your account does not need a tenant subscription to use
            these tools.
          </p>
        }
      />

      {isError && (
        <Alert tone="error" title="Could not load platform overview" onRetry={() => void refetch()}>
          {error instanceof Error ? error.message : 'Something went wrong.'}
        </Alert>
      )}

      {metricsQuery.isError && (
        <Alert
          tone="warning"
          title="Ops metrics could not be loaded"
          onRetry={() => void metricsQuery.refetch()}
        >
          Tenant counts still show below. Open Ops metrics for the full counter table.
        </Alert>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" aria-busy="true">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      )}

      {!isLoading && !isError && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/platform-admin/users" className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
            <MetricCard label="Users" value={stats.usersCount} icon={<Users />} accent="none" />
          </Link>
          <Link to="/platform-admin/organizations" className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
            <MetricCard label="Organizations" value={stats.orgsCount} icon={<Building2 />} accent="none" />
          </Link>
          <Link to="/platform-admin/plans" className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
            <MetricCard label="Plans" value={stats.plansCount} icon={<CreditCard />} accent="none" />
          </Link>
          <Link to="/platform-admin/leads" className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
            <MetricCard
              label="Open leads"
              value={stats.openLeadsCount ?? 0}
              sublabel="Not yet contacted"
              icon={<Inbox />}
              accent="none"
            />
          </Link>
        </div>
      )}

      {metrics && (
        <section aria-labelledby="ops-snapshot-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="ops-snapshot-heading" className="text-lg font-semibold text-gray-900">
                Process snapshot
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Counters since this API process started · {formatUptime(metrics.uptimeSec)} uptime
              </p>
            </div>
            <Link
              to="/platform-admin/ops-metrics"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-800"
            >
              Full metrics
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>

          {webhookConfigured === false && (
            <Alert tone="warning" title="Alert webhook not configured">
              Parse-lag and lead alerts will not fire until the API has{' '}
              <code className="text-xs">ALERT_WEBHOOK_URL</code> or{' '}
              <code className="text-xs">SLACK_WEBHOOK_URL</code>.
            </Alert>
          )}

          {(jobsFailed > 0 || (queueLag != null && queueLag > 300)) && (
            <Alert tone="warning" title="Parse health needs a look">
              {jobsFailed > 0 ? `${jobsFailed} failed parse job${jobsFailed === 1 ? '' : 's'} since boot. ` : null}
              {queueLag != null && queueLag > 300
                ? `Oldest queued document is ${formatUptime(Math.round(queueLag))} behind.`
                : null}
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard
              label="Parse jobs completed"
              value={jobsCompleted}
              sublabel={jobsFailed ? `${jobsFailed} failed` : 'Since process start'}
              icon={<Activity />}
              accent="none"
            />
            <MetricCard
              label="Queue"
              value={queuePending ?? 0}
              sublabel={
                queueLag != null && queueLag > 0
                  ? `Oldest lag ${formatUptime(Math.round(queueLag))}`
                  : 'Pending documents'
              }
              icon={<Server />}
              accent="none"
            />
            <MetricCard
              label="Auto-map"
              value={derived?.autoMapOutcomes?.mapped ?? 0}
              sublabel={`${derived?.autoMapOutcomes?.skipped ?? 0} skipped · ${parseFailed} failed`}
              icon={<FileSpreadsheet />}
              accent="none"
            />
            <MetricCard
              label="Parse quality"
              value={derived?.parseQualityAvg != null ? derived.parseQualityAvg : '—'}
              sublabel={
                derived?.memoryBoostTotal
                  ? `${derived.memoryBoostTotal} memory boosts`
                  : 'Average score since boot'
              }
              icon={<Activity />}
              accent="none"
            />
          </div>
        </section>
      )}

      <Card
        title="Jump to"
        sublabel="Same tools as the sidebar, for health checks and maintenance."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {jumpLinks.map(({ to, label, hint, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-start gap-3 rounded-xl border border-border shadow-card px-4 py-3 hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600 shrink-0">
                <Icon className="w-4 h-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900">{label}</span>
                <span className="block text-xs text-gray-500">{hint}</span>
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
