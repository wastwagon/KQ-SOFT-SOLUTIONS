/**
 * Mapping diagnostics returned with document preview (actionable fixes).
 */

export type MappingDiagnostic = {
  severity: 'error' | 'warning' | 'info'
  field?: string
  message: string
  fix?: string
}

export function getMappingDiagnostics(
  docType: string,
  headers: string[],
  suggestedMapping: Record<string, number>
): MappingDiagnostic[] {
  const issues: MappingDiagnostic[] = []
  const isCashBook = docType.startsWith('cash_book_')
  const dateField = isCashBook ? 'date' : 'transaction_date'
  const amountField = isCashBook
    ? docType === 'cash_book_receipts'
      ? 'amt_received'
      : 'amt_paid'
    : docType === 'bank_credits'
      ? 'credit'
      : 'debit'

  if (suggestedMapping[dateField] == null) {
    issues.push({
      severity: 'error',
      field: dateField,
      message: 'No date column detected.',
      fix: isCashBook
        ? 'Map DATE (not MONTH). Excel serial dates (e.g. 46023) are supported.'
        : 'Map Transaction Date. For Ecobank Excel/PDF, re-preview after upload — we normalize the statement block automatically.',
    })
  }

  if (suggestedMapping[amountField] == null) {
    issues.push({
      severity: 'error',
      field: amountField,
      message: `No ${amountField} column detected for ${docType}.`,
      fix: isCashBook
        ? 'Map AMT RECEIVED or AMT PAID.'
        : docType === 'bank_credits'
          ? 'Map Credit or Deposits (Ecobank).'
          : 'Map Debit or Payments (Ecobank).',
    })
  }

  const joined = headers.join(' ').toLowerCase()
  if (/payments?/.test(joined) && /deposits?/.test(joined) && !/\bdebit\b/.test(joined)) {
    issues.push({
      severity: 'warning',
      message: 'Raw Ecobank Payments/Deposits columns detected.',
      fix: 'Re-upload Excel if preview looks wrong, or map Payments→Debit and Deposits→Credit. Prefer .xlsx over PDF for Ecobank.',
    })
  }

  if (headers.length <= 2 && !isCashBook) {
    issues.push({
      severity: 'warning',
      message: 'Very few columns detected — PDF layout may be broken.',
      fix: 'Upload the Excel bank export (.xlsx) from Ecobank, or check PDF_OCR_MAX_PAGES if the statement is long.',
    })
  }

  return issues
}
