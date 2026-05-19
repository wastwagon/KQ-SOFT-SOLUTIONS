/** Phase 9: Multi-currency support — display only, no FX conversion */
import { resolveCurrencyIsoCode, resolveCurrencySymbol } from './currencyDisplay.js'

export function getCurrencySymbol(currency: string, currencySymbolOverride?: string | null): string {
  return resolveCurrencySymbol(currency, currencySymbolOverride)
}

export function formatAmount(amount: number, currency: string, currencySymbolOverride?: string | null): string {
  const sym = getCurrencySymbol(currency, currencySymbolOverride)
  return `${sym}${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

/** ISO-code amount for reports/exports to avoid font glyph substitution issues. */
export function formatAmountForReport(amount: number, currency: string): string {
  const code = resolveCurrencyIsoCode(currency)
  return `${code} ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}
