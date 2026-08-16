import { useNavigate } from 'react-router-dom'
import Alert from './ui/Alert'
import Button from './ui/Button'
import { useLayoutPaywallStripVisible } from '../lib/subscriptionBanner'

/**
 * Shown when core API calls fail with subscription paywall (`SUBSCRIPTION_INACTIVE`)
 * or when the UI detects inactive subscription from usage.
 *
 * If the layout strip is already visible, this stays a quiet line so billing
 * is not explained twice. After the strip is dismissed (or on Settings), the
 * Alert with a billing action remains.
 */
export default function SubscriptionRenewalPanel() {
  const navigate = useNavigate()
  const stripVisible = useLayoutPaywallStripVisible()

  if (stripVisible) {
    return (
      <p className="text-sm text-gray-500">This section is paused until the subscription is renewed.</p>
    )
  }

  return (
    <Alert
      tone="warning"
      title="Subscription inactive"
      className="max-w-lg"
      action={
        <Button type="button" size="sm" onClick={() => navigate('/settings/billing')}>
          Open billing
        </Button>
      }
    >
      Core workspace features are paused until an admin renews. Pay monthly, quarterly, or yearly
      with Paystack under Billing — or contact support if you are on a custom plan.
    </Alert>
  )
}
