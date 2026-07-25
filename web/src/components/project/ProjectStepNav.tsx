import { Check } from 'lucide-react'

/**
 * Stepper for the BRS workflow — aligned with Figma golden-path screens.
 */
export interface ProjectStep {
  /** Stable identifier used in the URL hash (e.g. `upload`). */
  id: string
  /** Display label (e.g. `Upload`). */
  label: string
}

interface ProjectStepNavProps {
  steps: readonly ProjectStep[]
  current: number
  onChange: (index: number) => void
}

export default function ProjectStepNav({ steps, current, onChange }: ProjectStepNavProps) {
  const safeCurrent = Math.min(Math.max(current, 0), steps.length - 1)
  const progressPct = steps.length <= 1 ? 100 : (safeCurrent / (steps.length - 1)) * 100

  return (
    <nav
      aria-label="Project workflow steps"
      className="rounded-xl border border-border bg-white p-3 shadow-card sm:p-3.5"
    >
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute left-3 right-3 top-[18px] hidden -translate-y-1/2 sm:block"
        >
          <div className="h-1 rounded-full bg-gray-100" />
          <div
            className="absolute left-0 top-0 h-1 rounded-full bg-primary-500 transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <ol className="relative flex flex-wrap items-stretch gap-1.5 sm:flex-nowrap sm:gap-2">
          {steps.map((s, i) => {
            const isCurrent = i === safeCurrent
            const isCompleted = i < safeCurrent
            return (
              <li key={s.id} className="min-w-0 sm:flex-1">
                <button
                  type="button"
                  onClick={() => onChange(i)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={[
                    'group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-all',
                    'sm:flex-col sm:gap-2 sm:px-2 sm:py-1.5 sm:text-center',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                    isCurrent
                      ? 'bg-primary-50 text-primary-700'
                      : isCompleted
                        ? 'text-primary-700 hover:bg-primary-50/60'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
                  ].join(' ')}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 transition-colors sm:mx-auto',
                      isCurrent
                        ? 'bg-primary-600 text-white ring-primary-200 shadow-sm'
                        : isCompleted
                          ? 'bg-primary-50 text-primary-700 ring-primary-100'
                          : 'bg-white text-gray-500 ring-gray-200 group-hover:ring-gray-300',
                    ].join(' ')}
                  >
                    {isCompleted ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
                  </span>
                  <span className="truncate sm:max-w-[7.5rem]">
                    <span className="sm:hidden">{i + 1}. </span>
                    {s.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
