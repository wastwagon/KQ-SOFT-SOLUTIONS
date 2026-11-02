import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../components/ui/Toast'
import CountMatchUxChecklistModal from '../components/reconcile/CountMatchUxChecklistModal'
import {
  getCountMatchUxSignoff,
  type CountMatchUxSignoff,
} from './countMatchUxSignoff'

export function useCountMatchUxSignoff(projectId: string, projectLabel?: string) {
  const toast = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [signoff, setSignoff] = useState<CountMatchUxSignoff | null>(() =>
    projectId ? getCountMatchUxSignoff(projectId) : null,
  )

  useEffect(() => {
    setSignoff(projectId ? getCountMatchUxSignoff(projectId) : null)
  }, [projectId])

  const onSaved = useCallback(
    (next: CountMatchUxSignoff | null) => {
      setSignoff(next)
      if (!next) {
        toast.info('Sign-off cleared', 'Run Preparer check again when ready.')
        return
      }
      if (next.result === 'pass') {
        toast.success(
          'Preparer check recorded',
          'Safe to consider further count-match UI compaction for this browser.',
        )
      } else {
        toast.warning(
          'Issues recorded',
          'Do not hide badges or primary CTAs until issues are fixed.',
        )
      }
    },
    [toast],
  )

  const openChecklist = useCallback(() => setModalOpen(true), [])
  const closeChecklist = useCallback(() => setModalOpen(false), [])

  const checklistModal = projectId ? (
    <CountMatchUxChecklistModal
      open={modalOpen}
      onClose={closeChecklist}
      projectId={projectId}
      projectLabel={projectLabel}
      existing={signoff}
      onSaved={onSaved}
    />
  ) : null

  return { signoff, openChecklist, checklistModal }
}
