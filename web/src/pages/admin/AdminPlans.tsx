import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { api } from '../../lib/api'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/ConfirmDialog'

export default function AdminPlans() {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<{ id: string; slug: string; name: string; projectsPerMonth: number; transactionsPerMonth: number; monthlyGhs: number; yearlyGhs: number } | null>(null)
  const [showNew, setShowNew] = useState(false)

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => api('/admin/plans') as Promise<
      { id: string; slug: string; name: string; projectsPerMonth: number; transactionsPerMonth: number; monthlyGhs: number; yearlyGhs: number; active: boolean }[]
    >,
  })

  const createMutation = useMutation({
    mutationFn: (body: { slug: string; name: string; projectsPerMonth: number; transactionsPerMonth: number; monthlyGhs: number; yearlyGhs: number }) =>
      api('/admin/plans', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] })
      setShowNew(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; slug?: string; name?: string; projectsPerMonth?: number; transactionsPerMonth?: number; monthlyGhs?: number; yearlyGhs?: number }) =>
      api(`/admin/plans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] })
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/plans/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] }),
  })

  if (isLoading) return <p className="text-gray-500">Loading plans...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plans</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage subscription tiers: limits and pricing.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          New plan
        </Button>
      </div>

      {showNew && (
        <Card className="mb-6 p-4">
          <h3 className="font-medium text-gray-900 mb-4">New plan</h3>
          <PlanForm
            onSubmit={(b) => createMutation.mutate(b)}
            onCancel={() => setShowNew(false)}
            loading={createMutation.isPending}
            error={createMutation.error?.message}
          />
        </Card>
      )}

      <Card noPadding>
        <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-surface">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Projects/mo</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tx/mo</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monthly (GHS)</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Yearly (GHS)</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {plans.map((p) =>
              editing?.id === p.id ? (
                <tr key={p.id} className="bg-surface">
                  <td colSpan={7} className="px-6 py-4">
                    <PlanForm
                      initial={p}
                      onSubmit={(b) => updateMutation.mutate({ id: p.id, ...b })}
                      onCancel={() => setEditing(null)}
                      loading={updateMutation.isPending}
                      error={updateMutation.error?.message}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="hover:bg-surface">
                  <td className="px-6 py-4 font-mono text-sm text-gray-900">{p.slug}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{p.name}</td>
                  <td className="px-6 py-4 text-right text-sm text-gray-600">
                    {p.projectsPerMonth < 0 ? 'Unlimited' : p.projectsPerMonth}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-600">
                    {p.transactionsPerMonth < 0 ? 'Unlimited' : p.transactionsPerMonth.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-600">{p.monthlyGhs}</td>
                  <td className="px-6 py-4 text-right text-sm text-gray-600">{p.yearlyGhs}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(p)}
                      className="text-primary-600 hover:underline mr-3"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Delete the "${p.name}" plan?`,
                          description: 'Existing subscribers on this plan will not be removed, but no new sign-ups will be able to choose it. You can re-create it later if needed.',
                          confirmLabel: 'Delete plan',
                          tone: 'danger',
                        })
                        if (ok) deleteMutation.mutate(p.id)
                      }}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  )
}

function PlanForm({
  initial,
  onSubmit,
  onCancel,
  loading,
  error,
}: {
  initial?: { slug: string; name: string; projectsPerMonth: number; transactionsPerMonth: number; monthlyGhs: number; yearlyGhs: number }
  onSubmit: (b: { slug: string; name: string; projectsPerMonth: number; transactionsPerMonth: number; monthlyGhs: number; yearlyGhs: number }) => void
  onCancel: () => void
  loading: boolean
  error?: string
}) {
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [projectsPerMonth, setProjectsPerMonth] = useState(String(initial?.projectsPerMonth ?? 5))
  const [transactionsPerMonth, setTransactionsPerMonth] = useState(String(initial?.transactionsPerMonth ?? 500))
  const [monthlyGhs, setMonthlyGhs] = useState(String(initial?.monthlyGhs ?? 0))
  const [yearlyGhs, setYearlyGhs] = useState(String(initial?.yearlyGhs ?? 0))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      slug: slug.trim().toLowerCase(),
      name: name.trim() || slug,
      projectsPerMonth: parseInt(projectsPerMonth, 10) || 0,
      transactionsPerMonth: parseInt(transactionsPerMonth, 10) || 0,
      monthlyGhs: parseFloat(monthlyGhs) || 0,
      yearlyGhs: parseFloat(yearlyGhs) || 0,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
          {initial ? (
            <input value={slug} readOnly className="w-full px-3 py-2 border border-border rounded-lg bg-gray-50 text-gray-600 font-mono" />
          ) : (
            <select
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-lg bg-white text-gray-900"
            >
              <option value="">Select plan tier</option>
              <option value="basic">basic</option>
              <option value="standard">standard</option>
              <option value="premium">premium</option>
              <option value="firm">firm</option>
            </select>
          )}
          <p className="text-xs text-gray-500 mt-0.5">Only standard tiers (basic, standard, premium, firm) are supported for feature gating.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-border rounded-lg bg-white text-gray-900"
            placeholder="Basic"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Projects/month</label>
          <input
            type="number"
            value={projectsPerMonth}
            onChange={(e) => setProjectsPerMonth(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-white text-gray-900"
            placeholder="-1 for unlimited"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Transactions/month</label>
          <input
            type="number"
            value={transactionsPerMonth}
            onChange={(e) => setTransactionsPerMonth(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-white text-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monthly (GHS)</label>
          <input
            type="number"
            step="0.01"
            value={monthlyGhs}
            onChange={(e) => setMonthlyGhs(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-white text-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Yearly (GHS)</label>
          <input
            type="number"
            step="0.01"
            value={yearlyGhs}
            onChange={(e) => setYearlyGhs(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-white text-gray-900"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}
