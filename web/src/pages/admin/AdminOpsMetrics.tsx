import { useMutation, useQuery } from '@tanstack/react-query'
import { Activity, RefreshCw, BellRing } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import PageHeader from '../../components/layout/PageHeader'
import { api, platformAdminOps } from '../../lib/api'
import { useToast } from '../../components/ui/Toast'

function formatUptime(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default function AdminOpsMetrics() {
  const toast = useToast()
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'ops-metrics'],
    queryFn: platformAdminOps.getMetrics,
    refetchInterval: 30_000,
  })

  const testAlert = useMutation({
    mutationFn: () =>
      api('/admin/ops-metrics/test-alert', { method: 'POST' }) as Promise<{ ok: boolean }>,
    onSuccess: () => toast.success('Test alert sent', 'Check your Slack / Pager channel.'),
    onError: (err) =>
      toast.error('Test alert failed', err instanceof Error ? err.message : undefined),
  })

  const counterEntries = Object.entries(data?.counters ?? {}).sort(([a], [b]) => a.localeCompare(b))
  const gaugeEntries = Object.entries(data?.gauges ?? {}).sort(([a], [b]) => a.localeCompare(b))
  const derivedEntries = Object.entries(data?.derived ?? {}).sort(([a], [b]) => a.localeCompare(b))
  const webhookConfigured = data?.alerts?.webhookConfigured

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Ops metrics"
        subtitle={
          <p className="text-gray-500">
            Process-local parse, OCR, and match-memory counters since this API process started. Resets on
            redeploy.
          </p>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => testAlert.mutate()}
              disabled={testAlert.isPending}
            >
              <BellRing className="w-4 h-4 mr-1.5" />
              Test alert
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {data && webhookConfigured === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 max-w-2xl">
          Alert webhook not configured. Set <code className="text-xs">ALERT_WEBHOOK_URL</code> (or{' '}
          <code className="text-xs">SLACK_WEBHOOK_URL</code>) on the API to receive parse-lag and lead
          alerts.
        </div>
      )}

      {isLoading && (
        <Card>
          <p className="text-sm text-gray-500">Loading metrics…</p>
        </Card>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 max-w-xl">
          {error instanceof Error ? error.message : 'Could not load ops metrics.'}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <div className="flex items-start gap-3">
                <Activity className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500 font-medium">Uptime</p>
                  <p className="text-xl font-semibold text-gray-900 mt-1">
                    {formatUptime(data.uptimeSec)}
                  </p>
                </div>
              </div>
            </Card>
            <Card>
              <p className="text-sm text-gray-500 font-medium">Process started</p>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {new Date(data.startedAt).toLocaleString()}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500 font-medium">Counter keys</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{counterEntries.length}</p>
            </Card>
          </div>

          {derivedEntries.length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Derived</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {derivedEntries.map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-gray-50 px-3 py-2">
                    <dt className="text-xs text-gray-500 font-mono truncate" title={key}>
                      {key}
                    </dt>
                    <dd className="text-sm font-semibold text-gray-900 mt-0.5">
                      {value == null ? '—' : value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          {gaugeEntries.length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Gauges</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-100">
                      <th className="py-2 pr-4 font-semibold">Metric</th>
                      <th className="py-2 font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gaugeEntries.map(([key, value]) => (
                      <tr key={key} className="border-b border-gray-50">
                        <td className="py-2 pr-4 font-mono text-xs text-gray-700">{key}</td>
                        <td className="py-2 font-medium text-gray-900">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Counters</h2>
            {counterEntries.length === 0 ? (
              <p className="text-sm text-gray-500">No counters recorded yet in this process.</p>
            ) : (
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-100">
                      <th className="py-2 pr-4 font-semibold">Metric</th>
                      <th className="py-2 font-semibold">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counterEntries.map(([key, value]) => (
                      <tr key={key} className="border-b border-gray-50">
                        <td className="py-2 pr-4 font-mono text-xs text-gray-700">{key}</td>
                        <td className="py-2 font-medium text-gray-900">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
