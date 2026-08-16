import { type SelectHTMLAttributes, forwardRef, useId } from 'react'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
}

const fieldBase =
  'w-full min-h-[44px] rounded-xl border bg-gray-50/50 pl-4 pr-10 py-2.5 text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white disabled:opacity-50 disabled:pointer-events-none appearance-none'

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, hint, error, id, children, ...props }, ref) => {
    const autoId = useId()
    const selectId = id ?? autoId
    const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`${fieldBase} ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-border'} ${className}`}
            {...props}
          >
            {children}
          </select>
          <span
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400"
            aria-hidden
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </div>
        {error ? (
          <p id={`${selectId}-error`} className="mt-1.5 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p id={`${selectId}-hint`} className="mt-1.5 text-sm text-gray-500">
            {hint}
          </p>
        ) : null}
      </div>
    )
  }
)

Select.displayName = 'Select'
export default Select
