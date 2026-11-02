import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  FileCheck,
  FileSpreadsheet,
  FolderKanban,
  Landmark,
  LayoutDashboard,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { clients, projects, subscription, workspace } from '../lib/api'
import { rankPaletteItems } from '../lib/commandPaletteSearch'
import { readRecentNav, rememberRecentNav } from '../lib/commandPaletteRecent'
import {
  agentPicksToPaletteItems,
  shouldUseWorkspaceAgent,
} from '../lib/workspaceAgentSearch'
import { normalizeClientsList } from '../lib/clientsPayload'
import { canCreateProject } from '../lib/permissions'
import { useAuth } from '../store/auth'
import { useFocusTrap } from '../lib/focusTrap'
import { projectPathForStatus } from '../lib/projectRoutes'
import Button from './ui/Button'
import Alert from './ui/Alert'

type PaletteItem = {
  id: string
  label: string
  hint?: string
  group: string
  to: string
  keywords?: string
}

type CommandPaletteProps = {
  variant?: 'workspace' | 'admin'
}

function isMacClient() {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
}

export default function CommandPalette({ variant = 'workspace' }: CommandPaletteProps) {
  const navigate = useNavigate()
  const role = useAuth((s) => s.role)
  const isPlatformAdmin = useAuth((s) => s.isPlatformAdmin)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [recentNav, setRecentNav] = useState<ReturnType<typeof readRecentNav>>([])
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const mac = isMacClient()

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: () => projects.list({ limit: 50 }),
    enabled: open && variant === 'workspace',
    staleTime: 30_000,
  })
  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: clients.list,
    enabled: open && variant === 'workspace',
    staleTime: 60_000,
  })
  const clientRows = useMemo(
    () => normalizeClientsList(clientsQuery.data),
    [clientsQuery.data]
  )
  const usageQuery = useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: subscription.getUsage,
    enabled: open && variant === 'workspace',
    staleTime: 60_000,
  })

  useEffect(() => {
    if (open && variant === 'workspace') setRecentNav(readRecentNav())
  }, [open, variant])

  const features = (usageQuery.data?.features || {}) as Record<string, boolean>
  const projectRows = projectsQuery.data?.projects ?? []

  useEffect(() => {
    if (!open) {
      setDebouncedQuery('')
      return
    }
    const t = window.setTimeout(() => setDebouncedQuery(query), 380)
    return () => window.clearTimeout(t)
  }, [query, open])

  const agentEnabled =
    variant === 'workspace' &&
    Boolean(features.ai_suggestions) &&
    shouldUseWorkspaceAgent(debouncedQuery)

  const agentQuery = useQuery({
    queryKey: ['workspace', 'agent-search', debouncedQuery],
    queryFn: () => workspace.agentSearch({ query: debouncedQuery }),
    enabled: open && agentEnabled,
    staleTime: 45_000,
    retry: false,
  })

  const items = useMemo(() => {
    const list: PaletteItem[] = []
    if (variant === 'admin') {
      list.push(
        { id: 'admin-home', label: 'Platform overview', group: 'Platform', to: '/platform-admin', keywords: 'admin dashboard ops' },
        { id: 'admin-orgs', label: 'Organizations', group: 'Platform', to: '/platform-admin/organizations' },
        { id: 'admin-users', label: 'Users', group: 'Platform', to: '/platform-admin/users' },
        { id: 'admin-plans', label: 'Plans', group: 'Platform', to: '/platform-admin/plans' },
        { id: 'admin-payments', label: 'Payments', group: 'Platform', to: '/platform-admin/payments' },
        { id: 'admin-revenue', label: 'Revenue', group: 'Platform', to: '/platform-admin/revenue' },
        { id: 'admin-ops-hub', label: 'Ops hub', group: 'Platform', to: '/platform-admin/ops', keywords: 'health retention database metrics' },
        { id: 'admin-ops', label: 'Ops metrics', group: 'Platform', to: '/platform-admin/ops-metrics', keywords: 'parse ocr queue' },
        { id: 'admin-leads', label: 'Leads', group: 'Platform', to: '/platform-admin/leads' },
        { id: 'admin-retention', label: 'Data retention', group: 'Platform', to: '/platform-admin/retention' },
        { id: 'admin-gen', label: 'Generation settings', group: 'Platform', to: '/platform-admin/generation-settings' },
        { id: 'admin-db', label: 'Database', group: 'Platform', to: '/platform-admin/database' },
        { id: 'admin-tools-hub', label: 'Tools', group: 'Platform', to: '/platform-admin/tools', keywords: 'clean bank cash book worker' },
        { id: 'admin-clean-bank', label: 'Clean bank statement', group: 'Tools', to: '/platform-admin/tools/clean-bank-statement' },
        { id: 'admin-clean-cb', label: 'Clean cash book', group: 'Tools', to: '/platform-admin/tools/clean-cash-book' },
        { id: 'ws', label: 'Back to organisation home', group: 'Organisation', to: '/dashboard' }
      )
      return list
    }

    for (const r of recentNav) {
      list.push({
        id: `recent-${r.id}`,
        label: r.label,
        hint: r.hint ? `Recent · ${r.hint}` : 'Recent',
        group: 'Recent',
        to: r.to,
        keywords: 'recent history',
      })
    }

    list.push(
      {
        id: 'qf-reconciling',
        label: 'Reconciling projects',
        group: 'Quick filters',
        to: '/projects?status=reconciling',
        keywords: 'reconcile rec matching filter list',
      },
      {
        id: 'qf-review',
        label: 'Projects awaiting review',
        group: 'Quick filters',
        to: '/projects?status=submitted_for_review',
        keywords: 'review submitted filter',
      },
      {
        id: 'qf-draft',
        label: 'Draft projects',
        group: 'Quick filters',
        to: '/projects?status=draft',
        keywords: 'upload draft filter',
      },
      { id: 'dash', label: 'Dashboard', group: 'Go to', to: '/dashboard', keywords: 'home overview' },
      { id: 'projects', label: 'Projects', group: 'Go to', to: '/projects', keywords: 'list jobs engagements' },
      { id: 'clients', label: 'Clients', group: 'Go to', to: '/clients' },
      { id: 'reports', label: 'Reports', group: 'Go to', to: '/reports' },
      { id: 'tools-hub', label: 'Tools', group: 'Tools', to: '/tools', keywords: 'clean bank cash book export' },
      { id: 'clean-bank', label: 'Clean bank statement', group: 'Tools', to: '/tools/clean-bank-statement' },
      { id: 'clean-cb', label: 'Clean cash book', group: 'Tools', to: '/tools/clean-cash-book' },
      { id: 'settings', label: 'Settings', group: 'Settings', to: '/settings/branding' },
      { id: 'branding', label: 'Branding', group: 'Settings', to: '/settings/branding', keywords: 'logo colours' },
      { id: 'billing', label: 'Billing', group: 'Settings', to: '/settings/billing', keywords: 'plan subscription paystack' },
      { id: 'members', label: 'Team members', group: 'Settings', to: '/settings/members', keywords: 'invite' },
      { id: 'connections', label: 'Bank import', group: 'Settings', to: '/settings/connections', keywords: 'bank feeds import upload' },
    )
    if (canCreateProject(role)) {
      list.push({
        id: 'new-project',
        label: 'New project',
        group: 'Go to',
        to: '/projects/new',
        keywords: 'create',
      })
    }
    if (features.api_access) {
      list.push({ id: 'api-keys', label: 'API keys', group: 'Settings', to: '/settings/api-keys' })
    }
    if (features.bank_rules) {
      list.push({ id: 'bank-rules', label: 'Bank rules', group: 'Settings', to: '/settings/bank-rules' })
    }
    if (features.audit_trail) {
      list.push({ id: 'audit', label: 'Audit log', group: 'Go to', to: '/audit' })
    }
    list.push({ id: 'help', label: 'User manual', group: 'Go to', to: '/manual', keywords: 'help docs' })
    if (isPlatformAdmin) {
      list.push({
        id: 'platform',
        label: 'Platform admin',
        group: 'Go to',
        to: '/platform-admin',
        keywords: 'ops customers organisations',
      })
    }
    for (const p of projectRows) {
      list.push({
        id: `project-${p.id}`,
        label: p.name,
        hint: p.client?.name ? `${p.status.replace(/_/g, ' ')} · ${p.client.name}` : p.status.replace(/_/g, ' '),
        group: 'Projects',
        to: projectPathForStatus(p.slug || p.id, p.status),
        keywords: `${p.slug} ${p.client?.name ?? ''} reconcile report map review upload`,
      })
    }
    for (const c of clientRows) {
      list.push({
        id: `client-${c.id}`,
        label: c.name,
        hint: 'View client projects',
        group: 'Clients',
        to: `/projects?clientId=${encodeURIComponent(c.id)}`,
        keywords: 'client filter',
      })
    }
    return list
  }, [
    variant,
    role,
    features.api_access,
    features.bank_rules,
    features.audit_trail,
    isPlatformAdmin,
    projectRows,
    clientRows,
    recentNav,
  ])

  const filtered = useMemo(() => {
    const ranked = rankPaletteItems(items, query)
    let base: PaletteItem[]
    if (query.trim()) {
      base = ranked
    } else {
      let projectShown = 0
      let clientShown = 0
      base = ranked.filter((item) => {
        if (item.group === 'Recent') return true
        if (item.group === 'Quick filters') return true
        if (item.group === 'Projects') {
          projectShown += 1
          return projectShown <= 8
        }
        if (item.group === 'Clients') {
          clientShown += 1
          return clientShown <= 6
        }
        return true
      })
    }

    const agentPicks = agentQuery.data?.picks ?? []
    if (agentPicks.length === 0) return base

    const existingPaths = new Set(base.map((i) => i.to))
    const agentItems = agentPicksToPaletteItems(agentPicks, new Set()) as PaletteItem[]
    const merged = [...agentItems.filter((a) => !existingPaths.has(a.to)), ...base]
    return merged
  }, [items, query, agentQuery.data?.picks])

  useEffect(() => {
    setActive(0)
  }, [query, open])

  useFocusTrap(open, dialogRef, { initialFocusRef: inputRef })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return
      if (e.repeat) return
      const modal = document.querySelector('[aria-modal="true"]')
      if (modal && !open) return
      e.preventDefault()
      setOpen((v) => !v)
      setQuery('')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, open, filtered])

  function close() {
    setOpen(false)
    setQuery('')
  }

  function go(item: PaletteItem) {
    if (variant === 'workspace') {
      rememberRecentNav({
        id: item.id.replace(/^recent-/, ''),
        label: item.label,
        to: item.to,
        hint: item.hint?.replace(/^Recent · /, ''),
      })
    }
    close()
    navigate(item.to)
  }

  function onDialogKey(e: ReactKeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(filtered.length - 1, i + 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = filtered[active]
      if (item) go(item)
    }
  }

  const groups = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, PaletteItem[]>()
    for (const item of filtered) {
      if (!map.has(item.group)) {
        map.set(item.group, [])
        order.push(item.group)
      }
      map.get(item.group)!.push(item)
    }
    return order.map((group) => ({ group, items: map.get(group)! }))
  }, [filtered])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setQuery('')
          setOpen(true)
        }}
        className="gap-2 text-gray-500 min-h-[44px] min-w-[44px] sm:min-w-0 px-2.5 sm:px-3"
        aria-label="Search organisation (Command K)"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <span className="sr-only sm:not-sr-only sm:inline">Search</span>
        <kbd className="hidden sm:inline rounded border border-border bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
          {mac ? '⌘K' : 'Ctrl+K'}
        </kbd>
      </Button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center px-0 pt-0 sm:items-start sm:px-4 sm:pt-[15vh] safe-bottom">
          <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            tabIndex={-1}
            onKeyDown={onDialogKey}
            className="relative z-10 flex w-full max-w-lg max-h-[min(88dvh,32rem)] flex-col overflow-hidden rounded-t-2xl border border-border bg-white shadow-xl outline-none sm:max-h-none sm:rounded-xl"
          >
            <div className="flex items-center gap-2 border-b border-gray-100 px-3">
              <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pages, projects, clients — or ask “where is my reconciling project?”"
                className="min-h-[48px] w-full border-0 bg-transparent py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                aria-controls="command-palette-list"
                aria-activedescendant={filtered[active] ? `cmd-${filtered[active]!.id}` : undefined}
                autoComplete="off"
              />
            </div>
            <div
              id="command-palette-list"
              ref={listRef}
              role="listbox"
              className="max-h-[min(24rem,50vh)] overflow-y-auto py-2"
            >
              {variant === 'workspace' && agentEnabled && agentQuery.isFetching && (
                <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-500">
                  <Sparkles className="h-3.5 w-3.5 text-primary-500 animate-pulse" aria-hidden />
                  Navigator is finding the best place to go…
                </div>
              )}
              {variant === 'workspace' && agentQuery.data?.answer && (
                <div className="mx-2 mb-2 rounded-lg border border-primary-100 bg-primary-50/80 px-3 py-2 text-sm text-primary-950">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-700">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    Navigator
                  </p>
                  <p className="mt-1 text-sm leading-snug">{agentQuery.data.answer}</p>
                </div>
              )}
              {projectsQuery.isError && variant === 'workspace' && (
                <div className="px-2 pb-2">
                  <Alert
                    tone="warning"
                    title="Projects could not be loaded"
                    className="!p-3"
                  >
                    Page shortcuts still work.
                  </Alert>
                </div>
              )}
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500 space-y-2">
                  <p>No matches for &ldquo;{query}&rdquo;.</p>
                  <p className="text-xs text-gray-400">
                    Try shorthand: <span className="font-medium text-gray-500">rec</span> (reconcile),{' '}
                    <span className="font-medium text-gray-500">brs</span> (report), a project name, or a full
                    question for the navigator.
                  </p>
                </div>
              ) : (
                groups.map(({ group, items: groupItems }) => (
                  <div key={group} className="px-2 pb-1">
                    <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      {group}
                    </p>
                    {groupItems.map((item) => {
                      const index = filtered.findIndex((x) => x.id === item.id)
                      const Icon = iconFor(item)
                      return (
                        <button
                          key={item.id}
                          id={`cmd-${item.id}`}
                          type="button"
                          role="option"
                          aria-selected={index === active}
                          data-active={index === active ? 'true' : undefined}
                          onMouseEnter={() => setActive(index)}
                          onClick={() => go(item)}
                          className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm ${
                            index === active ? 'bg-primary-50 text-primary-900' : 'text-gray-800 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{item.label}</span>
                            {item.hint && <span className="block truncate text-xs text-gray-500">{item.hint}</span>}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
            <p className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">
              ↑↓ to move · Enter to open · Esc to close
              {variant === 'workspace' && features.ai_suggestions ? ' · Ask in plain English for AI suggestions' : ''}
            </p>
          </div>
        </div>
      )}
    </>
  )
}

function iconFor(item: PaletteItem) {
  if (item.group === 'Navigator') return Sparkles
  if (item.group === 'Projects' || item.id === 'projects' || item.id === 'new-project') return FolderKanban
  if (item.id === 'clients') return Users
  if (item.id === 'reports' || item.id === 'audit') return FileCheck
  if (item.id.includes('clean-bank')) return Landmark
  if (item.id.includes('clean-cb') || item.id.includes('clean-cash')) return FileSpreadsheet
  if (item.group === 'Settings' || item.id === 'settings') return Settings
  if (item.id === 'help') return BookOpen
  if (item.id === 'platform' || item.group === 'Platform') return ShieldCheck
  return LayoutDashboard
}
