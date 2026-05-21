import { useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import type { ReconcileExportInput, ReconcileExportSide } from '../../lib/reconcileTableExport'

type Props = Omit<ReconcileExportInput, 'side'> & {
  side: ReconcileExportSide
  label: string
}

export default function ReconcileTableExportButtons({ side, label, ...rest }: Props) {
  const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null)
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
      console.error(e)
      alert(
        e instanceof Error
          ? e.message
          : 'Export failed. If using Docker, run: docker compose -f docker-compose.development.yml exec web npm install'
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Export ${label}`}>
      <button
        type="button"
        disabled={busy != null}
        onClick={() => run('excel')}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        title={`Download ${label} as Excel`}
      >
        <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
        {busy === 'excel' ? '…' : 'Excel'}
      </button>
      <button
        type="button"
        disabled={busy != null}
        onClick={() => run('pdf')}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        title={`Download ${label} as PDF`}
      >
        <FileText className="h-3.5 w-3.5" aria-hidden />
        {busy === 'pdf' ? '…' : 'PDF'}
      </button>
    </div>
  )
}
