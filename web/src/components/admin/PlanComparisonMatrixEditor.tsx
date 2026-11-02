import Select from '../ui/Select'
import Input from '../ui/Input'
import Button from '../ui/Button'
import type { FeatureGroup } from '../../lib/plans'
import {
  QUOTA_DRIVEN_MATRIX_IDS,
  matrixCellFromMode,
  matrixCellMode,
  quotaMatrixPreview,
  type MatrixCellMode,
} from '../../lib/planComparisonMatrix'

type Props = {
  featureGroups: FeatureGroup[]
  featureMatrix: Record<string, boolean | string>
  onChange: (next: Record<string, boolean | string>) => void
  quotaNums: {
    bankAccounts: number
    projectsPerMonth: number
    transactionsPerMonth: number
    usersLimit: number
  }
}

function MatrixRow({
  id,
  label,
  hint,
  value,
  quotaNums,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  value: boolean | string | undefined
  quotaNums: Props['quotaNums']
  onChange: (v: boolean | string) => void
}) {
  if (QUOTA_DRIVEN_MATRIX_IDS.has(id)) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto] gap-2 items-start py-2 border-b border-gray-100 last:border-0">
        <div>
          <p className="text-sm font-medium text-gray-900">{label}</p>
          {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
        </div>
        <p className="text-sm text-gray-600 sm:text-right font-mono">{quotaMatrixPreview(id, quotaNums)}</p>
      </div>
    )
  }

  const mode = matrixCellMode(value)
  const customText = typeof value === 'string' ? value : ''

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr,140px,1fr] gap-2 items-start py-2 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{label || id}</p>
        {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
        <p className="text-xs font-mono text-gray-400">{id}</p>
      </div>
      <Select
        aria-label={`${label} availability`}
        value={mode}
        onChange={(e) => {
          const nextMode = e.target.value as MatrixCellMode
          onChange(matrixCellFromMode(nextMode, customText))
        }}
      >
        <option value="included">Included</option>
        <option value="excluded">Not included</option>
        <option value="custom">Custom label</option>
      </Select>
      {mode === 'custom' ? (
        <Input
          aria-label={`${label} custom label`}
          value={customText}
          onChange={(e) => onChange(matrixCellFromMode('custom', e.target.value))}
          placeholder='e.g. "Up to 50 pairs"'
        />
      ) : (
        <span className="text-xs text-gray-400 self-center hidden sm:block">—</span>
      )}
    </div>
  )
}

export default function PlanComparisonMatrixEditor({
  featureGroups,
  featureMatrix,
  onChange,
  quotaNums,
}: Props) {
  const knownIds = new Set(featureGroups.flatMap((g) => g.features.map((f) => f.id)))
  const extraIds = Object.keys(featureMatrix).filter((id) => !knownIds.has(id))

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-gray-50/40 divide-y divide-gray-100">
        {featureGroups.map((group) => (
          <div key={group.title} className="p-4">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              {group.title}
            </h5>
            <div>
              {group.features.map((f) => (
                <MatrixRow
                  key={f.id}
                  id={f.id}
                  label={f.label}
                  hint={f.hint}
                  value={featureMatrix[f.id]}
                  quotaNums={quotaNums}
                  onChange={(v) => onChange({ ...featureMatrix, [f.id]: v })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {extraIds.length > 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 p-4">
          <h5 className="text-xs font-semibold text-gray-500 mb-2">Custom rows (not in layout)</h5>
          {extraIds.map((id) => (
            <MatrixRow
              key={id}
              id={id}
              label={id}
              value={featureMatrix[id]}
              quotaNums={quotaNums}
              onChange={(v) => onChange({ ...featureMatrix, [id]: v })}
            />
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
          const id = window.prompt('Row id (e.g. custom_export):')?.trim()
          if (!id) return
          onChange({ ...featureMatrix, [id]: true })
        }}
      >
        Add custom comparison row
      </Button>
    </div>
  )
}
