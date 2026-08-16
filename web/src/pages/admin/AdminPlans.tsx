import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { api } from '../../lib/api'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Alert from '../../components/ui/Alert'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../../components/ui/Table'
import { PageBodySkeleton } from '../../components/ui/Skeleton'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import PageHeader from '../../components/layout/PageHeader'

export default function AdminPlans() {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<{ id: string; slug: string; name: string; projectsPerMonth: number; transactionsPerMonth: number; monthlyGhs: number; yearlyGhs: number } | null>(null)
  const [showNew, setShowNew] = useState(false)

  const { data: plans = [], isLoading, isError, error, refetch } = useQuery({
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

  if (isError) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Platform admin"
          title="Plans"
          subtitle={<p className="text-gray-500">Manage subscription tiers: limits and pricing.</p>}
        />
        <Alert tone="error" title="Could not load plans" onRetry={() => void refetch()}>
          {error instanceof Error ? error.message : 'Something went wrong.'}
        </Alert>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Platform admin"
          title="Plans"
          subtitle={<p className="text-gray-500">Manage subscription tiers: limits and pricing.</p>}
        />
        <PageBodySkeleton label="Loading plans" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Plans"
        subtitle={<p className="text-gray-500">Manage subscription tiers: limits and pricing.</p>}
        actions={
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            New plan
          </Button>
        }
      />

      {showNew && (
        <Card title="New plan" className="mb-6">
          <PlanForm
            onSubmit={(b) => createMutation.mutate(b)}
            onCancel={() => setShowNew(false)}
            loading={createMutation.isPending}
            error={createMutation.error?.message}
          />
        </Card>
      )}

      <Card noPadding>
        <Table>
          <TableHead>
            <tr>
              <TableTh>Slug</TableTh>
              <TableTh>Name</TableTh>
              <TableTh className="text-right">Projects/mo</TableTh>
              <TableTh className="text-right">Tx/mo</TableTh>
              <TableTh className="text-right">Monthly (GHS)</TableTh>
              <TableTh className="text-right">Yearly (GHS)</TableTh>
              <TableTh className="text-right">Actions</TableTh>
            </tr>
          </TableHead>
          <TableBody>
            {plans.map((p) =>
              editing?.id === p.id ? (
                <TableRow key={p.id} className="bg-surface">
                  <TableTd colSpan={7}>
                    <PlanForm
                      initial={p}
                      onSubmit={(b) => updateMutation.mutate({ id: p.id, ...b })}
                      onCancel={() => setEditing(null)}
                      loading={updateMutation.isPending}
                      error={updateMutation.error?.message}
                    />
                  </TableTd>
                </TableRow>
              ) : (
                <TableRow key={p.id}>
                  <TableTd className="font-mono text-gray-900">{p.slug}</TableTd>
                  <TableTd className="text-gray-900">{p.name}</TableTd>
                  <TableTd className="text-right">
                    {p.projectsPerMonth < 0 ? 'Unlimited' : p.projectsPerMonth}
                  </TableTd>
                  <TableTd className="text-right">
                    {p.transactionsPerMonth < 0 ? 'Unlimited' : p.transactionsPerMonth.toLocaleString()}
                  </TableTd>
                  <TableTd className="text-right">{p.monthlyGhs}</TableTd>
                  <TableTd className="text-right">{p.yearlyGhs}</TableTd>
                  <TableTd className="text-right">
                    <Button type="button" variant="ghost" size="xs" onClick={() => setEditing(p)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Delete the "${p.name}" plan?`,
                          description: 'Existing subscribers on this plan will not be removed, but no new sign-ups will be able to choose it. You can re-create it later if needed.',
                          confirmLabel: 'Delete plan',
                          tone: 'danger',
                        })
                        if (ok) deleteMutation.mutate(p.id)
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </Button>
                  </TableTd>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
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
  const [projectsPerMonth, setProjectsPerMonth] = useState(String(initial?.projectsPerMonth ?? 10))
  const [transactionsPerMonth, setTransactionsPerMonth] = useState(String(initial?.transactionsPerMonth ?? 1000))
  const [monthlyGhs, setMonthlyGhs] = useState(String(initial?.monthlyGhs ?? 300))
  const [yearlyGhs, setYearlyGhs] = useState(String(initial?.yearlyGhs ?? 3000))

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
      {error && (
        <Alert tone="error" title="Could not save plan">
          {error}
        </Alert>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {initial ? (
          <Input label="Slug" value={slug} readOnly hint="Only standard tiers (basic, standard, premium, firm) are supported for feature gating." className="font-mono" />
        ) : (
          <Select
            label="Slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            hint="Only standard tiers (basic, standard, premium, firm) are supported for feature gating."
          >
            <option value="">Select plan tier</option>
            <option value="basic">basic</option>
            <option value="standard">standard</option>
            <option value="premium">premium</option>
            <option value="firm">firm</option>
          </Select>
        )}
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Basic"
        />
        <Input
          type="number"
          label="Projects/month"
          value={projectsPerMonth}
          onChange={(e) => setProjectsPerMonth(e.target.value)}
          placeholder="-1 for unlimited"
        />
        <Input
          type="number"
          label="Transactions/month"
          value={transactionsPerMonth}
          onChange={(e) => setTransactionsPerMonth(e.target.value)}
        />
        <Input
          type="number"
          step="0.01"
          label="Monthly (GHS)"
          value={monthlyGhs}
          onChange={(e) => setMonthlyGhs(e.target.value)}
        />
        <Input
          type="number"
          step="0.01"
          label="Yearly (GHS)"
          value={yearlyGhs}
          onChange={(e) => setYearlyGhs(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" isLoading={loading}>
          Save
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
