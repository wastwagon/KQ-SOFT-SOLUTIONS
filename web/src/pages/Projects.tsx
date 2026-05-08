import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { X, FolderKanban } from 'lucide-react'
import { useAuth } from '../store/auth'
import { projects, clients, subscription } from '../lib/api'
import { canCreateProject } from '../lib/permissions'
import { formatDate } from '../lib/format'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import { TableRowSkeleton } from '../components/ui/Skeleton'

const preloadProjectDetailPage = () => import('./ProjectDetail')

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'mapping', label: 'Mapping' },
  { value: 'reconciling', label: 'Reconciling' },
  { value: 'submitted_for_review', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'completed', label: 'Completed' },
]

type ProjectsProps = { initialStatus?: string }

export default function Projects({ initialStatus }: ProjectsProps) {
  const role = useAuth((s) => s.role)
  const [searchParams, setSearchParams] = useSearchParams()
  const clientFromUrl = searchParams.get('clientId') || ''
  const statusFromUrl = searchParams.get('status') || ''
  const [statusFilter, setStatusFilter] = useState(() => initialStatus || statusFromUrl)
  const [clientFilter, setClientFilter] = useState(() => clientFromUrl)
  const [search, setSearch] = useState('')

  const { data: usageData } = useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: subscription.getUsage,
  })
  const features = (usageData?.features || {}) as Record<string, boolean>
  const effectiveClientFilter = features.multi_client ? clientFilter : ''
  const [limit] = useState(50)
  const [offset, setOffset] = useState(0)

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects', effectiveClientFilter || null, offset],
    queryFn: () => projects.list(effectiveClientFilter ? { clientId: effectiveClientFilter, limit, offset } : { limit, offset }),
  })
  const projectsList = useMemo(
    () => projectsData?.projects || [],
    [projectsData?.projects]
  )
  const totalProjects = projectsData?.total || 0
  const { data: clientsList = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: clients.list,
  })

  const clientName = (clientFilter && (clientsList as { id: string; name: string }[]).find((c) => c.id === clientFilter)?.name) || null
  const clearClientFilter = () => {
    setClientFilter('')
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      p.delete('clientId')
      return p
    })
  }

  const filtered = useMemo(() => {
    let list = projectsList as { id: string; name: string; slug: string; status: string; createdAt: string; client?: { name: string } }[]
    if (statusFilter) list = list.filter((p) => p.status === statusFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }
    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [projectsList, statusFilter, search])

  const counts = useMemo(() => {
    const list = projectsList as { status: string }[]
    return {
      all: list.length,
      draft: list.filter((p) => p.status === 'draft').length,
      mapping: list.filter((p) => p.status === 'mapping').length,
      reconciling: list.filter((p) => p.status === 'reconciling').length,
      submitted_for_review: list.filter((p) => p.status === 'submitted_for_review').length,
      approved: list.filter((p) => p.status === 'approved').length,
      completed: list.filter((p) => p.status === 'completed').length,
    }
  }, [projectsList])

  const statusLabel = (s: string) => STATUS_OPTIONS.find((o) => o.value === s)?.label || s

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Projects</h1>
        {canCreateProject(role) && (
          <Link
            to="/projects/new"
            className="inline-flex items-center justify-center font-medium px-4 py-2.5 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 shadow-sm hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500 transition-all"
          >
            + New Project
          </Link>
        )}
      </div>

      {features.multi_client && clientFilter && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-50 border border-primary-200 text-sm text-gray-700 shadow-sm">
            Filtering by: <strong className="text-gray-900">{clientName || '…'}</strong>
            <button
              type="button"
              onClick={clearClientFilter}
              className="p-0.5 rounded-lg hover:bg-primary-200/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="Clear client filter"
              title="Clear client filter"
            >
              <X className="w-4 h-4" />
            </button>
          </span>
        </div>
      )}

      {/* Status KPI cards — consistent with Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
        {STATUS_OPTIONS.map(({ value, label }) => {
          const count = value ? (counts as Record<string, number>)[value] ?? 0 : counts.all
          const isActive = statusFilter === value
          return (
            <button
              key={value || 'all'}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`text-left rounded-xl border border-l-4 border-l-primary-500 p-4 sm:p-5 transition-all duration-200 ${
                isActive
                  ? 'border-primary-500 bg-primary-50/80 shadow-md'
                  : 'border-gray-200/80 bg-white shadow-sm hover:shadow-md hover:border-primary-100'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
              <p className="mt-2 text-lg sm:text-xl font-bold text-gray-900 tabular-nums">{count}</p>
            </button>
          )
        })}
      </div>

      {/* Search & filter bar */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <input
          type="search"
          placeholder="Search by project name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-0 sm:min-w-[200px] px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white transition-colors"
        />
        {features.multi_client ? (
          <select
            value={clientFilter}
            onChange={(e) => {
              const id = e.target.value
              setClientFilter(id)
              setSearchParams((prev) => {
                const p = new URLSearchParams(prev)
                if (id) p.set('clientId', id)
                else p.delete('clientId')
                return p
              })
            }}
            className="px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-gray-900 focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
          >
            <option value="">All clients</option>
            {(clientsList as { id: string; name: string }[]).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : (
          <span className="px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-lg bg-gray-50" title="Filter by client requires Firm plan">
            Filter by client (Firm)
          </span>
        )}
      </div>

      {/* Projects table */}
      <Card noPadding className="overflow-hidden rounded-xl border-gray-200 shadow-sm">
        {isLoading ? (
          <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Project</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted bg-white">
              {[1, 2, 3, 4, 5].map((i) => (
                <TableRowSkeleton key={i} cols={5} />
              ))}
            </tbody>
          </table>
          </div>
        ) : filtered.length === 0 ? (
          projectsList.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={<FolderKanban className="w-6 h-6" />}
                title="No projects yet"
                description="Create your first reconciliation project to get started."
                action={
                  <Link
                    to="/projects/new"
                    className="inline-flex items-center justify-center font-medium px-4 py-2.5 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all"
                  >
                    + New Project
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="py-12">
              <EmptyState
                title="No projects match your filters"
                description="Try a different status, client, or search term."
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStatusFilter('')
                      setClientFilter('')
                      setSearch('')
                      setSearchParams((prev) => {
                        const p = new URLSearchParams(prev)
                        p.delete('clientId')
                        return p
                      })
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Project</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted bg-white">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-surface/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{p.name}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.client?.name || '—'}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        p.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : p.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : p.status === 'submitted_for_review'
                          ? 'bg-blue-100 text-blue-800'
                          : p.status === 'draft'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {statusLabel(p.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(p.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/projects/${p.slug ?? p.id}`}
                      onMouseEnter={preloadProjectDetailPage}
                      onFocus={preloadProjectDetailPage}
                      className="text-primary-600 hover:text-primary-700 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                    >
                      {(p.status === 'completed' || p.status === 'approved' || p.status === 'submitted_for_review') ? 'View' : 'Resume'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      {totalProjects > limit && (
        <div className="flex items-center justify-between gap-4 py-4 px-2">
          <p className="text-sm text-gray-500">
            Showing <span className="font-medium">{offset + 1}</span> to <span className="font-medium">{Math.min(offset + limit, totalProjects)}</span> of <span className="font-medium">{totalProjects}</span> projects
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + limit >= totalProjects}
              onClick={() => setOffset(offset + limit)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
