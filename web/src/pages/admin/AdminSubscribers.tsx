import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../store/auth'
import Card from '../../components/ui/Card'

type Org = {
  id: string
  name: string
  slug: string
  plan: string
  suspendedAt: string | null
  createdAt: string
  lastPayment: { amount: number; createdAt: string; plan: string; period: string } | null
  totalPaid: number
  _count: { members: number; projects: number; clients: number }
}

export default function AdminSubscribers() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'subscribers', page, search, planFilter],
    queryFn: () =>
      api(
        `/admin/organizations?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}${planFilter ? `&plan=${encodeURIComponent(planFilter)}` : ''}`
      ) as Promise<{
        organizations: Org[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
      }>,
  })

  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    const base = import.meta.env.VITE_API_URL || ''
    const url = `${base}/api/v1/admin/organizations/export/csv${planFilter ? `?plan=${encodeURIComponent(planFilter)}` : ''}`
    const token = useAuth.getState().token
    setExporting(true)
    try {
      const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const blob = await r.blob()
      const u = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = u
      a.download = 'subscribers.csv'
      a.click()
      URL.revokeObjectURL(u)
    } finally {
      setExporting(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (!data?.organizations) return
    if (selectedIds.size === data.organizations.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(data.organizations.map((o) => o.id)))
  }

  if (isLoading || !data) {
    return <p className="text-gray-500">Loading organizations...</p>
  }

  const { organizations, pagination } = data
  const fmt = (n: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', minimumFractionDigits: 2 }).format(n)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Subscribers — filter by plan, manage, export.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={planFilter}
            onChange={(e) => { setPlanFilter(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-border rounded-lg bg-white text-gray-900"
          >
            <option value="">All plans</option>
            <option value="paid">Paid (basic/standard/premium)</option>
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
            <option value="firm">Firm</option>
          </select>
          <div className="relative">
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search by name..."
              className="pl-9 pr-3 py-2 w-56 border border-border rounded-lg bg-white text-gray-900 placeholder-gray-500"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-gray-700 hover:bg-surface disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      <Card noPadding className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-surface border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={organizations.length > 0 && selectedIds.size === organizations.length}
                  onChange={toggleSelectAll}
                  className="rounded border-border"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total paid</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Members</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-muted">
            {organizations.map((o) => (
              <tr key={o.id} className="hover:bg-surface/50 transition-colors">
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(o.id)}
                    onChange={() => toggleSelect(o.id)}
                    className="rounded border-border"
                  />
                </td>
                <td className="px-6 py-4">
                  <Link to={`/platform-admin/organizations/${o.slug}`} className="font-medium text-primary-600 hover:underline">
                    {o.name}
                  </Link>
                </td>
                <td className="px-6 py-4">
                  {o.suspendedAt ? (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                      Suspended
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 capitalize">{o.plan}</td>
                <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">{fmt(o.totalPaid)}</td>
                <td className="px-6 py-4 text-right text-sm text-gray-600">{o._count.members}</td>
                <td className="px-6 py-4 text-right">
                  <Link
                    to={`/platform-admin/organizations/${o.slug}`}
                    className="text-primary-600 hover:underline text-sm"
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <p className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} organizations)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50 text-gray-700 hover:bg-surface"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50 text-gray-700 hover:bg-surface"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
