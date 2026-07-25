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
} from 'lucide-react'
import Card from '../../components/ui/Card'
import PageHeader from '../../components/layout/PageHeader'
import { MetricCardSkeleton } from '../../components/ui/Skeleton'
import { api } from '../../lib/api'

export default function AdminOverview() {
  const { data: stats, isLoading, isError, error, refetch, isFetching } = useQuery({
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

  const cards = [
    { label: 'Users', value: stats?.usersCount ?? 0, icon: Users, to: '/platform-admin/users' },
    {
      label: 'Organizations',
      value: stats?.orgsCount ?? 0,
      icon: Building2,
      to: '/platform-admin/organizations',
    },
    { label: 'Plans', value: stats?.plansCount ?? 0, icon: CreditCard, to: '/platform-admin/plans' },
    {
      label: 'Open leads',
      value: stats?.openLeadsCount ?? 0,
      icon: Inbox,
      to: '/platform-admin/leads',
    },
  ]

  const quickLinks = [
    {
      to: '/platform-admin/leads',
      label: 'Leads inbox',
      hint: 'Newsletter & bank-feed waitlist',
      icon: Inbox,
    },
    {
      to: '/platform-admin/revenue',
      label: 'Revenue',
      hint: 'Payments analytics',
      icon: DollarSign,
    },
    {
      to: '/platform-admin/ops-metrics',
      label: 'Ops metrics',
      hint: 'Parse / OCR / match counters',
      icon: Activity,
    },
    {
      to: '/platform-admin/retention',
      label: 'Data retention',
      hint: 'Preview or prune old projects',
      icon: Archive,
    },
    {
      to: '/platform-admin/database',
      label: 'Database',
      hint: 'Migrations & seed',
      icon: Server,
    },
    {
      to: '/platform-admin/generation-settings',
      label: 'Generation settings',
      hint: 'Platform report defaults',
      icon: Settings,
    },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Overview"
        subtitle={
          <p className="text-gray-500">
            Platform-wide management: tenants, commerce, and operations. Your account does not need a
            tenant subscription to use these tools.
          </p>
        }
      />

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 max-w-xl">
          <p className="font-medium text-red-900">Could not load platform overview</p>
          <p className="mt-1">
            {error instanceof Error ? error.message : 'Something went wrong.'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-3 px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-red-300 text-red-900 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
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
          {cards.map(({ label, value, icon: Icon, to }) => (
            <Link key={to} to={to}>
              <Card className="hover:border-primary-300 transition-colors h-full">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">{label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {typeof value === 'number' ? value : value}
                    </p>
                  </div>
                  <Icon className="w-8 h-8 text-primary-500 flex-shrink-0" />
                </div>
                <div className="mt-3 flex items-center text-sm text-primary-600 font-medium">
                  View <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Card className="shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Operations</h2>
        <p className="text-sm text-gray-500 mb-4">
          Wired to the same APIs as the sidebar. Use these for health checks and maintenance.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickLinks.map(({ to, label, hint, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-start gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
            >
              <Icon className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900">{label}</span>
                <span className="block text-xs text-gray-500 mt-0.5">{hint}</span>
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400 ml-auto shrink-0 mt-1" aria-hidden />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
