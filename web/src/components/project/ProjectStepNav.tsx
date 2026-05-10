import { Check } from 'lucide-react'

/**
 * Stepper for the BRS workflow.  Replaces the flat row of pill buttons that
 * used to live inline in ProjectDetail.tsx.  Adds:
 *   - A progress bar that fills as the user advances through steps.
 *   - A visible "completed" affordance for steps the user has already passed.
 *   - Sensible keyboard / screen-reader semantics (`<nav>` + `aria-current`).
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
    <nav aria-label="Project workflow steps" className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
      {/* Progress track — desktop only; the rail itself doubles as the row of step pills. */}
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute left-0 right-0 top-1/2 hidden -translate-y-1/2 sm:block"
        >
          <div className="h-1 rounded-full bg-gray-100" />
          <div
            className="absolute left-0 top-0 h-1 rounded-full bg-primary-500 transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <ol className="relative flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-between sm:gap-4">
          {steps.map((s, i) => {
            const isCurrent = i === safeCurrent
            const isCompleted = i < safeCurrent
            return (
              <li key={s.id} className="min-w-0 sm:flex-1 sm:text-center">
                <button
                  type="button"
                  onClick={() => onChange(i)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={[
                    'group flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all',
                    'sm:w-auto sm:flex-col sm:gap-2 sm:px-2 sm:py-1.5',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                    isCurrent
                      ? 'bg-primary-50 text-primary-700 sm:bg-transparent sm:text-primary-700'
                      : isCompleted
                        ? 'text-gray-700 hover:bg-gray-50 sm:text-gray-700'
                        : 'text-gray-500 hover:bg-gray-50 sm:text-gray-500',
                  ].join(' ')}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 transition-colors',
                      isCurrent
                        ? 'bg-primary-600 text-white ring-primary-200 shadow-md shadow-primary-600/25'
                        : isCompleted
                          ? 'bg-primary-50 text-primary-700 ring-primary-100'
                          : 'bg-white text-gray-500 ring-gray-200 group-hover:ring-gray-300',
                    ].join(' ')}
                  >
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className="truncate sm:max-w-[120px]">{s.label}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
