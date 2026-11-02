import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, ClipboardCheck, Download, FileText, Hash } from 'lucide-react'
import { reconcile } from '../../lib/api'
import { exportCountMatchExcel, exportCountMatchPdf } from '../../lib/countMatchExport'
import {
  cancelEqualCountPairs,
  countMatchSelection,
  leftoverOnlyListKey,
  type CountCancelPair,
  type CountSelectMode,
} from '../../lib/countMatchSelect'
import { COUNT_MATCH_SELECT_CAP } from '../../lib/countMatchExport'
import { useConfirm } from '../ui/ConfirmDialog'
import { formatAmount } from '../../lib/format'
import Button from '../ui/Button'
import ActionMenu, { type ActionMenuItem } from '../ui/ActionMenu'
import { COUNT_MATCH_GROUP_LABELS } from './countMatchListLabels'
import PageLoadError from '../ui/PageLoadError'
import Alert from '../ui/Alert'
import Badge from '../ui/Badge'
import Card from '../ui/Card'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../ui/Table'
import Skeleton from '../ui/Skeleton'
import { useToast } from '../ui/Toast'
import type { CountAmountRow, CountMatchDiagnostic, CountScope } from './countMatchTypes'
import CountMatchListFilters, {
  COUNT_MATCH_LIST_META,
  type CountMatchListKey,
} from './CountMatchListFilters'
import type { CountMatchUxSignoff } from '../../lib/countMatchUxSignoff'

type ListKey = CountMatchListKey

const LIST_META = COUNT_MATCH_LIST_META

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
                ? `${m.hint}. When one side has more lines at the same amount, match the pairs that belong together; each amount is listed once.`
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
  /** Cancel-out only. Omitted leaves Select lines as the only action on that list. */
  canPairCancelBatch?: boolean
  onPairCancelBatch?: (pairs: CountCancelPair[]) => Promise<void>
  uxSignoff?: CountMatchUxSignoff | null
  onOpenUxChecklist?: () => void
}

export default function CountMatchPanel({
  projectId,
  projectSlug = 'project',
  projectName,
  currency,
  bankAccountId,
  onSelectAmountRows,
  canPairCancelBatch = false,
  onPairCancelBatch,
  uxSignoff = null,
  onOpenUxChecklist,
}: CountMatchPanelProps) {
  const toast = useToast()
  const confirm = useConfirm()
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
  const [pairingAmountKey, setPairingAmountKey] = useState<string | null>(null)

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
        'The remainder is on one side only. Try suggested matches or leave it for the BRS (lodgment or unpresented cheque).'
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
            ? ' and will stay on one side only after you confirm.'
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

  async function handlePairBatch(r: CountAmountRow) {
    if (!onPairCancelBatch || pairingAmountKey) return
    const pairs = cancelEqualCountPairs(r.cashBookTxIds, r.bankTxIds)
    if (!pairs) return
    const batches = Math.ceil(pairs.length / COUNT_MATCH_SELECT_CAP)
    const ok = await confirm({
      title: 'Pair this Cancel-out amount?',
      description: `Match ${pairs.length} cash-book line${pairs.length === 1 ? '' : 's'} with ${pairs.length} bank line${pairs.length === 1 ? '' : 's'} at this amount, one-to-one${
        batches > 1 ? `, in ${batches} batches of up to ${COUNT_MATCH_SELECT_CAP}` : ''
      }. Select lines stays available for a manual match.`,
      confirmLabel: 'Pair batch',
      tone: 'info',
    })
    if (!ok) return
    setPairingAmountKey(r.amountKey)
    try {
      await onPairCancelBatch(pairs)
    } finally {
      setPairingAmountKey(null)
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
            {uxSignoff?.result === 'pass' && (
              <Badge tone="success" size="sm" shape="soft">
                Preparer signed off
              </Badge>
            )}
            {uxSignoff?.result === 'fail' && (
              <Badge tone="warning" size="sm" shape="soft">
                UX check failed
              </Badge>
            )}
          </h3>
          <p className="text-sm text-slate-600 max-w-2xl pl-6">
            Groups by amount; <strong className="font-semibold text-slate-700">CB count</strong> and{' '}
            <strong className="font-semibold text-slate-700">Bank count</strong> are transaction
            tallies (five lines of the same amount ⇒ 5, not 1). Recommended order:{' '}
            <strong className="font-semibold text-slate-700">Cancel</strong>, then{' '}
            <strong className="font-semibold text-slate-700">Open</strong> (overlap), then{' '}
            <strong className="font-semibold text-slate-700">Only</strong>. Diagnostic — never
            auto-clears. Not split matching: different amounts that add up (6,200 + 3,800 = 10,000)
            are under <strong className="font-semibold text-slate-700">Split suggestions</strong>{' '}
            above, not Cancel.
          </p>
        </Button>
        {open && (
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="gap-1.5"
              onClick={() => onOpenUxChecklist?.()}
              disabled={!onOpenUxChecklist}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              Preparer check
            </Button>
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
            <ActionMenu
              label="Export"
              size="sm"
              variant="secondary"
              align="right"
              menuAriaLabel="Export amount-matching schedules"
              isLoading={!!exporting}
              items={[
                {
                  kind: 'button',
                  label: 'Download Excel',
                  icon: Download,
                  disabled: !query.data || !!exporting,
                  onClick: () => void handleExport('xlsx'),
                },
                {
                  kind: 'button',
                  label: 'Download PDF',
                  icon: FileText,
                  disabled: !query.data || !!exporting,
                  onClick: () => void handleExport('pdf'),
                },
              ]}
            />
          </div>
        )}
      </header>

      {open && (
        <div className="p-5 pt-4">
          {uxSignoff?.result === 'fail' && uxSignoff.notes && (
            <Alert tone="warning" title="Preparer UX check — issues recorded" className="mb-4">
              {uxSignoff.notes}
            </Alert>
          )}
          {query.isLoading && (
            <div className="space-y-2" aria-busy="true" aria-label="Building count schedules">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          )}
          {query.isError && (
            <PageLoadError
              title="Could not load matching-by-amount summary"
              onRetry={() => void query.refetch()}
            />
          )}

          {query.data && summaryBits && (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge
                  tone="neutral"
                  size="sm"
                  shape="soft"
                  title={`${summaryBits.onlyCbAmounts} distinct amounts · ${summaryBits.onlyCbTxs} transactions`}
                >
                  Only on cash book: {summaryBits.onlyCbTxs} txs
                  {summaryBits.onlyCbAmounts !== summaryBits.onlyCbTxs
                    ? ` (${summaryBits.onlyCbAmounts} amts)`
                    : ''}
                </Badge>
                <Badge
                  tone="neutral"
                  size="sm"
                  shape="soft"
                  title={`${summaryBits.onlyBankAmounts} distinct amounts · ${summaryBits.onlyBankTxs} transactions`}
                >
                  Only on bank statement: {summaryBits.onlyBankTxs} txs
                  {summaryBits.onlyBankAmounts !== summaryBits.onlyBankTxs
                    ? ` (${summaryBits.onlyBankAmounts} amts)`
                    : ''}
                </Badge>
                <Badge
                  tone="warning"
                  size="sm"
                  shape="soft"
                  title={`${summaryBits.openAmounts} distinct amounts · ${summaryBits.openTxs} transactions`}
                >
                  Same amount (extra lines): {summaryBits.openTxs} txs
                  {summaryBits.openAmounts !== summaryBits.openTxs
                    ? ` (${summaryBits.openAmounts} amts)`
                    : ''}
                </Badge>
                <Badge
                  tone="success"
                  size="sm"
                  shape="soft"
                  title={`${summaryBits.cancelAmounts} distinct amounts · ${summaryBits.cancelTxs} transactions`}
                >
                  Batch cancel: {summaryBits.cancelTxs} txs
                  {summaryBits.cancelAmounts !== summaryBits.cancelTxs
                    ? ` (${summaryBits.cancelAmounts} amts)`
                    : ''}
                </Badge>
                {query.data.invertedSides && (
                  <Badge tone="brand" size="sm" shape="soft">
                    Crossed sides applied
                  </Badge>
                )}
                {query.data.meta?.laneTruncated && (
                  <Badge tone="warning" size="sm" shape="soft">
                    Large file — counts use loaded lane cap
                  </Badge>
                )}
              </div>

              <div className="mb-2">
                <p className="text-xs text-slate-600 mb-3 max-w-3xl leading-relaxed hidden lg:block">
                  Suggested order:{' '}
                  <span className="font-semibold text-slate-800">1. Cancel</span> (same amount, same
                  number of lines on both sides) →{' '}
                  <span className="font-semibold text-slate-800">2. Extra lines</span> (select the lines
                  that pair up, then confirm) →{' '}
                  <span className="font-semibold text-slate-800">3. One side only</span> (use suggestions,
                  or leave as uncredited lodgments / unpresented cheques on the BRS). Keep{' '}
                  <span className="font-medium text-slate-700">Unmatched</span> selected so any remainder
                  stays on one side only after you confirm. Nothing is matched until you confirm.
                </p>
                <CountMatchListFilters
                  listKey={listKey}
                  onPick={setListKey}
                  data={query.data}
                  rowsFor={rowsFor}
                  listCountLabel={listCountLabel}
                  renderDesktopGroups={() => (
                    <>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                        {COUNT_MATCH_GROUP_LABELS.cancel}
                      </p>
                      <ListGroupButtons
                        group="cancel"
                        listKey={listKey}
                        onPick={setListKey}
                        data={query.data}
                      />
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                        2. Same amount, extra lines
                      </p>
                      <ListGroupButtons
                        group="open"
                        listKey={listKey}
                        onPick={setListKey}
                        data={query.data}
                      />
                      <p className="text-xs text-slate-500 mb-3 -mt-1 max-w-3xl">
                        When one side has more lines at the same amount, pick the lines that clearly
                        belong together, then confirm. Any leftover lines stay on{' '}
                        <span className="font-medium text-slate-600">one side only</span> (Unmatched
                        scope) for the BRS or the next statement.
                      </p>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                        3. One side only
                      </p>
                      <ListGroupButtons
                        group="only"
                        listKey={listKey}
                        onPick={setListKey}
                        data={query.data}
                      />
                    </>
                  )}
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
                <Table compact>
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
                            (r.cashBookTxIds.length > 0 || r.bankTxIds.length > 0) &&
                            (() => {
                              const items: ActionMenuItem[] = []
                              if (
                                listKey.startsWith('open_') &&
                                Math.min(r.cashBookTxIds.length, r.bankTxIds.length) > 0
                              ) {
                                items.push({
                                  kind: 'button',
                                  label: 'Match overlap',
                                  onClick: () => handleSelectRow(r, 'overlap'),
                                })
                              }
                              items.push({
                                kind: 'button',
                                label: listKey.startsWith('open_') ? 'Select all' : 'Select lines',
                                disabled: pairingAmountKey === r.amountKey,
                                onClick: () => handleSelectRow(r, 'all'),
                              })
                              if (
                                canPairCancelBatch &&
                                onPairCancelBatch &&
                                scope === 'unmatched' &&
                                (listKey === 'cancel_recv' || listKey === 'cancel_pay') &&
                                r.cashBookCount > 0 &&
                                r.cashBookCount === r.bankCount
                              ) {
                                items.push({
                                  kind: 'button',
                                  label: 'Pair batch',
                                  disabled: pairingAmountKey != null,
                                  onClick: () => void handlePairBatch(r),
                                })
                              }
                              if (items.length === 0) return null
                              if (items.length === 1 && items[0].kind === 'button') {
                                const only = items[0]
                                return (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    className="text-primary-700"
                                    title={
                                      only.label === 'Select all'
                                        ? 'Select every line at this amount, including the surplus. Confirm match requires equal totals.'
                                        : only.label === 'Match overlap'
                                          ? 'Select matching lines on both sides. Any remainder stays on one side only after you confirm (Unmatched scope).'
                                          : 'Select these lines for manual or suggested matching'
                                    }
                                    disabled={only.disabled}
                                    isLoading={pairingAmountKey === r.amountKey && only.label === 'Pair batch'}
                                    onClick={only.onClick}
                                  >
                                    {only.label}
                                  </Button>
                                )
                              }
                              return (
                                <ActionMenu
                                  label="Actions"
                                  size="xs"
                                  variant="ghost"
                                  align="right"
                                  menuAriaLabel={`Actions for ${formatAmount(r.amount, currency)}`}
                                  isLoading={pairingAmountKey === r.amountKey}
                                  items={items}
                                />
                              )
                            })()}
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
