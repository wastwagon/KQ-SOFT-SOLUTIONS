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
  onReopened?: () => void
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
    mutationFn: () => projects.reopen(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['report', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['reconcile', projectId] })
      toast.success('Project reopened', 'Sign-off cleared — you can edit uploads, mapping, and matches again.')
      onReopened?.()
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => reopenMutation.mutate()}
            isLoading={reopenMutation.isPending}
          >
            Reopen for editing
          </Button>
        ) : undefined
      }
    >
      This job is {statusLabel}, so uploads, mapping, and reconciliation cannot be changed.
      {canReopen
        ? ' Reopening returns the project to the reconciliation stage.'
        : ' Ask an admin or reviewer to reopen this project if changes are needed.'}
    </Alert>
  )
}
