import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, Menu, X } from 'lucide-react'
import { useFocusTrap } from '../../lib/focusTrap'
import { SIDEBAR_WIDTH, sidebarSectionLabelClass } from './sidebarStyles'
import Button from '../ui/Button'

type SidebarShellProps = {
  open: boolean
  onOpen: () => void
  onClose: () => void
  sidebar: ReactNode
  topBarEnd?: ReactNode
  banners?: ReactNode
  children: ReactNode
  sidebarLabel?: string
  topBarStart?: ReactNode
}

/**
 * Untitled UI–style app shell: 280px labeled sidebar + sticky top bar + main.
 * Desktop: static sidebar. Mobile: slide-over drawer with overlay + focus trap.
 */
export default function SidebarShell({
  open,
  onOpen,
  onClose,
  sidebar,
  topBarEnd,
  banners,
  children,
  sidebarLabel = 'Main navigation',
  topBarStart,
}: SidebarShellProps) {
  const asideRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useFocusTrap(open, asideRef, {
    restoreFocusRef: menuButtonRef,
  })

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  return (
    <div className="min-h-screen bg-surface flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-gray-900 focus:ring-2 focus:ring-primary-500"
      >
        Skip to main content
      </a>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        ref={asideRef}
        id="app-sidebar-nav"
        tabIndex={-1}
        className={`
          fixed lg:static inset-y-0 left-0 z-50 ${SIDEBAR_WIDTH} bg-white border-r border-border flex flex-col
          transform transition-transform duration-200 ease-out lg:transform-none
          outline-none
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        aria-label={sidebarLabel}
        {...(open
          ? {
              role: 'dialog' as const,
              'aria-modal': true as const,
            }
          : {})}
      >
        {sidebar}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-4 lg:px-6 border-b border-border bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/90">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              ref={menuButtonRef}
              type="button"
              variant="ghost"
              size="xs"
              onClick={onOpen}
              className="p-2 text-gray-500 lg:hidden"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="app-sidebar-nav"
            >
              <Menu className="w-5 h-5" />
            </Button>
            {topBarStart}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">{topBarEnd}</div>
        </header>

        {banners}

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-8 outline-none"
        >
          <div className="max-w-[1600px] mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  )
}

type SidebarHeaderProps = {
  children: ReactNode
  onClose: () => void
}

export function SidebarHeader({ children, onClose }: SidebarHeaderProps) {
  return (
    <div className="flex items-center justify-between h-16 px-4 border-b border-border-muted shrink-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">{children}</div>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={onClose}
        className="p-2 text-gray-500 lg:hidden shrink-0"
        aria-label="Close menu"
      >
        <X className="w-5 h-5" />
      </Button>
    </div>
  )
}

type SidebarNavSectionProps = {
  label: string
  children: ReactNode
  active?: boolean
  defaultOpen?: boolean
}

export function SidebarNavSection({
  label,
  children,
  active = false,
  defaultOpen = true,
}: SidebarNavSectionProps) {
  const panelId = useId()
  const [userOpen, setUserOpen] = useState(defaultOpen)
  const open = active || userOpen

  return (
    <div className="space-y-0.5">
      <Button
        type="button"
        variant="ghost"
        className={`${sidebarSectionLabelClass} w-full !justify-between h-auto hover:text-gray-600`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setUserOpen((v) => !v)}
      >
        <span>{label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
          aria-hidden
        />
      </Button>
      <div id={panelId} role="group" aria-label={label} hidden={!open} className={open ? 'space-y-0.5' : undefined}>
        {open ? children : null}
      </div>
    </div>
  )
}
