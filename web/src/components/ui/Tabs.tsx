import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import Button from './Button'

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
  const pad = size === 'sm' ? undefined : 'px-3.5 py-1.5 text-sm'

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex flex-wrap rounded-xl border border-border bg-gray-50/50 p-0.5 shadow-card ${className}`}
    >
      {items.map((item) => {
        const active = item.id === value
        return (
          <Button
            key={item.id}
            type="button"
            size="xs"
            variant={active ? 'primary' : 'ghost'}
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={pad}
          >
            {item.label}
          </Button>
        )
      })}
    </div>
  )
}

export interface TabButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}
