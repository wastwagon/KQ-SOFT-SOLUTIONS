import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight, Download, LogIn } from 'lucide-react'
import { api } from '../../lib/api'
import { usePlanDisplayNames } from '../../lib/usePlanDisplayNames'
import { useAuth } from '../../store/auth'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import ActionMenu from '../../components/ui/ActionMenu'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import PageHeader from '../../components/layout/PageHeader'
import AdminListToolbar from '../../components/layout/AdminListToolbar'
import PageLoadError from '../../components/ui/PageLoadError'
import Badge from '../../components/ui/Badge'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../../components/ui/Table'
import { PageBodySkeleton } from '../../components/ui/Skeleton'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'
import { SUPPORT_OPEN_ORG } from '../../lib/userFacingTerms'

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

function subscriptionTone(status: SubscriptionStatus): 'success' | 'brand' | 'warning' | 'neutral' {
  switch (status) {
    case 'active':
      return 'success'
    case 'trial':
      return 'brand'
    case 'expired':
      return 'warning'
    default:
      return 'neutral'
  }
}

export default function AdminSubscribers() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [enteringSlug, setEnteringSlug] = useState<string | null>(null)
  const { planLabel, plans: planCatalog } = usePlanDisplayNames()
  const confirm = useConfirm()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setAuth = useAuth((s) => s.setAuth)

  const { data, isLoading, isError, error, refetch } = useQuery({
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
      toast.success('Support mode opened', `Now viewing ${session.org.name}`)
      navigate('/dashboard')
    },
    onError: (e) => {
      toast.error('Could not open support mode', e instanceof Error ? e.message : 'Request failed')
    },
    onSettled: () => setEnteringSlug(null),
  })

  const handleEnterWorkspace = async (o: Org) => {
    const ok = await confirm({
      title: `${SUPPORT_OPEN_ORG} — “${o.name}”?`,
      description:
        'You will open this customer’s projects and Reconcile as a platform admin (support mode). An audit log entry is recorded. Sessions expire after 2 hours.',
      confirmLabel: SUPPORT_OPEN_ORG,
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

  if (isError) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Platform admin" title="Organizations" />
        <PageLoadError title="Could not load organizations" error={error} onRetry={() => void refetch()} />
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Platform admin" title="Organizations" />
        <PageBodySkeleton label="Loading organizations" />
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
            Customer organisations. Open <strong>Actions</strong> on a row to manage or open support mode.
          </p>
        }
      />

      <AdminListToolbar
        activeFilterCount={planFilter ? 1 : 0}
        drawerTitle="Organization filters"
        search={
          <Input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search by name…"
            leading={<Search className="w-4 h-4" />}
            aria-label="Search by name"
          />
        }
        filters={
          <div className="w-full md:w-48">
            <Select
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value)
                setPage(1)
              }}
              aria-label="Filter by plan"
            >
              <option value="">All plans</option>
              {planCatalog.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
              <option value="paid">Paid (excl. free/trial-only)</option>
            </Select>
          </div>
        }
        actions={
          <Button type="button" variant="outline" size="sm" onClick={handleExport} isLoading={exporting}>
            <Download className="w-4 h-4 mr-1.5" aria-hidden />
            Export CSV
          </Button>
        }
      />

      <Card noPadding>
        <Table compact>
          <TableHead>
            <tr>
              <TableTh>
                <input
                  type="checkbox"
                  checked={organizations.length > 0 && selectedIds.size === organizations.length}
                  onChange={toggleSelectAll}
                  className="rounded border-border"
                />
              </TableTh>
              <TableTh>Name</TableTh>
              <TableTh>Account</TableTh>
              <TableTh>Subscription</TableTh>
              <TableTh>Plan</TableTh>
              <TableTh className="text-right">Total paid</TableTh>
              <TableTh className="text-right">Members</TableTh>
              <TableTh className="text-right">Actions</TableTh>
            </tr>
          </TableHead>
          <TableBody>
            {organizations.map((o) => (
              <TableRow key={o.id}>
                <TableTd>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(o.id)}
                    onChange={() => toggleSelect(o.id)}
                    className="rounded border-border"
                  />
                </TableTd>
                <TableTd>
                  <Link
                    to={`/platform-admin/organizations/${o.slug}`}
                    className="font-medium text-primary-600 hover:underline"
                  >
                    {o.name}
                  </Link>
                </TableTd>
                <TableTd>
                  {o.suspendedAt ? (
                    <Badge tone="danger" size="sm" shape="soft">
                      Suspended
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="sm" shape="soft">
                      OK
                    </Badge>
                  )}
                </TableTd>
                <TableTd>
                  <Badge
                    tone={subscriptionTone(o.subscriptionStatus)}
                    size="sm"
                    shape="soft"
                    className="capitalize"
                  >
                    {o.subscriptionStatus}
                  </Badge>
                </TableTd>
                <TableTd>{planLabel(o.plan)}</TableTd>
                <TableTd className="text-right font-medium text-gray-900">{fmt(o.totalPaid)}</TableTd>
                <TableTd className="text-right">{o._count.members}</TableTd>
                <TableTd className="text-right">
                  <ActionMenu
                    label="Actions"
                    size="xs"
                    align="right"
                    menuAriaLabel={`Actions for ${o.name}`}
                    isLoading={enteringSlug === o.slug && impersonateMutation.isPending}
                    items={[
                      {
                        kind: 'link',
                        label: 'Manage organisation',
                        to: `/platform-admin/organizations/${o.slug}`,
                      },
                      {
                        kind: 'button',
                        label: SUPPORT_OPEN_ORG,
                        icon: LogIn,
                        onClick: () => handleEnterWorkspace(o),
                        disabled: impersonateMutation.isPending,
                      },
                    ]}
                  />
                </TableTd>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <p className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} organizations)
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
