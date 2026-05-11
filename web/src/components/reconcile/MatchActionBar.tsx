import { Link as LinkIcon } from 'lucide-react'

/**
 * Floating bottom-of-viewport action bar shown while there's a valid
 * cash-book × bank selection ready to be matched.  Renders selection counts
 * + Clear / Confirm Match buttons.  Pure-presentational; the page wires the
 * Confirm action to whichever mutation is appropriate (1:1, 1:N, N:1, N:N).
 */
interface MatchActionBarProps {
  cbCount: number
  bankCount: number
  isPending: boolean
  onClear: () => void
  onConfirm: () => void
}

export default function MatchActionBar({
  cbCount,
  bankCount,
  isPending,
  onClear,
  onConfirm,
}: MatchActionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Confirm reconcile match"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-center gap-6 border border-gray-800 bg-gray-900 bg-opacity-90 p-2 pl-6 text-white shadow-2xl backdrop-blur-md rounded-xl">
        <div className="flex items-center gap-4 py-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Selected for match
            </span>
            <span className="text-sm font-semibold">
              {cbCount} Book ↔ {bankCount} Bank
            </span>
          </div>
        </div>
        <div className="h-8 w-px bg-gray-800" aria-hidden="true" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-primary-500 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Matching…
              </>
            ) : (
              <>
                <LinkIcon className="w-4 h-4" />
                Confirm Match
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
