/** Phase 9: Multi-currency support — display only, no FX conversion */
const SYMBOLS: Record<string, string> = {
  GHS: 'GH₵',
  USD: '$',
  EUR: '€',
}

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
  return `${sym}${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

/** ISO-code amount for reports/exports to avoid font glyph substitution issues. */
export function formatAmountForReport(amount: number, currency: string): string {
  const code = ISO_CODES[currency?.toUpperCase()] ?? currency?.toUpperCase() ?? 'GHS'
  return `${code} ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}
