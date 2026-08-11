import Card from '../ui/Card'
import { canManageBilling } from '../../lib/permissions'
import type { OrgRole } from '../../lib/permissions'
import { formatYearlyDiscountLabel } from '../../lib/planPricing'
import type { BillingPeriod } from '../../lib/plans'

/** Minimal shapes from subscription API — kept loose for forward compatibility. */
interface BillingPlanRow {
  id: string
  name: string
  monthlyGhs: number
  yearlyGhs: number
  quarterlyGhs?: number
}

interface BillingProps {
  role: OrgRole | string | null
  usageData:
    | {
        organization?: { plan?: string }
        usage?: {
          projectsDisplay?: string
          transactionsDisplay?: string
          bankAccountsDisplay?: string
          cleanExportsDisplay?: string
          projectsUsed?: number
          projectsLimit?: number
          projectsUnlimited?: boolean
          transactionsUsed?: number
          transactionsLimit?: number
          transactionsUnlimited?: boolean
          bankAccountsUsed?: number
          bankAccountsLimit?: number
          bankAccountsUnlimited?: boolean
          cleanExportsUsed?: number
          cleanExportsLimit?: number
          cleanExportsUnlimited?: boolean
        }
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
        introOffer?: {
          eligible?: boolean
          description?: string
          months?: number
          remainingPeriods?: number
        }
        paystackConfigured?: boolean
        plans?: BillingPlanRow[]
      }
    | undefined
  initializing: string | null
  onUpgrade: (plan: string, period: BillingPeriod) => void
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
      {usageData?.usage && (
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Projects / mo</p>
            <p className="mt-0.5 font-semibold text-gray-900">
              {usageData.usage.projectsDisplay ??
                (usageData.usage.projectsUnlimited
                  ? `${usageData.usage.projectsUsed} (unlimited)`
                  : `${usageData.usage.projectsUsed} / ${usageData.usage.projectsLimit}`)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Transactions / mo</p>
            <p className="mt-0.5 font-semibold text-gray-900">
              {usageData.usage.transactionsDisplay ??
                (usageData.usage.transactionsUnlimited
                  ? `${usageData.usage.transactionsUsed} (unlimited)`
                  : `${usageData.usage.transactionsUsed} / ${usageData.usage.transactionsLimit}`)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Bank accounts</p>
            <p className="mt-0.5 font-semibold text-gray-900">
              {usageData.usage.bankAccountsDisplay ??
                (usageData.usage.bankAccountsUnlimited
                  ? `${usageData.usage.bankAccountsUsed ?? 0} (unlimited)`
                  : `${usageData.usage.bankAccountsUsed ?? 0} / ${usageData.usage.bankAccountsLimit ?? '—'}`)}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">Org-wide seats</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Full clean exports / mo</p>
            <p className="mt-0.5 font-semibold text-gray-900">
              {usageData.usage.cleanExportsDisplay ??
                (usageData.usage.cleanExportsUnlimited
                  ? `${usageData.usage.cleanExportsUsed ?? 0} (unlimited)`
                  : `${usageData.usage.cleanExportsUsed ?? 0} / ${usageData.usage.cleanExportsLimit ?? '—'}`)}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">Sample downloads free</p>
          </div>
        </div>
      )}
      <p className="text-xs text-gray-500 mb-4 leading-relaxed border-l-2 border-primary-200 pl-3">
        Workspace subscriptions are charged in <strong>GHS</strong> via Paystack. Each project&apos;s reporting currency
        (GHS, USD, or EUR) is chosen under <strong>Projects</strong> when you create or open a job — it affects BRS and
        workbook amounts only, not what you pay for the plan.
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
          <strong>Intro offer:</strong> {plansData.introOffer.description}.{' '}
          {plansData.introOffer.remainingPeriods != null
            ? `${plansData.introOffer.remainingPeriods} discounted billing period${
                plansData.introOffer.remainingPeriods === 1 ? '' : 's'
              } remaining.`
            : `Applies to your first ${plansData.introOffer.months ?? 2} billing periods.`}
        </div>
      )}
      {canManageBilling(role) && plansData?.paystackConfigured ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(plansData.plans || []).map((p) => {
            const introEligible = plansData?.introOffer?.eligible
            const q = p.quarterlyGhs ?? Math.round(p.monthlyGhs * 2.85)
            const firstMonthGhs = introEligible ? Math.round(p.monthlyGhs * 0.5 * 100) / 100 : null
            const firstQuarterGhs = introEligible ? Math.round(q * 0.5 * 100) / 100 : null
            const firstYearGhs = introEligible ? Math.round(p.yearlyGhs * 0.5 * 100) / 100 : null
            const isCurrentPlan = usageData?.organization?.plan === p.id
            return (
              <div
                key={p.id}
                className="border border-gray-200 rounded-xl p-6 sm:p-7 min-w-0 bg-white shadow-sm hover:shadow transition-shadow flex flex-col"
              >
                <h3 className="font-semibold tracking-tight text-gray-900">{p.name}</h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  GH₵{p.monthlyGhs}
                  <span className="text-sm font-normal text-gray-500">/mo</span>
                  {firstMonthGhs != null && (
                    <span className="ml-2 text-base font-normal text-green-700">
                      Intro: GH₵{firstMonthGhs}
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-500">
                  GH₵{q}/qtr · GH₵{p.yearlyGhs}/yr ({formatYearlyDiscountLabel(p.monthlyGhs, p.yearlyGhs)})
                </p>
                <div className="mt-5 flex flex-col gap-3 flex-1 justify-end">
                  <button
                    type="button"
                    onClick={() => onUpgrade(p.id, 'monthly')}
                    disabled={initializing === `${p.id}-monthly`}
                    className="w-full px-5 py-3 font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 text-sm shadow-sm hover:shadow transition-all"
                  >
                    {initializing === `${p.id}-monthly`
                      ? 'Redirecting...'
                      : isCurrentPlan
                        ? firstMonthGhs != null
                          ? `Renew monthly (GH₵${firstMonthGhs} intro)`
                          : 'Renew monthly'
                        : firstMonthGhs != null
                          ? `Pay monthly (GH₵${firstMonthGhs} intro)`
                          : 'Pay monthly'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpgrade(p.id, 'quarterly')}
                    disabled={initializing === `${p.id}-quarterly`}
                    className="w-full px-5 py-3 font-medium border border-gray-300 text-gray-800 bg-white rounded-xl hover:bg-gray-50 disabled:opacity-50 text-sm shadow-sm transition-all leading-snug"
                  >
                    {initializing === `${p.id}-quarterly`
                      ? 'Redirecting...'
                      : firstQuarterGhs != null
                        ? `Pay quarterly (GH₵${firstQuarterGhs} intro)`
                        : `Pay quarterly (GH₵${q})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpgrade(p.id, 'yearly')}
                    disabled={initializing === `${p.id}-yearly`}
                    className="w-full px-5 py-3 font-medium border border-gray-300 text-gray-800 bg-white rounded-xl hover:bg-gray-50 disabled:opacity-50 text-sm shadow-sm transition-all leading-snug"
                  >
                    {initializing === `${p.id}-yearly`
                      ? 'Redirecting...'
                      : firstYearGhs != null
                        ? `Pay yearly (GH₵${firstYearGhs} intro)`
                        : isCurrentPlan
                          ? `Renew yearly (GH₵${p.yearlyGhs})`
                          : `Pay yearly (GH₵${p.yearlyGhs})`}
                  </button>
                </div>
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
