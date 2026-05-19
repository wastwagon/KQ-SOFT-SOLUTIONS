/**
 * Actionable mapping guidance for the Map step (shared rules with API suggestions).
 */

export type MappingIssue = {
  severity: 'error' | 'warning' | 'info'
  field?: string
  message: string
  fix?: string
}

export function getMappingIssues(
  docType: string,
  headers: string[],
  mapping: Record<string, number>
): MappingIssue[] {
  const issues: MappingIssue[] = []
  const isCashBook = docType.startsWith('cash_book_')
  const isReceipts = docType === 'cash_book_receipts'
  const isPayments = docType === 'cash_book_payments'
  const isCredits = docType === 'bank_credits'
  const isDebits = docType === 'bank_debits'

  const dateField = isCashBook ? 'date' : 'transaction_date'
  if (mapping[dateField] == null) {
    issues.push({
      severity: 'error',
      field: dateField,
      message: 'Date column is required before matching can run.',
      fix: isCashBook
        ? 'Map DATE or Transaction Date. Cash books often use Excel serial numbers (e.g. 46023) — we convert those automatically.'
        : 'Map Transaction Date. For Ecobank, use the normalized Transaction Date column after upload.',
    })
  }

  if (isCashBook) {
    const amountField = isReceipts ? 'amt_received' : 'amt_paid'
    if (mapping[amountField] == null) {
      issues.push({
        severity: 'error',
        field: amountField,
        message: `${isReceipts ? 'Amount received' : 'Amount paid'} must be mapped for this document type.`,
        fix: `Select AMT RECEIVED / AMT PAID (or the single amount column if using signed-amount mode).`,
      })
    }
    if (mapping.amt_received != null && mapping.amt_paid != null && mapping.amt_received === mapping.amt_paid) {
      issues.push({
        severity: 'info',
        message: 'Signed amount mode: one column mapped to both receipt and payment fields.',
        fix: 'Positive values → receipts; negative → payments. Ideal when your cash book uses one Amount column.',
      })
    }
    if (mapping.date != null && headers[mapping.date] && /^month$/i.test(headers[mapping.date].trim())) {
      issues.push({
        severity: 'warning',
        field: 'date',
        message: 'You mapped MONTH, not DATE — matching will fail.',
        fix: 'Map the DATE column (often column C with Excel serial dates).',
      })
    }
  } else {
    const amountField = isCredits ? 'credit' : 'debit'
    if (mapping[amountField] == null) {
      issues.push({
        severity: 'error',
        field: amountField,
        message: `${isCredits ? 'Credit' : 'Debit'} amount column is required.`,
        fix: isCredits
          ? 'Map Credit or Deposits. Ecobank statements: use normalized Credit after auto-clean, or Deposits column.'
          : 'Map Debit or Payments. Ecobank: use normalized Debit or Payments column.',
      })
    }
    const h = headers.map((x) => (x || '').toLowerCase())
    if (isEcobankHeaders(h) && !h.some((x) => x === 'debit' || x === 'credit')) {
      issues.push({
        severity: 'warning',
        message: 'Ecobank Payments/Deposits layout detected.',
        fix: 'Prefer Excel (.xlsx) bank exports, or re-upload — we normalize Payments→Debit and Deposits→Credit. Map Debit for bank debits doc and Credit for bank credits doc.',
      })
    }
    if (mapping.credit != null && mapping.debit != null && mapping.credit === mapping.debit) {
      issues.push({
        severity: 'info',
        message: 'Signed amount mode on bank statement.',
        fix: 'Positive → credits; negative → debits.',
      })
    }
  }

  if (mapping.description == null && mapping.details == null && !isCashBook) {
    issues.push({
      severity: 'warning',
      field: 'description',
      message: 'No description column mapped.',
      fix: 'Map Description for better match suggestions (cheque numbers are also extracted from text).',
    })
  }

  return issues
}

function isEcobankHeaders(headers: string[]): boolean {
  const j = headers.join(' ')
  return /payments?/.test(j) && /deposits?/.test(j)
}

export function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    date: 'Date',
    transaction_date: 'Transaction date',
    name: 'Name',
    details: 'Details',
    description: 'Description',
    doc_ref: 'Doc ref',
    chq_no: 'Cheque no.',
    accode: 'Account code',
    amt_received: 'Amount received',
    amt_paid: 'Amount paid',
    credit: 'Credit',
    debit: 'Debit',
  }
  return labels[field] || field
}
