import type { DateOrder } from '../lib/transactionDateOrder'

type Props = {
  value: DateOrder
  onChange: (next: DateOrder) => void
  disabled?: boolean
  /** Accessible name for the control group */
  ariaLabel?: string
  className?: string
}

/**
 * Shared Oldest / Newest first control for Reconcile tables and Clean downloads.
 */
export default function DateOrderToggle({
  value,
  onChange,
  disabled = false,
  ariaLabel = 'Transaction date order',
  className = '',
}: Props) {
  return (
    <div
      className={`inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('oldest_first')}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
          value === 'oldest_first'
            ? 'bg-gray-900 text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        title="January at top, December below"
      >
        Oldest first
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('newest_first')}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
          value === 'newest_first'
            ? 'bg-gray-900 text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        title="December at top, January below"
      >
        Newest first
      </button>
    </div>
  )
}
