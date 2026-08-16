import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { subscription } from './api'
import { useAuth } from '../store/auth'

export const SUBSCRIPTION_BANNER_DISMISSED_KEY = 'brs_subscription_banner_dismissed'

const dismissedListeners = new Set<() => void>()

export function isSubscriptionBannerDismissed(): boolean {
  try {
    return sessionStorage.getItem(SUBSCRIPTION_BANNER_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissSubscriptionBanner(): void {
  try {
    sessionStorage.setItem(SUBSCRIPTION_BANNER_DISMISSED_KEY, '1')
  } catch {
    /* ignore */
  }
  dismissedListeners.forEach((fn) => fn())
}

export function subscribeSubscriptionBannerDismissed(fn: () => void): () => void {
  dismissedListeners.add(fn)
  return () => {
    dismissedListeners.delete(fn)
  }
}

export function layoutPaywallStripShouldShow(opts: {
  impersonating: boolean
  isPlatformAdmin: boolean
  path: string
  paywallEnabled?: boolean
  subscriptionBypass?: boolean
  subscriptionStatus?: string | null
  dismissed: boolean
}): boolean {
  const bypass = opts.isPlatformAdmin || !!opts.subscriptionBypass
  const sub = opts.subscriptionStatus
  return (
    !opts.impersonating &&
    !bypass &&
    !opts.dismissed &&
    !opts.path.startsWith('/settings') &&
    !!opts.paywallEnabled &&
    (sub === 'free' || sub === 'expired')
  )
}

/** True when AppLayout is already showing the subscription-inactive strip. */
export function useLayoutPaywallStripVisible(): boolean {
  const path = useLocation().pathname
  const impersonating = useAuth((s) => s.impersonating)
  const isPlatformAdmin = useAuth((s) => s.isPlatformAdmin)
  const { data } = useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: subscription.getUsage,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
  const [dismissed, setDismissed] = useState(isSubscriptionBannerDismissed)
  useEffect(() => subscribeSubscriptionBannerDismissed(() => setDismissed(isSubscriptionBannerDismissed())), [])

  return layoutPaywallStripShouldShow({
    impersonating,
    isPlatformAdmin,
    path,
    paywallEnabled: data?.paywallEnabled,
    subscriptionBypass: data?.subscriptionBypass,
    subscriptionStatus: data?.subscription?.status,
    dismissed,
  })
}
