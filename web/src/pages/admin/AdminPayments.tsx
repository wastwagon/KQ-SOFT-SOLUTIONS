import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import Card from '../../components/ui/Card'

type Payment = {
  id: string
  organizationId: string
  amount: number
  currency: string
  plan: string
  period: string
  reference: string | null
  status: string
  createdAt: string
  organization: { id: string; name: string }
}

export default function AdminPayments() {
  const [page, setPage] = useState(1)
  const [orgId, setOrgId] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payments', page, orgId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (orgId.trim()) params.set('orgId', orgId.trim())
      return api(`/admin/payments?${params}`) as Promise<{
        payments: Payment[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
      }>
    },
  })

  const fmt = (n: number, currency = 'GHS') =>
    new Intl.NumberFormat('en-GH', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n)

  if (isLoading || !data) {
    return <p className="text-gray-500">Loading payments...</p>
  }

  const { payments, pagination } = data
  const { page: p, totalPages, total } = pagination

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Payments</h1>
      <p className="text-sm text-gray-500 mb-6">
        All subscription payments across the platform.
      </p>

      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Filter by org ID"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-white text-gray-900 w-64 focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="button"
            onClick={() => setPage(1)}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-border text-gray-700 hover:bg-surface"
          >
            Apply
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-gray-600 font-medium">Date</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">Organization</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">Plan</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">Period</th>
                <th className="px-3 py-2 text-right text-gray-600 font-medium">Amount</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                    No payments found.
                  </td>
                </tr>
              ) : (
                payments.map((pay) => (
                  <tr key={pay.id} className="border-b border-border-muted hover:bg-surface/50">
                    <td className="px-3 py-2 text-gray-900 whitespace-nowrap">
                      {formatDate(pay.createdAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/platform-admin/organizations/${pay.organization.id}`}
                        className="text-primary-600 hover:underline"
                      >
                        {pay.organization.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-900 capitalize">{pay.plan}</td>
                    <td className="px-3 py-2 text-gray-600 capitalize">{pay.period}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      {fmt(Number(pay.amount), pay.currency)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          pay.status === 'success'
                            ? 'bg-green-100 text-green-800'
                            : pay.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {pay.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <p className="text-sm text-gray-500">
              Page {p} of {totalPages} • {total} total
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={p <= 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={p >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
