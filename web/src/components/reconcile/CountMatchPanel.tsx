import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Download, FileText, Hash } from 'lucide-react'
import { reconcile } from '../../lib/api'
import {
  COUNT_MATCH_SELECT_CAP,
  exportCountMatchExcel,
  exportCountMatchPdf,
} from '../../lib/countMatchExport'
import { formatAmount } from '../../lib/format'
import Button from '../ui/Button'
import { useToast } from '../ui/Toast'
import type { CountAmountRow, CountMatchDiagnostic, CountScope } from './countMatchTypes'

type ListKey =
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

const LIST_META: { key: ListKey; label: string; group: 'brs' | 'cancel'; hint: string }[] = [
  { key: 'only_cb_received', label: 'Only CB — Received', group: 'brs', hint: 'Amounts only in cash book (receipts)' },
  { key: 'only_cb_payment', label: 'Only CB — Payment', group: 'brs', hint: 'Amounts only in cash book (payments)' },
  { key: 'only_bank_lodgment', label: 'Only bank — Lodgment', group: 'brs', hint: 'Amounts only on bank credits' },
  { key: 'only_bank_debits', label: 'Only bank — Debits', group: 'brs', hint: 'Amounts only on bank debits' },
  {
    key: 'open_recv_cb',
    label: 'Open — more receipts in CB',
    group: 'brs',
    hint: 'Both sides; CB receipt count > bank credit count',
  },
  {
    key: 'open_recv_bank',
    label: 'Open — more credits in bank',
    group: 'brs',
    hint: 'Both sides; bank credit count > CB receipt count',
  },
  {
    key: 'open_pay_cb',
    label: 'Open — more payments in CB',
    group: 'brs',
    hint: 'Both sides; CB payment count > bank debit count',
  },
  {
    key: 'open_pay_bank',
    label: 'Open — more debits in bank',
    group: 'brs',
    hint: 'Both sides; bank debit count > CB payment count',
  },
  {
    key: 'cancel_recv',
    label: 'Cancel — receipts = credits',
    group: 'cancel',
    hint: 'Separate schedule (not main BRS) — batch totals cancel by count',
  },
  {
    key: 'cancel_pay',
    label: 'Cancel — payments = debits',
    group: 'cancel',
    hint: 'Separate schedule (not main BRS) — batch totals cancel by count',
  },
]

function rowsFor(data: CountMatchDiagnostic, key: ListKey): CountAmountRow[] {
  const d = data.brsDetails
  switch (key) {
    case 'only_cb_received':
      return d.onlyCashBookReceived
    case 'only_cb_payment':
      return d.onlyCashBookPayments
    case 'only_bank_lodgment':
      return d.onlyBankLodgments
    case 'only_bank_debits':
      return d.onlyBankDebits
    case 'open_recv_cb':
      return d.openReceiptsVsCreditsCbSurplus
    case 'open_recv_bank':
      return d.openReceiptsVsCreditsBankSurplus
    case 'open_pay_cb':
      return d.openPaymentsVsDebitsCbSurplus
    case 'open_pay_bank':
      return d.openPaymentsVsDebitsBankSurplus
    case 'cancel_recv':
      return data.cancelSchedule.receiptsEqualsCredits
    case 'cancel_pay':
      return data.cancelSchedule.paymentsEqualsDebits
  }
}

interface CountMatchPanelProps {
  projectId: string
  projectSlug?: string
  projectName?: string
  currency: string
  bankAccountId?: string
  onSelectAmountRows?: (cashBookTxIds: string[], bankTxIds: string[]) => void
}

export default function CountMatchPanel({
  projectId,
  projectSlug = 'project',
  projectName,
  currency,
  bankAccountId,
  onSelectAmountRows,
}: CountMatchPanelProps) {
  const toast = useToast()
  const [open, setOpen] = useState(true)
  const [scope, setScope] = useState<CountScope>('unmatched')
  const [listKey, setListKey] = useState<ListKey>('only_cb_received')
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null)

  const query = useQuery({
    queryKey: ['reconcile-count-match', projectId, bankAccountId || null, scope],
    queryFn: () =>
      reconcile.getCountMatch(projectId, {
        bankAccountId: bankAccountId || undefined,
        scope,
      }) as Promise<CountMatchDiagnostic>,
    enabled: !!projectId,
  })

  const activeMeta = LIST_META.find((m) => m.key === listKey)!
  const rows = useMemo(() => (query.data ? rowsFor(query.data, listKey) : []), [query.data, listKey])

  const summaryBits = useMemo(() => {
    if (!query.data) return null
    const r = query.data.receiptsCredits.summary
    const p = query.data.paymentsDebits.summary
    return {
      onlyCb: r.onlyCashBook + p.onlyCashBook,
      onlyBank: r.onlyBank + p.onlyBank,
      open: r.openCbSurplus + r.openBankSurplus + p.openCbSurplus + p.openBankSurplus,
      cancel: r.batchCancel + p.batchCancel,
    }
  }, [query.data])

  async function handleExport(kind: 'xlsx' | 'pdf') {
    if (!query.data) return
    setExporting(kind)
    try {
      if (kind === 'xlsx') {
        await exportCountMatchExcel(query.data, { projectSlug })
      } else {
        await exportCountMatchPdf(query.data, { projectSlug, projectName })
      }
      toast.success(kind === 'xlsx' ? 'Excel downloaded' : 'PDF downloaded')
    } catch (e) {
      toast.error('Export failed', e instanceof Error ? e.message : 'Try again')
    } finally {
      setExporting(null)
    }
  }

  function handleSelectRow(r: CountAmountRow) {
    if (!onSelectAmountRows) return
    const cbRaw = r.cashBookTxIds
    const bankRaw = r.bankTxIds
    const cbCapped = cbRaw.length > COUNT_MATCH_SELECT_CAP
    const bankCapped = bankRaw.length > COUNT_MATCH_SELECT_CAP
    const cb = cbRaw.slice(0, COUNT_MATCH_SELECT_CAP)
    const bank = bankRaw.slice(0, COUNT_MATCH_SELECT_CAP)
    onSelectAmountRows(cb, bank)
    if (cbCapped || bankCapped) {
      toast.warning(
        'Selection capped',
        `Selected first ${COUNT_MATCH_SELECT_CAP} lines per side (of ${cbRaw.length} CB / ${bankRaw.length} bank). Match in batches — counts never auto-clear.`
      )
    } else {
      toast.info(
        'Lines selected',
        `${cb.length} cash book · ${bank.length} bank. Confirm with Match or review suggested pairs — counting does not clear.`
      )
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm max-w-5xl overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 p-5 pb-0">
        <button
          type="button"
          className="text-left flex-1 min-w-[16rem]"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <h3 className="text-base font-bold text-slate-900 tracking-tight mb-1 flex items-center gap-2">
            {open ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            <Hash className="w-4 h-4 text-slate-500" />
            Match by counting
          </h3>
          <p className="text-sm text-slate-600 max-w-2xl pl-6">
            Amount-frequency schedules for BRS lists and a separate batch-cancel report. Diagnostic
            only — never auto-clears.
          </p>
        </button>
        {open && (
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                  scope === 'unmatched' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
                onClick={() => setScope('unmatched')}
              >
                Unmatched
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                  scope === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
                onClick={() => setScope('all')}
              >
                All lines
              </button>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              isLoading={exporting === 'xlsx'}
              disabled={!query.data || !!exporting}
              onClick={() => void handleExport('xlsx')}
            >
              <Download className="w-3.5 h-3.5" />
              Excel
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              isLoading={exporting === 'pdf'}
              disabled={!query.data || !!exporting}
              onClick={() => void handleExport('pdf')}
            >
              <FileText className="w-3.5 h-3.5" />
              PDF
            </Button>
          </div>
        )}
      </header>

      {open && (
        <div className="p-5 pt-4">
          {query.isLoading && <p className="text-sm text-slate-500">Building count schedules…</p>}
          {query.isError && (
            <p className="text-sm text-red-700">Could not load count-match diagnostic. Try again.</p>
          )}

          {query.data && summaryBits && (
            <>
              <div className="flex flex-wrap gap-2 mb-3 text-xs">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                  Only CB: {summaryBits.onlyCb}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                  Only bank: {summaryBits.onlyBank}
                </span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-900">
                  Open imbalances: {summaryBits.open}
                </span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-900">
                  Batch cancel: {summaryBits.cancel}
                </span>
                {query.data.invertedSides && (
                  <span className="rounded-full bg-primary-100 px-2.5 py-1 font-medium text-primary-900">
                    Crossed sides applied
                  </span>
                )}
                {query.data.meta?.laneTruncated && (
                  <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 font-medium text-amber-800">
                    Large file — counts use loaded lane cap
                  </span>
                )}
              </div>

              <div className="mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  BRS detail lists
                </p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {LIST_META.filter((m) => m.group === 'brs').map((m) => {
                    const n = rowsFor(query.data!, m.key).length
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setListKey(m.key)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                          listKey === m.key
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {m.label}
                        <span className="ml-1 opacity-70">({n})</span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Separate cancel schedule
                </p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {LIST_META.filter((m) => m.group === 'cancel').map((m) => {
                    const n = rowsFor(query.data!, m.key).length
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setListKey(m.key)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                          listKey === m.key
                            ? 'bg-emerald-800 text-white border-emerald-800'
                            : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:border-emerald-300'
                        }`}
                      >
                        {m.label}
                        <span className="ml-1 opacity-70">({n})</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-2">{activeMeta.hint}</p>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Amount</th>
                      <th className="px-3 py-2 font-semibold">CB count</th>
                      <th className="px-3 py-2 font-semibold">Bank count</th>
                      <th className="px-3 py-2 font-semibold">Diff</th>
                      <th className="px-3 py-2 font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                          No amounts in this list for the current scope.
                        </td>
                      </tr>
                    )}
                    {rows.map((r) => (
                      <tr key={`${listKey}-${r.amountKey}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-900 tabular-nums">
                          {formatAmount(r.amount, currency)}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-slate-700">{r.cashBookCount}</td>
                        <td className="px-3 py-2 tabular-nums text-slate-700">{r.bankCount}</td>
                        <td className="px-3 py-2 tabular-nums text-slate-700">{r.difference}</td>
                        <td className="px-3 py-2 text-right">
                          {onSelectAmountRows &&
                            (r.cashBookTxIds.length > 0 || r.bankTxIds.length > 0) && (
                              <button
                                type="button"
                                className="text-xs font-semibold text-primary-700 hover:underline"
                                onClick={() => handleSelectRow(r)}
                              >
                                Select lines
                              </button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
