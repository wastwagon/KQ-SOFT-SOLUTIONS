import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Users, Building2, CreditCard, DollarSign, ArrowRight } from 'lucide-react'
import Card from '../../components/ui/Card'
import PageHeader from '../../components/layout/PageHeader'
import { api } from '../../lib/api'

export default function AdminOverview() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => api('/admin/overview') as Promise<{
      usersCount: number
      orgsCount: number
      plansCount: number
      recentPayments?: number
    }>,
  })

  if (isLoading || !stats) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Platform admin"
          title="Overview"
          subtitle={<p className="text-gray-500">Loading platform snapshot…</p>}
        />
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500 shadow-sm max-w-md">
          Loading…
        </div>
      </div>
    )
  }

  const cards = [
    { label: 'Users', value: stats.usersCount ?? 0, icon: Users, to: '/platform-admin/users', color: 'primary' },
    { label: 'Organizations', value: stats.orgsCount ?? 0, icon: Building2, to: '/platform-admin/organizations', color: 'primary' },
    { label: 'Plans', value: stats.plansCount ?? 0, icon: CreditCard, to: '/platform-admin/plans', color: 'primary' },
    { label: 'Revenue', value: 'View', icon: DollarSign, to: '/platform-admin/revenue', color: 'primary' },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Overview"
        subtitle={
          <p className="text-gray-500">
            Platform-wide management: users, organizations, plans, and revenue.
          </p>
        }
      />
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
      <Card className="shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Quick links</h2>
        <p className="text-sm text-gray-500 mb-4">
          Use the sidebar to manage users, organizations, subscription plans, revenue analytics, and generation settings.
        </p>
        <Link
          to="/platform-admin/generation-settings"
          className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          Platform generation settings <ArrowRight className="w-4 h-4" />
        </Link>
      </Card>
    </div>
  )
}
