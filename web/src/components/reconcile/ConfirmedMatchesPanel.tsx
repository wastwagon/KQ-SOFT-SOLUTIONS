import { useRef, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { formatAmount } from '../../lib/format'
import { useConfirm } from '../ui/ConfirmDialog'
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
    <section className="rounded-xl border border-green-200/80 bg-green-50/80 p-5 shadow-sm">
      <h3 className="text-base font-bold text-green-900 tracking-tight mb-1">Confirmed matches</h3>
      <p className="text-sm text-green-800/90 mb-4">
        {canReconcile ? 'Click Unmatch to undo a match.' : 'View-only. Matches cannot be changed.'}
      </p>
      <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
        {matches.map((m) => (
          <li
            key={m.matchId}
            className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-green-200/70 bg-white shadow-sm"
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
                <button
                  type="button"
                  onClick={() => triggerEvidence(m.matchId)}
                  disabled={isUploading}
                  className="px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isUploading && uploadingMatchId === m.matchId ? 'Uploading…' : 'Evidence'}
                </button>
                <button
                  type="button"
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
                  className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  Unmatch
                </button>
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
    </section>
  )
}
