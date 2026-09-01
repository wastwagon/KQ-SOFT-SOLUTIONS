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
  const isCredits = docType === 'bank_credits'

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
    const hasFcColumns = headers.some((h) =>
      /^(foreign\s*currency\s*amount|fc\s*amount|fc\s*amt\s*(received|paid)|currency\s*code|exch\s*rate)$/i.test(
        String(h).trim()
      )
    )
    const tglLayout = headers.some((h) => /tgl\s*account\s*code/i.test(String(h).trim()))
    const hasTglDrCr =
      tglLayout &&
      headers.some((h) => /^dr$/i.test(String(h).trim())) &&
      headers.some((h) => /^cr$/i.test(String(h).trim()))
    if (hasTglDrCr && mapping.amt_received != null && mapping.amt_paid != null && mapping.amt_received !== mapping.amt_paid) {
      const recHdr = String(headers[mapping.amt_received] || '').trim()
      const payHdr = String(headers[mapping.amt_paid] || '').trim()
      if (/^dr$/i.test(recHdr) && /^cr$/i.test(payHdr)) {
        issues.push({
          severity: 'info',
          message: 'TGL pre-reconciliation export: dr → receipts, cr → payments.',
          fix: 'Recommended when you export only the pre-BRS cash book sheet. Foreign Currency Amount also works if you prefer one signed column.',
        })
      }
    }
    if (hasFcColumns) {
      const mappedIdx = mapping[amountField]
      const mappedHeader =
        mappedIdx != null && mappedIdx >= 0 && mappedIdx < headers.length
          ? String(headers[mappedIdx] || '')
          : ''
      const mappedIsFc = /^(foreign\s*currency\s*amount|fc\s*amount|fc\s*amt\s*(received|paid))$/i.test(
        mappedHeader.trim()
      )
      issues.push({
        severity: mappedIsFc ? 'info' : 'warning',
        field: amountField,
        message: mappedIsFc
          ? tglLayout
            ? 'Foreign Currency Amount is selected (TGL signed column — negative = receipt, positive = payment).'
            : 'Foreign-currency (euro/USD) amount column is selected.'
          : tglLayout
            ? 'This TGL export has Foreign Currency Amount for euro/USD and Amount for cedi equivalents.'
            : 'This cash book also has foreign-currency columns (Foreign Currency Amount).',
        fix: mappedIsFc
          ? tglLayout
            ? 'Keep Foreign Currency Amount when the bank statement is in EUR/USD. Amount is the cedi (GHS) equivalent.'
            : 'Keep FC amounts when the bank statement is in EUR/USD. Use separate receipt/payment columns for GHS/cedi equivalents.'
          : tglLayout
            ? 'For a euro bank account, map Amount received/paid to Foreign Currency Amount (one signed column). Do not use Amount unless reconciling in cedis.'
            : 'If the bank statement is in euros (or another foreign currency), map Amount received/paid to Foreign Currency Amount — not the cedi Amount column.',
      })
    }
    if (mapping[amountField] == null) {
      issues.push({
        severity: 'error',
        field: amountField,
        message: `${isReceipts ? 'Amount received' : 'Amount paid'} must be mapped for this document type.`,
        fix: `Select AMT RECEIVED / AMT PAID, Foreign Currency Amount (TGL signed column), or the single Amount column if using signed-amount mode.`,
      })
    }
    if (mapping.amt_received != null && mapping.amt_paid != null && mapping.amt_received === mapping.amt_paid) {
      const mappedHeader =
        headers[mapping.amt_received] != null ? String(headers[mapping.amt_received]).trim() : ''
      const tglSigned =
        tglLayout &&
        /^(amount|foreign currency amount|fc amount)$/i.test(mappedHeader)
      issues.push({
        severity: 'info',
        message: 'Signed amount mode: one column mapped to both receipt and payment fields.',
        fix: tglSigned
          ? 'TGL/IBIS convention on this column: negative values → receipts; positive → payments.'
          : 'Positive values → receipts; negative → payments. Ideal when your cash book uses one Amount column.',
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
    if (isErpGlCashBookHeaders(headers)) {
      issues.push({
        severity: 'info',
        message: 'ERP G/L cash book export detected (many rows).',
        fix: 'Map Doc. Date (or Transaction Date) for date. Map Debits/Credits or AMT RECEIVED/AMT PAID. Filter to your bank GL account in the source system if the export is very large.',
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
    if (isScbHeaders(h)) {
      issues.push({
        severity: 'info',
        message: 'Standard Chartered (SCB) statement layout detected.',
        fix: 'Map VALUE DATE (or ENTRY DATE) for transaction date, DEBITS for bank debits, CREDITS for bank credits. Description is used for INW CLG / sweep matching.',
      })
    }
    if (isBogHeaders(h)) {
      issues.push({
        severity: 'info',
        message: 'Bank of Ghana (BOG) statement layout detected.',
        fix: 'Map Post Date for transaction date. Use Credit for bank credits doc and Debit for bank debits doc.',
      })
    }
    if (isGcbBankHeaders(h)) {
      issues.push({
        severity: 'info',
        message: 'GCB bank statement layout detected.',
        fix: 'After PDF upload we normalize to Transaction Date, Description, Debit, Credit. Map Debit/Credit for the respective document type.',
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

function isScbHeaders(headers: string[]): boolean {
  const j = headers.join(' ')
  return /entry date/.test(j) && /debits?/.test(j) && /credits?/.test(j)
}

function isBogHeaders(headers: string[]): boolean {
  const j = headers.join(' ')
  return /post date/.test(j) && /debit/.test(j) && /credit/.test(j)
}

function isGcbBankHeaders(headers: string[]): boolean {
  const j = headers.join(' ')
  return (
    (/transaction date|value date/.test(j) && /debit/.test(j) && /credit/.test(j)) ||
    (/particulars/.test(j) && /debit/.test(j) && /credit/.test(j))
  )
}

function isErpGlCashBookHeaders(headers: string[]): boolean {
  const j = headers.map((h) => (h || '').toLowerCase()).join(' ')
  return /doc\.?\s*date/.test(j) && /debits?/.test(j) && /credits?/.test(j) && /reference/.test(j)
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
