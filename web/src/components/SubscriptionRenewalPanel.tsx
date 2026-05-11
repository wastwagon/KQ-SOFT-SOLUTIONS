import { Link } from 'react-router-dom'

/**
 * Shown when core API calls fail with subscription paywall (`SUBSCRIPTION_INACTIVE`)
 * or when the UI detects inactive subscription from usage.
 */
export default function SubscriptionRenewalPanel() {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-center max-w-lg mx-auto shadow-sm">
      <p className="text-sm font-semibold text-amber-950 mb-1">Subscription inactive</p>
      <p className="text-sm text-amber-900 mb-4 leading-relaxed">
        Core workspace features are paused until an admin renews. Use billing to pay with Paystack, or contact
        support if you are on a custom plan.
      </p>
      <Link
        to="/settings/billing"
        className="inline-flex items-center justify-center font-medium px-4 py-2.5 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      >
        Open Settings → Billing
      </Link>
    </div>
  )
}
