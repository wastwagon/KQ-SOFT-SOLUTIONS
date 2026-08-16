import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../store/auth'
import { FileCheck, Download } from 'lucide-react'
import { audit, projects, isSubscriptionInactiveError, unlessSubscriptionInactive } from '../lib/api'
import { formatDate } from '../lib/format'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import Select from '../components/ui/Select'
import { useToast } from '../components/ui/Toast'
import { TableRowSkeleton } from '../components/ui/Skeleton'
import SubscriptionRenewalPanel from '../components/SubscriptionRenewalPanel'
import PageHeader from '../components/layout/PageHeader'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../components/ui/Table'

const PAGE_SIZE = 20

/** Shape of each item in GET /projects → `projects` array */
type ProjectListItem = { id: string; name: string; slug: string }

interface AuditLog {
  id: string
  action: string
  actionLabel: string
  projectId: string | null
  userId: string | null
  details: Record<string, unknown> | null
  createdAt: string
}

export default function Audit() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const org = useAuth((s) => s.org)
  const [projectFilter, setProjectFilter] = useState('')
  const [page, setPage] = useState(0)
  const [exporting, setExporting] = useState(false)

  const auditQuery = useQuery({
    queryKey: ['audit', { limit: 200 }],
    queryFn: () => audit.list({ limit: 200 }),
  })
  const { data, isLoading, isError: auditQueryFailed } = auditQuery
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: () => projects.list(),
  })
  const { data: projectsPayload, isError: projectsQueryFailed } = projectsQuery
  const paywallBlocked =
    isSubscriptionInactiveError(auditQuery.error) || isSubscriptionInactiveError(projectsQuery.error)
  const auditLoadFailed = !paywallBlocked && (auditQueryFailed || projectsQueryFailed)

  const projectsList = useMemo((): ProjectListItem[] => projectsPayload?.projects ?? [], [projectsPayload?.projects])
  const { projectMap, projectSlugMap } = useMemo(() => {
    const m: Record<string, string> = {}
    const s: Record<string, string> = {}
    projectsList.forEach((p) => {
      m[p.id] = p.name
      s[p.id] = p.slug
    })
    return { projectMap: m, projectSlugMap: s }
  }, [projectsList])

  const filtered = useMemo(() => {
    let list = (data?.logs || []) as AuditLog[]
    if (projectFilter) list = list.filter((l) => l.projectId === projectFilter)
    return list
  }, [data?.logs, projectFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const paginated = useMemo(
    () => filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [filtered, currentPage]
  )

  if (paywallBlocked) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Administration" title="Audit log" />
        <SubscriptionRenewalPanel />
      </div>
    )
  }

  if (auditLoadFailed) {
    const err = auditQuery.error ?? projectsQuery.error
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Administration" title="Audit log" />
        <Alert
          tone="error"
          title="Could not load audit log"
          onRetry={() => {
            void queryClient.invalidateQueries({ queryKey: ['audit'] })
            void queryClient.invalidateQueries({ queryKey: ['projects'] })
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
        eyebrow="Administration"
        title="Audit log"
        subtitle={
          <>
            {org?.name ? <p className="text-gray-700 font-medium">{org.name}</p> : null}
            <p className="text-gray-500">
              Compliance trail for uploads, mappings, matches, approvals, and report exports.
            </p>
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-4">
        <div className="w-full sm:w-64">
          <Select
            label="Project"
            value={projectFilter}
            onChange={(e) => {
              setProjectFilter(e.target.value)
              setPage(0)
            }}
            aria-label="Filter by project"
          >
            <option value="">All projects</option>
            {projectsList.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            setExporting(true)
            try {
              await audit.exportCsv({ projectId: projectFilter || undefined, limit: 500 })
            } catch (err) {
              unlessSubscriptionInactive(err, (e) =>
                toast.error('Export failed', e instanceof Error ? e.message : undefined)
              )
            } finally {
              setExporting(false)
            }
          }}
          isLoading={exporting}
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
        </div>
      </Card>

      <Card noPadding>
        {isLoading ? (
          <Table>
            <TableHead>
              <tr>
                <TableTh>Time</TableTh>
                <TableTh>Action</TableTh>
                <TableTh>Project</TableTh>
                <TableTh>Details</TableTh>
              </tr>
            </TableHead>
            <TableBody>
              {[1, 2, 3, 4, 5].map((i) => (
                <TableRowSkeleton key={i} cols={4} />
              ))}
            </TableBody>
          </Table>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileCheck className="w-6 h-6" />}
            title="No audit entries"
            description={projectFilter ? 'No entries for this project. Try another filter.' : 'Actions will appear here once you upload documents, map, match, or export reports.'}
            action={projectFilter ? <Button variant="outline" onClick={() => setProjectFilter('')}>Clear filter</Button> : undefined}
          />
        ) : (
          <>
            <Table>
              <TableHead>
                <tr>
                  <TableTh>Time</TableTh>
                  <TableTh>Action</TableTh>
                  <TableTh>Project</TableTh>
                  <TableTh>Details</TableTh>
                </tr>
              </TableHead>
              <TableBody>
                {paginated.map((l) => (
                  <TableRow key={l.id}>
                    <TableTd className="text-gray-500 whitespace-nowrap">{formatDate(l.createdAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableTd>
                    <TableTd className="font-medium text-gray-900">{l.actionLabel}</TableTd>
                    <TableTd>
                      {l.projectId && projectSlugMap[l.projectId] ? (
                        <Link
                          to={`/projects/${projectSlugMap[l.projectId]}`}
                          className="text-primary-600 hover:underline"
                        >
                          {projectMap[l.projectId] || l.projectId}
                        </Link>
                      ) : l.projectId ? projectMap[l.projectId] || l.projectId : '—'}
                    </TableTd>
                    <TableTd>
                      {l.details && Object.keys(l.details).length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(l.details).map(([k, v]) => (
                            <Badge key={k} tone="neutral" size="sm">
                              <span className="opacity-60">{k}:</span>
                              <span className="truncate max-w-[120px]">{String(v)}</span>
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableTd>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-border flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-gray-500">
                  Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600 px-2">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
