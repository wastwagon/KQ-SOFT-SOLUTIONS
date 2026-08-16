import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Trash2, Building2, Ban, BadgeCheck, LogIn } from 'lucide-react'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import PageHeader from '../../components/layout/PageHeader'
import { useAuth } from '../../store/auth'
import { useToast } from '../../components/ui/Toast'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import MetricCard from '../../components/ui/MetricCard'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../../components/ui/Table'
import { PageBodySkeleton } from '../../components/ui/Skeleton'
import { useNavigate } from 'react-router-dom'

const ROLES = ['admin', 'reviewer', 'preparer', 'viewer'] as const
const COMPLIMENTARY_ACCESS_REASON = 'Complimentary platform admin access'

export default function AdminOrgDetail() {
  const { slug } = useParams<{ slug: string }>()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const toast = useToast()
  const navigate = useNavigate()
  const setAuth = useAuth((s) => s.setAuth)
  const [overridePlan, setOverridePlan] = useState('')
  const [newPlan, setNewPlan] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [trialEndsAt, setTrialEndsAt] = useState('')
  const [manualStatus, setManualStatus] = useState<'trial' | 'active' | 'expired' | 'free'>('trial')
  const [trialReason, setTrialReason] = useState('')
  const [statusReason, setStatusReason] = useState('')
  const [clearTrialReason, setClearTrialReason] = useState('')
  const [clearStatusReason, setClearStatusReason] = useState('')

  const { data: org, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'organization', slug],
    queryFn: () => api(`/admin/organizations/${slug}`) as Promise<{
      id: string
      name: string
      slug: string
      plan: string
      suspendedAt: string | null
      createdAt: string
      members: { user: { id: string; email: string; name: string | null }; role: string }[]
      _count: { projects: number; clients: number }
      usage: {
        projectsUsed: number
        projectsLimit: number
        projectsUnlimited: boolean
        transactionsUsed: number
        transactionsLimit: number
        transactionsUnlimited: boolean
        bankAccountsUsed?: number
        bankAccountsLimit?: number
        bankAccountsUnlimited?: boolean
        cleanExportsUsed?: number
        cleanExportsLimit?: number
        cleanExportsUnlimited?: boolean
      }
      totalPaid: number
      payments: { id: string; amount: number; currency: string; plan: string; period: string; reference: string | null; status: string; createdAt: string }[]
      subscription?: {
        status: 'trial' | 'active' | 'expired' | 'free'
        trialEndsAt: string | null
        currentPeriodStart: string | null
        currentPeriodEnd: string | null
        latestPaymentAt: string | null
        latestPaymentPeriod: 'monthly' | 'quarterly' | 'yearly' | null
        latestPaymentAmount: number | null
      }
      subscriptionMeta?: {
        computedStatus: 'trial' | 'active' | 'expired' | 'free'
        statusOverride: 'trial' | 'active' | 'expired' | 'free' | null
        statusOverrideReason: string | null
        trialOverrideEndsAt: string | null
        trialOverrideReason: string | null
      }
    }>,
    enabled: !!slug,
  })

  useEffect(() => {
    if (!org) return
    const effective = org.subscription?.status
    if (effective) setManualStatus(effective)
    if (org.subscriptionMeta?.trialOverrideEndsAt) {
      const d = new Date(org.subscriptionMeta.trialOverrideEndsAt)
      if (!Number.isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0')
        setTrialEndsAt(
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
        )
      }
    }
  }, [org?.id, org?.subscription?.status, org?.subscriptionMeta?.trialOverrideEndsAt])

  const { data: plans = [] } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => api('/admin/plans') as Promise<{ slug: string; name: string }[]>,
    enabled: !!org,
  })

  const updateMutation = useMutation({
    mutationFn: (plan: string) =>
      api(`/admin/organizations/${slug}`, { method: 'PATCH', body: JSON.stringify({ plan }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organization', slug] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscribers'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] })
      setOverridePlan('')
    },
  })

  const updateOrgMutation = useMutation({
    mutationFn: (data: { name?: string; slug?: string }) =>
      api(`/admin/organizations/${slug}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organization', slug] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscribers'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] })
      setEditingName(false)
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api(`/admin/organizations/${slug}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organization', slug] })
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      api(`/admin/organizations/${slug}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organization', slug] })
    },
  })

  const suspendOrgMutation = useMutation({
    mutationFn: (suspendedAt: string | null) =>
      api(`/admin/organizations/${slug}`, {
        method: 'PATCH',
        body: JSON.stringify({ suspendedAt }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organization', slug] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscribers'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] })
    },
  })

  const setTrialMutation = useMutation({
    mutationFn: (payload: { trialEndsAt: string; reason: string }) =>
      api(`/admin/organizations/${slug}/subscription/trial`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organization', slug] })
      setTrialReason('')
    },
  })

  const setStatusMutation = useMutation({
    mutationFn: (payload: { status: 'trial' | 'active' | 'expired' | 'free'; reason: string }) =>
      api(`/admin/organizations/${slug}/subscription/status`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organization', slug] })
      setStatusReason('')
    },
  })

  const clearTrialMutation = useMutation({
    mutationFn: (payload: { reason: string }) =>
      api(`/admin/organizations/${slug}/subscription/trial`, {
        method: 'DELETE',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organization', slug] })
      setClearTrialReason('')
    },
  })

  const clearStatusMutation = useMutation({
    mutationFn: (payload: { reason: string }) =>
      api(`/admin/organizations/${slug}/subscription/status`, {
        method: 'DELETE',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organization', slug] })
      setClearStatusReason('')
    },
  })

  const grantComplimentaryMutation = useMutation({
    mutationFn: async (current: { plan: string }) => {
      if (current.plan !== 'premium') {
        await api(`/admin/organizations/${slug}`, {
          method: 'PATCH',
          body: JSON.stringify({ plan: 'premium' }),
        })
      }
      await api(`/admin/organizations/${slug}/subscription/status`, {
        method: 'POST',
        body: JSON.stringify({ status: 'active', reason: COMPLIMENTARY_ACCESS_REASON }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organization', slug] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscribers'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] })
    },
  })

  const impersonateMutation = useMutation({
    mutationFn: () =>
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
    onSuccess: (data) => {
      setAuth(data.user, data.org, data.token, data.role, data.isPlatformAdmin, true)
      queryClient.clear()
      toast.success('Entered workspace', `Now viewing ${data.org.name}`)
      navigate('/dashboard')
    },
    onError: (e) => {
      toast.error('Could not enter workspace', e instanceof Error ? e.message : 'Request failed')
    },
  })

  if (!slug) {
    return (
      <div className="space-y-6">
        <Link
          to="/platform-admin/organizations"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Organizations
        </Link>
        <p className="text-gray-500 text-sm">Missing organization identifier.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Link
          to="/platform-admin/organizations"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Organizations
        </Link>
        <PageHeader eyebrow="Platform admin" title="Organization" />
        <PageBodySkeleton label="Loading organization" />
      </div>
    )
  }

  if (isError || !org) {
    return (
      <div className="space-y-8">
        <Link
          to="/platform-admin/organizations"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Organizations
        </Link>
        <PageHeader eyebrow="Platform admin" title="Organization" />
        <Alert
          tone="error"
          title={isError ? 'Could not load organization' : 'Organization not found'}
          onRetry={isError ? () => void refetch() : undefined}
        >
          {isError
            ? error instanceof Error
              ? error.message
              : 'Something went wrong.'
            : 'Check the URL or return to the organizations list.'}
        </Alert>
      </div>
    )
  }

  const fmt = (n: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', minimumFractionDigits: 2 }).format(n)
  const suspended = org.suspendedAt != null
  const hasComplimentaryAccess =
    org.plan === 'premium' && org.subscription?.status === 'active'

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {suspended && <Badge tone="danger">Suspended</Badge>}
      <Badge tone="brand" className="capitalize">
        {org.plan}
      </Badge>
      <Button
        variant="primary"
        size="sm"
        isLoading={impersonateMutation.isPending}
        onClick={async () => {
          const ok = await confirm({
            title: `Enter workspace “${org.name}”?`,
            description:
              'You will open this subscriber’s projects and Reconcile as a platform admin (support mode). An audit log entry is recorded. Sessions expire after 2 hours.',
            confirmLabel: 'Enter workspace',
          })
          if (ok) impersonateMutation.mutate()
        }}
      >
        <LogIn className="w-4 h-4 mr-1" />
        Enter workspace
      </Button>
      {suspended ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => suspendOrgMutation.mutate(null)}
          isLoading={suspendOrgMutation.isPending}
        >
          <Building2 className="w-4 h-4 mr-1" />
          Restore org
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => suspendOrgMutation.mutate(new Date().toISOString())}
          isLoading={suspendOrgMutation.isPending}
          className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
        >
          <Ban className="w-4 h-4 mr-1" />
          Suspend org
        </Button>
      )}
    </div>
  )

  return (
    <div className="space-y-8">
      <Link
        to="/platform-admin/organizations"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Organizations
      </Link>

      <PageHeader
        eyebrow="Platform admin"
        title={editingName ? 'Rename organization' : org.name}
        subtitle={
          editingName ? (
            <div className="space-y-3 max-w-xl">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Organization name"
                aria-label="Organization name"
                className="max-w-md font-semibold"
              />
              <Input
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
                placeholder="url-slug"
                aria-label="URL slug"
                className="max-w-md font-mono"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => updateOrgMutation.mutate({ name: editName, slug: editSlug })}
                  disabled={!editName.trim() || !editSlug.trim()}
                  isLoading={updateOrgMutation.isPending}
                >
                  Save
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditingName(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="font-mono text-sm text-gray-700">{org.slug}</p>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => {
                  setEditingName(true)
                  setEditName(org.name)
                  setEditSlug(org.slug)
                }}
                className="mt-2 text-primary-600 hover:text-primary-700"
              >
                <Pencil className="w-4 h-4 mr-1.5" aria-hidden />
                Edit name & slug
              </Button>
            </>
          )
        }
        actions={headerActions}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard
          label="Usage"
          value={
            org.usage.projectsUnlimited
              ? `${org.usage.projectsUsed} projects`
              : `${org.usage.projectsUsed} / ${org.usage.projectsLimit}`
          }
          sublabel={
            <>
              <p>
                {org.usage.transactionsUnlimited
                  ? `${org.usage.transactionsUsed} tx (unlimited)`
                  : `${org.usage.transactionsUsed} / ${org.usage.transactionsLimit} tx`}
              </p>
              <p>
                {org.usage.bankAccountsUnlimited
                  ? `${org.usage.bankAccountsUsed ?? 0} banks (unlimited)`
                  : `${org.usage.bankAccountsUsed ?? 0} / ${org.usage.bankAccountsLimit ?? '—'} banks`}
              </p>
              <p>
                {org.usage.cleanExportsUnlimited
                  ? `${org.usage.cleanExportsUsed ?? 0} full cleans (unlimited)`
                  : `${org.usage.cleanExportsUsed ?? 0} / ${org.usage.cleanExportsLimit ?? '—'} full cleans`}
              </p>
            </>
          }
        />
        <MetricCard label="Total paid" value={fmt(org.totalPaid)} />
        <MetricCard label="Joined" value={formatDate(org.createdAt)} />
        <MetricCard
          label="Subscription"
          value={<span className="capitalize">{org.subscription?.status || '—'}</span>}
          sublabel={
            <>
              {org.subscriptionMeta?.statusOverride && (
                <Badge tone="warning" size="sm">
                  Status override
                  {org.subscriptionMeta.computedStatus !== org.subscription?.status
                    ? ` (computed: ${org.subscriptionMeta.computedStatus})`
                    : ''}
                </Badge>
              )}
              {org.subscriptionMeta?.trialOverrideEndsAt && (
                <Badge tone="warning" size="sm">
                  Trial end override:{' '}
                  {formatDate(org.subscriptionMeta.trialOverrideEndsAt, {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Badge>
              )}
              {org.subscription?.trialEndsAt && !org.subscriptionMeta?.statusOverride && (
                <p>
                  Trial ends:{' '}
                  {formatDate(org.subscription.trialEndsAt, {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
              {org.subscription?.currentPeriodEnd && (
                <p>
                  Period ends:{' '}
                  {formatDate(org.subscription.currentPeriodEnd, {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Change plan">
          <div className="flex gap-3 flex-wrap items-end">
            <div className="w-48">
              <Select
                aria-label="Plan"
                value={overridePlan || newPlan || org.plan}
                onChange={(e) => { setOverridePlan(e.target.value); setNewPlan(e.target.value) }}
              >
                {plans.map((p) => (
                  <option key={p.slug} value={p.slug}>{p.name}</option>
                ))}
              </Select>
            </div>
            <Button
              onClick={() => {
                const plan = overridePlan || newPlan || org.plan
                if (plan !== org.plan) updateMutation.mutate(plan)
              }}
              disabled={(overridePlan || newPlan || org.plan) === org.plan}
              isLoading={updateMutation.isPending}
            >
              Update plan
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Downgrade to basic = cancel paid subscription. Org keeps access with basic limits.
          </p>
        </Card>

        <Card title="Members">
          <ul className="space-y-3">
            {org.members.map((m) => (
              <li key={m.user.id} className="flex justify-between items-center gap-4 text-sm">
                <Link
                  to={`/platform-admin/users/${m.user.id}`}
                  className="text-primary-600 hover:underline truncate"
                >
                  {m.user.email}
                </Link>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-32">
                    <Select
                      aria-label={`Role for ${m.user.email}`}
                      value={m.role === 'member' ? 'preparer' : m.role}
                      onChange={(e) => updateRoleMutation.mutate({ userId: m.user.id, role: e.target.value })}
                      disabled={updateRoleMutation.isPending}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </Select>
                  </div>
                  {org.members.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => removeMemberMutation.mutate(m.user.id)}
                      disabled={removeMemberMutation.isPending}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Remove member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Alert
        tone={hasComplimentaryAccess ? 'success' : 'info'}
        title="Complimentary access"
        action={
          hasComplimentaryAccess ? undefined : (
            <Button
              className="shrink-0"
              onClick={async () => {
                const planChange = org.plan !== 'premium' ? ` Plan will change from ${org.plan} to premium.` : ''
                const ok = await confirm({
                  title: 'Grant complimentary access?',
                  description: `Subscription will be set to active without payment.${planChange} Reason: "${COMPLIMENTARY_ACCESS_REASON}".`,
                  confirmLabel: 'Grant access',
                  tone: 'warning',
                })
                if (!ok) return
                grantComplimentaryMutation.mutate({ plan: org.plan })
              }}
              disabled={suspended}
              isLoading={grantComplimentaryMutation.isPending}
            >
              <BadgeCheck className="w-4 h-4 mr-1.5" aria-hidden />
              Grant complimentary access
            </Button>
          )
        }
      >
        One-click setup for internal or partner orgs: sets plan to <strong>Premium</strong> and subscription
        status to <strong>Active</strong> without payment. Removes inactive banners in the app immediately.
        {hasComplimentaryAccess ? (
          <p className="mt-1">This org already has Premium plan and Active subscription.</p>
        ) : null}
      </Alert>

      <Card title="Subscription controls (admin)">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-800">Set trial end</p>
            <Input
              type="datetime-local"
              value={trialEndsAt}
              onChange={(e) => setTrialEndsAt(e.target.value)}
              aria-label="Trial end"
            />
            <Input
              type="text"
              value={trialReason}
              onChange={(e) => setTrialReason(e.target.value)}
              placeholder="Reason (required)"
            />
            <Button
              size="sm"
              onClick={async () => {
                if (!trialEndsAt || trialReason.trim().length < 3) return
                const ok = await confirm({
                  title: 'Update trial end override?',
                  description: `Trial will end on ${new Date(trialEndsAt).toLocaleDateString()}. Reason: "${trialReason.trim()}".`,
                  confirmLabel: 'Update trial end',
                  tone: 'warning',
                })
                if (!ok) return
                setTrialMutation.mutate({ trialEndsAt: new Date(trialEndsAt).toISOString(), reason: trialReason.trim() })
              }}
              disabled={!trialEndsAt || trialReason.trim().length < 3}
              isLoading={setTrialMutation.isPending}
            >
              Update trial end
            </Button>
            <Input
              type="text"
              value={clearTrialReason}
              onChange={(e) => setClearTrialReason(e.target.value)}
              placeholder="Reason to clear trial override"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (clearTrialReason.trim().length < 3) return
                const ok = await confirm({
                  title: 'Clear trial override?',
                  description: 'The computed trial window will be restored. This action will be audit-logged.',
                  confirmLabel: 'Clear override',
                  tone: 'warning',
                })
                if (!ok) return
                clearTrialMutation.mutate({ reason: clearTrialReason.trim() })
              }}
              disabled={clearTrialReason.trim().length < 3}
              isLoading={clearTrialMutation.isPending}
            >
              Clear trial override
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-800">Override subscription status</p>
            {org.subscriptionMeta?.statusOverride ? (
              <Alert tone="warning" title="Override applied">
                <span className="capitalize">{org.subscriptionMeta.statusOverride}</span>
                {org.subscriptionMeta.statusOverrideReason && (
                  <> — {org.subscriptionMeta.statusOverrideReason}</>
                )}
              </Alert>
            ) : (
              <p className="text-xs text-gray-500">
                Effective status is computed from payments and trial window. Select a value below and apply to override.
              </p>
            )}
            <Select
              aria-label="Subscription status"
              value={manualStatus}
              onChange={(e) => setManualStatus(e.target.value as 'trial' | 'active' | 'expired' | 'free')}
            >
              <option value="trial">trial</option>
              <option value="active">active</option>
              <option value="expired">expired</option>
              <option value="free">free</option>
            </Select>
            <Input
              type="text"
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="Reason (required)"
            />
            <Button
              size="sm"
              onClick={async () => {
                if (statusReason.trim().length < 3) return
                const ok = await confirm({
                  title: 'Apply status override?',
                  description: `Subscription status will be set to "${manualStatus}". Reason: "${statusReason.trim()}".`,
                  confirmLabel: 'Apply override',
                  tone: 'warning',
                })
                if (!ok) return
                setStatusMutation.mutate({ status: manualStatus, reason: statusReason.trim() })
              }}
              disabled={statusReason.trim().length < 3}
              isLoading={setStatusMutation.isPending}
            >
              Apply status override
            </Button>
            <Input
              type="text"
              value={clearStatusReason}
              onChange={(e) => setClearStatusReason(e.target.value)}
              placeholder="Reason to clear status override"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (clearStatusReason.trim().length < 3) return
                const ok = await confirm({
                  title: 'Clear status override?',
                  description: 'The computed subscription status will be restored.',
                  confirmLabel: 'Clear override',
                  tone: 'warning',
                })
                if (!ok) return
                clearStatusMutation.mutate({ reason: clearStatusReason.trim() })
              }}
              disabled={clearStatusReason.trim().length < 3}
              isLoading={clearStatusMutation.isPending}
            >
              Clear status override
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Payment history" noPadding={org.payments.length > 0}>
        {org.payments.length === 0 ? (
          <p className="text-sm text-gray-500">No payments yet</p>
        ) : (
          <Table>
            <TableHead>
              <tr>
                <TableTh>Date</TableTh>
                <TableTh>Plan</TableTh>
                <TableTh>Period</TableTh>
                <TableTh className="text-right">Amount</TableTh>
                <TableTh>Reference</TableTh>
              </tr>
            </TableHead>
            <TableBody>
              {org.payments.map((p) => (
                <TableRow key={p.id}>
                  <TableTd>
                    {formatDate(p.createdAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </TableTd>
                  <TableTd className="capitalize">{p.plan}</TableTd>
                  <TableTd>{p.period}</TableTd>
                  <TableTd className="text-right font-medium text-gray-900">
                    {fmt(Number(p.amount))}
                  </TableTd>
                  <TableTd className="font-mono text-xs text-gray-500">{p.reference || '—'}</TableTd>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
