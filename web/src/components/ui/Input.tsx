import { type InputHTMLAttributes, forwardRef, useId } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode
  hint?: string
  error?: string
  /** Optional leading adornment (icon). */
  leading?: React.ReactNode
  /** Optional trailing adornment (e.g. password toggle). */
  trailing?: React.ReactNode
}

const fieldBase =
  'w-full min-h-[44px] rounded-xl border bg-gray-50/50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white disabled:opacity-50 disabled:pointer-events-none'

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, hint, error, leading, trailing, id, ...props }, ref) => {
    const autoId = useId()
    const inputId = id ?? autoId
    const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className="relative">
          {leading && (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400" aria-hidden>
              {leading}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`${fieldBase} ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-border'} ${leading ? 'pl-10' : ''} ${trailing ? 'pr-10' : ''} ${className}`}
            {...props}
          />
          {trailing && (
            <span className="absolute inset-y-0 right-2 flex items-center text-gray-400">{trailing}</span>
          )}
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="mt-1.5 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="mt-1.5 text-sm text-gray-500">
            {hint}
          </p>
        ) : null}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
