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
import { useFocusTrap } from '../../lib/focusTrap'
import Button from './Button'

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
    confirmVariant: 'primary' | 'danger' | 'warning'
  }
> = {
  default: {
    iconBg: 'bg-primary-50',
    iconColor: 'text-primary-600',
    Icon: HelpCircle,
    confirmVariant: 'primary',
  },
  info: {
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    Icon: Info,
    confirmVariant: 'primary',
  },
  warning: {
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    Icon: AlertTriangle,
    confirmVariant: 'warning',
  },
  danger: {
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    Icon: ShieldAlert,
    confirmVariant: 'danger',
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
  const panelRef = useRef<HTMLDivElement>(null)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  useFocusTrap(true, panelRef, { initialFocusRef: confirmBtnRef })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center px-4"
    >
      <div
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-[2px]"
        style={{ animation: 'kq-overlay-in 160ms ease-out both' }}
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kq-confirm-title"
        tabIndex={-1}
        className="relative w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 outline-none"
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
            <Button type="button" variant="outline" onClick={onCancel}>
              {options.cancelLabel ?? 'Cancel'}
            </Button>
          )}
          <Button ref={confirmBtnRef} type="button" variant={style.confirmVariant} onClick={onConfirm}>
            {options.confirmLabel ?? (options.hideCancel ? 'OK' : 'Confirm')}
          </Button>
        </div>
      </div>
    </div>
  )
}
