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
import { AlertTriangle, HelpCircle, Info, ShieldAlert } from 'lucide-react'

/**
 * Branded confirm/alert dialog system.
 *
 * Usage (anywhere inside the <ConfirmDialogProvider> mounted in App.tsx):
 *
 *   const confirm = useConfirm()
 *   const ok = await confirm({
 *     title: 'Delete project?',
 *     description: 'This cannot be undone.',
 *     confirmLabel: 'Delete',
 *     tone: 'danger',
 *   })
 *   if (ok) doIt()
 *
 * Replaces native `window.confirm()` / `window.alert()` so it follows brand
 * colours, supports keyboard close (Esc), and is screen-reader friendly.
 */
export type ConfirmTone = 'default' | 'danger' | 'warning' | 'info'

export interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Hide the cancel button — turns the dialog into an alert. */
  hideCancel?: boolean
  tone?: ConfirmTone
}

interface ConfirmContextValue {
  /** Returns a promise that resolves true on confirm, false on cancel/dismiss. */
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  /** Convenience: alert-style dialog with a single OK button. */
  alert: (opts: Omit<ConfirmOptions, 'hideCancel'>) => Promise<void>
}

const ConfirmDialogContext = createContext<ConfirmContextValue | null>(null)

const TONE_STYLES: Record<
  ConfirmTone,
  {
    iconBg: string
    iconColor: string
    Icon: typeof HelpCircle
    confirmBtn: string
  }
> = {
  default: {
    iconBg: 'bg-primary-50',
    iconColor: 'text-primary-600',
    Icon: HelpCircle,
    confirmBtn:
      'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500 shadow-md shadow-primary-600/20',
  },
  info: {
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    Icon: Info,
    confirmBtn:
      'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500 shadow-md shadow-primary-600/20',
  },
  warning: {
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    Icon: AlertTriangle,
    confirmBtn:
      'bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500 shadow-md shadow-amber-600/20',
  },
  danger: {
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    Icon: ShieldAlert,
    confirmBtn:
      'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 shadow-md shadow-red-600/25',
  },
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback<ConfirmContextValue['confirm']>((opts) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve })
    })
  }, [])

  const alert = useCallback<ConfirmContextValue['alert']>(
    async (opts) => {
      await confirm({ ...opts, hideCancel: true, cancelLabel: undefined })
    },
    [confirm]
  )

  const close = useCallback(
    (value: boolean) => {
      setPending((curr) => {
        curr?.resolve(value)
        return null
      })
    },
    []
  )

  const value = useMemo<ConfirmContextValue>(() => ({ confirm, alert }), [confirm, alert])

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      {pending && (
        <ConfirmDialogView
          options={pending}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      )}
    </ConfirmDialogContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm(): ConfirmContextValue['confirm'] {
  const ctx = useContext(ConfirmDialogContext)
  if (!ctx) throw new Error('useConfirm() must be used inside <ConfirmDialogProvider>')
  return ctx.confirm
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAlertDialog(): ConfirmContextValue['alert'] {
  const ctx = useContext(ConfirmDialogContext)
  if (!ctx) throw new Error('useAlertDialog() must be used inside <ConfirmDialogProvider>')
  return ctx.alert
}

function ConfirmDialogView({
  options,
  onConfirm,
  onCancel,
}: {
  options: ConfirmOptions
  onConfirm: () => void
  onCancel: () => void
}) {
  const tone = options.tone ?? 'default'
  const style = TONE_STYLES[tone]
  const Icon = style.Icon
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  // Esc closes; focus the confirm button on open for keyboard users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    confirmBtnRef.current?.focus()
    // Lock background scroll while dialog is open.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onCancel])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kq-confirm-title"
      className="fixed inset-0 z-[110] flex items-center justify-center px-4"
    >
      <div
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-[2px]"
        style={{ animation: 'kq-overlay-in 160ms ease-out both' }}
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5"
        style={{ animation: 'kq-dialog-in 200ms ease-out both' }}
      >
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.iconBg}`}
              aria-hidden="true"
            >
              <Icon className={`h-6 w-6 ${style.iconColor}`} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2
                id="kq-confirm-title"
                className="text-lg font-semibold tracking-tight text-gray-900"
              >
                {options.title}
              </h2>
              {options.description && (
                <div className="mt-2 text-sm leading-relaxed text-gray-600">
                  {options.description}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-7">
          {!options.hideCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {options.cancelLabel ?? 'Cancel'}
            </button>
          )}
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${style.confirmBtn}`}
          >
            {options.confirmLabel ?? (options.hideCancel ? 'OK' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
