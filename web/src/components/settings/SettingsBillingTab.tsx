import Card from '../ui/Card'
import { canManageBilling } from '../../lib/permissions'
import type { OrgRole } from '../../lib/permissions'

/** Minimal shapes from subscription API — kept loose for forward compatibility. */
interface BillingProps {
  role: OrgRole | string | null
  usageData:
    | {
        organization?: { plan?: string }
        subscription?: {
          status?: string
          trialEndsAt?: string | null
          currentPeriodEnd?: string | null
          latestPaymentAmount?: number | null
          latestPaymentPeriod?: string | null
        }
      }
    | undefined
  plansData:
    | {
        introOffer?: { eligible?: boolean; description?: string }
        paystackConfigured?: boolean
        plans?: { id: string; name: string; monthlyGhs: number; yearlyGhs: number }[]
      }
    | undefined
  initializing: string | null
  onUpgrade: (plan: string, period: 'monthly' | 'yearly') => void
}

export default function SettingsBillingTab({
  role,
  usageData,
  plansData,
  initializing,
  onUpgrade,
}: BillingProps) {
  return (
    <Card className="rounded-xl border-l-4 border-l-primary-500 border-gray-200 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight text-gray-900 mb-2">Billing</h2>
      {!canManageBilling(role) && (
        <p className="text-sm text-amber-600 mb-4">Only admins can manage billing.</p>
      )}
      <p className="text-sm text-gray-600 mb-4">
        Current plan:{' '}
        <strong className="capitalize text-gray-900">{usageData?.organization?.plan || 'basic'}</strong>
      </p>
      {usageData?.subscription && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          <p>
            Subscription status:{' '}
            <strong className="capitalize text-gray-900">{usageData.subscription.status}</strong>
          </p>
          {usageData.subscription.status === 'trial' && usageData.subscription.trialEndsAt && (
            <p>
              Trial ends:{' '}
              <strong>{new Date(usageData.subscription.trialEndsAt).toLocaleString()}</strong>
            </p>
          )}
          {usageData.subscription.currentPeriodEnd && (
            <p>
              Current period ends:{' '}
              <strong>{new Date(usageData.subscription.currentPeriodEnd).toLocaleString()}</strong>
            </p>
          )}
          {usageData.subscription.latestPaymentAmount != null && (
            <p>
              Last payment: <strong>GH₵{usageData.subscription.latestPaymentAmount}</strong>
              {usageData.subscription.latestPaymentPeriod
                ? ` (${usageData.subscription.latestPaymentPeriod})`
                : ''}
            </p>
          )}
        </div>
      )}
      {plansData?.introOffer?.eligible && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          <strong>Intro offer:</strong> {plansData.introOffer.description}. Applies to your first payment.
        </div>
      )}
      {canManageBilling(role) && plansData?.paystackConfigured ? (
        <div className="grid gap-4 md:grid-cols-3">
          {(plansData.plans || []).map((p) => {
            const introEligible = plansData?.introOffer?.eligible
            const firstMonthGhs = introEligible ? Math.round(p.monthlyGhs * 0.5 * 100) / 100 : null
            const firstYearGhs = introEligible ? Math.round(p.yearlyGhs * 0.5 * 100) / 100 : null
            return (
              <div
                key={p.id}
                className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:shadow transition-shadow"
              >
                <h3 className="font-semibold tracking-tight text-gray-900">{p.name}</h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  GH₵{p.monthlyGhs}
                  <span className="text-sm font-normal text-gray-500">/mo</span>
                  {firstMonthGhs != null && (
                    <span className="ml-2 text-base font-normal text-green-700">
                      First payment: GH₵{firstMonthGhs}
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-500">
                  or GH₵{p.yearlyGhs}/yr (17% off)
                  {firstYearGhs != null && ` · First payment: GH₵${firstYearGhs}`}
                </p>
                <button
                  type="button"
                  onClick={() => onUpgrade(p.id, 'monthly')}
                  disabled={
                    usageData?.organization?.plan === p.id || initializing === `${p.id}-monthly`
                  }
                  className="mt-4 w-full px-4 py-2.5 font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 text-sm shadow-sm hover:shadow transition-all"
                >
                  {initializing === `${p.id}-monthly`
                    ? 'Redirecting...'
                    : usageData?.organization?.plan === p.id
                      ? 'Current plan'
                      : 'Upgrade'}
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-600">Billing is not configured. Contact support to upgrade your plan.</p>
      )}
    </Card>
  )
}
