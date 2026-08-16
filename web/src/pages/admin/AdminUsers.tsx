import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import PageHeader from '../../components/layout/PageHeader'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../../components/ui/Table'
import { PageBodySkeleton } from '../../components/ui/Skeleton'

export default function AdminUsers() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'users', page, search],
    queryFn: () => api(`/admin/users?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`) as Promise<{
      users: { id: string; email: string; name: string | null; suspendedAt: string | null; createdAt: string; memberships: { organization: { name: string }; role: string }[] }[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }>,
  })

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Users"
        subtitle={<p className="text-gray-500">View and manage platform accounts.</p>}
        actions={
          <div className="w-full sm:w-72 min-w-0">
            <Input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search by email or name..."
              leading={<Search className="w-4 h-4" />}
              aria-label="Search by email or name"
            />
          </div>
        }
      />

      {isLoading && !data && <PageBodySkeleton label="Loading users" />}

      {isError && (
        <Alert tone="error" title="Could not load users" onRetry={() => void refetch()}>
          {error instanceof Error ? error.message : 'Something went wrong.'}
        </Alert>
      )}

      {data && (
      <Card noPadding>
        <Table>
          <TableHead>
            <tr>
              <TableTh>Email</TableTh>
              <TableTh>Name</TableTh>
              <TableTh>Status</TableTh>
              <TableTh>Organizations</TableTh>
              <TableTh>Joined</TableTh>
            </tr>
          </TableHead>
          <TableBody>
            {data.users.map((u) => (
              <TableRow key={u.id}>
                <TableTd>
                  <Link to={`/platform-admin/users/${u.id}`} className="text-primary-600 hover:underline font-medium">
                    {u.email}
                  </Link>
                </TableTd>
                <TableTd>{u.name || '—'}</TableTd>
                <TableTd>
                  {u.suspendedAt ? (
                    <Badge tone="danger" size="sm">
                      Suspended
                    </Badge>
                  ) : (
                    <Badge tone="success" size="sm">
                      Active
                    </Badge>
                  )}
                </TableTd>
                <TableTd>
                  {u.memberships.map((m) => `${m.organization.name} (${m.role})`).join(', ') || '—'}
                </TableTd>
                <TableTd className="text-gray-500">
                  {formatDate(u.createdAt)}
                </TableTd>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <p className="text-sm text-gray-500">
              Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={data.pagination.page <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                disabled={data.pagination.page >= data.pagination.totalPages}
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
      )}
    </div>
  )
}
