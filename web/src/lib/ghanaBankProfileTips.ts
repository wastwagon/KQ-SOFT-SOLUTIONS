/** Short reconcile UI tips keyed by reconcileProfile.bankFormat. */
export const GHANA_BANK_PROFILE_TIPS: Record<
  string,
  { title: string; body: string }
> = {
  ecobank: {
    title: 'Ecobank Ghana BRS profile',
    body: 'Clearing matches use a wider date window. Prefer Clearing, Transfer, and Withdrawal suggestions before generic payment↔debit pairs. Inward clearing / HSE deposits appear as bank credits.',
  },
  scb: {
    title: 'Standard Chartered profile',
    body: 'Prefer Sweep, inward clearing (INW CLG), OT ref, and cash withdrawal suggestions. Unique-amount-only inward clearing tips need manual review.',
  },
  gcb: {
    title: 'GCB profile',
    body: 'Prefer Cheque Withdrawal / CHQ lodgement suggestions with matching cheque numbers, and Cash Deposit suggestions with payee corroboration.',
  },
  nib: {
    title: 'NIB profile',
    body: 'Prefer Inward Cheque (CHQ NO / By cheque No) on the debit side, plus Cash Deposit and Inward Telex credits with payee corroboration.',
  },
  prudential: {
    title: 'Prudential profile',
    body: 'INWARD CLEARING posts as bank debits (not credits). Prefer inward clearing, cheque withdrawal, and NRT suggestions with payee or chq corroboration.',
  },
  absa: {
    title: 'Absa profile',
    body: 'Prefer Investment Bank / EBOX credits with payee corroboration, and shared FT reference + amount pairs.',
  },
  boa: {
    title: 'Bank of Africa profile',
    body: 'Prefer CHECK PAID / INW.CHQ debits with cheque number, YOUR CASH DEPOSIT credits with payee, and MAT.DEPOT matches on Our Reference.',
  },
  gt_bank_eur: {
    title: 'GT Bank EUR profile',
    body: 'Report builds uncredited lodgments, unpresented cheques, and bank-only lines from schedule rules — you can leave those timing items unmatched here. Do not pair bank charges (SOFITEL, QUAD, DUGOL) to cash book BANKCHG lines. Enter closing balances on Report and confirm tie-out ≈ 0.',
  },
}

export function ghanaBankProfileTip(bankFormat: string | undefined | null): {
  title: string
  body: string
} | null {
  if (!bankFormat) return null
  return GHANA_BANK_PROFILE_TIPS[bankFormat.toLowerCase()] ?? null
}
