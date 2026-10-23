import { useMutation, useQueryClient } from '@tanstack/react-query'
import { projects, unlessSubscriptionInactive } from '../../lib/api'
import { canReopenProject } from '../../lib/permissions'
import { useToast } from '../ui/Toast'
import Alert from '../ui/Alert'
import Button from '../ui/Button'

interface ProjectLockedBannerProps {
  projectId: string
  status: string
  role: string | null
  onReopened?: (mode: 'reconcile' | 'sources') => void
}

export default function ProjectLockedBanner({
  projectId,
  status,
  role,
  onReopened,
}: ProjectLockedBannerProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const canReopen = canReopenProject(role)

  const reopenMutation = useMutation({
    mutationFn: (mode: 'reconcile' | 'sources') => projects.reopen(projectId, { mode }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['report', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['reconcile', projectId] })
      const sources = data?.status === 'mapping'
      toast.success(
        'Project reopened',
        sources
          ? 'Sign-off cleared — you can replace cash book or bank files, then continue matching.'
          : 'Sign-off cleared — continue matching and review from the reconcile step.'
      )
      onReopened?.(sources ? 'sources' : 'reconcile')
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not reopen project', e instanceof Error ? e.message : undefined)
      ),
  })

  const statusLabel =
    status === 'completed'
      ? 'completed'
      : status === 'approved'
        ? 'approved'
        : status === 'submitted_for_review'
          ? 'submitted for review'
          : status.replace(/_/g, ' ')

  return (
    <Alert
      tone="warning"
      title="Project is locked"
      action={
        canReopen ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => reopenMutation.mutate('reconcile')}
              isLoading={reopenMutation.isPending}
              className="min-h-[44px]"
            >
              Reopen matching
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => reopenMutation.mutate('sources')}
              isLoading={reopenMutation.isPending}
              className="min-h-[44px]"
            >
              Replace source files
            </Button>
          </div>
        ) : undefined
      }
    >
      This job is {statusLabel}, so uploads, mapping, and reconciliation cannot be changed.
      {canReopen
        ? ' Reopen matching to adjust pairs, or replace source files to upload new statements (returns to Upload/Map).'
        : ' Ask an admin or reviewer to reopen this project if changes are needed.'}
    </Alert>
  )
}
