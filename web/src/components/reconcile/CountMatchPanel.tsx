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
import Alert from '../ui/Alert'
import Badge from '../ui/Badge'
import Card from '../ui/Card'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../ui/Table'
import Skeleton from '../ui/Skeleton'
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
    <Card className="max-w-5xl" noPadding>
      <header className="flex flex-wrap items-start justify-between gap-3 p-5 pb-0">
        <Button
          type="button"
          variant="ghost"
          className="text-left flex-1 min-w-[16rem] h-auto !justify-start !items-start px-0 py-0 hover:bg-transparent"
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
        </Button>
        {open && (
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-surface">
              <Button
                type="button"
                size="xs"
                variant="ghost"
                aria-pressed={scope === 'unmatched'}
                className={scope === 'unmatched' ? '!bg-white !text-slate-900 shadow-sm' : 'text-slate-600'}
                onClick={() => setScope('unmatched')}
              >
                Unmatched
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                aria-pressed={scope === 'all'}
                className={scope === 'all' ? '!bg-white !text-slate-900 shadow-sm' : 'text-slate-600'}
                onClick={() => setScope('all')}
              >
                All lines
              </Button>
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
          {query.isLoading && (
            <div className="space-y-2" aria-busy="true" aria-label="Building count schedules">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          )}
          {query.isError && (
            <Alert
              tone="error"
              title="Could not load count-match diagnostic"
              onRetry={() => void query.refetch()}
            />
          )}

          {query.data && summaryBits && (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge tone="neutral" size="sm">
                  Only CB: {summaryBits.onlyCb}
                </Badge>
                <Badge tone="neutral" size="sm">
                  Only bank: {summaryBits.onlyBank}
                </Badge>
                <Badge tone="warning" size="sm">
                  Open imbalances: {summaryBits.open}
                </Badge>
                <Badge tone="success" size="sm">
                  Batch cancel: {summaryBits.cancel}
                </Badge>
                {query.data.invertedSides && (
                  <Badge tone="brand" size="sm">
                    Crossed sides applied
                  </Badge>
                )}
                {query.data.meta?.laneTruncated && (
                  <Badge tone="warning" size="sm">
                    Large file — counts use loaded lane cap
                  </Badge>
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
                      <Button
                        key={m.key}
                        type="button"
                        size="xs"
                        variant={listKey === m.key ? 'primary' : 'outline'}
                        aria-pressed={listKey === m.key}
                        onClick={() => setListKey(m.key)}
                      >
                        {m.label}
                        <span className="ml-1 opacity-70">({n})</span>
                      </Button>
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
                      <Button
                        key={m.key}
                        type="button"
                        size="xs"
                        variant={listKey === m.key ? 'primary' : 'outline'}
                        aria-pressed={listKey === m.key}
                        onClick={() => setListKey(m.key)}
                      >
                        {m.label}
                        <span className="ml-1 opacity-70">({n})</span>
                      </Button>
                    )
                  })}
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-2">{activeMeta.hint}</p>

              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHead>
                    <tr>
                      <TableTh>Amount</TableTh>
                      <TableTh>CB count</TableTh>
                      <TableTh>Bank count</TableTh>
                      <TableTh>Diff</TableTh>
                      <TableTh />
                    </tr>
                  </TableHead>
                  <TableBody>
                    {rows.length === 0 && (
                      <TableRow>
                        <TableTd colSpan={5} className="text-center text-gray-500">
                          No amounts in this list for the current scope.
                        </TableTd>
                      </TableRow>
                    )}
                    {rows.map((r) => (
                      <TableRow key={`${listKey}-${r.amountKey}`}>
                        <TableTd className="font-medium text-gray-900 tabular-nums">
                          {formatAmount(r.amount, currency)}
                        </TableTd>
                        <TableTd className="tabular-nums">{r.cashBookCount}</TableTd>
                        <TableTd className="tabular-nums">{r.bankCount}</TableTd>
                        <TableTd className="tabular-nums">{r.difference}</TableTd>
                        <TableTd className="text-right">
                          {onSelectAmountRows &&
                            (r.cashBookTxIds.length > 0 || r.bankTxIds.length > 0) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                className="text-primary-700"
                                onClick={() => handleSelectRow(r)}
                              >
                                Select lines
                              </Button>
                            )}
                        </TableTd>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  )
}
