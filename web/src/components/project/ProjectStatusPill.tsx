import {
  CheckCircle2,
  CircleDashed,
  CircleDot,
  ClipboardCheck,
  Eye,
  ListChecks,
  type LucideIcon,
} from 'lucide-react'

/**
 * Project status pill — single source of truth for how a project status is
 * presented in the UI.  Covers every server-side status emitted by the API
 * plus a fallback for unknown values so a future status doesn't render as
 * a blank space.
 */
export type ProjectStatus =
  | 'draft'
  | 'mapping'
  | 'reconciling'
  | 'submitted_for_review'
  | 'approved'
  | 'completed'
  | (string & {})

interface StatusVisual {
  label: string
  Icon: LucideIcon
  /** Tailwind classes for the wrapping pill (text + bg + ring). */
  className: string
  /** Used where a single dot (no ring/bg) is enough — e.g. table cells. */
  dotColor: string
}

const STATUS_VISUALS: Record<string, StatusVisual> = {
  draft: {
    label: 'Draft',
    Icon: CircleDashed,
    className: 'bg-gray-100 text-gray-700 ring-gray-200',
    dotColor: 'bg-gray-400',
  },
  mapping: {
    label: 'Mapping',
    Icon: ListChecks,
    className: 'bg-blue-50 text-blue-700 ring-blue-100',
    dotColor: 'bg-blue-500',
  },
  reconciling: {
    label: 'Reconciling',
    Icon: CircleDot,
    className: 'bg-amber-50 text-amber-800 ring-amber-100',
    dotColor: 'bg-amber-500',
  },
  submitted_for_review: {
    label: 'Submitted for review',
    Icon: Eye,
    className: 'bg-purple-50 text-purple-700 ring-purple-100',
    dotColor: 'bg-purple-500',
  },
  approved: {
    label: 'Approved',
    Icon: ClipboardCheck,
    className: 'bg-primary-50 text-primary-700 ring-primary-100',
    dotColor: 'bg-primary-500',
  },
  completed: {
    label: 'Completed',
    Icon: CheckCircle2,
    className: 'bg-green-50 text-green-700 ring-green-100',
    dotColor: 'bg-green-500',
  },
}

const FALLBACK: StatusVisual = {
  label: 'Unknown',
  Icon: CircleDashed,
  className: 'bg-gray-50 text-gray-500 ring-gray-200',
  dotColor: 'bg-gray-300',
}

function visualFor(status: ProjectStatus): StatusVisual {
  return STATUS_VISUALS[status] ?? FALLBACK
}

interface ProjectStatusPillProps {
  status: ProjectStatus
  /** Compact variant (smaller padding/text) for table cells. */
  size?: 'sm' | 'md'
  /** Override the displayed label (rarely needed). */
  label?: string
  className?: string
}

export default function ProjectStatusPill({
  status,
  size = 'md',
  label,
  className = '',
}: ProjectStatusPillProps) {
  const v = visualFor(status)
  const Icon = v.Icon
  const sizing =
    size === 'sm'
      ? 'gap-1 px-2 py-0.5 text-[11px] font-semibold'
      : 'gap-1.5 px-2.5 py-1 text-xs font-semibold'
  return (
    <span
      className={`inline-flex items-center rounded-full ring-1 ${v.className} ${sizing} ${className}`}
      role="status"
      aria-label={`Status: ${label ?? v.label}`}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden="true" />
      {label ?? v.label}
    </span>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function projectStatusLabel(status: ProjectStatus): string {
  return visualFor(status).label
}
