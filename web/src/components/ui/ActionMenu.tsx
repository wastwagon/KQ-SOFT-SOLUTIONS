import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import Button from './Button'

export type ActionMenuItem =
  | {
      kind: 'button'
      label: string
      onClick: () => void
      icon?: LucideIcon
      disabled?: boolean
      destructive?: boolean
    }
  | { kind: 'link'; label: string; to: string; icon?: LucideIcon }
  | { kind: 'separator' }

type ActionMenuProps = {
  label: ReactNode
  items: ActionMenuItem[]
  align?: 'left' | 'right'
  variant?: 'outline' | 'ghost' | 'secondary'
  size?: 'xs' | 'sm'
  menuAriaLabel?: string
  triggerClassName?: string
  isLoading?: boolean
}

const itemBase =
  'flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus-visible:bg-gray-50'

export default function ActionMenu({
  label,
  items,
  align = 'right',
  variant = 'outline',
  size = 'sm',
  menuAriaLabel = 'Actions',
  triggerClassName = '',
  isLoading,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const triggerId = useId()
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    return () => window.removeEventListener('mousedown', onPointer)
  }, [open])

  useEffect(() => {
    if (!open || !menuRef.current) return
    const focusables = getFocusableMenuItems(menuRef.current)
    focusables[0]?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const list = getFocusableMenuItems(menuRef.current!)
      if (list.length === 0) return
      const idx = list.indexOf(document.activeElement as HTMLElement)
      const next =
        e.key === 'ArrowDown'
          ? list[(idx + 1 + list.length) % list.length]
          : list[(idx - 1 + list.length) % list.length]
      next?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const close = () => setOpen(false)

  return (
    <div className="relative inline-block" ref={rootRef}>
      <Button
        ref={triggerRef}
        type="button"
        variant={variant}
        size={size}
        id={triggerId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        isLoading={isLoading}
        onClick={() => setOpen((v) => !v)}
        className={`gap-1 ${triggerClassName}`}
      >
        {label}
        <ChevronDown className={`h-3.5 w-3.5 opacity-70 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </Button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          aria-label={menuAriaLabel}
          className={`absolute top-full z-50 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-border bg-white py-1 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item, i) => {
            if (item.kind === 'separator') {
              return <div key={`sep-${i}`} role="separator" className="my-1 border-t border-gray-100" />
            }
            if (item.kind === 'link') {
              const Icon = item.icon
              return (
                <Link
                  key={item.to + item.label}
                  to={item.to}
                  role="menuitem"
                  tabIndex={-1}
                  onClick={close}
                  className={itemBase}
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden /> : null}
                  {item.label}
                </Link>
              )
            }
            const Icon = item.icon
            return (
              <button
                key={item.label + i}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                onClick={() => {
                  close()
                  item.onClick()
                }}
                className={`${itemBase} disabled:opacity-50 disabled:pointer-events-none ${
                  item.destructive ? 'text-red-700 hover:bg-red-50 hover:text-red-800' : ''
                }`}
              >
                {Icon ? <Icon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden /> : null}
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function getFocusableMenuItems(menu: HTMLElement): HTMLElement[] {
  return [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')]
}
