import { useState, type ReactNode } from 'react'
import { ListFilter } from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import type { CountAmountRow, CountMatchDiagnostic } from './countMatchTypes'
import { COUNT_MATCH_GROUP_LABELS } from './countMatchListLabels'

export type CountMatchListKey =
  | 'only_cb_received'
  | 'only_cb_payment'
  | 'only_bank_lodgment'
  | 'only_bank_debits'
  | 'open_recv_cb'
  | 'open_recv_bank'
  | 'open_pay_cb'
  | 'open_pay_bank'
  | 'cancel_recv'
  | 'cancel_pay'

export const COUNT_MATCH_LIST_META: {
  key: CountMatchListKey
  label: string
  group: 'only' | 'open' | 'cancel'
  hint: string
}[] = [
  { key: 'only_cb_received', label: 'Cash book only — receipts', group: 'only', hint: 'Amounts only in cash book (receipts)' },
  { key: 'only_cb_payment', label: 'Cash book only — payments', group: 'only', hint: 'Amounts only in cash book (payments)' },
  { key: 'only_bank_lodgment', label: 'Bank only — lodgments', group: 'only', hint: 'Amounts only on bank credits' },
  { key: 'only_bank_debits', label: 'Bank only — debits', group: 'only', hint: 'Amounts only on bank debits' },
  {
    key: 'open_recv_cb',
    label: 'Extra receipt lines in cash book',
    group: 'open',
    hint: 'Same amount on both sides; more receipt lines in cash book than bank credits',
  },
  {
    key: 'open_recv_bank',
    label: 'Extra credit lines on bank',
    group: 'open',
    hint: 'Same amount on both sides; more bank credits than cash book receipts',
  },
  {
    key: 'open_pay_cb',
    label: 'Extra payment lines in cash book',
    group: 'open',
    hint: 'Same amount on both sides; more payment lines in cash book than bank debits',
  },
  {
    key: 'open_pay_bank',
    label: 'Extra debit lines on bank',
    group: 'open',
    hint: 'Same amount on both sides; more bank debits than cash book payments',
  },
  {
    key: 'cancel_recv',
    label: 'Receipts = credits (same count)',
    group: 'cancel',
    hint: 'Same number of receipt and credit lines at each amount — batch cancel by count',
  },
  {
    key: 'cancel_pay',
    label: 'Payments = debits (same count)',
    group: 'cancel',
    hint: 'Same number of payment and debit lines at each amount — batch cancel by count',
  },
]

const GROUP_LABELS: Record<'cancel' | 'open' | 'only', string> = COUNT_MATCH_GROUP_LABELS

type CountMatchListFiltersProps = {
  listKey: CountMatchListKey
  onPick: (key: CountMatchListKey) => void
  data: CountMatchDiagnostic
  rowsFor: (data: CountMatchDiagnostic, key: CountMatchListKey) => CountAmountRow[]
  listCountLabel: (rows: CountAmountRow[]) => string
  renderDesktopGroups: () => ReactNode
}

/**
 * Desktop: full pill row (unchanged). Mobile/tablet: summary badges stay visible in parent;
 * list choice moves into a dialog (Phase 5 prototype — do not remove desktop counts without user testing).
 */
export default function CountMatchListFilters({
  listKey,
  onPick,
  data,
  rowsFor,
  listCountLabel,
  renderDesktopGroups,
}: CountMatchListFiltersProps) {
  const [open, setOpen] = useState(false)
  const active = COUNT_MATCH_LIST_META.find((m) => m.key === listKey)!
  const activeRows = rowsFor(data, listKey)

  return (
    <>
      <div className="hidden lg:block">{renderDesktopGroups()}</div>

      <div className="lg:hidden mb-3 space-y-2">
        <p className="text-xs text-slate-600">
          <span className="font-medium text-slate-800">{active.label}</span>
          {' · '}
          {listCountLabel(activeRows)}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <ListFilter className="w-4 h-4 mr-1.5" aria-hidden />
          Choose matching list
        </Button>
      </div>

      <Modal
        open={open}
        title="Matching list"
        onClose={() => setOpen(false)}
        footer={
          <Button type="button" variant="primary" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        <div className="space-y-5" role="radiogroup" aria-label="Count-match list">
          {(['cancel', 'open', 'only'] as const).map((group) => (
            <div key={group}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                {GROUP_LABELS[group]}
              </p>
              <div className="flex flex-col gap-1">
                {COUNT_MATCH_LIST_META.filter((m) => m.group === group).map((m) => {
                  const listRows = rowsFor(data, m.key)
                  const selected = m.key === listKey
                  return (
                    <button
                      key={m.key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        onPick(m.key)
                        setOpen(false)
                      }}
                      className={`flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                        selected
                          ? 'border-primary-300 bg-primary-50/80 text-slate-900'
                          : 'border-border hover:bg-gray-50 text-slate-700'
                      }`}
                    >
                      <span>
                        <span className="font-medium block">{m.label}</span>
                        <span className="text-xs text-slate-500 mt-0.5 block">{m.hint}</span>
                      </span>
                      <span className="text-xs tabular-nums text-slate-500 shrink-0 pt-0.5">
                        {listCountLabel(listRows)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  )
}
