/** Shared query/env/org/platform/project parsing for Ghana BRS workbook netting. */
import { getPlatformDefaults } from './platformDefaults.js'

/** Tri-state: true/false when explicit in query; undefined when absent. */
export function parseWorkbookNettingQuery(value: unknown): boolean | undefined {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true
  if (normalized === '0' || normalized === 'false' || normalized === 'no') return false
  return undefined
}

export type WorkbookNettingMode = 'inherit' | 'on' | 'off'

export type WorkbookNettingSource = 'query' | 'project' | 'org' | 'platform' | 'env' | 'off'

export function normalizeWorkbookNettingMode(value: unknown): WorkbookNettingMode {
  const v = String(value ?? '').trim().toLowerCase()
  if (v === 'on') return 'on'
  if (v === 'off') return 'off'
  return 'inherit'
}

function envWorkbookNettingOn(): boolean {
  return (
    process.env.GHANA_BRS_WORKBOOK_NETTING === '1' ||
    process.env.GHANA_BRS_WORKBOOK_NETTING === 'true'
  )
}

export interface WorkbookNettingResolution {
  enabled: boolean
  source: WorkbookNettingSource
  mode: WorkbookNettingMode
}

/**
 * Resolve workbook netting (sync).
 * Priority: explicit query → project on/off → org → platform → env → off.
 */
export function resolveWorkbookNetting(opts?: {
  queryValue?: unknown
  projectMode?: WorkbookNettingMode | string | null | undefined
  orgDefault?: boolean | null | undefined
  platformDefault?: boolean | null | undefined
}): WorkbookNettingResolution {
  const mode = normalizeWorkbookNettingMode(opts?.projectMode)
  const parsed = parseWorkbookNettingQuery(opts?.queryValue)
  if (parsed === true) return { enabled: true, source: 'query', mode }
  if (parsed === false) return { enabled: false, source: 'query', mode }

  if (mode === 'on') return { enabled: true, source: 'project', mode }
  if (mode === 'off') return { enabled: false, source: 'project', mode }

  if (opts?.orgDefault === true) return { enabled: true, source: 'org', mode }
  if (opts?.orgDefault === false) return { enabled: false, source: 'org', mode }

  if (opts?.platformDefault === true) return { enabled: true, source: 'platform', mode }
  if (opts?.platformDefault === false) return { enabled: false, source: 'platform', mode }

  if (envWorkbookNettingOn()) return { enabled: true, source: 'env', mode }
  return { enabled: false, source: 'off', mode }
}

/**
 * Resolve workbook netting for report/reconcile (async — uses cached platform defaults).
 */
export async function resolveWorkbookNettingForScope(opts: {
  queryValue?: unknown
  projectMode?: WorkbookNettingMode | string | null | undefined
  orgBranding?: unknown
}): Promise<WorkbookNettingResolution> {
  const platformDefaults = await getPlatformDefaults()
  const branding = (opts.orgBranding as { ghanaBrsWorkbookNettingDefault?: boolean }) || {}
  return resolveWorkbookNetting({
    queryValue: opts.queryValue,
    projectMode: opts.projectMode,
    orgDefault: branding.ghanaBrsWorkbookNettingDefault,
    platformDefault: platformDefaults.ghanaBrsWorkbookNetting,
  })
}

/** @deprecated Use resolveWorkbookNetting().enabled */
export function workbookNettingEnabled(opts?: {
  queryValue?: unknown
  projectMode?: WorkbookNettingMode | string | null | undefined
  orgDefault?: boolean | null | undefined
  platformDefault?: boolean | null | undefined
}): boolean {
  return resolveWorkbookNetting(opts).enabled
}

/** @deprecated Use resolveWorkbookNetting */
export function workbookNettingFromRequest(queryValue: unknown): boolean {
  return resolveWorkbookNetting({ queryValue }).enabled
}
