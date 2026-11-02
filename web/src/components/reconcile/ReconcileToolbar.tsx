import type { ReconcileView } from './types'
import type { ReactNode } from 'react'
import Tabs from '../ui/Tabs'
import Select from '../ui/Select'

/**
 * Reconcile toolbar: bank account scope and view tabs (Receipts / Payments / Cash book all).
 * The step title lives in the parent page intro (see WorkflowStepIntro).
 */
interface ReconcileToolbarProps {
  view: ReconcileView
  onViewChange: (view: ReconcileView) => void
  bankAccounts: { id: string; name: string; locked?: boolean }[]
  bankAccountId: string
  onBankAccountChange: (id: string) => void
  className?: string
}

const VIEWS: { id: ReconcileView; label: ReactNode }[] = [
  {
    id: 'receipts',
    label: (
      <>
        <span className="hidden sm:inline">Receipts vs Credits</span>
        <span className="sm:hidden">Receipts</span>
      </>
    ),
  },
  {
    id: 'payments',
    label: (
      <>
        <span className="hidden sm:inline">Payments vs Debits</span>
        <span className="sm:hidden">Payments</span>
      </>
    ),
  },
  {
    id: 'all',
    label: (
      <>
        <span className="hidden sm:inline">Cash book (all)</span>
        <span className="sm:hidden">All</span>
      </>
    ),
  },
]

export default function ReconcileToolbar({
  view,
  onViewChange,
  bankAccounts,
  bankAccountId,
  onBankAccountChange,
  className = '',
}: ReconcileToolbarProps) {
  return (
    <div className={`flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end ${className}`}>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
        {bankAccounts.length > 0 && (
          <div className="w-full sm:w-48">
            <Select
              value={bankAccountId}
              onChange={(e) => onBankAccountChange(e.target.value)}
              aria-label="Bank account"
              className="min-h-[40px] py-2 font-medium"
            >
              <option value="">All bank accounts</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id} disabled={a.locked}>
                  {a.name}{a.locked ? ' (above plan limit)' : ''}
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
          className="w-full sm:w-auto"
        />
      </div>
    </div>
  )
}
