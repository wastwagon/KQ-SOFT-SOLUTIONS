import type { ReconcileView } from './types'
import Tabs from '../ui/Tabs'
import Select from '../ui/Select'

/**
 * Reconcile toolbar: bank account scope and view tabs (Receipts / Payments / Cash book all).
 * The step title lives in the parent page intro (see WorkflowStepIntro).
 */
interface ReconcileToolbarProps {
  view: ReconcileView
  onViewChange: (view: ReconcileView) => void
  bankAccounts: { id: string; name: string }[]
  bankAccountId: string
  onBankAccountChange: (id: string) => void
}

const VIEWS: { id: ReconcileView; label: string }[] = [
  { id: 'receipts', label: 'Receipts vs Credits' },
  { id: 'payments', label: 'Payments vs Debits' },
  { id: 'all', label: 'Cash book (all)' },
]

export default function ReconcileToolbar({
  view,
  onViewChange,
  bankAccounts,
  bankAccountId,
  onBankAccountChange,
}: ReconcileToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {bankAccounts.length > 0 && (
          <div className="w-48">
            <Select
              value={bankAccountId}
              onChange={(e) => onBankAccountChange(e.target.value)}
              aria-label="Bank account"
              className="min-h-[40px] py-2 font-medium"
            >
              <option value="">All bank accounts</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <Tabs
          aria-label="Reconcile view"
          value={view}
          onChange={onViewChange}
          items={VIEWS}
          size="sm"
        />
      </div>
    </div>
  )
}
