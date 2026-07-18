import { afterEach, describe, expect, it } from 'vitest'
import {
  formatOpsMetricsPrometheus,
  getOpsMetricsSnapshot,
  incOpsMetric,
  observeParseQuality,
  parseOpsMetricKey,
  resetOpsMetricsForTests,
} from './opsMetrics.js'

describe('opsMetrics', () => {
  afterEach(() => {
    resetOpsMetricsForTests()
  })

  it('increments counters and derives averages', () => {
    incOpsMetric('parse.auto_map_mapped', { log: false })
    incOpsMetric('parse.auto_map_mapped', { log: false })
    incOpsMetric('parse.auto_map_skipped', { log: false })
    incOpsMetric('match.memory_boost_1to1', { by: 3, log: false })
    observeParseQuality(80)
    observeParseQuality(60)

    const snap = getOpsMetricsSnapshot()
    expect(snap.counters['parse.auto_map_mapped']).toBe(2)
    expect(snap.derived.autoMapOutcomes).toEqual({ mapped: 2, skipped: 1, failed: 0 })
    expect(snap.derived.memoryBoostTotal).toBe(3)
    expect(snap.derived.parseQualityAvg).toBe(70)
    expect(snap.uptimeSec).toBeGreaterThanOrEqual(0)
  })

  it('supports label keys', () => {
    incOpsMetric('parse.layout_memory_hit', { labels: { exact: 'true' }, log: false })
    incOpsMetric('parse.layout_memory_hit', { labels: { exact: 'false' }, log: false })
    const snap = getOpsMetricsSnapshot()
    expect(snap.counters['parse.layout_memory_hit{exact=true}']).toBe(1)
    expect(snap.counters['parse.layout_memory_hit{exact=false}']).toBe(1)
  })

  it('parses labeled counter keys', () => {
    expect(parseOpsMetricKey('ocr.busy')).toEqual({ name: 'ocr.busy', labels: {} })
    expect(parseOpsMetricKey('parse.layout_memory_hit{exact=true}')).toEqual({
      name: 'parse.layout_memory_hit',
      labels: { exact: 'true' },
    })
  })

  it('formats Prometheus exposition text', () => {
    incOpsMetric('parse.auto_map_mapped', { log: false })
    incOpsMetric('parse.layout_memory_hit', { labels: { exact: 'true' }, log: false })
    observeParseQuality(90)

    const text = formatOpsMetricsPrometheus()
    expect(text).toContain('# TYPE brs_process_uptime_seconds gauge')
    expect(text).toContain('brs_process_uptime_seconds ')
    expect(text).toContain('# TYPE brs_parse_auto_map_mapped counter')
    expect(text).toContain('brs_parse_auto_map_mapped 1')
    expect(text).toContain('brs_parse_layout_memory_hit{exact="true"} 1')
    expect(text).toContain('brs_parse_quality_avg 90')
    expect(text).toContain('brs_match_memory_boost_total 0')
  })
})
