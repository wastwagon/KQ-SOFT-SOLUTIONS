import { useEffect, useRef } from 'react'
import { SUBSCRIPTION_INACTIVE_EVENT, type SubscriptionInactiveEventDetail } from '../lib/api'
import { useToast } from './ui/Toast'

const DEBOUNCE_MS = 50_000

/**
 * Listens for {@link SUBSCRIPTION_INACTIVE_EVENT} from the API layer and shows a
 * debounced warning toast (skipped on `/dashboard` where a banner already explains paywall).
 */
export default function SubscriptionPaywallToastBridge() {
  const toast = useToast()
  const lastShown = useRef(0)

  useEffect(() => {
    const handler = (e: Event) => {
      const now = Date.now()
      if (now - lastShown.current < DEBOUNCE_MS) return
      lastShown.current = now
      const ce = e as CustomEvent<SubscriptionInactiveEventDetail>
      const status = ce.detail?.subscriptionStatus
      const title =
        status === 'expired'
          ? 'Subscription expired'
          : status === 'free'
            ? 'Subscription required'
            : 'Subscription inactive'
      const description =
        ce.detail?.message ||
        'Renew under Settings → Billing to continue using projects and reconciliation.'
      toast.warning(title, description)
    }
    window.addEventListener(SUBSCRIPTION_INACTIVE_EVENT, handler)
    return () => window.removeEventListener(SUBSCRIPTION_INACTIVE_EVENT, handler)
  }, [toast])

  return null
}
