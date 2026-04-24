import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings } from 'lucide-react'
import { api } from '../../lib/api'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'

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
}

export default function AdminGenerationSettings() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<GenerationSettings>({
    defaultReportTitle: 'Bank Reconciliation Statement',
    defaultFooter: 'Prepared by your organisation',
    defaultPrimaryColor: '#16a34a',
    defaultSecondaryColor: '#15803d',
    apiRateLimitPerMin: 100,
    defaultCurrency: 'GHS',
    manualRates: { GHS_USD: null, GHS_EUR: null },
    useManualRatesOnly: false,
    amountTolerance: 0.01,
    dateWindowDays: 3,
    dataRetentionYears: 7,
  })

  const { data, isLoading } = useQuery({
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateMutation.mutate(form)
  }

  if (isLoading) return <p className="text-gray-500">Loading generation settings...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Generation settings</h1>
      <p className="text-sm text-gray-500 mb-6">
        Platform-wide defaults for report generation, API limits, and new organisations.
      </p>

      <Card>
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-6 h-6 text-primary-500" />
          <div>
            <h2 className="text-base font-semibold text-gray-900">Report generation defaults</h2>
            <p className="text-sm text-gray-500">
              Default branding applied to new organisations and used as template when copying settings.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default report title</label>
            <input
              type="text"
              value={form.defaultReportTitle}
              onChange={(e) => setForm((f) => ({ ...f, defaultReportTitle: e.target.value }))}
              placeholder="Bank Reconciliation Statement"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-gray-900 placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default footer</label>
            <input
              type="text"
              value={form.defaultFooter}
              onChange={(e) => setForm((f) => ({ ...f, defaultFooter: e.target.value }))}
              placeholder="Prepared by your organisation"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-gray-900 placeholder-gray-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default primary colour</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.defaultPrimaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, defaultPrimaryColor: e.target.value }))}
                  className="h-10 w-14 rounded cursor-pointer border border-border"
                />
                <input
                  type="text"
                  value={form.defaultPrimaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, defaultPrimaryColor: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-sm font-mono bg-white text-gray-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default secondary colour</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.defaultSecondaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, defaultSecondaryColor: e.target.value }))}
                  className="h-10 w-14 rounded cursor-pointer border border-border"
                />
                <input
                  type="text"
                  value={form.defaultSecondaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, defaultSecondaryColor: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-sm font-mono bg-white text-gray-900"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default currency</label>
            <select
              value={form.defaultCurrency}
              onChange={(e) => setForm((f) => ({ ...f, defaultCurrency: e.target.value as 'GHS' | 'USD' | 'EUR' }))}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-gray-900"
            >
              <option value="GHS">GHS (Cedi)</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Used when creating new projects.</p>
          </div>

          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Manual exchange rates (override)</h3>
            <p className="text-xs text-gray-500 mb-3">
              Used when API is unavailable or when &quot;Use manual rates only&quot; is enabled. 1 GHS = X USD/EUR.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">GHS → USD (1 GHS = ? USD)</label>
                <input
                  type="number"
                  step="0.0001"
                  min={0}
                  placeholder="e.g. 0.0925"
                  value={form.manualRates.GHS_USD ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setForm((f) => ({
                      ...f,
                      manualRates: { ...f.manualRates, GHS_USD: v === '' ? null : Number(v) },
                    }))
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">GHS → EUR (1 GHS = ? EUR)</label>
                <input
                  type="number"
                  step="0.0001"
                  min={0}
                  placeholder="e.g. 0.0796"
                  value={form.manualRates.GHS_EUR ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setForm((f) => ({
                      ...f,
                      manualRates: { ...f.manualRates, GHS_EUR: v === '' ? null : Number(v) },
                    }))
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-gray-900"
                />
              </div>
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
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Matching engine</h3>
            <p className="text-xs text-gray-500 mb-3">
              Amount tolerance and date window for AI match suggestions.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount tolerance (±)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  value={form.amountTolerance}
                  onChange={(e) => setForm((f) => ({ ...f, amountTolerance: Number(e.target.value) || 0.01 }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-0.5">e.g. 0.01 = ±GH₵0.01</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date window (days)</label>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={form.dateWindowDays}
                  onChange={(e) => setForm((f) => ({ ...f, dateWindowDays: Number(e.target.value) || 3 }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-0.5">e.g. 3 = ±3 days</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data retention (years)</label>
            <input
              type="number"
              min={1}
              max={30}
              value={form.dataRetentionYears}
              onChange={(e) => setForm((f) => ({ ...f, dataRetentionYears: Number(e.target.value) || 7 }))}
              className="w-full max-w-xs px-3 py-2 border border-border rounded-lg text-sm bg-white text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-1">
              Policy for audit/data retention (documentation). Actual deletion not implemented.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API rate limit (per minute)</label>
            <input
              type="number"
              min={10}
              max={1000}
              value={form.apiRateLimitPerMin}
              onChange={(e) => setForm((f) => ({ ...f, apiRateLimitPerMin: Number(e.target.value) || 100 }))}
              className="w-full max-w-xs px-3 py-2 border border-border rounded-lg text-sm bg-white text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-1">
              Maximum requests per API key per minute. Applied after API restart.
            </p>
          </div>

          {updateMutation.error && (
            <p className="text-sm text-red-600">{(updateMutation.error as Error).message}</p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save settings'}
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
