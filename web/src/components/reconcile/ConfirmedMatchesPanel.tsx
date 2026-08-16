import { useRef, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { formatAmount } from '../../lib/format'
import { useConfirm } from '../ui/ConfirmDialog'
import Button from '../ui/Button'
import Card from '../ui/Card'
import type { MatchedPair } from './types'

/**
 * Lists confirmed matches with per-row Evidence upload + Unmatch actions.
 *
 * Replaces the old `document.getElementById('match-evidence-input')` hack
 * with a single hidden input owned by this component and tracked via React
 * state — far easier to reason about and test.  Unmatch goes through the
 * branded confirm dialog so users can't accidentally undo work.
 */
interface ConfirmedMatchesPanelProps {
  matches: MatchedPair[]
  currency: string
  canReconcile: boolean
  onUnmatch: (matchId: string) => void
  isUnmatching: boolean
  onClearAll?: () => void
  isClearingAll?: boolean
  onUploadEvidence: (matchId: string, file: File) => void
  isUploading: boolean
  uploadingMatchId?: string | null
}

export default function ConfirmedMatchesPanel({
  matches,
  currency,
  canReconcile,
  onUnmatch,
  isUnmatching,
  onClearAll,
  isClearingAll,
  onUploadEvidence,
  isUploading,
  uploadingMatchId,
}: ConfirmedMatchesPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingMatchId, setPendingMatchId] = useState<string | null>(null)
  const confirm = useConfirm()

  const triggerEvidence = (matchId: string) => {
    setPendingMatchId(matchId)
    fileInputRef.current?.click()
  }

  return (
    <Card
      title="Confirmed matches"
      sublabel={canReconcile ? 'Click Unmatch to undo a match.' : 'View-only. Matches cannot be changed.'}
      actions={
        canReconcile && matches.length > 0 && onClearAll ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={async () => {
              const ok = await confirm({
                title: 'Clear all matches?',
                description:
                  'Every confirmed match on this project will be removed. Cash book and bank transactions return to the unmatched lists. This cannot be undone.',
                confirmLabel: 'Clear all',
                tone: 'danger',
              })
              if (ok) onClearAll()
            }}
            isLoading={isClearingAll}
            disabled={isUnmatching}
            className="shrink-0 text-red-700 border-red-200 hover:bg-red-50"
          >
            Clear all
          </Button>
        ) : undefined
      }
    >
      <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
        {matches.map((m) => (
          <li
            key={m.matchId}
            className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-border bg-white shadow-card"
          >
            <span className="flex-1 text-sm truncate text-gray-900">
              <span className="font-semibold">{m.cbTx.name || m.cbTx.details || '—'}</span>
              <span className="mx-1.5 text-green-600">↔</span>
              <span>{m.bankTx.name || m.bankTx.details || '—'}</span>
              <span className="ml-2 text-xs font-medium text-gray-500">
                {formatAmount(m.cbTx.amount, currency)}
              </span>
              {m.attachments && m.attachments.length > 0 && (
                <span
                  className="ml-2 inline-flex items-center text-primary-600"
                  title={`Evidence: ${m.attachments[0].filename}`}
                  aria-label="Has supporting evidence"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                </span>
              )}
            </span>
            {canReconcile && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => triggerEvidence(m.matchId)}
                  disabled={isUploading && uploadingMatchId !== m.matchId}
                  isLoading={isUploading && uploadingMatchId === m.matchId}
                  className="text-primary-600 hover:bg-primary-50"
                >
                  Evidence
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Remove this match?',
                      description:
                        'The cash book and bank transactions will move back to the unmatched list. Any uploaded evidence stays on the project but will no longer be linked to this match.',
                      confirmLabel: 'Unmatch',
                      tone: 'danger',
                    })
                    if (ok) onUnmatch(m.matchId)
                  }}
                  disabled={isUnmatching}
                  className="text-red-600 hover:bg-red-50"
                >
                  Unmatch
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && pendingMatchId) {
            onUploadEvidence(pendingMatchId, file)
          }
          setPendingMatchId(null)
          e.target.value = ''
        }}
      />
    </Card>
  )
}
