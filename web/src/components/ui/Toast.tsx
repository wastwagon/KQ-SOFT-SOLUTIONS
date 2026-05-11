import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react'

/**
 * Lightweight branded toast system.
 *
 * Use via the {@link useToast} hook anywhere inside <ToastProvider> (mounted at
 * the root in App.tsx).  Every page that previously rolled its own
 * `setError`/`setSaved` + `setTimeout` UI should migrate to this so success
 * and error feedback looks and behaves consistently.
 *
 * @example
 *   const toast = useToast()
 *   toast.success('Settings saved')
 *   toast.error('Could not save', err.message)
 */
export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  /** Auto-dismiss delay in ms. `0` = sticky until user closes it. */
  duration: number
}

interface ShowToastOptions {
  description?: string
  /** Override default duration. `0` keeps the toast on screen until dismissed. */
  duration?: number
}

interface ToastContextValue {
  show: (variant: ToastVariant, title: string, opts?: ShowToastOptions) => string
  success: (title: string, description?: string) => string
  error: (title: string, description?: string) => string
  info: (title: string, description?: string) => string
  warning: (title: string, description?: string) => string
  dismiss: (id: string) => void
  dismissAll: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATIONS: Record<ToastVariant, number> = {
  success: 3500,
  info: 4000,
  warning: 5000,
  error: 6000, // errors stick around longer; users may need to read them
}

const VARIANT_STYLES: Record<
  ToastVariant,
  { ring: string; iconBg: string; iconColor: string; Icon: typeof CheckCircle2 }
> = {
  success: { ring: 'ring-green-100', iconBg: 'bg-green-50', iconColor: 'text-green-600', Icon: CheckCircle2 },
  error: { ring: 'ring-red-100', iconBg: 'bg-red-50', iconColor: 'text-red-600', Icon: AlertCircle },
  info: { ring: 'ring-blue-100', iconBg: 'bg-blue-50', iconColor: 'text-blue-600', Icon: Info },
  warning: { ring: 'ring-amber-100', iconBg: 'bg-amber-50', iconColor: 'text-amber-600', Icon: AlertTriangle },
}

let _idCounter = 0
const nextId = () => `t-${Date.now().toString(36)}-${(_idCounter++).toString(36)}`

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  // Track timers so we can clear them on manual dismiss / unmount.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const dismissAll = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t))
    timersRef.current.clear()
    setToasts([])
  }, [])

  const show = useCallback<ToastContextValue['show']>(
    (variant, title, opts) => {
      const id = nextId()
      const duration = opts?.duration ?? DEFAULT_DURATIONS[variant]
      const item: ToastItem = { id, variant, title, description: opts?.description, duration }
      setToasts((prev) => [...prev, item])
      if (duration > 0) {
        const handle = setTimeout(() => dismiss(id), duration)
        timersRef.current.set(id, handle)
      }
      return id
    },
    [dismiss]
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (title, description) => show('success', title, { description }),
      error: (title, description) => show('error', title, { description }),
      info: (title, description) => show('info', title, { description }),
      warning: (title, description) => show('warning', title, { description }),
      dismiss,
      dismissAll,
    }),
    [show, dismiss, dismissAll]
  )

  // Clean up any pending timers when the provider unmounts.
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

/** Get the toast API.  Throws if called outside <ToastProvider>. */
// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast() must be used inside <ToastProvider>')
  return ctx
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:top-auto sm:items-end sm:px-0"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const { variant, title, description } = item
  const style = VARIANT_STYLES[variant]
  const Icon = style.Icon
  return (
    <div
      role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'}
      className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-lg ring-1 ${style.ring} animate-in slide-in-from-top-2 sm:slide-in-from-bottom-2 sm:slide-in-from-right-2 motion-reduce:animate-none`}
      style={{
        // Local animation fallback — Tailwind v4 ships these but be defensive.
        animation: 'kq-toast-in 180ms ease-out both',
      }}
    >
      <div className="flex items-start gap-3 p-4">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.iconBg}`}>
          <Icon className={`h-5 w-5 ${style.iconColor}`} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {description && (
            <p className="mt-1 text-sm text-gray-600 break-words">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="-m-1 inline-flex shrink-0 rounded-xl p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
