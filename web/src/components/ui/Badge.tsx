import { type HTMLAttributes, forwardRef } from 'react'

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'
export type BadgeSize = 'sm' | 'md'

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

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  size?: BadgeSize
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = '', tone = 'neutral', size = 'md', children, ...props }, ref) => (
    <span
      ref={ref}
      className={`inline-flex items-center gap-1 rounded-full font-semibold ring-1 ${toneClasses[tone]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
)

Badge.displayName = 'Badge'
export default Badge
