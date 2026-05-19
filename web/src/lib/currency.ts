/** Multi-currency display — no FX conversion */

const KNOWN_SYMBOLS: Record<string, string> = {
  GHS: 'GH₵',
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
  XOF: 'CFA',
  ZAR: 'R',
}

const ISO_CODES: Record<string, string> = {
  GHS: 'GHS',
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  NGN: 'NGN',
  XOF: 'XOF',
  ZAR: 'ZAR',
}

export function getCurrencySymbol(currency: string, currencySymbolOverride?: string | null): string {
  const override = (currencySymbolOverride || '').trim()
  if (override) return override
  const code = (currency || 'GHS').toUpperCase()
  return KNOWN_SYMBOLS[code] ?? code
}

export function formatAmount(amount: number, currency: string, currencySymbolOverride?: string | null): string {
  const sym = getCurrencySymbol(currency, currencySymbolOverride)
  const formatted = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2 }).format(amount)
  return sym + formatted
}

export function formatAmountNumber(amount: number): string {
  return new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2 }).format(amount)
}

export function formatAmountForReport(amount: number, currency: string): string {
  const code = ISO_CODES[currency?.toUpperCase()] ?? currency?.toUpperCase() ?? 'GHS'
  const formatted = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  return `${code} ${formatted}`
}

/** Common ISO codes for project currency picker */
export const COMMON_PROJECT_CURRENCIES = ['GHS', 'USD', 'EUR', 'GBP', 'NGN', 'XOF', 'ZAR'] as const
