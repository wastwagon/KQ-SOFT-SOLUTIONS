import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  attachments,
  reconcile,
  subscription,
  isSubscriptionInactiveError,
  unlessSubscriptionInactive,
} from '../../lib/api'
import { useToast } from '../ui/Toast'
import type {
  MatchParams,
  MatchedPair,
  ReconcileView,
  SuggestedMatch,
  SuggestedSplitMatch,
  Tx,
} from './types'

/**
 * State + data hook for the reconcile workflow.  Owns:
 *   - The reconcile data fetch (with bank-account scope and matching params).
 *   - LocalStorage-backed user preferences (selected bank account + match
 *     params) so users don't lose context between visits.
 *   - All write mutations (single match, multi match, bulk match, unmatch,
 *     evidence upload) wired with cache invalidation and toasts.
 *
 * Returns a flat object that ProjectReconcile and its presentational
 * subcomponents can pull state and callbacks from.  Keeps the page itself
 * a thin orchestrator.
 */
const STORAGE_KEY_BANK = (projectId: string) => `brs_last_bank_account_${projectId}`
const STORAGE_KEY_PARAMS = (projectId: string) => `brs_match_params_${projectId}`

const DEFAULT_MATCH_PARAMS: MatchParams = {
  useDate: true,
  useDocRef: true,
  useChequeNo: true,
}

/**
 * Read the previously-selected bank account id from localStorage.  Used as a
 * lazy initializer so we don't fire a redundant setState inside an effect.
 * The value is only honoured after we know the id is present in the
 * project's bank account list.
 */
function readSavedBankAccount(projectId: string): string {
  if (!projectId || typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(STORAGE_KEY_BANK(projectId)) ?? ''
  } catch {
    return ''
  }
}

function readSavedMatchParams(projectId: string): MatchParams {
  if (!projectId || typeof window === 'undefined') return DEFAULT_MATCH_PARAMS
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PARAMS(projectId))
    if (!raw) return DEFAULT_MATCH_PARAMS
    const parsed = JSON.parse(raw) as Partial<MatchParams>
    return {
      useDate: typeof parsed.useDate === 'boolean' ? parsed.useDate : true,
      useDocRef: typeof parsed.useDocRef === 'boolean' ? parsed.useDocRef : true,
      useChequeNo: typeof parsed.useChequeNo === 'boolean' ? parsed.useChequeNo : true,
    }
  } catch {
    return DEFAULT_MATCH_PARAMS
  }
}

interface ReconcileApiResponse {
  bankAccounts?: { id: string; name: string }[]
  receipts?: { transactions: Tx[]; truncated?: boolean }
  payments?: { transactions: Tx[]; truncated?: boolean }
  credits?: { transactions: Tx[]; truncated?: boolean }
  debits?: { transactions: Tx[]; truncated?: boolean }
  matches?: MatchedPair[]
  matchedCashBookIds?: string[]
  matchedReceiptIds?: string[]
  matchedBankIds?: string[]
  matchedCreditIds?: string[]
  flaggedBankIds?: string[]
  existingMatches?: number
  suggestions?: {
    receipts?: SuggestedMatch[]
    payments?: SuggestedMatch[]
    split?: {
      receipts?: SuggestedSplitMatch[]
      payments?: SuggestedSplitMatch[]
    }
  }
  project?: { currency?: string }
}

export interface ReconcileSession {
  // Query state
  data: ReconcileApiResponse | undefined
  isLoading: boolean
  /** True when reconcile API returned subscription paywall (org inactive). */
  subscriptionPaywallBlocked: boolean
  /** True when reconcile fetch failed for a reason other than subscription paywall. */
  reconcileLoadFailed: boolean
  // View / scope
  view: ReconcileView
  setView: (view: ReconcileView) => void
  bankAccountId: string
  setBankAccountId: (id: string) => void
  bankAccounts: { id: string; name: string }[]
  // Pagination
  reconcileLimit: number
  loadMore: () => void
  // Match params
  matchParams: MatchParams
  setMatchParams: (params: MatchParams) => void
  resetMatchParams: () => void
  // Selection
  selectedCbIds: Set<string>
  setSelectedCbIds: (next: Set<string>) => void
  toggleCb: (id: string) => void
  selectedBankIds: Set<string>
  setSelectedBankIds: (next: Set<string>) => void
  toggleBank: (id: string) => void
  clearSelection: () => void
  // Bulk-match selection (indices into the flat suggestions array)
  bulkSelected: Set<number>
  setBulkSelected: (next: Set<number>) => void
  // Feature flags pulled from /subscription/usage
  features: Record<string, boolean>
  // Mutations + status
  matchMutation: ReturnType<typeof useMutation<unknown, Error, { cashBookTransactionId: string; bankTransactionId: string }>>
  multiMatchMutation: ReturnType<
    typeof useMutation<
      unknown,
      Error,
      | { cashBookTransactionId: string; bankTransactionIds: string[] }
      | { cashBookTransactionIds: string[]; bankTransactionId: string }
      | { cashBookTransactionIds: string[]; bankTransactionIds: string[] }
    >
  >
  bulkMatchMutation: ReturnType<
    typeof useMutation<
      { created: number },
      Error,
      { cashBookTransactionId: string; bankTransactionId: string }[]
    >
  >
  unmatchMutation: ReturnType<typeof useMutation<unknown, Error, string>>
  evidenceUploadMutation: ReturnType<
    typeof useMutation<unknown, Error, { file: File; matchId: string }>
  >
}

export function useReconcileSession(projectId: string): ReconcileSession {
  const queryClient = useQueryClient()
  const toast = useToast()

  const [view, setView] = useState<ReconcileView>('all')
  const [selectedCbIds, setSelectedCbIds] = useState<Set<string>>(new Set())
  const [selectedBankIds, setSelectedBankIds] = useState<Set<string>>(new Set())
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set())
  // Lazy initializers so we only read localStorage once at mount.  Anything
  // we later persist is mirrored back via the effects below.
  const [bankAccountId, setBankAccountIdState] = useState(() => readSavedBankAccount(projectId))
  const [matchParams, setMatchParamsState] = useState<MatchParams>(() =>
    readSavedMatchParams(projectId)
  )
  const [reconcileLimit, setReconcileLimit] = useState(1500)

  const { data: usageData } = useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: subscription.getUsage,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
  const features = (usageData?.features || {}) as Record<string, boolean>

  const reconcileQuery = useQuery<ReconcileApiResponse>({
    queryKey: [
      'reconcile',
      projectId,
      bankAccountId || null,
      reconcileLimit,
      matchParams.useDate,
      matchParams.useDocRef,
      matchParams.useChequeNo,
    ],
    queryFn: () =>
      reconcile.get(projectId, {
        bankAccountId: bankAccountId || undefined,
        limit: reconcileLimit,
        useDate: matchParams.useDate,
        useDocRef: matchParams.useDocRef,
        useChequeNo: matchParams.useChequeNo,
      }) as Promise<ReconcileApiResponse>,
    enabled: !!projectId,
  })
  const { data, isLoading, isError: reconcileQueryFailed } = reconcileQuery
  const subscriptionPaywallBlocked = isSubscriptionInactiveError(reconcileQuery.error)
  const reconcileLoadFailed = !subscriptionPaywallBlocked && reconcileQueryFailed

  const bankAccounts = useMemo(() => data?.bankAccounts ?? [], [data?.bankAccounts])

  // Effective bank account: only show the saved value once we've confirmed
  // the account still exists on the project.  Until accounts have loaded
  // we trust the saved value (so the API can filter on first fetch).
  const effectiveBankAccountId = useMemo(() => {
    if (!bankAccountId) return ''
    if (bankAccounts.length === 0) return bankAccountId
    return bankAccounts.some((a) => a.id === bankAccountId) ? bankAccountId : ''
  }, [bankAccountId, bankAccounts])

  // Persist the selection only once it's validated against the server's
  // account list.  If the saved value is stale, we simply don't write
  // anything (the next valid pick from the user replaces it).
  useEffect(() => {
    if (!projectId || !effectiveBankAccountId) return
    try {
      localStorage.setItem(STORAGE_KEY_BANK(projectId), effectiveBankAccountId)
    } catch {
      /* localStorage may be unavailable */
    }
  }, [projectId, effectiveBankAccountId])

  // Persist match params whenever they change (the initial value already
  // came from storage via the lazy state init).
  useEffect(() => {
    if (!projectId) return
    try {
      localStorage.setItem(STORAGE_KEY_PARAMS(projectId), JSON.stringify(matchParams))
    } catch {
      /* localStorage may be unavailable */
    }
  }, [projectId, matchParams])

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['reconcile', projectId] })
    queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    queryClient.invalidateQueries({ queryKey: ['projects'] })
  }

  const matchMutation = useMutation<unknown, Error, { cashBookTransactionId: string; bankTransactionId: string }>({
    mutationFn: (body) => reconcile.createMatch(projectId, body),
    onSuccess: () => {
      invalidateAll()
      setSelectedCbIds(new Set())
      setSelectedBankIds(new Set())
      toast.success('Match saved')
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not save match', e instanceof Error ? e.message : 'Request failed')
      ),
  })

  const multiMatchMutation = useMutation<
    unknown,
    Error,
    | { cashBookTransactionId: string; bankTransactionIds: string[] }
    | { cashBookTransactionIds: string[]; bankTransactionId: string }
    | { cashBookTransactionIds: string[]; bankTransactionIds: string[] }
  >({
    mutationFn: (body) => reconcile.createMatchMulti(projectId, body),
    onSuccess: (_, variables) => {
      invalidateAll()
      setSelectedCbIds(new Set())
      setSelectedBankIds(new Set())
      const count =
        'cashBookTransactionIds' in variables && 'bankTransactionIds' in variables
          ? variables.cashBookTransactionIds.length + variables.bankTransactionIds.length
          : 'bankTransactionIds' in variables
            ? variables.bankTransactionIds.length
            : variables.cashBookTransactionIds.length
      toast.success(`Matched ${count} transaction${count === 1 ? '' : 's'}`)
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not save match', e instanceof Error ? e.message : 'Request failed')
      ),
  })

  const bulkMatchMutation = useMutation<
    { created: number },
    Error,
    { cashBookTransactionId: string; bankTransactionId: string }[]
  >({
    mutationFn: (matches) =>
      reconcile.createMatchBulk(projectId, { matches }) as Promise<{ created: number }>,
    onSuccess: (resp) => {
      invalidateAll()
      setBulkSelected(new Set())
      setSelectedCbIds(new Set())
      setSelectedBankIds(new Set())
      const created = resp?.created ?? 0
      toast.success(`Matched ${created} pair${created === 1 ? '' : 's'}`)
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Bulk match failed', e instanceof Error ? e.message : 'Request failed')
      ),
  })

  const unmatchMutation = useMutation<unknown, Error, string>({
    mutationFn: (matchId) => reconcile.deleteMatch(projectId, matchId),
    onSuccess: () => {
      invalidateAll()
      toast.success('Match removed')
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not remove match', e instanceof Error ? e.message : 'Request failed')
      ),
  })

  const evidenceUploadMutation = useMutation<unknown, Error, { file: File; matchId: string }>({
    mutationFn: ({ file, matchId }) =>
      attachments.upload(projectId, file, 'match_evidence', matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconcile', projectId] })
      toast.success('Evidence uploaded')
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Evidence upload failed', e instanceof Error ? e.message : 'Request failed')
      ),
  })

  const toggleCb = (id: string) => {
    setSelectedCbIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleBank = (id: string) => {
    setSelectedBankIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearSelection = () => {
    setSelectedCbIds(new Set())
    setSelectedBankIds(new Set())
  }

  return {
    data,
    isLoading,
    subscriptionPaywallBlocked,
    reconcileLoadFailed,
    view,
    setView,
    bankAccountId: effectiveBankAccountId,
    setBankAccountId: setBankAccountIdState,
    bankAccounts,
    reconcileLimit,
    loadMore: () => setReconcileLimit(5000),
    matchParams,
    setMatchParams: setMatchParamsState,
    resetMatchParams: () => setMatchParamsState(DEFAULT_MATCH_PARAMS),
    selectedCbIds,
    setSelectedCbIds,
    toggleCb,
    selectedBankIds,
    setSelectedBankIds,
    toggleBank,
    clearSelection,
    bulkSelected,
    setBulkSelected,
    features,
    matchMutation,
    multiMatchMutation,
    bulkMatchMutation,
    unmatchMutation,
    evidenceUploadMutation,
  }
}
