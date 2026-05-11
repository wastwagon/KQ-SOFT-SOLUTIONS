import { useAuth } from '../store/auth'

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

/** Dispatched when the API returns `code: SUBSCRIPTION_INACTIVE` (see {@link SubscriptionPaywallToastBridge}). */
export const SUBSCRIPTION_INACTIVE_EVENT = 'brs:subscription-inactive' as const

export type SubscriptionInactiveEventDetail = {
  message?: string
  subscriptionStatus?: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  /** Present when `code` is `SUBSCRIPTION_INACTIVE` and the API included it. */
  readonly subscriptionStatus?: string

  constructor(
    message: string,
    init: { status: number; code: string; subscriptionStatus?: string }
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.subscriptionStatus = init.subscriptionStatus
    Object.setPrototypeOf(this, ApiError.prototype)
  }
}

export function isSubscriptionInactiveError(e: unknown): e is ApiError {
  return e instanceof ApiError && e.code === 'SUBSCRIPTION_INACTIVE'
}

/**
 * Use in mutation `onError` or `catch` blocks so generic toasts / inline errors do
 * not duplicate the paywall toast and renewal messaging.
 */
export function unlessSubscriptionInactive(err: unknown, fn: (err: unknown) => void): void {
  if (isSubscriptionInactiveError(err)) return
  fn(err)
}

/** Use with React Query `retry` so paywall 403s do not hammer the API. */
export function subscriptionPaywallRetry(failureCount: number, err: unknown): boolean {
  if (isSubscriptionInactiveError(err)) return false
  return failureCount < 2
}

export type SignBucket = 'primary' | 'cross_reference' | 'zero' | 'empty'

export interface MapDocumentResponse {
  count: number
  signFilterSummary?: Record<SignBucket, number>
  signWarningsCount?: number
  signWarningsPreview?: { rowIndex: number; amount: number; bucket: SignBucket; note: string }[]
  /** Rows skipped because they were exact duplicates (same date, amount, ref, narrative) of an earlier row in this import. */
  skippedDuplicateRows?: number
  /** When bulk-mapping several files, number of documents that were mapped (transaction count is still `count`). */
  documentsMapped?: number
}

export interface DocumentPreviewResponse {
  documentId: string
  filename: string
  headers: string[]
  rows: unknown[][]
  totalRows: number
  sheetNames?: string[]
  /** Excel only: worksheet index used for this preview (after server clamping). */
  sheetIndex?: number
  canonicalFields?: string[]
  detectedBankFormat?: string
  suggestedMapping?: Record<string, number>
  mappingConfidence?: Record<string, 'high' | 'medium' | 'low'>
  pdfTruncated?: boolean
  pdfPagesProcessed?: number
  pdfTotalPages?: number
}

export interface ReportMatchRow {
  cbDate: string
  cbName: string
  cbChqNo?: string | null
  cbDocRef?: string | null
  cbAmount: number
  cbAmountReceived?: number | null
  cbAmountPaid?: number | null
  bankDate: string
  bankDescription: string
  bankChqNo?: string | null
  bankDocRef?: string | null
  bankAmount: number
}

export interface ReportProjectInfo {
  id?: string
  name?: string
  status?: string
  reconciliationDate?: string | null
  bankStatementClosingBalance?: number | null
  reportNarrative?: string | null
  preparerComment?: string | null
  reviewerComment?: string | null
  preparedBy?: { name?: string | null; email?: string | null } | null
  preparedAt?: string | null
  reviewedBy?: { name?: string | null; email?: string | null } | null
  reviewedAt?: string | null
  approvedBy?: { name?: string | null; email?: string | null } | null
  approvedAt?: string | null
}

export interface BrsStatement {
  bankClosingBalance: number
  /** Legacy tie: cash book − full uncredited + unpresented (still returned for diagnostics). */
  bankClosingBalanceLegacy?: number
  bankClosingBalanceGhanaStyle?: number
  uncreditedLodgmentsTotal: number
  uncreditedLodgmentsTimingTotal?: number
  broughtForwardLodgmentsTotal?: number
  unpresentedChequesTotal: number
  bankOnlyCreditsNotInCashBookTotal?: number
  bankOnlyDebitsNotInCashBookTotal?: number
  bankOnlyReconcilingNet?: number
  balancePerCashBook: number
  bankStatementClosingBalance?: number | null
  workbookScheduleDerivedCashBook?: number
  workbookScheduleTieOutVariance?: number
  timingUncreditedCurrentPeriod?: number
  timingUncreditedBroughtForwardPrior?: number
  unpresentedCurrentCashBookPeriod?: number
  unpresentedBroughtForwardPrior?: number
  bankOnlyCreditsCurrentPeriod?: number
  bankOnlyCreditsBroughtForwardPrior?: number
}

export interface ReportSimpleTx {
  date: string
  amount: number
  name?: string
  details?: string
  description?: string
  chqNo?: string | null
  docRef?: string | null
  amountReceived?: number | null
  amountPaid?: number | null
  debit?: number | string
  credit?: number | string
}

export interface ReportBroughtForwardItem extends ReportSimpleTx {
  name: string
  chqNo?: string | null
  fromProject?: string
}

export interface ReportBroughtForwardLodgment extends ReportSimpleTx {
  name: string
  docRef?: string | null
  source: string
  fromProject?: string
}

export interface ReportBranding {
  logoUrl?: string
  letterheadAddress?: string
  reportTitle?: string
  primaryColor?: string
  secondaryColor?: string
  footer?: string
}

export interface ReportDiscrepancy {
  cbDate: string
  cbName: string
  cbChqNo?: string | null
  cbDocRef?: string | null
  cbAmount: number
  cbAmountReceived?: number | null
  cbAmountPaid?: number | null
  bankDate: string
  bankDescription: string
  bankChqNo?: string | null
  bankDocRef?: string | null
  bankAmount: number
  amountVariance: number
  dateVarianceDays: number
}

export interface ReportResponse {
  organization?: { name?: string; branding?: ReportBranding }
  project?: ReportProjectInfo
  bankAccounts?: { id: string; name: string; bankName?: string | null; accountNo?: string | null }[]
  bankAccountId?: string | null
  selectedBankAccountName?: string | null
  selectedBankAccountNo?: string | null
  /** Regional bank workbook-style header line, e.g. "Ecobank Account Number 5565668889" */
  bankAccountHeaderLine?: string | null
  currency?: string
  reportCompletedAt?: string
  generatedAt?: string
  narrative?: string
  preparerComment?: string
  reviewerComment?: string
  brsStatement?: BrsStatement
  reportLanguageProfile?: {
    code?: string
    label?: string
    signedAmountSupport?: boolean
    asAtAndPostPeriodMovement?: boolean
    labels?: {
      openingBankStatementBalance?: string
      closingBankStatementBalance?: string
      addUncreditedLodgments?: string
      /** Primary BRS worksheet row labels — bank-only reconciliation lines */
      addBankOnlyDebitsNotInCashBookLine?: string
      deductBankOnlyCreditsNotInCashBookLine?: string
      addBankOnlyCredits?: string
      lessBankOnlyDebits?: string
      lessUnpresentedCheques?: string
      cashBookBalanceEnd?: string
      additionalInformationTitle?: string
      asAtReconciliationPosition?: string
      postPeriodMovement?: string
      uncreditedLodgmentsOrUnclearedDeposits?: string
      bankOnlyCreditsNotInCashBook?: string
      bankOnlyDebitsNotInCashBook?: string
      unpresentedChequesOrUnclearedPayments?: string
      broughtForwardUncreditedLodgments?: string
      broughtForwardBankOnlyCredits?: string
      broughtForwardUnpresentedCheques?: string
      workbookCompositionTimingUncreditedCurrent?: string
      workbookCompositionTimingUncreditedPrior?: string
      workbookCompositionUnpresentedCurrent?: string
      workbookCompositionUnpresentedPrior?: string
      workbookCompositionBankCreditsCurrent?: string
      workbookCompositionBankCreditsPrior?: string
    }
  }
  additionalInformation?: {
    asAtReconciliationPosition?: {
      uncreditedLodgmentsOrUnclearedDeposits?: number
      bankOnlyCreditsNotInCashBook?: number
      bankOnlyDebitsNotInCashBook?: number
      unpresentedChequesOrUnclearedPayments?: number
    }
    postPeriodMovement?: {
      broughtForwardUncreditedLodgments?: number
      broughtForwardBankOnlyCredits?: number
      broughtForwardUnpresentedCheques?: number
    }
  }
  unmatchedReceipts?: ReportSimpleTx[]
  unmatchedCredits?: ReportSimpleTx[]
  unmatchedPayments?: ReportSimpleTx[]
  unmatchedDebits?: ReportSimpleTx[]
  discrepancies?: ReportDiscrepancy[]
  broughtForwardItems?: ReportBroughtForwardItem[]
  broughtForwardLodgments?: ReportBroughtForwardLodgment[]
  summary?: {
    matchedCount?: number
    matchedReceiptsCreditsCount?: number
    matchedPaymentsDebitsCount?: number
    unmatchedReceipts?: number
    unmatchedCredits?: number
    unmatchedPayments?: number
    unmatchedDebits?: number
    totalTransactions?: number
  }
  matchedPairs?: ReportMatchRow[]
  matchedReceiptsVsCredits?: ReportMatchRow[]
  matchedPaymentsVsDebits?: ReportMatchRow[]
  paidOutVarianceBreakdown?: {
    moreInCbThanBs?: ReportMatchRow[]
    moreInBsThanCb?: ReportMatchRow[]
  }
  sourceFilterLogic?: {
    cashBookReceipts?: { primary: number; cross_reference: number; zero: number; empty: number }
    cashBookPayments?: { primary: number; cross_reference: number; zero: number; empty: number }
    bankStatementDebits?: { primary: number; cross_reference: number; zero: number; empty: number }
    bankStatementCredits?: { primary: number; cross_reference: number; zero: number; empty: number }
  }
  missingChequesWithAgeing?: { date: string; name: string; chqNo?: string | null; amount: number; daysOutstanding: number; ageingBand: string }[]
  missingChequesAgeingSummary?: Record<string, { count: number; total: number }>
  discrepancySummary?: {
    byAmountBand?: { band: string; count: number; totalVariance: number }[]
    byDateBand?: { band: string; count: number }[]
  }
  reversalCandidates?: {
    reference: string
    stream: 'cash_book' | 'bank'
    amount: number
    incomingDate: string | null
    outgoingDate: string | null
    incomingNarration: string
    outgoingNarration: string
    dayDiff: number
  }[]
}

export interface SubscriptionUsageResponse {
  organization: { id: string; name: string; plan: string }
  /** True when API has SUBSCRIPTION_PAYWALL=true (core routes blocked for inactive subs). */
  paywallEnabled?: boolean
  features: Record<string, boolean>
  usage: {
    projectsUsed: number
    projectsLimit: number
    projectsUnlimited: boolean
    projectsDisplay: string
    transactionsUsed: number
    transactionsLimit: number
    transactionsUnlimited: boolean
    transactionsDisplay: string
  }
  limits: { projectsPerMonth: number; transactionsPerMonth: number }
  subscription?: {
    status: 'trial' | 'active' | 'expired' | 'free'
    trialEndsAt: string | null
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    latestPaymentAt: string | null
    latestPaymentPeriod: 'monthly' | 'yearly' | null
    latestPaymentAmount: number | null
  }
}

/** Build a URL the browser can load for a branding logo (uses frontend API base to avoid 404 when API returns another host). */
export function getLogoDisplayUrl(logoUrl: string | undefined): string {
  if (!logoUrl) return ''
  const match = logoUrl.match(/\/api\/v1\/uploads\/branding\/[^/?#]+/)
  if (match) return API_URL ? `${API_URL}${match[0]}` : logoUrl
  if (logoUrl.startsWith('http')) return logoUrl
  return API_URL ? `${API_URL}${logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`}` : logoUrl
}

function getToken(): string | null {
  return useAuth.getState().token
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

/**
 * Same error handling as {@link api} for non-JSON or blob `fetch` callers that
 * parse the body themselves (uploads, exports, downloads).
 */
function throwFromFailedResponse(res: Response, data: unknown): never {
  const raw = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const msg = raw.error ?? res.statusText ?? 'Request failed'
  const messageStr = typeof msg === 'string' ? msg : JSON.stringify(msg)
  const code = typeof raw.code === 'string' ? raw.code : undefined
  const subscriptionStatusForInactive =
    code === 'SUBSCRIPTION_INACTIVE' && typeof raw.subscriptionStatus === 'string'
      ? raw.subscriptionStatus
      : undefined
  if (code === 'SUBSCRIPTION_INACTIVE' && typeof window !== 'undefined') {
    const path = window.location.pathname
    if (path !== '/dashboard' && path !== '/') {
      const detail: SubscriptionInactiveEventDetail = {
        message: messageStr,
        ...(subscriptionStatusForInactive !== undefined
          ? { subscriptionStatus: subscriptionStatusForInactive }
          : {}),
      }
      window.dispatchEvent(new CustomEvent(SUBSCRIPTION_INACTIVE_EVENT, { detail }))
    }
  }
  if (code) {
    const subscriptionStatus =
      typeof raw.subscriptionStatus === 'string' ? raw.subscriptionStatus : undefined
    throw new ApiError(messageStr, { status: res.status, code, subscriptionStatus })
  }
  throw new Error(messageStr)
}

export async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    headers: { ...getHeaders(), ...options.headers },
  })
  const contentType = res.headers.get('content-type')
  const data = contentType?.includes('application/json')
    ? await res.json().catch(() => ({}))
    : !res.ok
      ? { error: await res.text().catch(() => '') || res.statusText }
      : {}
  if (res.status === 401 && getToken()) {
    useAuth.getState().logout()
    window.location.href = '/login?session=expired'
    return new Promise((_, reject) => reject(new Error('Session expired')))
  }
  if (!res.ok) {
    throwFromFailedResponse(res, data)
  }
  return data
}

export const auth = {
  me: () => api('/auth/me') as Promise<{ user: { id: string; email: string; name?: string }; org: { id: string; name: string }; role: string; isPlatformAdmin: boolean }>,
  register: (body: { email: string; password: string; name?: string; orgName: string }) =>
    api('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    api('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  forgotPassword: (email: string) =>
    api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
}

export const documents = {
  preview: (id: string, opts?: { sheetIndex?: number }) => {
    const q = new URLSearchParams()
    if (opts?.sheetIndex != null) q.set('sheetIndex', String(opts.sheetIndex))
    const suffix = q.toString() ? `?${q}` : ''
    return api(`/documents/${id}/preview${suffix}`) as Promise<DocumentPreviewResponse>
  },
  map: (id: string, body: { mapping: Record<string, number>; sheetIndex?: number }) =>
    api(`/documents/${id}/map`, { method: 'POST', body: JSON.stringify(body) }) as Promise<MapDocumentResponse>,
  getTransactions: (id: string) => api(`/documents/${id}/transactions`),
}

export const clients = {
  list: () => api('/clients'),
  create: (body: { name: string }) => api('/clients', { method: 'POST', body: JSON.stringify(body) }),
}

/** Row shape from GET /projects (`projects` array) — matches API select */
export type ProjectListRow = {
  id: string
  name: string
  slug: string
  status: string
  reconciliationDate?: string | null
  currency?: string
  createdAt: string
  updatedAt: string
  client?: { id: string; name: string } | null
}

/** GET /projects JSON body — not a bare array */
export type ProjectListPayload = {
  projects: ProjectListRow[]
  total: number
  limit: number
  offset: number
}

export const projects = {
  list: (params?: { clientId?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.clientId) q.set('clientId', params.clientId)
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.offset) q.set('offset', String(params.offset))
    return api(`/projects${q.toString() ? `?${q}` : ''}`) as Promise<ProjectListPayload>
  },
  get: (id: string) => api(`/projects/${id}`),
  create: (body: {
    name: string
    clientId?: string
    reconciliationDate?: string
    rollForwardFromProjectId?: string
    currency?: 'GHS' | 'USD' | 'EUR'
    /** Shown on BRS letterhead when set; creates primary bank account record */
    primaryBankName?: string
    primaryAccountNo?: string
  }) => api('/projects', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: { name?: string; clientId?: string | null; currency?: 'GHS' | 'USD' | 'EUR' }) =>
    api(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: string) =>
    api(`/projects/${id}`, { method: 'DELETE' }),
  reopen: (id: string) =>
    api(`/projects/${id}/reopen`, { method: 'PATCH' }),
  undoReconciliation: (id: string, reason?: string) =>
    api(`/projects/${id}/undo-reconciliation`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  submit: (id: string) =>
    api(`/projects/${id}/submit`, { method: 'PATCH' }),
  approve: (id: string) =>
    api(`/projects/${id}/approve`, { method: 'PATCH' }),
  updateReportComments: (id: string, body: { reportNarrative?: string; preparerComment?: string; reviewerComment?: string; bankStatementClosingBalance?: number | null }) =>
    api(`/projects/${id}/report-comments`, { method: 'PATCH', body: JSON.stringify(body) }),
}

export const audit = {
  list: (params?: { projectId?: string; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.projectId) q.set('projectId', params.projectId)
    if (params?.limit) q.set('limit', String(params.limit))
    return api(`/audit${q.toString() ? `?${q}` : ''}`)
  },
  exportCsv: async (params?: { projectId?: string; limit?: number }) => {
    const q = new URLSearchParams({ format: 'csv' })
    if (params?.projectId) q.set('projectId', params.projectId)
    if (params?.limit) q.set('limit', String(params.limit ?? 500))
    const token = getToken()
    const res = await fetch(`${API_URL}/api/v1/audit/export?${q}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throwFromFailedResponse(res, data)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  },
}

export type PlatformDatabaseOpResult = {
  success: boolean
  exitCode: number
  stdout: string
  stderr: string
}

/** Platform admin: run Prisma on server (see Platform Admin → Database) */
export const platformAdminDatabase = {
  status: () => api('/admin/database/status') as Promise<PlatformDatabaseOpResult>,
  migrate: () => api('/admin/database/migrate', { method: 'POST' }) as Promise<PlatformDatabaseOpResult>,
  seed: () => api('/admin/database/seed', { method: 'POST' }) as Promise<PlatformDatabaseOpResult>,
}

export const subscription = {
  getUsage: () => api('/subscription/usage') as Promise<SubscriptionUsageResponse>,
  getPlans: () => api('/subscription/plans'),
  initializePayment: (body: { plan: string; period: 'monthly' | 'yearly' }) =>
    api('/subscription/initialize', { method: 'POST', body: JSON.stringify(body) }),
}

export interface PublicPlan {
  id: string
  name: string
  monthlyGhs: number
  yearlyGhs: number
  projectsPerMonth: number
  transactionsPerMonth: number
}

/**
 * Marketing/landing-page facing client. These endpoints do not require auth
 * and must never include user/org-scoped data.
 *
 * NOTE: `getPlans` is intentionally non-throwing. The landing page has a
 * complete static plan catalogue (`web/src/lib/plans.ts`) and only uses
 * the API to override pricing/limits. If the API is unreachable we just
 * return `{ plans: [] }` so the page renders the static defaults.
 */
export const publicApi = {
  getPlans: async (): Promise<{ plans: PublicPlan[] }> => {
    try {
      const res = await fetch(`${API_URL}/api/v1/public/plans`, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return { plans: [] }
      const data = (await res.json()) as { plans?: PublicPlan[] }
      return { plans: Array.isArray(data.plans) ? data.plans : [] }
    } catch {
      return { plans: [] }
    }
  },
}

export const currency = {
  getRates: () => api('/currency/rates') as Promise<{ rates: { GHS: number; USD: number; EUR: number }; attribution?: string }>,
}

export const bankAccounts = {
  list: (projectId: string) =>
    api(`/bank-accounts/project/${projectId}`) as Promise<{ id: string; name: string; bankName?: string; accountNo?: string; documentCount: number }[]>,
  create: (projectId: string, body: { name: string; bankName?: string; accountNo?: string }) =>
    api(`/bank-accounts/project/${projectId}`, { method: 'POST', body: JSON.stringify(body) }) as Promise<{ id: string; name: string }>,
}

export const bankRules = {
  list: () => api('/bank-rules'),
  create: (body: { name: string; priority?: number; conditions: { field: string; operator: string; value: string | number }[]; action?: string }) =>
    api('/bank-rules', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: { name?: string; priority?: number; conditions?: { field: string; operator: string; value: string | number }[]; action?: string }) =>
    api(`/bank-rules/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: string) =>
    api(`/bank-rules/${id}`, { method: 'DELETE' }),
}

export const apiKeys = {
  list: () => api('/api-keys') as Promise<{ id: string; name: string; keyPrefix: string; lastUsedAt: string | null; expiresAt: string | null; createdAt: string }[]>,
  create: (body: { name: string; expiresAt?: string }) =>
    api('/api-keys', { method: 'POST', body: JSON.stringify(body) }) as Promise<{ id: string; name: string; keyPrefix: string; key: string; expiresAt: string | null; createdAt: string }>,
  delete: (id: string) => api(`/api-keys/${id}`, { method: 'DELETE' }),
}

export const settings = {
  getPlatformDefaults: () => api('/settings/platform-defaults') as Promise<{
    defaultCurrency: 'GHS' | 'USD' | 'EUR'
    reportTitle?: string
    footer?: string
    primaryColor?: string
    secondaryColor?: string
  }>,
  getBranding: () => api('/settings/branding'),
  getMembers: () =>
    api('/settings/members') as Promise<{
      members: { id: string; userId: string; email: string; name: string | null; role: string; createdAt: string }[]
      limit: number | null
      currentCount: number
    }>,
  addMember: (body: { email: string; role?: string }) =>
    api('/settings/members', { method: 'POST', body: JSON.stringify(body) }) as Promise<{
      id: string
      userId: string
      email: string
      name: string | null
      role: string
      createdAt: string
    }>,
  removeMember: (userId: string) =>
    api(`/settings/members/${userId}`, { method: 'DELETE' }),
  updateMemberRole: (userId: string, role: string) =>
    api(`/settings/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  updateBranding: (body: {
    logoUrl?: string
    primaryColor?: string
    secondaryColor?: string
    letterheadAddress?: string
    reportTitle?: string
    footer?: string
    approvalThresholdAmount?: number | null
  }) => api('/settings/branding', { method: 'PATCH', body: JSON.stringify(body) }),
  uploadLogo: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const token = getToken()
    return fetch(`${API_URL}/api/v1/upload/branding-logo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throwFromFailedResponse(res, data)
      return data as { logoUrl: string }
    })
  },
}

export type ReportExportScope = 'full' | 'brs_only'

export interface ReportExportOptions {
  bankAccountId?: string
  signedAmounts?: boolean
  scope?: ReportExportScope
}

async function reportExport(projectId: string, format: string, opts?: ReportExportOptions) {
  const token = getToken()
  const q = new URLSearchParams({ format })
  if (opts?.bankAccountId) q.set('bankAccountId', opts.bankAccountId)
  if (opts?.signedAmounts) q.set('signedAmounts', '1')
  if (opts?.scope === 'brs_only') q.set('scope', 'brs_only')
  const res = await fetch(`${API_URL}/api/v1/report/${projectId}/export?${q}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throwFromFailedResponse(res, data)
  }
  const blob = await res.blob()
  const disp = res.headers.get('Content-Disposition')
  const match = disp?.match(/filename="([^"]+)"/)
  const ext = format === 'pdf' ? 'pdf' : 'xlsx'
  const filename = match?.[1] || `BRS_${projectId}_${new Date().toISOString().slice(0, 10)}.${ext}`
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export const attachments = {
  list: (projectId: string) => api(`/attachments?projectId=${projectId}`) as Promise<{ id: string; filename: string; type: string; createdAt: string; user?: { name?: string; email?: string } }[]>,
  upload: (projectId: string, file: File, type: 'bank_statement' | 'approval' | 'match_evidence' | 'other', matchId?: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('type', type)
    if (matchId) form.append('matchId', matchId)
    const token = getToken()
    return fetch(`${API_URL}/api/v1/upload/attachments/${projectId}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throwFromFailedResponse(res, data)
      return data
    })
  },
  download: async (id: string, filename?: string) => {
    const token = getToken()
    const res = await fetch(`${API_URL}/api/v1/attachments/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throwFromFailedResponse(res, data)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || 'attachment'
    a.click()
    URL.revokeObjectURL(url)
  },
  delete: (id: string) => api(`/attachments/${id}`, { method: 'DELETE' }),
}

export const report = {
  get: (projectId: string, params?: { bankAccountId?: string }) => {
    const q = params?.bankAccountId ? `?bankAccountId=${params.bankAccountId}` : ''
    return api(`/report/${projectId}${q}`) as Promise<ReportResponse>
  },
  exportExcel: (projectId: string, opts?: ReportExportOptions) => reportExport(projectId, 'excel', opts),
  exportPdf: (projectId: string, opts?: ReportExportOptions) => reportExport(projectId, 'pdf', opts),
}

export const reconcile = {
  get: (projectId: string, params?: { bankAccountId?: string; limit?: number; useDate?: boolean; useDocRef?: boolean; useChequeNo?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.bankAccountId) q.set('bankAccountId', params.bankAccountId)
    if (params?.limit) q.set('limit', String(params.limit))
    if (typeof params?.useDate === 'boolean') q.set('useDate', String(params.useDate))
    if (typeof params?.useDocRef === 'boolean') q.set('useDocRef', String(params.useDocRef))
    if (typeof params?.useChequeNo === 'boolean') q.set('useChequeNo', String(params.useChequeNo))
    return api(`/reconcile/${projectId}${q.toString() ? `?${q}` : ''}`)
  },
  createMatch: (projectId: string, body: { cashBookTransactionId: string; bankTransactionId: string }) =>
    api(`/reconcile/${projectId}/match`, { method: 'POST', body: JSON.stringify(body) }),
  createMatchMulti: (
    projectId: string,
    body:
      | { cashBookTransactionId: string; bankTransactionIds: string[] }
      | { cashBookTransactionIds: string[]; bankTransactionId: string }
      | { cashBookTransactionIds: string[]; bankTransactionIds: string[] }
  ) => api(`/reconcile/${projectId}/match/multi`, { method: 'POST', body: JSON.stringify(body) }),
  createMatchBulk: (projectId: string, body: { matches: { cashBookTransactionId: string; bankTransactionId: string }[] }) =>
    api(`/reconcile/${projectId}/match/bulk`, { method: 'POST', body: JSON.stringify(body) }),
  deleteMatch: (projectId: string, matchId: string) =>
    api(`/reconcile/${projectId}/match/${matchId}`, { method: 'DELETE' }),
}

export function uploadCashBook(projectId: string, file: File, type: 'receipts' | 'payments') {
  const form = new FormData()
  form.append('file', file)
  form.append('type', type)
  const token = getToken()
  return fetch(`${API_URL}/api/v1/upload/cash-book/${projectId}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throwFromFailedResponse(res, data)
    return data
  })
}

export function uploadBankStatement(
  projectId: string,
  file: File,
  type: 'credits' | 'debits',
  opts?: { bankAccountId?: string; accountName?: string; accountNo?: string }
) {
  const form = new FormData()
  form.append('file', file)
  form.append('type', type)
  if (opts?.bankAccountId) form.append('bankAccountId', opts.bankAccountId)
  if (opts?.accountName?.trim()) form.append('accountName', opts.accountName.trim())
  if (opts?.accountNo?.trim()) form.append('accountNo', opts.accountNo.trim())
  const token = getToken()
  return fetch(`${API_URL}/api/v1/upload/bank-statement/${projectId}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throwFromFailedResponse(res, data)
    return data
  })
}
