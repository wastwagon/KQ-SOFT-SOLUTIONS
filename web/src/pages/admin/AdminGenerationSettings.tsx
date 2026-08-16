import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Alert from '../../components/ui/Alert'
import { PageBodySkeleton } from '../../components/ui/Skeleton'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { BRAND_PRIMARY_HEX, BRAND_SECONDARY_HEX } from '../../lib/brandColors'
import PageHeader from '../../components/layout/PageHeader'

type GenerationSettings = {
  defaultReportTitle: string
  defaultFooter: string
  defaultPrimaryColor: string
  defaultSecondaryColor: string
  apiRateLimitPerMin: number
  defaultCurrency: 'GHS' | 'USD' | 'EUR'
  manualRates: { GHS_USD: number | null; GHS_EUR: number | null }
  useManualRatesOnly: boolean
  amountTolerance: number
  dateWindowDays: number
  dataRetentionYears: number
  ghanaBrsWorkbookNetting: boolean
}

export default function AdminGenerationSettings() {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [form, setForm] = useState<GenerationSettings>({
    defaultReportTitle: 'Bank Reconciliation Statement',
    defaultFooter: 'Prepared by your organisation',
    defaultPrimaryColor: BRAND_PRIMARY_HEX,
    defaultSecondaryColor: BRAND_SECONDARY_HEX,
    apiRateLimitPerMin: 100,
    defaultCurrency: 'GHS',
    manualRates: { GHS_USD: null, GHS_EUR: null },
    useManualRatesOnly: false,
    amountTolerance: 0.01,
    dateWindowDays: 3,
    dataRetentionYears: 7,
    ghanaBrsWorkbookNetting: false,
  })

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'settings', 'generation'],
    queryFn: () => api('/admin/settings') as Promise<GenerationSettings>,
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (data) setForm(data)
  }, [data])

  const updateMutation = useMutation({
    mutationFn: (body: Partial<GenerationSettings>) =>
      api('/admin/settings', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'generation'] })
    },
  })

  type RetentionPreview = {
    dryRun: boolean
    retentionYears: number
    cutoffIso: string
    eligibleProjects: number
    deletedProjects: number
    filesRemoved: number
  }

  const retentionPreview = useMutation({
    mutationFn: () =>
      api(`/admin/retention?years=${form.dataRetentionYears}`) as Promise<RetentionPreview>,
  })

  const retentionExecute = useMutation({
    mutationFn: () =>
      api('/admin/retention', {
        method: 'POST',
        body: JSON.stringify({ confirm: true, retentionYears: form.dataRetentionYears }),
      }) as Promise<RetentionPreview>,
    onSuccess: () => {
      retentionPreview.reset()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateMutation.mutate(form)
  }

  if (isError) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Platform admin"
          title="Generation settings"
          subtitle={
            <p className="text-gray-500">Platform-wide defaults for reports, API limits, and new organisations.</p>
          }
        />
        <Alert tone="error" title="Could not load generation settings" onRetry={() => void refetch()}>
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
          title="Generation settings"
          subtitle={
            <p className="text-gray-500">Platform-wide defaults for reports, API limits, and new organisations.</p>
          }
        />
        <PageBodySkeleton label="Loading settings" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Generation settings"
        subtitle={
          <p className="text-gray-500">
            Platform-wide defaults for report generation, API limits, and new organisations.
          </p>
        }
      />

      <Card
        title="Report generation defaults"
        sublabel="Default branding applied to new organisations and used as template when copying settings."
      >

        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
          <Input
            type="text"
            label="Default report title"
            value={form.defaultReportTitle}
            onChange={(e) => setForm((f) => ({ ...f, defaultReportTitle: e.target.value }))}
            placeholder="Bank Reconciliation Statement"
          />
          <Input
            type="text"
            label="Default footer"
            value={form.defaultFooter}
            onChange={(e) => setForm((f) => ({ ...f, defaultFooter: e.target.value }))}
            placeholder="Prepared by your organisation"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-700">Default primary colour</p>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.defaultPrimaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, defaultPrimaryColor: e.target.value }))}
                  aria-label="Default primary colour"
                  className="h-11 w-14 shrink-0 rounded-xl cursor-pointer border border-gray-200"
                />
                <div className="flex-1 min-w-0">
                  <Input
                    type="text"
                    value={form.defaultPrimaryColor}
                    onChange={(e) => setForm((f) => ({ ...f, defaultPrimaryColor: e.target.value }))}
                    className="font-mono"
                  />
                </div>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-700">Default secondary colour</p>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.defaultSecondaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, defaultSecondaryColor: e.target.value }))}
                  aria-label="Default secondary colour"
                  className="h-11 w-14 shrink-0 rounded-xl cursor-pointer border border-gray-200"
                />
                <div className="flex-1 min-w-0">
                  <Input
                    type="text"
                    value={form.defaultSecondaryColor}
                    onChange={(e) => setForm((f) => ({ ...f, defaultSecondaryColor: e.target.value }))}
                    className="font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <Select
            label="Default currency"
            value={form.defaultCurrency}
            onChange={(e) => setForm((f) => ({ ...f, defaultCurrency: e.target.value as 'GHS' | 'USD' | 'EUR' }))}
            hint="Used when creating new projects."
          >
            <option value="GHS">GHS (Cedi)</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </Select>

          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Manual exchange rates (override)</h3>
            <p className="text-xs text-gray-500 mb-3">
              Used when API is unavailable or when &quot;Use manual rates only&quot; is enabled. 1 GHS = X USD/EUR.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <Input
                type="number"
                step="0.0001"
                min={0}
                label="GHS → USD (1 GHS = ? USD)"
                placeholder="e.g. 0.0925"
                value={form.manualRates.GHS_USD ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setForm((f) => ({
                    ...f,
                    manualRates: { ...f.manualRates, GHS_USD: v === '' ? null : Number(v) },
                  }))
                }}
              />
              <Input
                type="number"
                step="0.0001"
                min={0}
                label="GHS → EUR (1 GHS = ? EUR)"
                placeholder="e.g. 0.0796"
                value={form.manualRates.GHS_EUR ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setForm((f) => ({
                    ...f,
                    manualRates: { ...f.manualRates, GHS_EUR: v === '' ? null : Number(v) },
                  }))
                }}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.useManualRatesOnly}
                onChange={(e) => setForm((f) => ({ ...f, useManualRatesOnly: e.target.checked }))}
                className="rounded border-border"
              />
              <span className="text-sm text-gray-700">Use manual rates only (disable FX API)</span>
            </label>
          </div>

          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Ghana BRS</h3>
            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={form.ghanaBrsWorkbookNetting}
                onChange={(e) => setForm((f) => ({ ...f, ghanaBrsWorkbookNetting: e.target.checked }))}
                className="rounded border-border"
              />
              <span className="text-sm text-gray-700">
                Enable workbook netting by default (Ecobank Ghana BRS groups 2–3)
              </span>
            </label>
            <p className="text-xs text-gray-500 mb-4 -mt-2">
              Org branding can override per organisation. Env var GHANA_BRS_WORKBOOK_NETTING still applies
              when neither is set.
            </p>
          </div>

          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Matching engine</h3>
            <p className="text-xs text-gray-500 mb-3">
              Amount tolerance and date window for AI match suggestions.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="number"
                step="0.01"
                min={0}
                max={100}
                label="Amount tolerance (±)"
                value={form.amountTolerance}
                onChange={(e) => setForm((f) => ({ ...f, amountTolerance: Number(e.target.value) || 0.01 }))}
                hint="e.g. 0.01 = ±GH₵0.01"
              />
              <Input
                type="number"
                min={0}
                max={90}
                label="Date window (days)"
                value={form.dateWindowDays}
                onChange={(e) => setForm((f) => ({ ...f, dateWindowDays: Number(e.target.value) || 3 }))}
                hint="e.g. 3 = ±3 days"
              />
            </div>
          </div>

          <div>
            <Input
              type="number"
              min={1}
              max={30}
              label="Data retention (years)"
              value={form.dataRetentionYears}
              onChange={(e) => setForm((f) => ({ ...f, dataRetentionYears: Number(e.target.value) || 7 }))}
              className="max-w-xs"
              hint="Completed/approved projects older than this (by reconciliation date, else last update) are eligible for permanent delete via prune. Preview with dry-run first."
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={retentionExecute.isPending}
                isLoading={retentionPreview.isPending}
                onClick={() => retentionPreview.mutate()}
              >
                Preview prune (dry-run)
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={
                  !retentionPreview.data ||
                  retentionPreview.data.eligibleProjects === 0
                }
                isLoading={retentionExecute.isPending}
                onClick={async () => {
                  const n = retentionPreview.data?.eligibleProjects ?? 0
                  const ok = await confirm({
                    title: `Permanently delete ${n} project(s)?`,
                    description: 'Completed/approved projects and their upload files will be removed. This cannot be undone.',
                    confirmLabel: 'Delete projects',
                    tone: 'danger',
                  })
                  if (ok) retentionExecute.mutate()
                }}
              >
                Run prune
              </Button>
            </div>
            {retentionPreview.data && (
              <p className="mt-2 text-xs text-gray-600">
                Dry-run: {retentionPreview.data.eligibleProjects} eligible · cutoff{' '}
                {new Date(retentionPreview.data.cutoffIso).toLocaleDateString()} · retention{' '}
                {retentionPreview.data.retentionYears}y
              </p>
            )}
            {retentionExecute.data && !retentionExecute.data.dryRun && (
              <Alert tone="success" title="Prune complete" className="mt-2">
                Deleted {retentionExecute.data.deletedProjects} project(s), removed{' '}
                {retentionExecute.data.filesRemoved} file(s).
              </Alert>
            )}
            {(retentionPreview.error || retentionExecute.error) && (
              <Alert tone="error" title="Prune failed" className="mt-2">
                {((retentionPreview.error || retentionExecute.error) as Error).message}
              </Alert>
            )}
          </div>

          <Input
            type="number"
            min={10}
            max={1000}
            label="API rate limit (per minute)"
            value={form.apiRateLimitPerMin}
            onChange={(e) => setForm((f) => ({ ...f, apiRateLimitPerMin: Number(e.target.value) || 100 }))}
            className="max-w-xs"
            hint="Maximum requests per API key per minute. Applied after API restart."
          />

          {updateMutation.error && (
            <Alert tone="error" title="Could not save settings">
              {(updateMutation.error as Error).message}
            </Alert>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" isLoading={updateMutation.isPending}>
              Save settings
            </Button>
            {updateMutation.isSuccess && (
              <span className="text-sm text-green-600">Saved.</span>
            )}
          </div>
        </form>
      </Card>
    </div>
  )
}
