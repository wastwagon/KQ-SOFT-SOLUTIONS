import { Link } from 'react-router-dom'
import Alert from './ui/Alert'
import { planUsageAlerts, type SubscriptionUsageSlice } from '../lib/planUsageHints'
import { canManageBilling } from '../lib/permissions'
import type { OrgRole } from '../lib/permissions'

type PlanUsageAlertsProps = {
  usage?: SubscriptionUsageSlice
  role: OrgRole | string | null
  className?: string
}

export default function PlanUsageAlerts({ usage, role, className = '' }: PlanUsageAlertsProps) {
  const alerts = planUsageAlerts(usage)
  if (alerts.length === 0) return null
  return (
    <div className={`space-y-3 max-w-3xl ${className}`}>
      {alerts.map((a) => (
        <Alert
          key={a.title}
          tone={a.tone}
          title={a.title}
          action={
            canManageBilling(role) ? (
              <Link
                to="/settings#billing"
                className="text-sm font-medium text-primary-700 hover:underline whitespace-nowrap"
              >
                Billing
              </Link>
            ) : undefined
          }
        >
          {a.body}
          {!canManageBilling(role) ? ' Ask an admin to review billing in Settings.' : null}
        </Alert>
      ))}
    </div>
  )
}
