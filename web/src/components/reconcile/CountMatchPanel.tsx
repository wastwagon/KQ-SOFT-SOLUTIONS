import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Download, FileText, Hash } from 'lucide-react'
import { reconcile } from '../../lib/api'
import { exportCountMatchExcel, exportCountMatchPdf } from '../../lib/countMatchExport'
import {
  countMatchSelection,
  leftoverOnlyListKey,
  type CountSelectMode,
} from '../../lib/countMatchSelect'
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

const LIST_META: { key: ListKey; label: string; group: 'only' | 'open' | 'cancel'; hint: string }[] = [
  { key: 'only_cb_received', label: 'Only CB — Received', group: 'only', hint: 'Amounts only in cash book (receipts)' },
  { key: 'only_cb_payment', label: 'Only CB — Payment', group: 'only', hint: 'Amounts only in cash book (payments)' },
  { key: 'only_bank_lodgment', label: 'Only bank — Lodgment', group: 'only', hint: 'Amounts only on bank credits' },
  { key: 'only_bank_debits', label: 'Only bank — Debits', group: 'only', hint: 'Amounts only on bank debits' },
  {
    key: 'open_recv_cb',
    label: 'Open — more receipts in CB',
    group: 'open',
    hint: 'Both sides; CB receipt count > bank credit count (same as fewer credits on the bank — listed once, not as Open — less)',
  },
  {
    key: 'open_recv_bank',
    label: 'Open — more credits in bank',
    group: 'open',
    hint: 'Both sides; bank credit count > CB receipt count (same as fewer receipts in the cash book — listed once, not as Open — less)',
  },
  {
    key: 'open_pay_cb',
    label: 'Open — more payments in CB',
    group: 'open',
    hint: 'Both sides; CB payment count > bank debit count (same as fewer debits on the bank — listed once, not as Open — less)',
  },
  {
    key: 'open_pay_bank',
    label: 'Open — more debits in bank',
    group: 'open',
    hint: 'Both sides; bank debit count > CB payment count (same as fewer payments in the cash book — listed once, not as Open — less)',
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

/** Sum of transaction counts (not amount-bucket rows). Five txs of the same amount ⇒ 5. */
function sumTxCounts(rows: CountAmountRow[]): { cb: number; bank: number } {
  let cb = 0
  let bank = 0
  for (const r of rows) {
    cb += r.cashBookCount
    bank += r.bankCount
  }
  return { cb, bank }
}

function listCountLabel(rows: CountAmountRow[]): string {
  const amounts = rows.length
  const { cb, bank } = sumTxCounts(rows)
  const txs = cb + bank
  if (amounts === 0) return '0'
  if (txs === amounts) return String(txs)
  return `${amounts} amts · ${txs} txs`
}

function ListGroupButtons({
  group,
  listKey,
  onPick,
  data,
}: {
  group: 'only' | 'open' | 'cancel'
  listKey: ListKey
  onPick: (key: ListKey) => void
  data: CountMatchDiagnostic
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {LIST_META.filter((m) => m.group === group).map((m) => {
        const listRows = rowsFor(data, m.key)
        return (
          <Button
            key={m.key}
            type="button"
            size="xs"
            variant={listKey === m.key ? 'primary' : 'outline'}
            aria-pressed={listKey === m.key}
            title={
              m.group === 'open'
                ? `${m.hint}. Open — more on one side is open — less on the other; each amount is listed once.`
                : 'Label shows distinct amounts and transaction counts (same amount counted per line)'
            }
            onClick={() => onPick(m.key)}
          >
            {m.label}
            <span className="ml-1 opacity-70">({listCountLabel(listRows)})</span>
          </Button>
        )
      })}
    </div>
  )
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
  const [listKey, setListKey] = useState<ListKey>('cancel_recv')
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null)
  const [pendingLeftover, setPendingLeftover] = useState<{
    amountKey: string
    openKey: ListKey
    onlyKey: ListKey
    seenUpdatedAt: number
  } | null>(null)
  const [highlightAmountKey, setHighlightAmountKey] = useState<string | null>(null)

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

  useEffect(() => {
    if (!pendingLeftover || !query.data || scope !== 'unmatched') return
    if (query.dataUpdatedAt === pendingLeftover.seenUpdatedAt) return
    const onlyRows = rowsFor(query.data, pendingLeftover.onlyKey)
    const moved = onlyRows.some((r) => r.amountKey === pendingLeftover.amountKey)
    if (moved) {
      setListKey(pendingLeftover.onlyKey)
      setHighlightAmountKey(pendingLeftover.amountKey)
      setPendingLeftover(null)
      toast.info(
        'Leftovers moved to Only',
        'The unmatched remainder is now on the Only list. Check suggestions or leave as BRS items.'
      )
      return
    }
    const stillOpen = rowsFor(query.data, pendingLeftover.openKey).some(
      (r) => r.amountKey === pendingLeftover.amountKey
    )
    if (stillOpen) {
      setPendingLeftover((prev) =>
        prev ? { ...prev, seenUpdatedAt: query.dataUpdatedAt } : null
      )
      return
    }
    setPendingLeftover(null)
  }, [pendingLeftover, query.data, query.dataUpdatedAt, scope, toast])

  const summaryBits = useMemo(() => {
    if (!query.data) return null
    const d = query.data
    const onlyCbRows = [...d.brsDetails.onlyCashBookReceived, ...d.brsDetails.onlyCashBookPayments]
    const onlyBankRows = [...d.brsDetails.onlyBankLodgments, ...d.brsDetails.onlyBankDebits]
    const openRows = [
      ...d.brsDetails.openReceiptsVsCreditsCbSurplus,
      ...d.brsDetails.openReceiptsVsCreditsBankSurplus,
      ...d.brsDetails.openPaymentsVsDebitsCbSurplus,
      ...d.brsDetails.openPaymentsVsDebitsBankSurplus,
    ]
    const cancelRows = [
      ...d.cancelSchedule.receiptsEqualsCredits,
      ...d.cancelSchedule.paymentsEqualsDebits,
    ]
    const onlyCbTx = sumTxCounts(onlyCbRows)
    const onlyBankTx = sumTxCounts(onlyBankRows)
    const openTx = sumTxCounts(openRows)
    const cancelTx = sumTxCounts(cancelRows)
    return {
      onlyCbAmounts: onlyCbRows.length,
      onlyCbTxs: onlyCbTx.cb + onlyCbTx.bank,
      onlyBankAmounts: onlyBankRows.length,
      onlyBankTxs: onlyBankTx.cb + onlyBankTx.bank,
      openAmounts: openRows.length,
      openTxs: openTx.cb + openTx.bank,
      cancelAmounts: cancelRows.length,
      cancelTxs: cancelTx.cb + cancelTx.bank,
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

  function handleSelectRow(r: CountAmountRow, mode: CountSelectMode) {
    if (!onSelectAmountRows) return
    const sel = countMatchSelection(r.cashBookTxIds, r.bankTxIds, mode)
    onSelectAmountRows(sel.cashBookTxIds, sel.bankTxIds)
    const leftover = sel.leftoverCb + sel.leftoverBank
    if (mode === 'overlap' && leftover > 0 && scope === 'unmatched') {
      const onlyKey = leftoverOnlyListKey(listKey, sel.leftoverCb, sel.leftoverBank)
      if (onlyKey) {
        setPendingLeftover({
          amountKey: r.amountKey,
          openKey: listKey,
          onlyKey,
          seenUpdatedAt: query.dataUpdatedAt,
        })
      }
    } else {
      setPendingLeftover(null)
    }
    setHighlightAmountKey(null)
    if (sel.capped) {
      toast.warning(
        'Selection capped',
        `Selected first ${sel.cashBookTxIds.length} CB / ${sel.bankTxIds.length} bank. Match in batches — counts never auto-clear.`
      )
    } else if (mode === 'overlap' && leftover > 0) {
      toast.info(
        'Overlap selected',
        `${sel.cashBookTxIds.length} cash book · ${sel.bankTxIds.length} bank (matching count). Confirm match. Leftover ${sel.leftoverCb} CB / ${sel.leftoverBank} bank stay unmatched${
          scope === 'unmatched'
            ? ' and will show on Only after you confirm.'
            : ' — switch to Unmatched after confirm so leftovers appear on Only.'
        }`
      )
    } else {
      toast.info(
        'Lines selected',
        `${sel.cashBookTxIds.length} cash book · ${sel.bankTxIds.length} bank. Confirm with Match or review suggested pairs — counting does not clear.`
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
            Groups by amount; <strong className="font-semibold text-slate-700">CB count</strong> and{' '}
            <strong className="font-semibold text-slate-700">Bank count</strong> are transaction
            tallies (five lines of the same amount ⇒ 5, not 1). Recommended order:{' '}
            <strong className="font-semibold text-slate-700">Cancel</strong>, then{' '}
            <strong className="font-semibold text-slate-700">Open</strong> (overlap), then{' '}
            <strong className="font-semibold text-slate-700">Only</strong>. Diagnostic — never
            auto-clears.
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
                <Badge
                  tone="neutral"
                  size="sm"
                  title={`${summaryBits.onlyCbAmounts} distinct amounts · ${summaryBits.onlyCbTxs} transactions`}
                >
                  Only CB: {summaryBits.onlyCbTxs} txs
                  {summaryBits.onlyCbAmounts !== summaryBits.onlyCbTxs
                    ? ` (${summaryBits.onlyCbAmounts} amts)`
                    : ''}
                </Badge>
                <Badge
                  tone="neutral"
                  size="sm"
                  title={`${summaryBits.onlyBankAmounts} distinct amounts · ${summaryBits.onlyBankTxs} transactions`}
                >
                  Only bank: {summaryBits.onlyBankTxs} txs
                  {summaryBits.onlyBankAmounts !== summaryBits.onlyBankTxs
                    ? ` (${summaryBits.onlyBankAmounts} amts)`
                    : ''}
                </Badge>
                <Badge
                  tone="warning"
                  size="sm"
                  title={`${summaryBits.openAmounts} distinct amounts · ${summaryBits.openTxs} transactions`}
                >
                  Open: {summaryBits.openTxs} txs
                  {summaryBits.openAmounts !== summaryBits.openTxs
                    ? ` (${summaryBits.openAmounts} amts)`
                    : ''}
                </Badge>
                <Badge
                  tone="success"
                  size="sm"
                  title={`${summaryBits.cancelAmounts} distinct amounts · ${summaryBits.cancelTxs} transactions`}
                >
                  Batch cancel: {summaryBits.cancelTxs} txs
                  {summaryBits.cancelAmounts !== summaryBits.cancelTxs
                    ? ` (${summaryBits.cancelAmounts} amts)`
                    : ''}
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
                <p className="text-xs text-slate-600 mb-3 max-w-3xl leading-relaxed">
                  Recommended order:{' '}
                  <span className="font-semibold text-slate-800">1. Cancel</span> (equal counts) →{' '}
                  <span className="font-semibold text-slate-800">2. Open</span> (select overlap, then
                  confirm) → <span className="font-semibold text-slate-800">3. Only</span>{' '}
                  (suggestions, or leave as BRS items). Keep{' '}
                  <span className="font-medium text-slate-700">Unmatched</span> so leftover Open
                  lines move to Only after the overlap is matched. Counting never auto-clears.
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  1. Cancel schedule
                </p>
                <ListGroupButtons
                  group="cancel"
                  listKey={listKey}
                  onPick={setListKey}
                  data={query.data}
                />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  2. Open lists
                </p>
                <ListGroupButtons
                  group="open"
                  listKey={listKey}
                  onPick={setListKey}
                  data={query.data}
                />
                <p className="text-xs text-slate-500 mb-3 -mt-1 max-w-3xl">
                  <span className="font-medium text-slate-600">Open — more</span> on one side is the
                  same as <span className="font-medium text-slate-600">open — less</span> on the
                  other, so there is no separate Open — less list. Each amount appears once.{' '}
                  <span className="font-medium text-slate-600">Select overlap</span> takes the
                  matching count on both sides; leftovers stay unmatched and show on Only after
                  confirm (Unmatched scope).
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  3. Only lists
                </p>
                <ListGroupButtons
                  group="only"
                  listKey={listKey}
                  onPick={setListKey}
                  data={query.data}
                />
              </div>

              <p className="text-xs text-slate-500 mb-2">
                {activeMeta.hint}. Table: <span className="font-medium text-slate-600">Amount</span>{' '}
                = value; <span className="font-medium text-slate-600">CB count / Bank count</span> =
                number of transactions.
                {rows.length > 0 && (
                  <>
                    {' '}
                    This list: {listCountLabel(rows)}.
                  </>
                )}
              </p>

              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHead>
                    <tr>
                      <TableTh title="Money value used to group lines — not a count">Amount</TableTh>
                      <TableTh title="Number of cash-book transactions at this amount">
                        CB count
                      </TableTh>
                      <TableTh title="Number of bank transactions at this amount">
                        Bank count
                      </TableTh>
                      <TableTh title="CB count − Bank count">Diff</TableTh>
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
                      <TableRow
                        key={`${listKey}-${r.amountKey}`}
                        className={
                          highlightAmountKey === r.amountKey ? 'bg-amber-50' : undefined
                        }
                      >
                        <TableTd className="font-medium text-gray-900 tabular-nums">
                          {formatAmount(r.amount, currency)}
                        </TableTd>
                        <TableTd className="tabular-nums">{r.cashBookCount}</TableTd>
                        <TableTd className="tabular-nums">{r.bankCount}</TableTd>
                        <TableTd className="tabular-nums">{r.difference}</TableTd>
                        <TableTd className="text-right">
                          {onSelectAmountRows &&
                            (r.cashBookTxIds.length > 0 || r.bankTxIds.length > 0) && (
                              <div className="flex flex-wrap justify-end gap-1">
                                {listKey.startsWith('open_') &&
                                  Math.min(r.cashBookTxIds.length, r.bankTxIds.length) > 0 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="xs"
                                      className="text-primary-700"
                                      title="Select the matching count on both sides. Leftovers stay unmatched and move to Only after you confirm (Unmatched scope)."
                                      onClick={() => handleSelectRow(r, 'overlap')}
                                    >
                                      Select overlap
                                    </Button>
                                  )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  className="text-primary-700"
                                  title={
                                    listKey.startsWith('open_')
                                      ? 'Select every line at this amount, including the surplus. Confirm match requires equal totals.'
                                      : 'Select these lines for manual or suggested matching'
                                  }
                                  onClick={() => handleSelectRow(r, 'all')}
                                >
                                  {listKey.startsWith('open_') ? 'Select all' : 'Select lines'}
                                </Button>
                              </div>
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
