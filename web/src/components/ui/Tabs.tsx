import { type ButtonHTMLAttributes, type ReactNode } from 'react'

export interface TabItem<T extends string = string> {
  id: T
  label: ReactNode
  disabled?: boolean
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  /** Accessible name for the tablist. */
  'aria-label': string
  className?: string
  size?: 'sm' | 'md'
}

/**
 * Segmented tabs — matches Figma golden-path toolbar (Receipts vs Credits, etc.).
 */
export default function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  'aria-label': ariaLabel,
  className = '',
  size = 'md',
}: TabsProps<T>) {
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex flex-wrap rounded-xl border border-gray-200 bg-gray-50/50 p-0.5 shadow-sm ${className}`}
    >
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={`rounded-xl font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none ${pad} ${
              active ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export interface TabButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}
