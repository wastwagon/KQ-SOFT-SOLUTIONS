import type { ReconcileView } from './types'

/**
 * Top toolbar for the reconcile workflow.  Renders the title, the bank
 * account scope dropdown, and the three view tabs (Receipts / Payments /
 * Cash book all).  Pure-presentational; the page above owns the state.
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
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h2 className="text-xl font-bold text-gray-900 tracking-tight">Reconcile transactions</h2>
      <div className="flex flex-wrap items-center gap-3">
        {bankAccounts.length > 0 && (
          <select
            value={bankAccountId}
            onChange={(e) => onBankAccountChange(e.target.value)}
            className="min-h-[40px] pl-4 pr-10 py-2 border border-gray-200 rounded-xl bg-gray-50/80 text-gray-900 text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white outline-none transition-all"
          >
            <option value="">All bank accounts</option>
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        <div
          role="tablist"
          aria-label="Reconcile view"
          className="flex flex-wrap rounded-xl border border-gray-200 bg-gray-50/50 p-0.5 shadow-sm"
        >
          {VIEWS.map((v) => {
            const active = view === v.id
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onViewChange(v.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  active ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {v.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
