import type { ReactNode } from 'react'
import Alert from './Alert'

type PageLoadErrorProps = {
  title: string
  error?: unknown
  onRetry?: () => void
  children?: ReactNode
  action?: ReactNode
  className?: string
}

/** Standard in-page error when a list or settings query fails (layout banner unchanged). */
export default function PageLoadError({
  title,
  error,
  onRetry,
  children,
  action,
  className,
}: PageLoadErrorProps) {
  const message =
    children ??
    (error instanceof Error && error.message.trim() ? error.message : 'Something went wrong.')

  return (
    <Alert tone="error" title={title} onRetry={onRetry} action={action} className={className}>
      {message}
    </Alert>
  )
}
