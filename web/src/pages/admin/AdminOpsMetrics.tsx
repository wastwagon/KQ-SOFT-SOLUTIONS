import { useMutation, useQuery } from '@tanstack/react-query'
import { Activity, RefreshCw, BellRing } from 'lucide-react'
import Card from '../../components/ui/Card'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import MetricCard from '../../components/ui/MetricCard'
import PageHeader from '../../components/layout/PageHeader'
import { PageBodySkeleton } from '../../components/ui/Skeleton'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../../components/ui/Table'
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
              isLoading={testAlert.isPending}
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
        <Alert tone="warning" title="Alert webhook not configured" className="max-w-2xl">
          Set <code className="text-xs">ALERT_WEBHOOK_URL</code> (or{' '}
          <code className="text-xs">SLACK_WEBHOOK_URL</code>) on the API to receive parse-lag and lead
          alerts.
        </Alert>
      )}

      {isLoading && <PageBodySkeleton label="Loading metrics" />}

      {isError && (
        <Alert
          tone="error"
          title="Could not load ops metrics"
          onRetry={() => void refetch()}
        >
          {error instanceof Error ? error.message : 'Something went wrong.'}
        </Alert>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              label="Uptime"
              value={formatUptime(data.uptimeSec)}
              icon={<Activity />}
            />
            <MetricCard
              label="Process started"
              value={new Date(data.startedAt).toLocaleString()}
            />
            <MetricCard label="Counter keys" value={counterEntries.length} />
          </div>

          {derivedEntries.length > 0 && (
            <Card title="Derived">
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
            <Card title="Gauges">
              <Table>
                <TableHead>
                  <tr>
                    <TableTh>Metric</TableTh>
                    <TableTh>Value</TableTh>
                  </tr>
                </TableHead>
                <TableBody>
                  {gaugeEntries.map(([key, value]) => (
                    <TableRow key={key}>
                      <TableTd className="font-mono text-xs">{key}</TableTd>
                      <TableTd className="font-medium text-gray-900">{value}</TableTd>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          <Card title="Counters">
            {counterEntries.length === 0 ? (
              <p className="text-sm text-gray-500">No counters recorded yet in this process.</p>
            ) : (
              <div className="max-h-[480px] overflow-y-auto">
                <Table>
                  <TableHead>
                    <tr>
                      <TableTh>Metric</TableTh>
                      <TableTh>Count</TableTh>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {counterEntries.map(([key, value]) => (
                      <TableRow key={key}>
                        <TableTd className="font-mono text-xs">{key}</TableTd>
                        <TableTd className="font-medium text-gray-900">{value}</TableTd>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
