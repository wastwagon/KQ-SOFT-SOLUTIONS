import { useQuery } from '@tanstack/react-query'
import { DollarSign, TrendingUp, CreditCard, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import Card from '../../components/ui/Card'

export default function AdminRevenue() {
  const { data, isLoading } = useQuery({
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

  if (isLoading || !data) {
    return <p className="text-gray-500">Loading revenue...</p>
  }

  const fmt = (n: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', minimumFractionDigits: 2 }).format(n)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Revenue Analytics</h1>
      <p className="text-sm text-gray-500 mb-6">
        Platform revenue, MRR, and payment history.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-100">
              <DollarSign className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Revenue</p>
              <p className="text-xl font-bold text-gray-900">{fmt(data.totalRevenue)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">MRR (this month)</p>
              <p className="text-xl font-bold text-gray-900">{fmt(data.mrr)}</p>
              <p className={`text-xs mt-0.5 flex items-center gap-0.5 ${data.mrrChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.mrrChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {data.mrrChange >= 0 ? '+' : ''}{data.mrrChange.toFixed(1)}% vs last month
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <CreditCard className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Payments</p>
              <p className="text-xl font-bold text-gray-900">{data.paymentsCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">{data.thisMonthCount} this month</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Revenue by plan</h3>
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
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Recent payments</h3>
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
