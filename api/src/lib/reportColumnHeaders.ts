/** Report / export column headers — currency code only (e.g. GHS), not "Amount (GHS)". */

export function amountColumnHeader(currency: string): string {
  return (currency || 'GHS').trim().toUpperCase()
}

/** Unique Excel keys when multiple amount columns appear on one row. */
export function amountColumnCashBook(currency: string): string {
  return `${amountColumnHeader(currency)} cash book`
}

export function amountColumnBank(currency: string): string {
  return `${amountColumnHeader(currency)} bank`
}

export function amountColumnReceived(currency: string): string {
  return `${amountColumnHeader(currency)} Rcvd`
}

export function amountColumnPaid(currency: string): string {
  return `${amountColumnHeader(currency)} Paid`
}

export const VARIANCE_COLUMN_HEADER = 'Variance'

export function findAmountColumnValue(row: Record<string, unknown>, currency: string): number {
  const code = amountColumnHeader(currency)
  const key = Object.keys(row).find(
    (k) =>
      k === code ||
      k.startsWith(`${code} `) ||
      k.startsWith(`${code} ·`) ||
      k.startsWith('Amount (') ||
      k.startsWith('Amount ')
  )
  if (!key) return 0
  const v = row[key]
  return typeof v === 'number' ? v : Number(v) || 0
}
