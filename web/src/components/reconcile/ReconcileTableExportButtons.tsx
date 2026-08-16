import { useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import type { ReconcileExportInput, ReconcileExportSide } from '../../lib/reconcileTableExport'
import Button from '../ui/Button'
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
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Export ${label}`}>
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={busy != null}
        isLoading={busy === 'excel'}
        onClick={() => run('excel')}
        title={`Download ${label} as Excel`}
      >
        <FileSpreadsheet className="h-3.5 w-3.5 mr-1" aria-hidden />
        Excel
      </Button>
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={busy != null}
        isLoading={busy === 'pdf'}
        onClick={() => run('pdf')}
        title={`Download ${label} as PDF`}
      >
        <FileText className="h-3.5 w-3.5 mr-1" aria-hidden />
        PDF
      </Button>
    </div>
  )
}
