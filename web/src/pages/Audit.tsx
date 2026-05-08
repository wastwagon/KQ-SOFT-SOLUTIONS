import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileCheck, Download } from 'lucide-react'
import { audit, projects } from '../lib/api'
import { formatDate } from '../lib/format'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import { TableRowSkeleton } from '../components/ui/Skeleton'

const PAGE_SIZE = 20

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
  const [projectFilter, setProjectFilter] = useState('')
  const [page, setPage] = useState(0)
  const [exporting, setExporting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['audit', { limit: 200 }],
    queryFn: () => audit.list({ limit: 200 }),
  })
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projects.list(),
  })

  const projectsList = useMemo(
    () => (projectsData as { id: string; name: string; slug: string }[]) || [],
    [projectsData]
  )
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Audit log</h1>
      <p className="text-sm text-gray-600 max-w-2xl">
        Actions logged for compliance: uploads, mappings, matches, and report exports.
      </p>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-700">Project</span>
          <select
            value={projectFilter}
            onChange={(e) => { setProjectFilter(e.target.value); setPage(0) }}
            className="w-full sm:w-auto sm:min-w-[200px] px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 text-gray-900 focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
          >
            <option value="">All projects</option>
            {projectsList.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          onClick={async () => {
            setExporting(true)
            try {
              await audit.exportCsv({ projectId: projectFilter || undefined, limit: 500 })
            } finally {
              setExporting(false)
            }
          }}
          disabled={exporting}
        >
          <Download className="w-4 h-4 mr-2" />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      <Card noPadding className="overflow-hidden rounded-xl border-l-4 border-l-primary-500 border-gray-200 shadow-sm">
        {isLoading ? (
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Project</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted bg-white">
              {[1, 2, 3, 4, 5].map((i) => (
                <TableRowSkeleton key={i} cols={4} />
              ))}
            </tbody>
          </table>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileCheck className="w-6 h-6" />}
            title="No audit entries"
            description={projectFilter ? 'No entries for this project. Try another filter.' : 'Actions will appear here once you upload documents, map, match, or export reports.'}
            action={projectFilter ? <Button variant="outline" onClick={() => setProjectFilter('')}>Clear filter</Button> : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted bg-white">
                {paginated.map((l) => (
                  <tr key={l.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{formatDate(l.createdAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-6 py-3 font-medium text-gray-900">{l.actionLabel}</td>
                    <td className="px-6 py-3 text-gray-600">
                      {l.projectId && projectSlugMap[l.projectId] ? (
                        <Link
                          to={`/projects/${projectSlugMap[l.projectId]}`}
                          className="text-primary-600 hover:underline"
                        >
                          {projectMap[l.projectId] || l.projectId}
                        </Link>
                      ) : l.projectId ? projectMap[l.projectId] || l.projectId : '—'}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {l.details && Object.keys(l.details).length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(l.details).map(([k, v]) => (
                            <span key={k} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                              <span className="opacity-60 mr-1">{k}:</span>
                              <span className="truncate max-w-[120px]">{String(v)}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
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
