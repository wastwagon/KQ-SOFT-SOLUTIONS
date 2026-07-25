import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, RefreshCw } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import PageHeader from '../../components/layout/PageHeader'
import { platformAdminOps, type RetentionPruneResult } from '../../lib/api'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'

function ResultSummary({ result }: { result: RetentionPruneResult }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500">Mode</p>
          <p className="text-sm font-semibold text-gray-900">
            {result.dryRun ? 'Dry run' : 'Deleted'}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500">Retention years</p>
          <p className="text-sm font-semibold text-gray-900">{result.retentionYears}</p>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500">Eligible</p>
          <p className="text-sm font-semibold text-gray-900">{result.eligibleProjects}</p>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500">Files removed</p>
          <p className="text-sm font-semibold text-gray-900">{result.filesRemoved}</p>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Cutoff: {new Date(result.cutoffIso).toLocaleString()} · Deleted projects:{' '}
        {result.deletedProjects}
      </p>
      {result.projects.length > 0 && (
        <div className="overflow-x-auto max-h-72 overflow-y-auto border border-gray-100 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-100">
                <th className="px-3 py-2 font-semibold">Project</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Org</th>
              </tr>
            </thead>
            <tbody>
              {result.projects.map((p) => (
                <tr key={p.id} className="border-b border-gray-50">
                  <td className="px-3 py-2 text-gray-900">{p.name}</td>
                  <td className="px-3 py-2 text-gray-600">{p.status}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.organizationId}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

      <Card>
        <div className="flex items-start gap-3 mb-4">
          <Archive className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Filters</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Optional overrides for the dry-run preview and delete action.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <div>
            <label htmlFor="retention-years" className="block text-sm font-medium text-gray-700 mb-1">
              Retention years
            </label>
            <Input
              id="retention-years"
              type="number"
              min={1}
              max={30}
              placeholder="Platform default"
              value={years}
              onChange={(e) => setYears(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="retention-org" className="block text-sm font-medium text-gray-700 mb-1">
              Organization ID
            </label>
            <Input
              id="retention-org"
              placeholder="All organizations"
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => runMutation.mutate(false)}
            disabled={runMutation.isPending}
          >
            Run dry-run
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            disabled={runMutation.isPending}
          >
            Delete eligible projects
          </Button>
        </div>
      </Card>

      {previewQuery.isLoading && (
        <Card>
          <p className="text-sm text-gray-500">Loading retention preview…</p>
        </Card>
      )}

      {previewQuery.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 max-w-xl">
          {previewQuery.error instanceof Error
            ? previewQuery.error.message
            : 'Could not load retention preview.'}
        </div>
      )}

      {previewQuery.data && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Current preview</h2>
          <ResultSummary result={previewQuery.data} />
        </Card>
      )}

      {runMutation.data && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Last run result</h2>
          <ResultSummary result={runMutation.data} />
        </Card>
      )}
    </div>
  )
}
