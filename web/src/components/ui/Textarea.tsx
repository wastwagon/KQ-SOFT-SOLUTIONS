import { type TextareaHTMLAttributes, forwardRef, useId } from 'react'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

const fieldBase =
  'w-full min-h-[96px] rounded-xl border bg-gray-50/50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white disabled:opacity-50 disabled:pointer-events-none'

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', label, hint, error, id, ...props }, ref) => {
    const autoId = useId()
    const areaId = id ?? autoId
    const describedBy = error ? `${areaId}-error` : hint ? `${areaId}-hint` : undefined

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={areaId} className="mb-1.5 block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${fieldBase} ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-200'} ${className}`}
          {...props}
        />
        {error ? (
          <p id={`${areaId}-error`} className="mt-1.5 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p id={`${areaId}-hint`} className="mt-1.5 text-sm text-gray-500">
            {hint}
          </p>
        ) : null}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
export default Textarea
