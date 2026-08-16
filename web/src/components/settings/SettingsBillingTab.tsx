import Card from '../ui/Card'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import MetricCard from '../ui/MetricCard'
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
    <Card title="Billing">
      {!canManageBilling(role) && (
        <Alert tone="info" title="View only" className="mb-4">
          Only admins can manage billing.
        </Alert>
      )}
      <p className="text-sm text-gray-600 mb-4 flex flex-wrap items-center gap-2">
        Current plan:{' '}
        <Badge tone="brand" size="sm" className="capitalize">
          {usageData?.organization?.plan || 'basic'}
        </Badge>
      </p>
      {usageData?.usage && (
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            className="!p-4"
            label="Projects / mo"
            value={
              usageData.usage.projectsDisplay ??
              (usageData.usage.projectsUnlimited
                ? `${usageData.usage.projectsUsed} (unlimited)`
                : `${usageData.usage.projectsUsed} / ${usageData.usage.projectsLimit}`)
            }
          />
          <MetricCard
            className="!p-4"
            label="Transactions / mo"
            value={
              usageData.usage.transactionsDisplay ??
              (usageData.usage.transactionsUnlimited
                ? `${usageData.usage.transactionsUsed} (unlimited)`
                : `${usageData.usage.transactionsUsed} / ${usageData.usage.transactionsLimit}`)
            }
          />
          <MetricCard
            className="!p-4"
            label="Bank accounts"
            value={
              usageData.usage.bankAccountsDisplay ??
              (usageData.usage.bankAccountsUnlimited
                ? `${usageData.usage.bankAccountsUsed ?? 0} (unlimited)`
                : `${usageData.usage.bankAccountsUsed ?? 0} / ${usageData.usage.bankAccountsLimit ?? '—'}`)
            }
            sublabel="Org-wide seats"
          />
          <MetricCard
            className="!p-4"
            label="Full clean exports / mo"
            value={
              usageData.usage.cleanExportsDisplay ??
              (usageData.usage.cleanExportsUnlimited
                ? `${usageData.usage.cleanExportsUsed ?? 0} (unlimited)`
                : `${usageData.usage.cleanExportsUsed ?? 0} / ${usageData.usage.cleanExportsLimit ?? '—'}`)
            }
            sublabel="Sample downloads free"
          />
        </div>
      )}
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        Workspace subscriptions are charged in <strong>GHS</strong> via Paystack. Each project&apos;s reporting currency
        (GHS, USD, or EUR) is chosen under <strong>Projects</strong> when you create or open a job — it affects BRS and
        workbook amounts only, not what you pay for the plan.
      </p>
      {usageData?.subscription && (
        <Alert
          tone="info"
          title={`Subscription: ${(usageData.subscription.status ?? 'unknown').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}`}
          className="mb-4"
        >
          {usageData.subscription.status === 'trial' && usageData.subscription.trialEndsAt && (
            <p>Trial ends: {new Date(usageData.subscription.trialEndsAt).toLocaleString()}</p>
          )}
          {usageData.subscription.currentPeriodEnd && (
            <p>
              Current period ends:{' '}
              {new Date(usageData.subscription.currentPeriodEnd).toLocaleString()}
            </p>
          )}
          {usageData.subscription.latestPaymentAmount != null && (
            <p>
              Last payment: GH₵{usageData.subscription.latestPaymentAmount}
              {usageData.subscription.latestPaymentPeriod
                ? ` (${usageData.subscription.latestPaymentPeriod})`
                : ''}
            </p>
          )}
        </Alert>
      )}
      {plansData?.introOffer?.eligible && (
        <Alert tone="success" title="Intro offer" className="mb-4">
          {plansData.introOffer.description}.{' '}
          {plansData.introOffer.remainingPeriods != null
            ? `${plansData.introOffer.remainingPeriods} discounted billing period${
                plansData.introOffer.remainingPeriods === 1 ? '' : 's'
              } remaining.`
            : `Applies to your first ${plansData.introOffer.months ?? 2} billing periods.`}
        </Alert>
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
              <Card
                key={p.id}
                className="flex flex-col min-w-0 hover:shadow-card-hover"
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
                  <Button
                    type="button"
                    size="lg"
                    className="w-full"
                    onClick={() => onUpgrade(p.id, 'monthly')}
                    isLoading={initializing === `${p.id}-monthly`}
                  >
                    {isCurrentPlan
                      ? firstMonthGhs != null
                        ? `Renew monthly (GH₵${firstMonthGhs} intro)`
                        : 'Renew monthly'
                      : firstMonthGhs != null
                        ? `Pay monthly (GH₵${firstMonthGhs} intro)`
                        : 'Pay monthly'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full leading-snug"
                    onClick={() => onUpgrade(p.id, 'quarterly')}
                    isLoading={initializing === `${p.id}-quarterly`}
                  >
                    {firstQuarterGhs != null
                      ? `Pay quarterly (GH₵${firstQuarterGhs} intro)`
                      : `Pay quarterly (GH₵${q})`}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full leading-snug"
                    onClick={() => onUpgrade(p.id, 'yearly')}
                    isLoading={initializing === `${p.id}-yearly`}
                  >
                    {firstYearGhs != null
                      ? `Pay yearly (GH₵${firstYearGhs} intro)`
                      : isCurrentPlan
                        ? `Renew yearly (GH₵${p.yearlyGhs})`
                        : `Pay yearly (GH₵${p.yearlyGhs})`}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-600">Billing is not configured. Contact support to upgrade your plan.</p>
      )}
    </Card>
  )
}
