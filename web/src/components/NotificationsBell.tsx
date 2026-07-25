import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { audit, projects, subscription, isSubscriptionInactiveError } from '../lib/api'
import { useAuth } from '../store/auth'
import { formatDate } from '../lib/format'

const LAST_SEEN_KEY = 'brs_notifications_last_seen'

const AUDIT_ACTIONS = new Set([
  'project_submitted',
  'project_approved',
  'project_reopened',
  'match_bulk',
  'report_exported',
  'reconciliation_undone',
])

type NotifItem = {
  id: string
  title: string
  body?: string
  href?: string
  createdAt: string
  unread: boolean
}

function readLastSeen(): number {
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY)
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function writeLastSeen(ts: number) {
  try {
    localStorage.setItem(LAST_SEEN_KEY, String(ts))
  } catch {
    /* ignore */
  }
}

/**
 * In-app notification bell — derives items from subscription status, projects
 * awaiting review, and (when plan allows) recent audit activity. Unread state
 * is localStorage last-seen timestamp (no notifications table required).
 */
export default function NotificationsBell() {
  const isPlatformAdmin = useAuth((s) => s.isPlatformAdmin)
  const [open, setOpen] = useState(false)
  const [lastSeen, setLastSeen] = useState(readLastSeen)

  const usageQuery = useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: subscription.getUsage,
    staleTime: 60_000,
  })
  const features = (usageQuery.data?.features || {}) as Record<string, boolean>
  const hasAudit = !!features.audit_trail
  const subscriptionBypass = isPlatformAdmin || !!usageQuery.data?.subscriptionBypass
  const subStatus = usageQuery.data?.subscription?.status
  const paywallOn = !!usageQuery.data?.paywallEnabled

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: () => projects.list(),
    staleTime: 60_000,
  })

  const auditQuery = useQuery({
    queryKey: ['audit', { limit: 20, for: 'notifications' }],
    queryFn: () => audit.list({ limit: 20 }),
    enabled: hasAudit,
    staleTime: 60_000,
    retry: (count, err) => {
      if (isSubscriptionInactiveError(err)) return false
      return count < 1
    },
  })

  const items = useMemo((): NotifItem[] => {
    const out: NotifItem[] = []
    const projectList = projectsQuery.data?.projects ?? []
    const slugById = new Map<string, string>()
    const nameById = new Map<string, string>()
    for (const p of projectList) {
      slugById.set(p.id, p.slug)
      nameById.set(p.id, p.name)
    }

    if (
      !subscriptionBypass &&
      paywallOn &&
      (subStatus === 'free' || subStatus === 'expired')
    ) {
      out.push({
        id: `sub-${subStatus}`,
        title: subStatus === 'expired' ? 'Subscription expired' : 'Subscription required',
        body: 'Renew under Settings → Billing to keep projects and reconciliation active.',
        href: '/settings/billing',
        createdAt: new Date().toISOString(),
        unread: true,
      })
    }

    for (const p of projectList) {
      if (p.status !== 'submitted_for_review') continue
      const createdAt = (p as { updatedAt?: string }).updatedAt || new Date().toISOString()
      out.push({
        id: `review-${p.id}`,
        title: 'Pending review',
        body: p.name,
        href: `/projects/${p.slug}`,
        createdAt,
        unread: new Date(createdAt).getTime() > lastSeen,
      })
    }

    if (hasAudit && !isSubscriptionInactiveError(auditQuery.error)) {
      const logs = (auditQuery.data?.logs || []) as Array<{
        id: string
        action: string
        actionLabel: string
        projectId: string | null
        createdAt: string
      }>
      for (const log of logs) {
        if (!AUDIT_ACTIONS.has(log.action)) continue
        const slug = log.projectId ? slugById.get(log.projectId) : undefined
        const projectName = log.projectId ? nameById.get(log.projectId) : undefined
        out.push({
          id: `audit-${log.id}`,
          title: log.actionLabel || log.action,
          body: projectName,
          href: slug ? `/projects/${slug}` : '/audit',
          createdAt: log.createdAt,
          unread: new Date(log.createdAt).getTime() > lastSeen,
        })
      }
    }

    return out
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12)
  }, [
    projectsQuery.data,
    auditQuery.data,
    auditQuery.error,
    hasAudit,
    subscriptionBypass,
    paywallOn,
    subStatus,
    lastSeen,
  ])

  const unreadCount = items.filter((i) => i.unread).length

  function markAllRead() {
    const now = Date.now()
    writeLastSeen(now)
    setLastSeen(now)
  }

  function handleOpenToggle() {
    setOpen((v) => {
      const next = !v
      if (next) markAllRead()
      return next
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpenToggle}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        title="Notifications"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[0.5rem] h-2 px-0.5 rounded-full bg-primary-600 ring-2 ring-white" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 top-full mt-1 z-50 w-80 sm:w-96 rounded-xl border border-gray-200 bg-white py-2 shadow-lg"
          >
            <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">Notifications</p>
              <Link
                to="/audit"
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                Audit log
              </Link>
            </div>

            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                You&apos;re all caught up.
              </div>
            ) : (
              <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {items.map((item) => (
                  <li key={item.id}>
                    {item.href ? (
                      <Link
                        to={item.href}
                        onClick={() => setOpen(false)}
                        className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <NotifRow item={item} />
                      </Link>
                    ) : (
                      <div className="px-4 py-3">
                        <NotifRow item={item} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function NotifRow({ item }: { item: NotifItem }) {
  return (
    <div className="flex gap-2 min-w-0">
      <span
        className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${item.unread ? 'bg-primary-600' : 'bg-transparent'}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
        {item.body && <p className="text-xs text-gray-500 truncate mt-0.5">{item.body}</p>}
        <p className="text-[11px] text-gray-400 mt-1">{formatDate(item.createdAt)}</p>
      </div>
    </div>
  )
}
