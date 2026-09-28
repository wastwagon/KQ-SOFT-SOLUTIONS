import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { api } from '../../lib/api'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../../components/ui/Table'
import { PageBodySkeleton } from '../../components/ui/Skeleton'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import PageHeader from '../../components/layout/PageHeader'
import { useToast } from '../../components/ui/Toast'

type PlanFeatureId = string

type AdminPlan = {
  id: string
  slug: string
  name: string
  projectsPerMonth: number
  transactionsPerMonth: number
  monthlyGhs: number
  yearlyGhs: number
  quarterlyGhs: number
  bankAccounts: number
  cleanExportsPerMonth: number
  usersLimit: number
  features: Record<PlanFeatureId, boolean>
  active: boolean
}

type FeatureCatalogItem = { id: PlanFeatureId; label: string; hint: string }

type PlanBody = {
  slug: string
  name: string
  projectsPerMonth: number
  transactionsPerMonth: number
  monthlyGhs: number
  yearlyGhs: number
  quarterlyGhs: number
  bankAccounts: number
  cleanExportsPerMonth: number
  usersLimit: number
  features: Record<string, boolean>
  active: boolean
}

const DEFAULT_FEATURES: Record<string, Record<string, boolean>> = {
  basic: {
    bulk_match: true,
    ai_suggestions: true,
    bank_rules: false,
    audit_trail: false,
    discrepancy_report: false,
    missing_cheques_report: false,
    one_to_many: true,
    many_to_many: true,
    roll_forward: false,
    threshold_approval: false,
    full_branding: false,
    firm_dashboard: false,
    api_access: false,
    multi_client: false,
  },
  standard: {
    bulk_match: true,
    ai_suggestions: true,
    bank_rules: true,
    audit_trail: true,
    discrepancy_report: true,
    missing_cheques_report: true,
    one_to_many: true,
    many_to_many: true,
    roll_forward: false,
    threshold_approval: false,
    full_branding: true,
    firm_dashboard: false,
    api_access: false,
    multi_client: false,
  },
  premium: {
    bulk_match: true,
    ai_suggestions: true,
    bank_rules: true,
    audit_trail: true,
    discrepancy_report: true,
    missing_cheques_report: true,
    one_to_many: true,
    many_to_many: true,
    roll_forward: true,
    threshold_approval: true,
    full_branding: true,
    firm_dashboard: true,
    api_access: false,
    multi_client: false,
  },
  firm: {
    bulk_match: true,
    ai_suggestions: true,
    bank_rules: true,
    audit_trail: true,
    discrepancy_report: true,
    missing_cheques_report: true,
    one_to_many: true,
    many_to_many: true,
    roll_forward: true,
    threshold_approval: true,
    full_branding: true,
    firm_dashboard: true,
    api_access: true,
    multi_client: true,
  },
}

/** Split / many-to-1 matching is on every package; CMS cannot turn it off. */
const UNGATED_PLAN_FEATURES = new Set(['one_to_many', 'many_to_many'])

function fmtLimit(n: number) {
  return n < 0 ? 'Unlimited' : n.toLocaleString()
}

export default function AdminPlans() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<AdminPlan | null>(null)
  const [showNew, setShowNew] = useState(false)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: async () => {
      const raw = await api('/admin/plans')
      if (Array.isArray(raw)) {
        return { plans: raw as AdminPlan[], featureCatalog: [] as FeatureCatalogItem[] }
      }
      return raw as { plans: AdminPlan[]; featureCatalog: FeatureCatalogItem[] }
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: PlanBody) => api('/admin/plans', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] })
      toast.success('Plan created', 'Pricing and features are live for checkout and the public site.')
      setShowNew(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: PlanBody & { id: string }) =>
      api(`/admin/plans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] })
      toast.success('Plan updated', 'Billing, feature gates, and the landing page now use these values.')
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
          subtitle={<p className="text-gray-500">CMS for subscription packages: prices, limits, and features.</p>}
        />
        <Alert tone="error" title="Could not load plans" onRetry={() => void refetch()}>
          {error instanceof Error ? error.message : 'Something went wrong.'}
        </Alert>
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Platform admin"
          title="Plans"
          subtitle={<p className="text-gray-500">CMS for subscription packages: prices, limits, and features.</p>}
        />
        <PageBodySkeleton label="Loading plans" />
      </div>
    )
  }

  const { plans, featureCatalog } = data

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Plans"
        subtitle={
          <p className="text-gray-500">
            Changes here drive Paystack checkout amounts, monthly transaction volume (resets on the
            1st; the cap stays), workspace feature gates, and the public pricing page.
          </p>
        }
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
            catalog={featureCatalog}
            onSubmit={(b) => createMutation.mutate(b)}
            onCancel={() => setShowNew(false)}
            loading={createMutation.isPending}
            error={createMutation.error instanceof Error ? createMutation.error.message : undefined}
          />
        </Card>
      )}

      {editing && (
        <Card title={`Edit ${editing.name}`} className="mb-6">
          <PlanForm
            initial={editing}
            catalog={featureCatalog}
            onSubmit={(b) => updateMutation.mutate({ id: editing.id, ...b })}
            onCancel={() => setEditing(null)}
            loading={updateMutation.isPending}
            error={updateMutation.error instanceof Error ? updateMutation.error.message : undefined}
          />
        </Card>
      )}

      <Card noPadding>
        <Table>
          <TableHead>
            <tr>
              <TableTh>Package</TableTh>
              <TableTh className="text-right">Seats</TableTh>
              <TableTh className="text-right">Projects</TableTh>
              <TableTh className="text-right">Tx / calendar mo</TableTh>
              <TableTh className="text-right">Banks</TableTh>
              <TableTh className="text-right">Monthly</TableTh>
              <TableTh className="text-right">Quarterly</TableTh>
              <TableTh className="text-right">Yearly</TableTh>
              <TableTh className="text-right">Actions</TableTh>
            </tr>
          </TableHead>
          <TableBody>
            {plans.map((p) => (
              <TableRow key={p.id}>
                <TableTd>
                  <div className="font-medium text-gray-900">{p.name}</div>
                  <div className="font-mono text-xs text-gray-500">{p.slug}</div>
                  {p.active === false ? (
                    <Badge tone="neutral" size="sm" className="mt-1">
                      Inactive
                    </Badge>
                  ) : null}
                </TableTd>
                <TableTd className="text-right">{fmtLimit(p.usersLimit)}</TableTd>
                <TableTd className="text-right">{fmtLimit(p.projectsPerMonth)}</TableTd>
                <TableTd className="text-right">{fmtLimit(p.transactionsPerMonth)}</TableTd>
                <TableTd className="text-right">{fmtLimit(p.bankAccounts)}</TableTd>
                <TableTd className="text-right">{p.monthlyGhs}</TableTd>
                <TableTd className="text-right">{p.quarterlyGhs}</TableTd>
                <TableTd className="text-right">{p.yearlyGhs}</TableTd>
                <TableTd className="text-right">
                  <Button type="button" variant="ghost" size="xs" onClick={() => { setShowNew(false); setEditing(p) }}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Delete the "${p.name}" plan?`,
                        description:
                          'Existing subscribers on this plan will not be removed, but no new sign-ups will be able to choose it.',
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
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

function PlanForm({
  initial,
  catalog,
  onSubmit,
  onCancel,
  loading,
  error,
}: {
  initial?: AdminPlan
  catalog: FeatureCatalogItem[]
  onSubmit: (b: PlanBody) => void
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
  const [quarterlyGhs, setQuarterlyGhs] = useState(
    String(initial?.quarterlyGhs ?? Math.round((initial?.monthlyGhs ?? 300) * 2.85))
  )
  const [bankAccounts, setBankAccounts] = useState(String(initial?.bankAccounts ?? 5))
  const [cleanExportsPerMonth, setCleanExportsPerMonth] = useState(String(initial?.cleanExportsPerMonth ?? 5))
  const [usersLimit, setUsersLimit] = useState(String(initial?.usersLimit ?? 1))
  const [active, setActive] = useState(initial?.active !== false)
  const [features, setFeatures] = useState<Record<string, boolean>>(
    () => initial?.features ?? { ...(DEFAULT_FEATURES[initial?.slug || 'basic'] || DEFAULT_FEATURES.basic) }
  )

  const rows = catalog.length > 0 ? catalog : Object.keys(DEFAULT_FEATURES.basic).map((id) => ({ id, label: id, hint: '' }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      slug: slug.trim().toLowerCase(),
      name: name.trim() || slug,
      projectsPerMonth: parseInt(projectsPerMonth, 10) || 0,
      transactionsPerMonth: parseInt(transactionsPerMonth, 10) || 0,
      monthlyGhs: parseFloat(monthlyGhs) || 0,
      yearlyGhs: parseFloat(yearlyGhs) || 0,
      quarterlyGhs: parseFloat(quarterlyGhs) || 0,
      bankAccounts: parseInt(bankAccounts, 10) || 0,
      cleanExportsPerMonth: parseInt(cleanExportsPerMonth, 10) || 0,
      usersLimit: parseInt(usersLimit, 10) || 0,
      features: { ...features, one_to_many: true, many_to_many: true },
      active,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert tone="error" title="Could not save plan">
          {error}
        </Alert>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {initial ? (
          <Input label="Slug" value={slug} readOnly className="font-mono" hint="Locked so existing subscribers keep their package." />
        ) : (
          <Select
            label="Slug"
            value={slug}
            onChange={(e) => {
              const next = e.target.value
              setSlug(next)
              if (!initial && DEFAULT_FEATURES[next]) setFeatures({ ...DEFAULT_FEATURES[next] })
            }}
            required
          >
            <option value="">Select package</option>
            <option value="basic">basic</option>
            <option value="standard">standard</option>
            <option value="premium">premium</option>
            <option value="firm">firm</option>
          </Select>
        )}
        <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Solo" />
        <Input type="number" step="0.01" label="Monthly (GHS)" value={monthlyGhs} onChange={(e) => setMonthlyGhs(e.target.value)} />
        <Input type="number" step="0.01" label="Quarterly (GHS)" value={quarterlyGhs} onChange={(e) => setQuarterlyGhs(e.target.value)} />
        <Input type="number" step="0.01" label="Yearly (GHS)" value={yearlyGhs} onChange={(e) => setYearlyGhs(e.target.value)} />
        <Input type="number" label="Team seats" value={usersLimit} onChange={(e) => setUsersLimit(e.target.value)} hint="-1 = unlimited" />
        <Input type="number" label="Projects / month" value={projectsPerMonth} onChange={(e) => setProjectsPerMonth(e.target.value)} hint="-1 = unlimited" />
        <Input
          type="number"
          label="Monthly volume limit (line items)"
          value={transactionsPerMonth}
          onChange={(e) => setTransactionsPerMonth(e.target.value)}
          hint="Used count resets to 0 on the 1st of each calendar month. This cap stays until you change it or the customer upgrades. -1 = unlimited."
        />
        <Input type="number" label="Bank accounts" value={bankAccounts} onChange={(e) => setBankAccounts(e.target.value)} />
        <Input type="number" label="Full clean exports / month" value={cleanExportsPerMonth} onChange={(e) => setCleanExportsPerMonth(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-gray-300" />
        Package is active (self-serve checkout and billing). The landing page still lists all four packages.
      </label>
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-1">Features</h4>
        <p className="text-xs text-gray-500 mb-3">
          These flags gate the product (API keys, bank rules, reports). One-to-many and many-to-many
          matching stay on for every package. Saving updates every workspace on this package.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {rows.map((f) => (
            <label key={f.id} className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300"
                checked={UNGATED_PLAN_FEATURES.has(f.id) ? true : !!features[f.id]}
                disabled={UNGATED_PLAN_FEATURES.has(f.id)}
                onChange={(e) => setFeatures((prev) => ({ ...prev, [f.id]: e.target.checked }))}
              />
              <span>
                <span className="font-medium text-gray-900">{f.label}</span>
                {f.hint ? <span className="block text-xs text-gray-500">{f.hint}</span> : null}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" isLoading={loading}>
          Save package
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
