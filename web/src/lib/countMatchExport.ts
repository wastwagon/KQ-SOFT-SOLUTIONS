import type { CountAmountRow, CountMatchDiagnostic } from '../components/reconcile/countMatchTypes'

type ScheduleSheet = {
  sheetName: string
  title: string
  rows: CountAmountRow[]
  cbLabel: string
  bankLabel: string
  note?: string
}

const OPEN_LESS_NOTE =
  'Open — more on one side is open — less on the other; each amount is listed once (see CB count vs Bank count).'

function categoryLabel(category: string): string {
  switch (category) {
    case 'only_cash_book':
      return 'Only cash book'
    case 'only_bank':
      return 'Only bank'
    case 'open_cb_surplus':
      return 'Open — CB surplus'
    case 'open_bank_surplus':
      return 'Open — bank surplus'
    case 'batch_cancel':
      return 'Batch cancel'
    default:
      return category
  }
}

function buildSchedules(diagnostic: CountMatchDiagnostic): ScheduleSheet[] {
  const d = diagnostic.brsDetails
  return [
    {
      sheetName: 'Only CB Received',
      title: 'Amounts only in cash book — Received',
      rows: d.onlyCashBookReceived,
      cbLabel: 'Received',
      bankLabel: 'Lodgment',
    },
    {
      sheetName: 'Only CB Payment',
      title: 'Amounts only in cash book — Payment',
      rows: d.onlyCashBookPayments,
      cbLabel: 'Payment',
      bankLabel: 'Debits',
    },
    {
      sheetName: 'Only Bank Lodgment',
      title: 'Amounts only in bank — Lodgment',
      rows: d.onlyBankLodgments,
      cbLabel: 'Received',
      bankLabel: 'Lodgment',
    },
    {
      sheetName: 'Only Bank Debits',
      title: 'Amounts only in bank — Debits',
      rows: d.onlyBankDebits,
      cbLabel: 'Payment',
      bankLabel: 'Debits',
    },
    {
      sheetName: 'Open Recv CB+',
      title: 'Open — more receipts in CB than credits in bank',
      rows: d.openReceiptsVsCreditsCbSurplus,
      cbLabel: 'Received',
      bankLabel: 'Lodgment',
      note: OPEN_LESS_NOTE,
    },
    {
      sheetName: 'Open Recv Bank+',
      title: 'Open — more credits in bank than receipts in CB',
      rows: d.openReceiptsVsCreditsBankSurplus,
      cbLabel: 'Received',
      bankLabel: 'Lodgment',
      note: OPEN_LESS_NOTE,
    },
    {
      sheetName: 'Open Pay CB+',
      title: 'Open — more payments in CB than debits in bank',
      rows: d.openPaymentsVsDebitsCbSurplus,
      cbLabel: 'Payment',
      bankLabel: 'Debits',
      note: OPEN_LESS_NOTE,
    },
    {
      sheetName: 'Open Pay Bank+',
      title: 'Open — more debits in bank than payments in CB',
      rows: d.openPaymentsVsDebitsBankSurplus,
      cbLabel: 'Payment',
      bankLabel: 'Debits',
      note: OPEN_LESS_NOTE,
    },
    {
      sheetName: 'Cancel Recv=Credit',
      title: 'Batch cancel — receipts count = bank credits count (separate from main BRS)',
      rows: diagnostic.cancelSchedule.receiptsEqualsCredits,
      cbLabel: 'Received',
      bankLabel: 'Lodgment',
    },
    {
      sheetName: 'Cancel Pay=Debit',
      title: 'Batch cancel — payments count = bank debits count (separate from main BRS)',
      rows: diagnostic.cancelSchedule.paymentsEqualsDebits,
      cbLabel: 'Payment',
      bankLabel: 'Debits',
    },
  ]
}

function sheetAoa(
  title: string,
  rows: CountAmountRow[],
  cbLabel: string,
  bankLabel: string,
  note?: string
) {
  const aoa: (string | number)[][] = [[title]]
  if (note) aoa.push([note])
  aoa.push([
      'Amount',
      `${cbLabel} count`,
      `${bankLabel} count`,
      'Difference (CB−Bank)',
      'Category',
      'CB lines',
      'Bank lines',
  ])
  for (const r of rows) {
    aoa.push([
      r.amount,
      r.cashBookCount,
      r.bankCount,
      r.difference,
      categoryLabel(r.category),
      r.cashBookTxIds.length,
      r.bankTxIds.length,
    ])
  }
  if (rows.length === 0) aoa.push(['(none)', '', '', '', '', '', ''])
  return aoa
}

function baseName(projectSlug: string, scope: string, ext: string) {
  return `${projectSlug || 'project'}-count-match-${scope}.${ext}`
}

/** Max lines selected per side from a count row (aligned with bulk match limit). */
export const COUNT_MATCH_SELECT_CAP = 50

export async function exportCountMatchExcel(
  diagnostic: CountMatchDiagnostic,
  opts: { projectSlug: string }
): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const s of buildSchedules(diagnostic)) {
    const aoa = sheetAoa(s.title, s.rows, s.cbLabel, s.bankLabel, s.note)
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(wb, ws, s.sheetName.slice(0, 31))
  }
  XLSX.writeFile(wb, baseName(opts.projectSlug, diagnostic.scope, 'xlsx'))
}

export async function exportCountMatchPdf(
  diagnostic: CountMatchDiagnostic,
  opts: { projectSlug: string; projectName?: string }
): Promise<void> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = autoTableModule.default
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const schedules = buildSchedules(diagnostic)
  const subtitle = [
    opts.projectName || opts.projectSlug,
    `Scope: ${diagnostic.scope}`,
    'Diagnostic only — counts do not clear matches',
  ]
    .filter(Boolean)
    .join(' · ')

  schedules.forEach((s, index) => {
    if (index > 0) doc.addPage()
    doc.setFontSize(13)
    doc.setTextColor(20)
    doc.text('Match by counting', 40, 32)
    doc.setFontSize(10)
    doc.text(s.title, 40, 48)
    doc.setFontSize(8)
    doc.setTextColor(90)
    doc.text(subtitle, 40, 62)
    if (s.note) {
      doc.text(s.note, 40, 74)
    }
    doc.setTextColor(0)

    const head = [
      ['Amount', `${s.cbLabel} count`, `${s.bankLabel} count`, 'Diff (CB−Bank)', 'Category'],
    ]
    const body =
      s.rows.length === 0
        ? [['(none)', '', '', '', '']]
        : s.rows.map((r) => [
            r.amount.toFixed(2),
            String(r.cashBookCount),
            String(r.bankCount),
            String(r.difference),
            categoryLabel(r.category),
          ])

    autoTable(doc, {
      head,
      body,
      startY: s.note ? 84 : 72,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [15, 61, 46], textColor: 255 },
      margin: { left: 28, right: 28 },
    })
  })

  doc.save(baseName(opts.projectSlug, diagnostic.scope, 'pdf'))
}
