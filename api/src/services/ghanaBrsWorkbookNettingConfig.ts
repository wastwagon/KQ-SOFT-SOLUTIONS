/**
 * Lordship / Account 901–902 manual workbook netting constants.
 * Extend this module when onboarding new preparer schedules — keep business rules out of algorithm code.
 */
export const WORKBOOK_JUDGMENT_PAYEE_RE =
  /VODAFONE|GRA\b|SSNIT|SODIUM|DORIS|RITA KORKOI/i

export const WORKBOOK_B1_SMALL_AMOUNTS = [950, 975.2, 975] as const

export const WORKBOOK_B1_FUEL_AMOUNT = 5000
export const WORKBOOK_B1_FUEL_PAYEE_RE = /FUEL|ED FUEL|FUEL ALLOWANCE/i

/** Preparer-listed timing cheques (block B₁) by chq number. */
export const WORKBOOK_B1_TIMING_CHQ_NOS = new Set(['926075'])

export const WORKBOOK_ROUND2_CONTRA_AMOUNTS = [3000, 3214.89, 3214.9] as const
