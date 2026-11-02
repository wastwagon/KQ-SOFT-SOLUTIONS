import { type HTMLAttributes, forwardRef } from 'react'

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'
export type BadgeSize = 'sm' | 'md'
/** pill = marketing-style tag; soft = rectangular chip for dense tables */
export type BadgeShape = 'pill' | 'soft'

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-gray-100 text-gray-700 ring-gray-200',
  brand: 'bg-primary-50 text-primary-700 ring-primary-100',
  success: 'bg-green-50 text-green-700 ring-green-100',
  warning: 'bg-amber-50 text-amber-800 ring-amber-100',
  danger: 'bg-red-50 text-red-700 ring-red-100',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-xs',
}

const shapeClasses: Record<BadgeShape, string> = {
  pill: 'rounded-full',
  soft: 'rounded-md',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  size?: BadgeSize
  shape?: BadgeShape
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = '', tone = 'neutral', size = 'md', shape = 'pill', children, ...props }, ref) => (
    <span
      ref={ref}
      className={`inline-flex items-center gap-1 font-semibold ring-1 ${shapeClasses[shape]} ${toneClasses[tone]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
)

Badge.displayName = 'Badge'
export default Badge
