import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, ChevronDown, LogOut, Settings, ShieldCheck, type LucideIcon } from 'lucide-react'
import { useAuth } from '../store/auth'
import Badge from './ui/Badge'
import Button from './ui/Button'

function roleLabel(role: string | null | undefined) {
  if (role === 'admin') return 'Admin'
  if (role === 'reviewer') return 'Reviewer'
  if (role === 'preparer') return 'Preparer'
  if (role === 'viewer') return 'Viewer'
  return null
}

function roleTone(role: string | null | undefined): 'brand' | 'success' | 'neutral' {
  if (role === 'admin' || role === 'preparer') return 'brand'
  if (role === 'reviewer') return 'success'
  return 'neutral'
}

type AccountMenuProps = {
  /** Extra items at the top of the menu (e.g. back to workspace). */
  extraItems?: { to: string; label: string; icon?: LucideIcon }[]
}

export default function AccountMenu({ extraItems = [] }: AccountMenuProps) {
  const navigate = useNavigate()
  const { user, role, logout, isPlatformAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const label = roleLabel(role)
  const initial = user?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
    }
  }, [open])

  function handleLogout() {
    setOpen(false)
    logout()
    navigate('/login')
  }

  const itemClass =
    'flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900'

  return (
    <div className="relative" ref={rootRef}>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => setOpen((v) => !v)}
        className="gap-2 p-1 pr-1.5 h-auto"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
          {initial}
        </span>
        <ChevronDown className={`hidden h-3.5 w-3.5 text-gray-400 sm:block ${open ? 'rotate-180' : ''}`} aria-hidden />
      </Button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-white py-1 shadow-lg"
        >
          <div className="border-b border-gray-100 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-gray-900">{user?.name || 'User'}</p>
            <p className="truncate text-xs text-gray-500">{user?.email}</p>
            {label && (
              <div className="mt-2">
                <Badge tone={roleTone(role)} size="sm">
                  {label}
                </Badge>
              </div>
            )}
          </div>
          {extraItems.map((item) => {
            const Icon = item.icon ?? Settings
            return (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={itemClass}
              >
                <Icon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                {item.label}
              </Link>
            )
          })}
          <Link to="/settings/branding" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
            <Settings className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
            Settings
          </Link>
          <Link to="/manual" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
            <BookOpen className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
            Help
          </Link>
          {isPlatformAdmin && (
            <Link to="/platform-admin" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
              <ShieldCheck className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
              Platform admin
            </Link>
          )}
          <div className="mt-1 border-t border-gray-100 pt-1">
            <Button
              type="button"
              variant="ghost"
              role="menuitem"
              onClick={handleLogout}
              className={`${itemClass} h-auto min-h-0 rounded-none !justify-start`}
            >
              <LogOut className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
              Sign out
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
