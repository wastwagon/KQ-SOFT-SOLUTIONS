import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, Archive, Inbox, Server, Settings, ArrowRight } from 'lucide-react'
import Card from '../../components/ui/Card'
import PageHeader from '../../components/layout/PageHeader'
import MetricCard from '../../components/ui/MetricCard'
import Alert from '../../components/ui/Alert'
import { platformAdminOps } from '../../lib/api'

function formatUptime(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${sec}s`
}

const OPS_LINKS = [
  {
    to: '/platform-admin/ops-metrics',
    label: 'Ops metrics',
    hint: 'Parse, OCR, queue counters, test alerts',
    icon: Activity,
  },
  {
    to: '/platform-admin/leads',
    label: 'Leads',
    hint: 'Newsletter, waitlist, and sales enquiries',
    icon: Inbox,
  },
  {
    to: '/platform-admin/retention',
    label: 'Data retention',
    hint: 'Preview or prune completed projects',
    icon: Archive,
  },
  {
    to: '/platform-admin/generation-settings',
    label: 'Generation settings',
    hint: 'Platform report defaults and retention years',
    icon: Settings,
  },
  {
    to: '/platform-admin/database',
    label: 'Database',
    hint: 'Migrations, seed, and maintenance',
    icon: Server,
  },
] as const

export default function AdminOpsHub() {
  const metricsQuery = useQuery({
    queryKey: ['admin', 'ops-metrics'],
    queryFn: platformAdminOps.getMetrics,
    refetchInterval: 60_000,
  })
  const metrics = metricsQuery.data
  const queueLag = metrics?.gauges?.['parse.queue_oldest_lag_sec']
  const queuePending = metrics?.gauges?.['parse.queue_pending_docs']
  const jobsFailed = metrics?.counters?.['parse.job_failed'] ?? 0

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Ops hub"
        subtitle={
          <p className="text-gray-500">
            Health checks, leads, retention, and platform defaults. Deep links stay in the sidebar and ⌘K palette.
          </p>
        }
      />

      {metrics && (jobsFailed > 0 || (queueLag != null && queueLag > 300)) && (
        <Alert tone="warning" title="Parse health needs a look">
          {jobsFailed > 0 ? `${jobsFailed} failed parse job${jobsFailed === 1 ? '' : 's'} since boot. ` : null}
          {queueLag != null && queueLag > 300
            ? `Oldest queued document is ${formatUptime(Math.round(queueLag))} behind.`
            : null}{' '}
          <Link to="/platform-admin/ops-metrics" className="font-medium text-primary-700 underline">
            Open ops metrics
          </Link>
        </Alert>
      )}

      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="API uptime"
            value={formatUptime(metrics.uptimeSec)}
            sublabel="This process"
            icon={<Activity />}
            accent="none"
          />
          <MetricCard
            label="Parse queue"
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
            label="Failed parse jobs"
            value={jobsFailed}
            sublabel="Since process start"
            icon={<Activity />}
            accent={jobsFailed > 0 ? 'amber' : 'none'}
          />
        </div>
      )}

      <Card title="Operations" sublabel="Same destinations as the Ops section in the sidebar.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {OPS_LINKS.map(({ to, label, hint, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-start gap-3 rounded-xl border border-border shadow-card px-4 py-3 hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600 shrink-0">
                <Icon className="w-4 h-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-medium text-gray-900">
                  {label}
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400" aria-hidden />
                </span>
                <span className="block text-xs text-gray-500">{hint}</span>
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
