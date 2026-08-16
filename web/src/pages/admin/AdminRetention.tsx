import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import Card from '../../components/ui/Card'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import MetricCard from '../../components/ui/MetricCard'
import PageHeader from '../../components/layout/PageHeader'
import { platformAdminOps, type RetentionPruneResult } from '../../lib/api'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'
import { PageBodySkeleton } from '../../components/ui/Skeleton'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../../components/ui/Table'
import ProjectStatusPill from '../../components/project/ProjectStatusPill'

function ResultSummary({ result }: { result: RetentionPruneResult }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard className="!p-4" label="Mode" value={result.dryRun ? 'Dry run' : 'Deleted'} />
        <MetricCard className="!p-4" label="Retention years" value={result.retentionYears} />
        <MetricCard className="!p-4" label="Eligible" value={result.eligibleProjects} />
        <MetricCard className="!p-4" label="Files removed" value={result.filesRemoved} />
      </div>
      <p className="text-xs text-gray-500">
        Cutoff: {new Date(result.cutoffIso).toLocaleString()} · Deleted projects:{' '}
        {result.deletedProjects}
      </p>
      {result.projects.length > 0 && (
        <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-100">
          <Table>
            <TableHead>
              <tr>
                <TableTh>Project</TableTh>
                <TableTh>Status</TableTh>
                <TableTh>Org</TableTh>
              </tr>
            </TableHead>
            <TableBody>
              {result.projects.map((p) => (
                <TableRow key={p.id}>
                  <TableTd className="text-gray-900">{p.name}</TableTd>
                  <TableTd>
                    <ProjectStatusPill status={p.status} size="sm" />
                  </TableTd>
                  <TableTd className="font-mono text-xs text-gray-500">{p.organizationId}</TableTd>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

export default function AdminRetention() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [years, setYears] = useState('')
  const [organizationId, setOrganizationId] = useState('')

  const yearsNum = years.trim() ? Number(years) : undefined
  const previewParams = {
    years: Number.isFinite(yearsNum) && (yearsNum as number) > 0 ? yearsNum : undefined,
    organizationId: organizationId.trim() || undefined,
  }

  const previewQuery = useQuery({
    queryKey: ['admin', 'retention', previewParams],
    queryFn: () => platformAdminOps.getRetentionPreview(previewParams),
  })

  const runMutation = useMutation({
    mutationFn: (confirmDelete: boolean) =>
      platformAdminOps.runRetention({
        confirm: confirmDelete,
        retentionYears: previewParams.years,
        organizationId: previewParams.organizationId,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'retention'] })
      toast.success(
        result.dryRun ? 'Dry run complete' : 'Retention prune complete',
        `${result.eligibleProjects} eligible · ${result.deletedProjects} deleted`
      )
    },
    onError: (err) => {
      toast.error('Retention failed', err instanceof Error ? err.message : undefined)
    },
  })

  async function handleDelete() {
    const ok = await confirm({
      title: 'Permanently delete eligible projects?',
      description:
        'This removes old completed projects and their uploaded files past the retention cutoff. This cannot be undone.',
      confirmLabel: 'Delete permanently',
      tone: 'danger',
    })
    if (!ok) return
    runMutation.mutate(true)
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Data retention"
        subtitle={
          <p className="text-gray-500">
            Preview or prune completed projects older than the retention window. Defaults to platform
            retention years when blank.
          </p>
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => previewQuery.refetch()}
            disabled={previewQuery.isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${previewQuery.isFetching ? 'animate-spin' : ''}`} />
            Refresh preview
          </Button>
        }
      />

      <Card
        title="Filters"
        sublabel="Optional overrides for the dry-run preview and delete action."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <Input
            id="retention-years"
            label="Retention years"
            type="number"
            min={1}
            max={30}
            placeholder="Platform default"
            value={years}
            onChange={(e) => setYears(e.target.value)}
          />
          <Input
            id="retention-org"
            label="Organization ID"
            placeholder="All organizations"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => runMutation.mutate(false)}
            isLoading={runMutation.isPending && runMutation.variables === false}
            disabled={runMutation.isPending}
          >
            Run dry-run
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            isLoading={runMutation.isPending && runMutation.variables === true}
            disabled={runMutation.isPending}
          >
            Delete eligible projects
          </Button>
        </div>
      </Card>

      {previewQuery.isLoading && <PageBodySkeleton label="Loading retention preview" />}

      {previewQuery.isError && (
        <Alert
          tone="error"
          title="Could not load retention preview"
          onRetry={() => void previewQuery.refetch()}
        >
          {previewQuery.error instanceof Error
            ? previewQuery.error.message
            : 'Something went wrong.'}
        </Alert>
      )}

      {previewQuery.data && (
        <Card title="Current preview">
          <ResultSummary result={previewQuery.data} />
        </Card>
      )}

      {runMutation.data && (
        <Card title="Last run result">
          <ResultSummary result={runMutation.data} />
        </Card>
      )}
    </div>
  )
}
