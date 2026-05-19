/** Resolve display symbol for a project currency (override or known ISO map). */

const KNOWN_SYMBOLS: Record<string, string> = {
  GHS: 'GH₵',
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
  XOF: 'CFA',
  ZAR: 'R',
}

export function resolveCurrencySymbol(currencyCode: string, currencySymbolOverride?: string | null): string {
  const override = (currencySymbolOverride || '').trim()
  if (override) return override
  const code = (currencyCode || 'GHS').toUpperCase()
  return KNOWN_SYMBOLS[code] ?? code
}

export function resolveCurrencyIsoCode(currencyCode: string): string {
  return (currencyCode || 'GHS').toUpperCase()
}
