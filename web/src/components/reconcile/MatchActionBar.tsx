import { useEffect } from 'react'
import { Link as LinkIcon } from 'lucide-react'
import Button from '../ui/Button'

/**
 * Floating bottom-of-viewport action bar shown while there's a valid
 * cash-book × bank selection ready to be matched. Enter confirms when
 * focus is not in a field.
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || isPending || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if (!(t instanceof HTMLElement)) return
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) {
        return
      }
      e.preventDefault()
      onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPending, onConfirm])

  return (
    <div
      role="toolbar"
      aria-label="Confirm reconcile match"
      className="fixed z-40 left-0 right-0 px-3 sm:px-4 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:left-1/2 lg:right-auto lg:bottom-6 lg:-translate-x-1/2 lg:px-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="mx-auto flex max-w-[min(100%,42rem)] flex-col gap-2 border border-gray-800 bg-gray-900/90 p-2 text-white shadow-2xl backdrop-blur-md rounded-xl sm:flex-row sm:items-center sm:gap-4 sm:pl-4">
        <div className="flex items-center gap-4 px-2 py-1 sm:py-2 sm:pl-2">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Selected for match
            </span>
            <span className="text-sm font-semibold truncate">
              {cbCount} Book ↔ {bankCount} Bank
            </span>
          </div>
        </div>
        <div className="hidden sm:block h-8 w-px bg-gray-800 shrink-0" aria-hidden="true" />
        <div className="flex items-center gap-2 px-2 pb-1 sm:pb-0 sm:pr-2 sm:ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-gray-300 hover:text-white hover:bg-white/10"
          >
            Clear
          </Button>
          <Button type="button" size="sm" onClick={onConfirm} disabled={isPending} isLoading={isPending}>
            <LinkIcon className="w-4 h-4 mr-2" aria-hidden />
            Confirm match
            <kbd className="ml-2 hidden sm:inline rounded border border-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white/70">
              Enter
            </kbd>
          </Button>
        </div>
      </div>
    </div>
  )
}
