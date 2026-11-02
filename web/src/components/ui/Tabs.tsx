import { useCallback, useRef, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'
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
  const tablistRef = useRef<HTMLDivElement>(null)

  const focusTab = useCallback((id: T) => {
    const root = tablistRef.current
    if (!root) return
    const el = root.querySelector<HTMLButtonElement>(`[data-tab-id="${CSS.escape(String(id))}"]`)
    el?.focus()
  }, [])

  const moveFocus = useCallback(
    (fromId: T, delta: number) => {
      const enabled = items.filter((i) => !i.disabled)
      const idx = enabled.findIndex((i) => i.id === fromId)
      if (idx < 0 || enabled.length === 0) return
      const next = enabled[(idx + delta + enabled.length) % enabled.length]
      onChange(next.id)
      focusTab(next.id)
    },
    [items, onChange, focusTab]
  )

  const onTabListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.filter((i) => !i.disabled)
    if (enabled.length === 0) return
    const current = enabled.find((i) => i.id === value) ?? enabled[0]

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        moveFocus(current.id, 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        moveFocus(current.id, -1)
        break
      case 'Home':
        e.preventDefault()
        onChange(enabled[0].id)
        focusTab(enabled[0].id)
        break
      case 'End':
        e.preventDefault()
        onChange(enabled[enabled.length - 1].id)
        focusTab(enabled[enabled.length - 1].id)
        break
      default:
        break
    }
  }

  return (
    <div
      ref={tablistRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onTabListKeyDown}
      className={`inline-flex max-w-full flex-nowrap overflow-x-auto rounded-xl border border-border bg-gray-50/50 p-0.5 shadow-card [-webkit-overflow-scrolling:touch] ${className}`}
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
            tabIndex={active ? 0 : -1}
            data-tab-id={item.id}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={`shrink-0 ${pad ?? ''}`}
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
