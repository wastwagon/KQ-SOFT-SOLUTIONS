import { Link as LinkIcon } from 'lucide-react'
import Button from '../ui/Button'

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
      <div className="flex items-center gap-6 border border-gray-800 bg-gray-900/90 p-2 pl-6 text-white shadow-2xl backdrop-blur-md rounded-xl">
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-gray-300 hover:text-white hover:bg-white/10"
          >
            Clear
          </Button>
          <Button type="button" size="sm" onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <span className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden />
                Matching…
              </>
            ) : (
              <>
                <LinkIcon className="w-4 h-4 mr-2" aria-hidden />
                Confirm Match
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
