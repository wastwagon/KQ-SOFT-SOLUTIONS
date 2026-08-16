import type { DateOrder } from '../lib/transactionDateOrder'
import Button from './ui/Button'

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
      className={`inline-flex rounded-lg border border-border bg-white p-0.5 shadow-card ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      <Button
        type="button"
        size="xs"
        variant="ghost"
        disabled={disabled}
        aria-pressed={value === 'oldest_first'}
        onClick={() => onChange('oldest_first')}
        className={
          value === 'oldest_first'
            ? '!bg-gray-900 !text-white hover:!bg-gray-800'
            : 'text-gray-600 hover:text-gray-900'
        }
        title="January at top, December below"
      >
        Oldest first
      </Button>
      <Button
        type="button"
        size="xs"
        variant="ghost"
        disabled={disabled}
        aria-pressed={value === 'newest_first'}
        onClick={() => onChange('newest_first')}
        className={
          value === 'newest_first'
            ? '!bg-gray-900 !text-white hover:!bg-gray-800'
            : 'text-gray-600 hover:text-gray-900'
        }
        title="December at top, January below"
      >
        Newest first
      </Button>
    </div>
  )
}
