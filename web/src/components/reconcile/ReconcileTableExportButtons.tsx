import { useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import type { ReconcileExportInput, ReconcileExportSide } from '../../lib/reconcileTableExport'
import ActionMenu from '../ui/ActionMenu'
import { useToast } from '../ui/Toast'

type Props = Omit<ReconcileExportInput, 'side'> & {
  side: ReconcileExportSide
  label: string
}

export default function ReconcileTableExportButtons({ side, label, ...rest }: Props) {
  const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null)
  const toast = useToast()
  const input: ReconcileExportInput = { ...rest, side }

  async function run(kind: 'excel' | 'pdf') {
    setBusy(kind)
    try {
      const { exportReconcileTableExcel, exportReconcileTablePdf } = await import(
        '../../lib/reconcileTableExport'
      )
      if (kind === 'excel') await exportReconcileTableExcel(input)
      else await exportReconcileTablePdf(input)
    } catch (e) {
      toast.error('Export failed', e instanceof Error ? e.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  return (
    <ActionMenu
      label="Export"
      size="xs"
      variant="outline"
      align="right"
      menuAriaLabel={`Export ${label}`}
      isLoading={busy != null}
      items={[
        {
          kind: 'button',
          label: 'Download Excel',
          icon: FileSpreadsheet,
          disabled: busy != null,
          onClick: () => void run('excel'),
        },
        {
          kind: 'button',
          label: 'Download PDF',
          icon: FileText,
          disabled: busy != null,
          onClick: () => void run('pdf'),
        },
      ]}
    />
  )
}
