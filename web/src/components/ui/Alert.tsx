import { type ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import Button from './Button'

export type AlertTone = 'error' | 'warning' | 'info' | 'success'

const TONE: Record<
  AlertTone,
  { wrap: string; title: string; Icon: typeof AlertCircle; role: 'alert' | 'status' }
> = {
  error: {
    wrap: 'border-red-200 bg-red-50 text-red-800',
    title: 'text-red-900',
    Icon: AlertCircle,
    role: 'alert',
  },
  warning: {
    wrap: 'border-amber-200 bg-amber-50 text-amber-950',
    title: 'text-amber-900',
    Icon: AlertTriangle,
    role: 'alert',
  },
  info: {
    wrap: 'border-primary-200 bg-primary-50 text-primary-950',
    title: 'text-primary-900',
    Icon: Info,
    role: 'status',
  },
  success: {
    wrap: 'border-green-200 bg-green-50 text-green-800',
    title: 'text-green-900',
    Icon: CheckCircle2,
    role: 'status',
  },
}

export interface AlertProps {
  tone?: AlertTone
  title: string
  children?: ReactNode
  action?: ReactNode
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export default function Alert({
  tone = 'info',
  title,
  children,
  action,
  onRetry,
  retryLabel = 'Retry',
  className = '',
}: AlertProps) {
  const style = TONE[tone]
  const Icon = style.Icon

  return (
    <div className={`rounded-xl border p-4 text-sm ${style.wrap} ${className}`} role={style.role}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className={`font-medium ${style.title}`}>{title}</p>
          {children != null && <div className="mt-1 leading-relaxed">{children}</div>}
          {(action || onRetry) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {action}
              {onRetry && (
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                  {retryLabel}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
