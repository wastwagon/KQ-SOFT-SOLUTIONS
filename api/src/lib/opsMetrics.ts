/**
 * Lightweight process-local ops metrics for parse / OCR / organisation learning.
 *
 * - Increment counters for dashboards and GET /admin/ops-metrics
 * - Prometheus text via GET /admin/ops-metrics/prometheus (and optional /metrics)
 * - Emit structured pino lines (evt: ops_metric) for log aggregation
 *
 * Process-local counters reset on restart — pair with Prometheus scrape for durability.
 */
import { logger } from '../middleware/logging.js'

export type OpsMetricName =
  | 'parse.auto_map_mapped'
  | 'parse.auto_map_skipped'
  | 'parse.auto_map_failed'
  | 'parse.type_corrected'
  | 'parse.layout_memory_hit'
  | 'parse.layout_memory_exact'
  | 'parse.ocr_retried'
  | 'parse.ocr_geometry'
  | 'parse.quality_score_sum'
  | 'parse.quality_score_count'
  | 'match.memory_boost_1to1'
  | 'match.memory_boost_split'
  | 'match.memory_remember_1to1'
  | 'match.memory_remember_split'
  | 'ocr.busy'
  | 'ocr.timeout'
  | 'upload.parse_rate_limited'
  | 'parse.job_enqueued_redis'
  | 'parse.job_enqueued_db'
  | 'parse.job_enqueued_bullmq'
  | 'parse.job_reclaimed_stale'
  | 'parse.job_completed'
  | 'parse.job_failed'

const startedAt = Date.now()
const counters = new Map<string, number>()

function keyOf(name: OpsMetricName, labels?: Record<string, string>): string {
  if (!labels || !Object.keys(labels).length) return name
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k]}`)
    .join(',')
  return `${name}{${parts}}`
}

/** Increment a counter (and optionally emit a structured log line). */
export function incOpsMetric(
  name: OpsMetricName,
  opts: {
    by?: number
    labels?: Record<string, string>
    /** Extra fields for the log line (not stored on the counter key). */
    detail?: Record<string, unknown>
    /** Default: info for failures / corrections; debug for high-volume boosts. */
    log?: 'debug' | 'info' | 'warn' | false
  } = {}
): void {
  const by = opts.by ?? 1
  if (!Number.isFinite(by) || by === 0) return
  const key = keyOf(name, opts.labels)
  counters.set(key, (counters.get(key) || 0) + by)

  const level = opts.log === undefined ? defaultLogLevel(name) : opts.log
  if (level === false) return
  const payload = {
    evt: 'ops_metric' as const,
    metric: name,
    by,
    ...(opts.labels || {}),
    ...(opts.detail || {}),
  }
  if (level === 'warn') logger.warn(payload, name)
  else if (level === 'info') logger.info(payload, name)
  else logger.debug(payload, name)
}

function defaultLogLevel(name: OpsMetricName): 'debug' | 'info' | 'warn' | false {
  if (name === 'parse.auto_map_failed' || name === 'ocr.busy' || name === 'ocr.timeout') {
    return 'warn'
  }
  if (
    name === 'parse.type_corrected' ||
    name === 'parse.auto_map_mapped' ||
    name === 'parse.ocr_retried'
  ) {
    return 'info'
  }
  if (name === 'parse.quality_score_sum' || name === 'parse.quality_score_count') {
    return false
  }
  return 'debug'
}

/** Record a parse quality score into sum/count (for average in snapshot). */
export function observeParseQuality(score: number, detail?: Record<string, unknown>): void {
  if (!Number.isFinite(score)) return
  incOpsMetric('parse.quality_score_sum', { by: score, detail, log: false })
  incOpsMetric('parse.quality_score_count', { by: 1, detail, log: false })
}

export type OpsMetricsSnapshot = {
  startedAt: string
  uptimeSec: number
  counters: Record<string, number>
  derived: {
    parseQualityAvg: number | null
    memoryBoostTotal: number
    autoMapOutcomes: {
      mapped: number
      skipped: number
      failed: number
    }
  }
}

export function getOpsMetricsSnapshot(): OpsMetricsSnapshot {
  const out: Record<string, number> = {}
  for (const [k, v] of counters) out[k] = v

  const sum = out['parse.quality_score_sum'] || 0
  const count = out['parse.quality_score_count'] || 0
  const mapped = out['parse.auto_map_mapped'] || 0
  const skipped = out['parse.auto_map_skipped'] || 0
  const failed = out['parse.auto_map_failed'] || 0
  const boost1 = out['match.memory_boost_1to1'] || 0
  const boostSplit = out['match.memory_boost_split'] || 0

  return {
    startedAt: new Date(startedAt).toISOString(),
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    counters: out,
    derived: {
      parseQualityAvg: count > 0 ? Math.round((sum / count) * 10) / 10 : null,
      memoryBoostTotal: boost1 + boostSplit,
      autoMapOutcomes: { mapped, skipped, failed },
    },
  }
}

/** Parse internal counter key `name` or `name{a=b,c=d}` into Prometheus pieces. */
export function parseOpsMetricKey(key: string): {
  name: string
  labels: Record<string, string>
} {
  const brace = key.indexOf('{')
  if (brace < 0 || !key.endsWith('}')) {
    return { name: key, labels: {} }
  }
  const name = key.slice(0, brace)
  const raw = key.slice(brace + 1, -1)
  const labels: Record<string, string> = {}
  if (raw.trim()) {
    for (const part of raw.split(',')) {
      const eq = part.indexOf('=')
      if (eq <= 0) continue
      const k = part.slice(0, eq).trim()
      const v = part.slice(eq + 1).trim()
      if (k) labels[k] = v
    }
  }
  return { name, labels }
}

function toPrometheusMetricName(name: string): string {
  const sanitized = name
    .replace(/[^a-zA-Z0-9_:]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  return sanitized.startsWith('brs_') ? sanitized : `brs_${sanitized}`
}

function escapePrometheusLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"')
}

function formatPrometheusLabels(labels: Record<string, string>): string {
  const keys = Object.keys(labels).sort()
  if (!keys.length) return ''
  return `{${keys.map((k) => `${k}="${escapePrometheusLabelValue(labels[k]!)}"`).join(',')}}`
}

/**
 * Prometheus text exposition (0.0.4) for process-local counters.
 * Includes uptime + derived parse quality average as gauges.
 */
export function formatOpsMetricsPrometheus(): string {
  const snap = getOpsMetricsSnapshot()
  const lines: string[] = []
  const declared = new Set<string>()

  const emitHelpType = (promName: string, type: 'counter' | 'gauge', help: string) => {
    if (declared.has(promName)) return
    declared.add(promName)
    lines.push(`# HELP ${promName} ${help}`)
    lines.push(`# TYPE ${promName} ${type}`)
  }

  emitHelpType('brs_process_uptime_seconds', 'gauge', 'Seconds since this API process started')
  lines.push(`brs_process_uptime_seconds ${snap.uptimeSec}`)

  emitHelpType(
    'brs_parse_quality_avg',
    'gauge',
    'Average parse quality score since boot (null omitted)'
  )
  if (snap.derived.parseQualityAvg != null) {
    lines.push(`brs_parse_quality_avg ${snap.derived.parseQualityAvg}`)
  }

  emitHelpType(
    'brs_match_memory_boost_total',
    'gauge',
    'Total match-memory suggestion boosts since boot'
  )
  lines.push(`brs_match_memory_boost_total ${snap.derived.memoryBoostTotal}`)

  for (const [key, value] of Object.entries(snap.counters)) {
    const { name, labels } = parseOpsMetricKey(key)
    const promName = toPrometheusMetricName(name.replace(/\./g, '_'))
    emitHelpType(promName, 'counter', `Ops counter ${name}`)
    lines.push(`${promName}${formatPrometheusLabels(labels)} ${value}`)
  }

  lines.push('')
  return lines.join('\n')
}

/** Test helper — clear process counters. */
export function resetOpsMetricsForTests(): void {
  counters.clear()
}
