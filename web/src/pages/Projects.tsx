import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { FolderKanban, ChevronRight } from 'lucide-react'
import { useAuth } from '../store/auth'
import { projects, clients, subscription, isSubscriptionInactiveError } from '../lib/api'
import { normalizeClientsList } from '../lib/clientsPayload'
import { canCreateProject } from '../lib/permissions'
import { formatDate } from '../lib/format'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Button, { buttonClassName } from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../components/ui/Table'
import { TableRowSkeleton } from '../components/ui/Skeleton'
import ProjectStatusPill from '../components/project/ProjectStatusPill'
import SubscriptionRenewalPanel from '../components/SubscriptionRenewalPanel'
import PageHeader from '../components/layout/PageHeader'
import BrsVarianceBadge from '../components/project/BrsVarianceBadge'
import Alert from '../components/ui/Alert'

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
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const role = useAuth((s) => s.role)
  const org = useAuth((s) => s.org)
  /** `/reports` renders this page with completed status pre-selected */
  const isReportsView = initialStatus === 'completed'
  const [searchParams, setSearchParams] = useSearchParams()
  const clientFromUrl = searchParams.get('clientId') || ''
  const statusFromUrl = searchParams.get('status') || ''
  const [statusFilter, setStatusFilter] = useState(() => initialStatus || statusFromUrl)
  const [clientFilter, setClientFilter] = useState(() => clientFromUrl)
  const [search, setSearch] = useState('')

  const usageQuery = useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: subscription.getUsage,
  })
  const { data: usageData } = usageQuery
  const features = (usageData?.features || {}) as Record<string, boolean>
  const effectiveClientFilter = features.multi_client ? clientFilter : ''
  const [limit] = useState(50)
  const [offset, setOffset] = useState(0)

  const projectsQuery = useQuery({
    queryKey: ['projects', effectiveClientFilter || null, offset],
    queryFn: () => projects.list(effectiveClientFilter ? { clientId: effectiveClientFilter, limit, offset } : { limit, offset }),
  })
  const { data: projectsData, isLoading, isError: projectsQueryFailed } = projectsQuery
  const projectsList = useMemo(
    () => projectsData?.projects || [],
    [projectsData?.projects]
  )
  const totalProjects = projectsData?.total || 0
  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: clients.list,
  })
  const { data: clientsRaw, isError: clientsQueryFailed } = clientsQuery
  const clientsList = useMemo(() => normalizeClientsList(clientsRaw), [clientsRaw])
  const paywallBlocked =
    isSubscriptionInactiveError(projectsQuery.error) || isSubscriptionInactiveError(clientsQuery.error)
  const listLoadFailed =
    !paywallBlocked && (projectsQueryFailed || clientsQueryFailed)

  const clientName = (clientFilter && clientsList.find((c) => c.id === clientFilter)?.name) || null
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

  if (paywallBlocked) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Work" title={isReportsView ? 'Reports' : 'Projects'} />
        <SubscriptionRenewalPanel />
      </div>
    )
  }

  if (listLoadFailed) {
    const err = projectsQuery.error ?? clientsQuery.error
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Work" title={isReportsView ? 'Reports' : 'Projects'} />
        <Alert
          tone="error"
          title="Could not load projects"
          onRetry={() => {
            void queryClient.invalidateQueries({ queryKey: ['projects'] })
            void queryClient.invalidateQueries({ queryKey: ['clients'] })
          }}
        >
          {err instanceof Error ? err.message : 'Something went wrong.'}
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Work"
        title={isReportsView ? 'Reports' : 'Projects'}
        subtitle={
          <>
            {org?.name ? <p className="text-gray-700 font-medium">{org.name}</p> : null}
            <p className="text-gray-500">
              {isReportsView
                ? 'Completed jobs — open a report to download Excel or PDF, check BRS tie-out, and roll the period forward.'
                : 'Open and resume reconciliation jobs.'}
            </p>
          </>
        }
        actions={
          canCreateProject(role) ? (
            <Button type="button" onClick={() => navigate('/projects/new')}>
              New project
            </Button>
          ) : undefined
        }
      />

      {features.multi_client && clientFilter && (
        <Alert
          tone="info"
          title={`Filtering by ${clientName || 'client'}`}
          className="!p-3"
          action={
            <Button type="button" variant="outline" size="xs" onClick={clearClientFilter}>
              Clear
            </Button>
          }
        />
      )}

      {!isReportsView && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {STATUS_OPTIONS.map(({ value, label }) => {
            const count = value ? (counts as Record<string, number>)[value] ?? 0 : counts.all
            const isActive = statusFilter === value
            return (
              <Button
                key={value || 'all'}
                type="button"
                size="xs"
                variant={isActive ? 'primary' : 'outline'}
                aria-pressed={isActive}
                onClick={() => setStatusFilter(value)}
                className="rounded-full gap-1.5"
              >
                {label}
                <span className={`tabular-nums text-xs ${isActive ? 'text-primary-100' : 'text-gray-500'}`}>
                  {count}
                </span>
              </Button>
            )
          })}
        </div>
      )}

      {/* Search & filter bar */}
      <Card>
        <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-0 sm:min-w-[200px]">
          <Input
            type="search"
            placeholder="Search by project name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search projects"
          />
        </div>
        {features.multi_client ? (
          <div className="w-full sm:w-56">
            <Select
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
              aria-label="Filter by client"
            >
              <option value="">All clients</option>
              {clientsList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled
            title="Filter by client requires Firm plan"
          >
            Filter by client (Firm)
          </Button>
        )}
        </div>
      </Card>

      {/* Projects table */}
      <Card noPadding>
        {isLoading ? (
          <Table>
            <TableHead>
              <tr>
                <TableTh>Project</TableTh>
                <TableTh>Client</TableTh>
                <TableTh>Status</TableTh>
                {isReportsView && <TableTh>BRS tie-out</TableTh>}
                <TableTh>Created</TableTh>
                <TableTh className="text-right">Action</TableTh>
              </tr>
            </TableHead>
            <TableBody>
              {[1, 2, 3, 4, 5].map((i) => (
                <TableRowSkeleton key={i} cols={isReportsView ? 6 : 5} />
              ))}
            </TableBody>
          </Table>
        ) : filtered.length === 0 ? (
          projectsList.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={<FolderKanban className="w-6 h-6" />}
                title="No projects yet"
                description="Create your first reconciliation project to get started."
                action={
                  <Link to="/projects/new" className={buttonClassName('primary', 'md')}>
                    New project
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
          <Table>
            <TableHead>
              <tr>
                <TableTh>Project</TableTh>
                <TableTh>Client</TableTh>
                <TableTh>Status</TableTh>
                {isReportsView && <TableTh>BRS tie-out</TableTh>}
                <TableTh>Created</TableTh>
                <TableTh className="text-right">Action</TableTh>
              </tr>
            </TableHead>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableTd>
                    <p className="font-medium text-gray-900">{p.name}</p>
                  </TableTd>
                  <TableTd className="text-gray-500">{p.client?.name || '—'}</TableTd>
                  <TableTd>
                    <ProjectStatusPill status={p.status} size="sm" />
                  </TableTd>
                  {isReportsView && (
                    <TableTd>
                      <BrsVarianceBadge projectId={p.id} />
                    </TableTd>
                  )}
                  <TableTd className="text-gray-500">{formatDate(p.createdAt)}</TableTd>
                  <TableTd className="text-right">
                    <Link
                      to={
                        isReportsView || p.status === 'completed' || p.status === 'approved'
                          ? `/projects/${p.slug ?? p.id}#report`
                          : `/projects/${p.slug ?? p.id}`
                      }
                      onMouseEnter={preloadProjectDetailPage}
                      onFocus={preloadProjectDetailPage}
                      className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-800 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg group/link"
                    >
                      {isReportsView || p.status === 'completed' || p.status === 'approved'
                        ? 'Open report'
                        : p.status === 'submitted_for_review'
                          ? 'Review'
                          : 'Resume'}
                      <ChevronRight className="w-4 h-4 opacity-70 group-hover/link:translate-x-0.5 transition-transform" aria-hidden />
                    </Link>
                  </TableTd>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {totalProjects > limit && (
        <Card>
          <div className="flex items-center justify-between gap-4">
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
        </Card>
      )}
    </div>
  )
}
