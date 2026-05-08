import { type HTMLAttributes, forwardRef } from 'react'

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Optional header title (avoid using HTML title attribute) */
  title?: React.ReactNode
  /** Optional subtitle or summary under the title */
  sublabel?: React.ReactNode
  actions?: React.ReactNode
  /** When true, content area has no padding (e.g. for tables) */
  noPadding?: boolean
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', title, sublabel, actions, noPadding, children, ...props }, ref) => (
    <div
      ref={ref}
      className={`bg-white rounded-lg border border-border shadow-card overflow-hidden ${className}`}
      {...props}
    >
      {(title || actions) && (
        <div className="px-6 py-5 border-b border-border-muted flex items-start sm:items-center justify-between gap-4">
          <div>
            {title && <h2 className="text-lg font-semibold tracking-tight text-gray-900">{title}</h2>}
            {sublabel && <p className="mt-1 text-sm text-gray-600">{sublabel}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={noPadding ? 'p-0' : 'p-6'}>{children}</div>
    </div>
  )
)

Card.displayName = 'Card'
export default Card
