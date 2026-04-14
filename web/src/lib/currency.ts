/** Phase 9: Multi-currency support — display only, no FX conversion */

const SYMBOLS: Record<string, string> = {
  GHS: 'GH₵',
  USD: '$',
  EUR: '€',
}

/** ISO 4217 codes for report/print — avoids font substitution (e.g. ₵ → µ) in PDF/print */
const ISO_CODES: Record<string, string> = {
  GHS: 'GHS',
  USD: 'USD',
  EUR: 'EUR',
}

export function getCurrencySymbol(currency: string): string {
  return SYMBOLS[currency?.toUpperCase()] ?? 'GH₵'
}

export function formatAmount(amount: number, currency: string): string {
  const sym = getCurrencySymbol(currency)
  const formatted = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2 }).format(amount)
  return sym + formatted
}

/** Format amount without symbol — use when currency is in column header */
export function formatAmountNumber(amount: number): string {
  return new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2 }).format(amount)
}

/** Use for BRS reports and print/PDF — ISO code + amount so currency displays correctly globally */
export function formatAmountForReport(amount: number, currency: string): string {
  const code = ISO_CODES[currency?.toUpperCase()] ?? currency?.toUpperCase() ?? 'GHS'
  const formatted = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  return `${code} ${formatted}`
}
