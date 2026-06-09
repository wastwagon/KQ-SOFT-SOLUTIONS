import { useMutation, useQueryClient } from '@tanstack/react-query'
import { projects, unlessSubscriptionInactive } from '../../lib/api'
import { canReopenProject } from '../../lib/permissions'
import { useToast } from '../ui/Toast'

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
    <div
      className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
      role="status"
    >
      <p>
        <strong className="font-semibold">Project is locked</strong> — this job is{' '}
        <strong className="capitalize">{statusLabel}</strong>, so uploads, mapping, and reconciliation cannot be
        changed.
      </p>
      {canReopen ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => reopenMutation.mutate()}
            disabled={reopenMutation.isPending}
            className="rounded-xl border border-amber-400 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            {reopenMutation.isPending ? 'Reopening…' : 'Reopen for editing'}
          </button>
          <span className="text-xs text-amber-800">
            Reopening returns the project to the reconciliation stage.
          </span>
        </div>
      ) : (
        <p className="mt-2 text-xs text-amber-800">
          Ask an admin or reviewer to reopen this project if changes are needed.
        </p>
      )}
    </div>
  )
}
