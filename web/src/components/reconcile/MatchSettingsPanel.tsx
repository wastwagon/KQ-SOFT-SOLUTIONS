import type { MatchParams } from './types'
import Button from '../ui/Button'

/**
 * Collapsible matching-parameters panel.  Lets the user pick a preset
 * (Strict, Amount + Date, Amount-only) or fine-tune individual flags
 * (Date, Reference, Cheque No.).  Amount is always required.
 *
 * Pure-presentational — `value`/`onChange` mirror controlled input semantics.
 */
interface MatchSettingsPanelProps {
  value: MatchParams
  onChange: (next: MatchParams) => void
}

const PRESETS = {
  strict: { useDate: true, useDocRef: true, useChequeNo: true },
  amountDate: { useDate: true, useDocRef: false, useChequeNo: false },
  amountOnly: { useDate: false, useDocRef: false, useChequeNo: false },
} as const

function isPreset(value: MatchParams, preset: MatchParams) {
  return (
    value.useDate === preset.useDate &&
    value.useDocRef === preset.useDocRef &&
    value.useChequeNo === preset.useChequeNo
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function activeModeLabel(value: MatchParams) {
  if (isPreset(value, PRESETS.strict)) return 'Strict'
  if (isPreset(value, PRESETS.amountDate)) return 'Amount + Date'
  if (isPreset(value, PRESETS.amountOnly)) return 'Amount only'
  return 'Custom'
}

export default function MatchSettingsPanel({ value, onChange }: MatchSettingsPanelProps) {
  const isStrict = isPreset(value, PRESETS.strict)
  const isAmountDate = isPreset(value, PRESETS.amountDate)
  const isAmountOnly = isPreset(value, PRESETS.amountOnly)

  return (
    <div className="mb-4 rounded-xl border border-border bg-surface p-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
        Matching parameters
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <PresetButton active={isStrict} onClick={() => onChange(PRESETS.strict)}>
          Strict
        </PresetButton>
        <PresetButton active={isAmountDate} onClick={() => onChange(PRESETS.amountDate)}>
          Amount + Date
        </PresetButton>
        <PresetButton active={isAmountOnly} onClick={() => onChange(PRESETS.amountOnly)}>
          Amount-only
        </PresetButton>
      </div>
      <div className="flex flex-wrap gap-5 text-sm text-gray-800 font-medium">
        <label className="inline-flex items-center gap-2 cursor-not-allowed">
          <input
            type="checkbox"
            checked
            disabled
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Amount
        </label>
        <ParamCheckbox
          label="Date"
          checked={value.useDate}
          onChange={(useDate) => onChange({ ...value, useDate })}
        />
        <ParamCheckbox
          label="Reference"
          checked={value.useDocRef}
          onChange={(useDocRef) => onChange({ ...value, useDocRef })}
        />
        <ParamCheckbox
          label="Cheque No."
          checked={value.useChequeNo}
          onChange={(useChequeNo) => onChange({ ...value, useChequeNo })}
        />
      </div>
      <p className="mt-3 text-[11px] text-gray-500 leading-relaxed italic">
        Active mode: <strong>{activeModeLabel(value)}</strong>. Settings apply to suggestions and
        automated matching.
      </p>
    </div>
  )
}

function PresetButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      size="xs"
      variant={active ? 'primary' : 'outline'}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </Button>
  )
}

function ParamCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
      />
      {label}
    </label>
  )
}
