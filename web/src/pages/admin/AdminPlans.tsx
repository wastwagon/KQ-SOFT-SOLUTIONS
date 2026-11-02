import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import Card from '../../components/ui/Card'
import Button, { buttonClassName } from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Alert from '../../components/ui/Alert'
import PageLoadError from '../../components/ui/PageLoadError'
import { PageBodySkeleton } from '../../components/ui/Skeleton'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import PageHeader from '../../components/layout/PageHeader'
import { useToast } from '../../components/ui/Toast'
import Textarea from '../../components/ui/Textarea'
import PlanComparisonMatrixEditor from '../../components/admin/PlanComparisonMatrixEditor'
import PlansDraggableTable from '../../components/admin/PlansDraggableTable'
import type { FeatureGroup } from '../../lib/plans'
import { FEATURE_GROUPS } from '../../lib/plans'

type PlanMarketing = {
  tagline: string
  audience: string
  badge?: string | null
  highlight?: boolean
  bullets: string[]
  inheritsFromLabel?: string | null
  ctaLabel: string
  ctaHref: string
  featureMatrix: Record<string, boolean | string>
}

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
  marketing?: PlanMarketing
  sortOrder?: number
  showOnPublic?: boolean
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
  sortOrder: number
  showOnPublic: boolean
  features: Record<string, boolean>
  marketing?: PlanMarketing
  active: boolean
}

const DEFAULT_FEATURES: Record<string, Record<string, boolean>> = {
  basic: {
    bulk_match: true,
    ai_suggestions: true,
    bank_rules: true,
    audit_trail: true,
    discrepancy_report: true,
    missing_cheques_report: true,
    one_to_many: true,
    many_to_many: true,
    roll_forward: true,
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
    roll_forward: true,
    threshold_approval: true,
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

function suggestTaglineFromLimits(input: {
  bankAccounts: number
  projectsPerMonth: number
  transactionsPerMonth: number
  usersLimit: number
}): string {
  const banks =
    input.bankAccounts < 0
      ? 'unlimited bank accounts'
      : `${input.bankAccounts} bank account${input.bankAccounts === 1 ? '' : 's'}`
  const tx =
    input.transactionsPerMonth < 0
      ? 'unlimited transactions'
      : `${input.transactionsPerMonth.toLocaleString('en-GH')} transactions`
  const projects =
    input.projectsPerMonth < 0
      ? 'unlimited projects'
      : `${input.projectsPerMonth} project${input.projectsPerMonth === 1 ? '' : 's'}`
  const people =
    input.usersLimit < 0
      ? 'unlimited team members'
      : input.usersLimit === 1
        ? '1 person'
        : `${input.usersLimit} people`
  if (input.usersLimit === 1) {
    return `${people}, ${banks}, ${tx}, and ${projects} a month.`
  }
  return `${people}, ${banks}, ${tx}, and ${projects} a month.`
}

function leadBulletFromLimits(input: {
  projectsPerMonth: number
  usersLimit: number
}): string {
  const projects =
    input.projectsPerMonth < 0
      ? 'Unlimited projects / month'
      : `${input.projectsPerMonth.toLocaleString('en-GH')} projects / month`
  const members =
    input.usersLimit < 0
      ? 'unlimited team members'
      : `${input.usersLimit} team member${input.usersLimit === 1 ? '' : 's'}`
  return `${projects} · ${members}`
}

function syncLeadBullet(bullets: string[], limits: { projectsPerMonth: number; usersLimit: number }): string[] {
  const lead = leadBulletFromLimits(limits)
  if (bullets.length === 0) return [lead]
  const out = [...bullets]
  if (/projects?\s*\/?\s*month|team member|people|person\b/i.test(out[0] ?? '')) {
    out[0] = lead
  }
  return out
}

const EMPTY_MARKETING: PlanMarketing = {
  tagline: '',
  audience: '',
  bullets: [],
  ctaLabel: 'Subscribe',
  ctaHref: '/register',
  featureMatrix: {},
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
        return { plans: raw as AdminPlan[], featureCatalog: [] as FeatureCatalogItem[], comparisonGroups: [] }
      }
      return raw as {
        plans: AdminPlan[]
        featureCatalog: FeatureCatalogItem[]
        comparisonGroups: FeatureGroup[]
      }
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: PlanBody) => api('/admin/plans', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'plan-names'] })
      void queryClient.invalidateQueries({ queryKey: ['subscription', 'plans'] })
      void queryClient.invalidateQueries({ queryKey: ['public', 'plans'] })
      toast.success('Plan created', 'Pricing and features are live for checkout and the public site.')
      setShowNew(false)
    },
    onError: (err) => {
      toast.error('Could not create plan', err instanceof Error ? err.message : undefined)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: PlanBody & { id: string }) =>
      api(`/admin/plans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'plan-names'] })
      queryClient.invalidateQueries({ queryKey: ['subscription', 'plans'] })
      void queryClient.invalidateQueries({ queryKey: ['public', 'plans'] })
      toast.success('Plan updated', 'Billing, feature gates, and the landing page now use these values.')
      setEditing(null)
    },
    onError: (err) => {
      toast.error('Could not update plan', err instanceof Error ? err.message : undefined)
    },
  })

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) =>
      api('/admin/plans/reorder', { method: 'PUT', body: JSON.stringify({ orderedIds }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'plan-names'] })
      void queryClient.invalidateQueries({ queryKey: ['public', 'plans'] })
      toast.success('Plan order saved', 'The public pricing page uses this order.')
    },
    onError: (err) => {
      toast.error('Could not save order', err instanceof Error ? err.message : undefined)
      void refetch()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/plans/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'plan-names'] })
    },
  })

  if (isError) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Platform admin"
          title="Plans"
          subtitle={<p className="text-gray-500">CMS for subscription packages: prices, limits, and features.</p>}
        />
        <PageLoadError title="Could not load plans" error={error} onRetry={() => void refetch()} />
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

  const { plans, featureCatalog, comparisonGroups: comparisonGroupsRaw } = data
  const comparisonGroups = comparisonGroupsRaw?.length ? comparisonGroupsRaw : FEATURE_GROUPS

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Plans"
        subtitle={
          <p className="text-gray-500">
            Changes here drive Paystack checkout, organisation limits, and the full public pricing page.
            Drag rows by the handle to set order on the landing page (or use Sort order in Edit).
          </p>
        }
        actions={
          <>
            <Link
              to="/platform-admin/pricing-page"
              className={buttonClassName('outline', 'sm')}
            >
              Pricing layout
            </Link>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              New plan
            </Button>
          </>
        }
      />

      {showNew && (
        <Card title="New plan" className="mb-6">
          <PlanForm
            catalog={featureCatalog}
            comparisonGroups={comparisonGroups}
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
            comparisonGroups={comparisonGroups}
            onSubmit={(b) => updateMutation.mutate({ id: editing.id, ...b })}
            onCancel={() => setEditing(null)}
            loading={updateMutation.isPending}
            error={updateMutation.error instanceof Error ? updateMutation.error.message : undefined}
          />
        </Card>
      )}

      <Card noPadding sublabel="Drag the grip icon to reorder packages on the public pricing page.">
        <PlansDraggableTable
          plans={plans}
          reordering={reorderMutation.isPending}
          onReorder={(orderedIds) => reorderMutation.mutate(orderedIds)}
          onEdit={(p) => {
            setShowNew(false)
            setEditing(plans.find((x) => x.id === p.id) ?? (p as AdminPlan))
          }}
          onDelete={async (p) => {
            const ok = await confirm({
              title: `Delete the "${p.name}" plan?`,
              description:
                'Existing subscribers on this plan will not be removed, but no new sign-ups will be able to choose it.',
              confirmLabel: 'Delete plan',
              tone: 'danger',
            })
            if (ok) deleteMutation.mutate(p.id)
          }}
        />
      </Card>
    </div>
  )
}

function PlanForm({
  initial,
  catalog,
  comparisonGroups,
  onSubmit,
  onCancel,
  loading,
  error,
}: {
  initial?: AdminPlan
  catalog: FeatureCatalogItem[]
  comparisonGroups: FeatureGroup[]
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
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0))
  const [showOnPublic, setShowOnPublic] = useState(initial?.showOnPublic !== false)
  const [active, setActive] = useState(initial?.active !== false)
  const [features, setFeatures] = useState<Record<string, boolean>>(
    () => initial?.features ?? { ...(DEFAULT_FEATURES[initial?.slug || 'basic'] || DEFAULT_FEATURES.basic) }
  )
  const [marketing, setMarketing] = useState<PlanMarketing>(
    () => initial?.marketing ?? { ...EMPTY_MARKETING }
  )

  const rows = catalog.length > 0 ? catalog : Object.keys(DEFAULT_FEATURES.basic).map((id) => ({ id, label: id, hint: '' }))
  const featureRows = [
    ...rows,
    ...Object.keys(features)
      .filter((id) => !rows.some((r) => r.id === id))
      .map((id) => ({ id, label: id, hint: 'Custom flag' })),
  ]

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
      sortOrder: parseInt(sortOrder, 10) || 0,
      showOnPublic,
      features,
      marketing: {
        ...marketing,
        tagline: suggestTaglineFromLimits(quotaNums),
        badge: marketing.badge?.trim() ? marketing.badge.trim() : null,
        inheritsFromLabel: marketing.inheritsFromLabel?.trim()
          ? marketing.inheritsFromLabel.trim()
          : null,
        bullets: syncLeadBullet(
          marketing.bullets.filter((b) => b.trim().length > 0),
          quotaNums
        ),
        featureMatrix: marketing.featureMatrix,
      },
      active,
    })
  }

  const quotaNums = {
    bankAccounts: parseInt(bankAccounts, 10) || 0,
    projectsPerMonth: parseInt(projectsPerMonth, 10) || 0,
    transactionsPerMonth: parseInt(transactionsPerMonth, 10) || 0,
    usersLimit: parseInt(usersLimit, 10) || 0,
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert tone="error" title="Could not save plan">
          {error}
        </Alert>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Input
          label="Slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          className="font-mono"
          hint="Lowercase id (a-z, 0-9, _, -). Renaming updates all orgs on this plan."
        />
        <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Solo" />
        <Input
          type="number"
          label="Sort order"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          hint="Lower numbers appear first on the pricing page"
        />
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

      <div className="border-t border-border pt-6 space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Public pricing page</h4>
          <p className="text-xs text-gray-500 mt-1">
            Taglines and lead bullets are regenerated from the numeric limits when you save (and on the public site at load time). Other bullets and comparison copy stay editable below.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Tagline"
            value={marketing.tagline}
            onChange={(e) => setMarketing((m) => ({ ...m, tagline: e.target.value }))}
            placeholder="Short summary under the plan name"
          />
          <Input
            label="Audience label"
            value={marketing.audience}
            onChange={(e) => setMarketing((m) => ({ ...m, audience: e.target.value }))}
            placeholder="e.g. Solo accountant"
          />
          <Input
            label="Ribbon badge (optional)"
            value={marketing.badge ?? ''}
            onChange={(e) => setMarketing((m) => ({ ...m, badge: e.target.value }))}
            placeholder="Most popular"
          />
          <Input
            label="Inherits-from label"
            value={marketing.inheritsFromLabel ?? ''}
            onChange={(e) => setMarketing((m) => ({ ...m, inheritsFromLabel: e.target.value }))}
            placeholder="Everything in Solo, plus:"
          />
          <Input
            label="CTA label"
            value={marketing.ctaLabel}
            onChange={(e) => setMarketing((m) => ({ ...m, ctaLabel: e.target.value }))}
          />
          <Input
            label="CTA link"
            value={marketing.ctaHref}
            onChange={(e) => setMarketing((m) => ({ ...m, ctaHref: e.target.value }))}
            placeholder="/register or mailto:…"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setMarketing((m) => ({ ...m, tagline: suggestTaglineFromLimits(quotaNums) }))
            }
          >
            Regenerate tagline from limits
          </Button>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={!!marketing.highlight}
              onChange={(e) => setMarketing((m) => ({ ...m, highlight: e.target.checked }))}
              className="rounded border-gray-300"
            />
            Highlight on pricing page
          </label>
        </div>
        <Textarea
          label="Card bullets (one per line)"
          rows={6}
          value={marketing.bullets.join('\n')}
          onChange={(e) =>
            setMarketing((m) => ({
              ...m,
              bullets: e.target.value.split('\n'),
            }))
          }
          hint="Shown on the plan card on the home page."
        />
        <div>
          <h5 className="text-sm font-medium text-gray-900 mb-1">Landing comparison table</h5>
          <p className="text-xs text-gray-500 mb-3">
            Plan limit rows preview from the numeric fields above and sync automatically on the
            public site.
          </p>
          <PlanComparisonMatrixEditor
            featureGroups={comparisonGroups}
            featureMatrix={marketing.featureMatrix}
            quotaNums={quotaNums}
            onChange={(featureMatrix) => setMarketing((m) => ({ ...m, featureMatrix }))}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={showOnPublic} onChange={(e) => setShowOnPublic(e.target.checked)} className="rounded border-gray-300" />
        Show on public pricing page
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-gray-300" />
        Plan is active (self-serve checkout when prices are set)
      </label>
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-1">Features</h4>
        <p className="text-xs text-gray-500 mb-3">
          Toggle product gates for this plan. Add custom flags below or in Pricing layout → Extra
          feature flags.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {featureRows.map((f) => (
            <label key={f.id} className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300"
                checked={!!features[f.id]}
                onChange={(e) => setFeatures((prev) => ({ ...prev, [f.id]: e.target.checked }))}
              />
              <span>
                <span className="font-medium text-gray-900">{f.label}</span>
                {f.hint ? <span className="block text-xs text-gray-500">{f.hint}</span> : null}
              </span>
            </label>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => {
            const id = window.prompt('Feature flag id (e.g. custom_reports):')?.trim()
            if (!id) return
            setFeatures((prev) => ({ ...prev, [id]: true }))
          }}
        >
          Add feature flag
        </Button>
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
