import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import Card from '../../components/ui/Card'
import PageHeader from '../../components/layout/PageHeader'

export default function AdminUsers() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, search],
    queryFn: () => api(`/admin/users?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`) as Promise<{
      users: { id: string; email: string; name: string | null; suspendedAt: string | null; createdAt: string; memberships: { organization: { name: string }; role: string }[] }[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }>,
  })

  if (isLoading || !data) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Platform admin"
          title="Users"
          subtitle={<p className="text-gray-500">View and manage platform accounts.</p>}
        />
        <p className="text-gray-500 text-sm">Loading users…</p>
      </div>
    )
  }

  const { users, pagination } = data

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Users"
        subtitle={<p className="text-gray-500">View and manage platform accounts.</p>}
        actions={
          <div className="relative w-full sm:w-72 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search by email or name..."
              className="w-full pl-9 pr-3 py-2.5 border border-border rounded-xl bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500 shadow-sm min-h-[44px]"
            />
          </div>
        }
      />

      <Card noPadding className="shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-surface">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organizations</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-muted">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-surface">
                <td className="px-6 py-4">
                  <Link to={`/platform-admin/users/${u.id}`} className="text-primary-600 hover:underline font-medium">
                    {u.email}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{u.name || '—'}</td>
                <td className="px-6 py-4">
                  {u.suspendedAt ? (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                      Suspended
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {u.memberships.map((m) => `${m.organization.name} (${m.role})`).join(', ') || '—'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {formatDate(u.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <p className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 hover:bg-surface focus:ring-2 focus:ring-primary-500"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 hover:bg-surface focus:ring-2 focus:ring-primary-500"
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
