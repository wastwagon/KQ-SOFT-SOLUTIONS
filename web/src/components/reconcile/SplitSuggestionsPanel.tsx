import { formatAmount } from '../../lib/format'
import type { SuggestedSplitMatch, Tx } from './types'

/**
 * Premium split-suggestion cards for 1-to-many or many-to-1 reconciliation
 * candidates (typically bulk deposits or aggregated payments).  Clicking a
 * card pre-selects every cash-book and bank id in the proposed group so the
 * floating action bar can confirm the multi-match.
 */
interface SplitSuggestionsPanelProps {
  suggestions: SuggestedSplitMatch[]
  currency: string
  features?: Record<string, boolean>
  selectedCbIds: Set<string>
  selectedBankIds: Set<string>
  onSelectGroup: (cbIds: string[], bankIds: string[]) => void
  onForgetMemory?: (memoryId: string) => void
  isForgettingMemory?: boolean
}

export default function SplitSuggestionsPanel({
  suggestions,
  currency,
  features,
  selectedCbIds,
  selectedBankIds,
  onSelectGroup,
  onForgetMemory,
  isForgettingMemory = false,
}: SplitSuggestionsPanelProps) {
  return (
    <section className="rounded-xl border border-primary-200/80 bg-primary-50/50 p-5 shadow-sm">
      <header className="flex items-center gap-2 mb-3">
        <span className="px-2 py-0.5 bg-primary-600 text-white text-[10px] font-bold rounded uppercase tracking-wider">
          Premium
        </span>
        <h3 className="text-base font-bold text-primary-900 tracking-tight">Split suggestions</h3>
      </header>
      <p className="text-sm text-primary-800/90 mb-4">
        These items appear to be bulk deposits or multi-item payments. Click to select the group.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {suggestions.map((s, i) => {
          const allSelected =
            s.cashBookTxs.every((t: Tx) => selectedCbIds.has(t.id)) &&
            s.bankTxs.every((t: Tx) => selectedBankIds.has(t.id))
          return (
            <button
              key={i}
              type="button"
              onClick={() =>
                onSelectGroup(
                  s.cashBookTxs.map((t) => t.id),
                  s.bankTxs.map((t) => t.id)
                )
              }
              className={`flex flex-col gap-1 w-full text-left px-4 py-3 rounded-xl border transition-all ${
                allSelected
                  ? 'border-primary-400 bg-primary-100 shadow-sm'
                  : 'border-primary-200/50 bg-white hover:bg-primary-50'
              }`}
            >
              <div className="flex justify-between items-start mb-1 gap-2">
                <span className="text-[10px] font-bold text-primary-700 uppercase">{s.reason}</span>
                <span className="flex items-center gap-1 shrink-0">
                  {features?.ai_suggestions &&
                    (s.orgMemoryBoosted || /org memory/i.test(s.reason)) && (
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-900 normal-case tracking-normal"
                        title={
                          s.orgMemoryConfirmations
                            ? `Boosted from ${s.orgMemoryConfirmations} prior confirmation(s) of a similar split group`
                            : 'Boosted because your organisation confirmed a similar split group before'
                        }
                      >
                        Learned
                        {s.orgMemoryConfirmations != null && s.orgMemoryConfirmations > 0
                          ? ` · ${s.orgMemoryConfirmations}×`
                          : ''}
                      </span>
                      {onForgetMemory && s.orgMemoryId && (
                        <button
                          type="button"
                          disabled={isForgettingMemory}
                          onClick={(e) => {
                            e.stopPropagation()
                            onForgetMemory(s.orgMemoryId!)
                          }}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-emerald-800/80 hover:bg-emerald-200/80 normal-case tracking-normal disabled:opacity-50"
                          title="Stop boosting suggestions from this learned pattern"
                        >
                          Forget
                        </button>
                      )}
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-gray-500">
                    {Math.round(s.confidence * 100)}% Match
                  </span>
                </span>
              </div>
              <div className="text-xs text-gray-900">
                <div className="font-semibold mb-0.5">Book: {s.cashBookTxs.length} item(s)</div>
                <div className="font-semibold">Bank: {s.bankTxs.length} item(s)</div>
              </div>
              <div className="mt-2 pt-2 border-t border-primary-100 flex justify-between items-center">
                <span className="text-xs font-bold text-primary-900">
                  {formatAmount(
                    s.cashBookTxs.reduce((sum: number, t: Tx) => sum + t.amount, 0),
                    currency
                  )}
                </span>
                <span className="text-[10px] text-primary-600 font-medium italic">
                  Click to match group
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
