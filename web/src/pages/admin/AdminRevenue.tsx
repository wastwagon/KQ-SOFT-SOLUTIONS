import { useQuery } from '@tanstack/react-query'
import { DollarSign, TrendingUp, CreditCard, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import Card from '../../components/ui/Card'
import MetricCard from '../../components/ui/MetricCard'
import PageHeader from '../../components/layout/PageHeader'
import Alert from '../../components/ui/Alert'
import { PageBodySkeleton } from '../../components/ui/Skeleton'

export default function AdminRevenue() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'analytics', 'revenue'],
    queryFn: () => api('/admin/analytics/revenue') as Promise<{
      totalRevenue: number
      mrr: number
      mrrChange: number
      paymentsCount: number
      thisMonthCount: number
      byPlan: { plan: string; total: number; count: number }[]
      recentPayments: { id: string; amount: number; plan: string; period: string; orgName: string; createdAt: string }[]
    }>,
  })

  if (isError) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Platform admin"
          title="Revenue analytics"
          subtitle={<p className="text-gray-500">Platform revenue, MRR, and payment history.</p>}
        />
        <Alert tone="error" title="Could not load revenue" onRetry={() => void refetch()}>
          {error instanceof Error ? error.message : 'Something went wrong.'}
        </Alert>
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Platform admin"
          title="Revenue analytics"
          subtitle={<p className="text-gray-500">Platform revenue, MRR, and payment history.</p>}
        />
        <PageBodySkeleton label="Loading revenue" />
      </div>
    )
  }

  const fmt = (n: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', minimumFractionDigits: 2 }).format(n)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Revenue analytics"
        subtitle={<p className="text-gray-500">Platform revenue, MRR, and payment history.</p>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Total revenue" value={fmt(data.totalRevenue)} icon={<DollarSign />} />
        <MetricCard
          label="MRR (this month)"
          value={fmt(data.mrr)}
          icon={<TrendingUp />}
          sublabel={
            <span className={`inline-flex items-center gap-0.5 ${data.mrrChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.mrrChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {data.mrrChange >= 0 ? '+' : ''}
              {data.mrrChange.toFixed(1)}% vs last month
            </span>
          }
        />
        <MetricCard
          label="Payments"
          value={data.paymentsCount}
          icon={<CreditCard />}
          sublabel={`${data.thisMonthCount} this month`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Revenue by plan">
          <div className="space-y-3">
            {data.byPlan.length === 0 ? (
              <p className="text-sm text-gray-500">No payments yet</p>
            ) : (
              data.byPlan.map((p) => (
                <div key={p.plan} className="flex justify-between items-center py-2 border-b border-border-muted last:border-0">
                  <span className="font-medium text-gray-900 capitalize">{p.plan}</span>
                  <span className="text-sm text-gray-600">{fmt(p.total)} ({p.count} payments)</span>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card title="Recent payments">
          <div className="space-y-3">
            {data.recentPayments.length === 0 ? (
              <p className="text-sm text-gray-500">No payments yet</p>
            ) : (
              data.recentPayments.map((p) => (
                <div key={p.id} className="flex justify-between items-center py-2 border-b border-border-muted last:border-0 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{p.orgName}</p>
                    <p className="text-gray-500 text-xs">{p.plan} • {p.period} • {formatDate(p.createdAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <span className="font-medium text-gray-900">{fmt(p.amount)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
