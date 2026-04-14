import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Trash2, Building2, Ban } from 'lucide-react'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'

const ROLES = ['admin', 'reviewer', 'preparer', 'viewer', 'member'] as const

export default function AdminOrgDetail() {
  const { slug } = useParams<{ slug: string }>()
  const queryClient = useQueryClient()
  const [overridePlan, setOverridePlan] = useState('')
  const [newPlan, setNewPlan] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [trialEndsAt, setTrialEndsAt] = useState('')
  const [manualStatus, setManualStatus] = useState<'trial' | 'active' | 'expired' | 'free'>('active')
  const [trialReason, setTrialReason] = useState('')
  const [statusReason, setStatusReason] = useState('')
  const [clearTrialReason, setClearTrialReason] = useState('')
  const [clearStatusReason, setClearStatusReason] = useState('')

  const { data: org, isLoading } = useQuery({
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
      usage: { projectsUsed: number; projectsLimit: number; projectsUnlimited: boolean; transactionsUsed: number; transactionsLimit: number; transactionsUnlimited: boolean }
      totalPaid: number
      payments: { id: string; amount: number; currency: string; plan: string; period: string; reference: string | null; status: string; createdAt: string }[]
      subscription?: {
        status: 'trial' | 'active' | 'expired' | 'free'
        trialEndsAt: string | null
        currentPeriodStart: string | null
        currentPeriodEnd: string | null
        latestPaymentAt: string | null
        latestPaymentPeriod: 'monthly' | 'yearly' | null
        latestPaymentAmount: number | null
      }
    }>,
    enabled: !!slug,
  })

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

  if (!slug || isLoading || !org) {
    return (
      <div>
        <Link to="/platform-admin/organizations" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Organizations
        </Link>
        <p className="text-gray-500">{isLoading ? 'Loading...' : 'Organization not found'}</p>
      </div>
    )
  }

  const fmt = (n: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', minimumFractionDigits: 2 }).format(n)
  const suspended = org.suspendedAt != null

  return (
    <div>
      <Link to="/platform-admin/organizations" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Organizations
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          {editingName ? (
            <div className="flex flex-col gap-2">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg bg-white text-gray-900 text-lg font-bold w-64 focus:ring-2 focus:ring-primary-500"
                placeholder="Name"
              />
              <input
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg bg-white text-gray-900 font-mono text-sm w-64 focus:ring-2 focus:ring-primary-500"
                placeholder="slug"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => updateOrgMutation.mutate({ name: editName, slug: editSlug })}
                  disabled={updateOrgMutation.isPending || !editName.trim() || !editSlug.trim()}
                >
                  {updateOrgMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditingName(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
              <p className="text-sm text-gray-500 font-mono">{org.slug}</p>
              <button
                type="button"
                onClick={() => { setEditingName(true); setEditName(org.name); setEditSlug(org.slug) }}
                className="mt-2 inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
              >
                <Pencil className="w-4 h-4" />
                Edit name & slug
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {suspended && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
              Suspended
            </span>
          )}
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800 capitalize">
            {org.plan}
          </span>
          {suspended ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => suspendOrgMutation.mutate(null)}
              disabled={suspendOrgMutation.isPending}
            >
              <Building2 className="w-4 h-4 mr-1" />
              {suspendOrgMutation.isPending ? 'Restoring...' : 'Restore org'}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => suspendOrgMutation.mutate(new Date().toISOString())}
              disabled={suspendOrgMutation.isPending}
              className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
            >
              <Ban className="w-4 h-4 mr-1" />
              {suspendOrgMutation.isPending ? 'Suspending...' : 'Suspend org'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-4">
          <p className="text-sm text-gray-500 font-medium">Usage</p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            {org.usage.projectsUnlimited
              ? `${org.usage.projectsUsed} projects (unlimited)`
              : `${org.usage.projectsUsed} / ${org.usage.projectsLimit} projects`}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            {org.usage.transactionsUnlimited
              ? `${org.usage.transactionsUsed} tx (unlimited)`
              : `${org.usage.transactionsUsed} / ${org.usage.transactionsLimit} tx`}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500 font-medium">Total paid</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{fmt(org.totalPaid)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500 font-medium">Joined</p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            {formatDate(org.createdAt)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500 font-medium">Subscription</p>
          <p className="text-lg font-bold text-gray-900 mt-1 capitalize">{org.subscription?.status || '—'}</p>
          {org.subscription?.currentPeriodEnd && (
            <p className="text-xs text-gray-500 mt-1">Period ends: {formatDate(org.subscription.currentPeriodEnd, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Change plan</h3>
          <div className="flex gap-3 flex-wrap">
            <select
              value={overridePlan || newPlan || org.plan}
              onChange={(e) => { setOverridePlan(e.target.value); setNewPlan(e.target.value) }}
              className="px-3 py-2 border border-border rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500"
            >
              {plans.map((p) => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>
            <Button
              onClick={() => {
                const plan = overridePlan || newPlan || org.plan
                if (plan !== org.plan) updateMutation.mutate(plan)
              }}
              disabled={updateMutation.isPending || (overridePlan || newPlan || org.plan) === org.plan}
            >
              {updateMutation.isPending ? 'Saving...' : 'Update plan'}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Downgrade to basic = cancel paid subscription. Org keeps access with basic limits.
          </p>
        </Card>

        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Members</h3>
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
                  <select
                    value={m.role}
                    onChange={(e) => updateRoleMutation.mutate({ userId: m.user.id, role: e.target.value })}
                    disabled={updateRoleMutation.isPending}
                    className="px-2 py-1 border border-border rounded bg-white text-gray-900 text-xs capitalize focus:ring-2 focus:ring-primary-500"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  {org.members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMemberMutation.mutate(m.user.id)}
                      disabled={removeMemberMutation.isPending}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      title="Remove member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <h3 className="font-semibold text-gray-900 mb-4">Subscription controls (admin)</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-800">Set trial end</p>
            <input
              type="datetime-local"
              value={trialEndsAt}
              onChange={(e) => setTrialEndsAt(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-white text-gray-900 text-sm w-full"
            />
            <input
              type="text"
              value={trialReason}
              onChange={(e) => setTrialReason(e.target.value)}
              placeholder="Reason (required)"
              className="px-3 py-2 border border-border rounded-lg bg-white text-gray-900 text-sm w-full"
            />
            <Button
              size="sm"
              onClick={() => {
                if (!trialEndsAt || trialReason.trim().length < 3) return
                if (!window.confirm('Confirm trial end override update?')) return
                setTrialMutation.mutate({ trialEndsAt: new Date(trialEndsAt).toISOString(), reason: trialReason.trim() })
              }}
              disabled={setTrialMutation.isPending}
            >
              {setTrialMutation.isPending ? 'Updating...' : 'Update trial end'}
            </Button>
            <input
              type="text"
              value={clearTrialReason}
              onChange={(e) => setClearTrialReason(e.target.value)}
              placeholder="Reason to clear trial override"
              className="px-3 py-2 border border-border rounded-lg bg-white text-gray-900 text-sm w-full"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (clearTrialReason.trim().length < 3) return
                if (!window.confirm('Clear trial override and restore computed trial window?')) return
                clearTrialMutation.mutate({ reason: clearTrialReason.trim() })
              }}
              disabled={clearTrialMutation.isPending}
            >
              {clearTrialMutation.isPending ? 'Clearing...' : 'Clear trial override'}
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-800">Override subscription status</p>
            <select
              value={manualStatus}
              onChange={(e) => setManualStatus(e.target.value as 'trial' | 'active' | 'expired' | 'free')}
              className="px-3 py-2 border border-border rounded-lg bg-white text-gray-900 text-sm w-full"
            >
              <option value="trial">trial</option>
              <option value="active">active</option>
              <option value="expired">expired</option>
              <option value="free">free</option>
            </select>
            <input
              type="text"
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="Reason (required)"
              className="px-3 py-2 border border-border rounded-lg bg-white text-gray-900 text-sm w-full"
            />
            <Button
              size="sm"
              onClick={() => {
                if (statusReason.trim().length < 3) return
                if (!window.confirm(`Set subscription status override to "${manualStatus}"?`)) return
                setStatusMutation.mutate({ status: manualStatus, reason: statusReason.trim() })
              }}
              disabled={setStatusMutation.isPending}
            >
              {setStatusMutation.isPending ? 'Updating...' : 'Apply status override'}
            </Button>
            <input
              type="text"
              value={clearStatusReason}
              onChange={(e) => setClearStatusReason(e.target.value)}
              placeholder="Reason to clear status override"
              className="px-3 py-2 border border-border rounded-lg bg-white text-gray-900 text-sm w-full"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (clearStatusReason.trim().length < 3) return
                if (!window.confirm('Clear status override and restore computed status?')) return
                clearStatusMutation.mutate({ reason: clearStatusReason.trim() })
              }}
              disabled={clearStatusMutation.isPending}
            >
              {clearStatusMutation.isPending ? 'Clearing...' : 'Clear status override'}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <h3 className="font-semibold text-gray-900 mb-4">Payment history</h3>
        {org.payments.length === 0 ? (
          <p className="text-sm text-gray-500">No payments yet</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left py-2 text-gray-500 font-medium">Date</th>
                <th className="text-left py-2 text-gray-500 font-medium">Plan</th>
                <th className="text-left py-2 text-gray-500 font-medium">Period</th>
                <th className="text-right py-2 text-gray-500 font-medium">Amount</th>
                <th className="text-left py-2 text-gray-500 font-medium">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted">
              {org.payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 text-gray-900">
                    {formatDate(p.createdAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2 text-gray-600 capitalize">{p.plan}</td>
                  <td className="py-2 text-gray-600">{p.period}</td>
                  <td className="py-2 text-right font-medium text-gray-900">
                    {fmt(Number(p.amount))}
                  </td>
                  <td className="py-2 text-gray-500 font-mono text-xs">{p.reference || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>
    </div>
  )
}
