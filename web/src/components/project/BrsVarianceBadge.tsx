import { useQuery } from '@tanstack/react-query'
import { report } from '../../lib/api'
import { formatAmount } from '../../lib/format'
import { brsTieOutVariance, brsVarianceLabel } from '../../lib/brsVariance'
import Badge from '../ui/Badge'

export default function BrsVarianceBadge({
  projectId,
  currency = 'GHS',
  compact = false,
}: {
  projectId: string
  currency?: string
  compact?: boolean
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['report', 'summary', projectId],
    queryFn: () => report.get(projectId, { summaryOnly: true }),
    staleTime: 120_000,
    enabled: !!projectId,
  })

  const resolvedCurrency = data?.currency || currency
  const variance = brsTieOutVariance(data)
  const label = brsVarianceLabel(variance)

  if (isLoading) {
    return <span className="text-xs text-gray-400">{compact ? '…' : 'Loading BRS…'}</span>
  }
  if (isError || variance == null || !label) {
    return <span className="text-xs text-gray-400">—</span>
  }
  if (label === 'Tied out') {
    return (
      <Badge tone="success" size="sm">
        Tied out
      </Badge>
    )
  }

  const tone = Math.abs(variance) < 0.01 ? 'success' : variance > 0 ? 'warning' : 'danger'

  return (
    <Badge
      tone={tone}
      size="sm"
      title={`BRS variance: ${formatAmount(variance, resolvedCurrency)}`}
    >
      {label} {formatAmount(Math.abs(variance), resolvedCurrency)}
    </Badge>
  )
}
