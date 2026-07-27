import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight, Download, LogIn } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../store/auth'
import Card from '../../components/ui/Card'
import PageHeader from '../../components/layout/PageHeader'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'

type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'free'

type Org = {
  id: string
  name: string
  slug: string
  plan: string
  suspendedAt: string | null
  subscriptionStatus: SubscriptionStatus
  createdAt: string
  lastPayment: { amount: number; createdAt: string; plan: string; period: string } | null
  totalPaid: number
  _count: { members: number; projects: number; clients: number }
}

function subscriptionBadgeClass(status: SubscriptionStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-700'
    case 'trial':
      return 'bg-blue-100 text-blue-700'
    case 'expired':
      return 'bg-amber-100 text-amber-800'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

export default function AdminSubscribers() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [enteringSlug, setEnteringSlug] = useState<string | null>(null)
  const confirm = useConfirm()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setAuth = useAuth((s) => s.setAuth)

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

  const impersonateMutation = useMutation({
    mutationFn: (slug: string) =>
      api(`/admin/organizations/${slug}/impersonate`, {
        method: 'POST',
        body: '{}',
      }) as Promise<{
        user: { id: string; email: string; name?: string }
        org: { id: string; name: string }
        role: string
        token: string
        isPlatformAdmin: boolean
        impersonating: boolean
      }>,
    onSuccess: (session) => {
      setAuth(session.user, session.org, session.token, session.role, session.isPlatformAdmin, true)
      queryClient.clear()
      toast.success('Entered workspace', `Now viewing ${session.org.name}`)
      navigate('/dashboard')
    },
    onError: (e) => {
      toast.error('Could not enter workspace', e instanceof Error ? e.message : 'Request failed')
    },
    onSettled: () => setEnteringSlug(null),
  })

  const handleEnterWorkspace = async (o: Org) => {
    const ok = await confirm({
      title: `Enter workspace “${o.name}”?`,
      description:
        'You will open this subscriber’s projects and Reconcile as a platform admin (support mode). An audit log entry is recorded. Sessions expire after 2 hours.',
      confirmLabel: 'Enter workspace',
    })
    if (!ok) return
    setEnteringSlug(o.slug)
    impersonateMutation.mutate(o.slug)
  }

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

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', minimumFractionDigits: 2 }).format(n)

  if (isLoading || !data) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Platform admin" title="Organizations" />
        <p className="text-gray-500 text-sm">Loading organizations…</p>
      </div>
    )
  }

  const { organizations, pagination } = data

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Organizations"
        subtitle={
          <p className="text-sm text-gray-600">
            Subscriber workspaces. Use <strong>Enter</strong> to open a workspace in support mode, or{' '}
            <strong>Manage</strong> for plan and billing controls.
          </p>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value)
                setPage(1)
              }}
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm text-gray-800"
              aria-label="Filter by plan"
            >
              <option value="">All plans</option>
              <option value="basic">Basic</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
              <option value="firm">Firm</option>
              <option value="paid">Paid (excl. free/trial-only)</option>
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Search by name…"
                className="pl-9 pr-3 py-2 rounded-xl border border-border text-sm w-56"
              />
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-surface disabled:opacity-60"
            >
              <Download className="w-4 h-4" aria-hidden />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        }
      />

      <Card noPadding className="overflow-hidden shadow-sm">
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subscription</th>
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
                    <Link
                      to={`/platform-admin/organizations/${o.slug}`}
                      className="font-medium text-primary-600 hover:underline"
                    >
                      {o.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    {o.suspendedAt ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                        Suspended
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">OK</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${subscriptionBadgeClass(o.subscriptionStatus)}`}
                    >
                      {o.subscriptionStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 capitalize">{o.plan}</td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">{fmt(o.totalPaid)}</td>
                  <td className="px-6 py-4 text-right text-sm text-gray-600">{o._count.members}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => handleEnterWorkspace(o)}
                        disabled={impersonateMutation.isPending}
                        title="Enter this subscriber workspace (support mode)"
                        className="inline-flex items-center gap-1 text-sm font-medium text-amber-800 hover:text-amber-950 disabled:opacity-60"
                      >
                        <LogIn className="w-3.5 h-3.5" aria-hidden />
                        {enteringSlug === o.slug && impersonateMutation.isPending ? 'Entering…' : 'Enter'}
                      </button>
                      <Link
                        to={`/platform-admin/organizations/${o.slug}`}
                        className="text-primary-600 hover:underline text-sm"
                      >
                        Manage
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <p className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} organizations)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
