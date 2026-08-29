/**
 * Ghana Ecobank BRS workbook classification constants.
 * Prefer payee/pattern rules so future similar transactions classify without new cheque lists.
 * Keep listed chq/amount overrides only for edge cases the patterns miss.
 */

/** Tax / utility / named judgment lines kept off unpresented TOTAL columns. */
export const WORKBOOK_JUDGMENT_PAYEE_RE =
  /VODAFONE|GRA\b|SSNIT|SODIUM|DORIS|RITA KORKOI|ENTERPRISE TRUSTEES|WELFARE/i

/**
 * Open timing (B₁): recurring operating payments preparers keep in the unmatched-payments
 * working column until bank clearing/withdrawal pairs them (**).
 * Prefer specific operating phrases — avoid bare "ED FUEL" (catches final fuel settlements
 * that belong on other schedules).
 */
export const WORKBOOK_B1_TIMING_PAYEE_RE =
  /BOARD SECRETARY|SECURITY(\s|$)|SHORT LOAN|PART PAYMENT OF (ED )?FUEL|FUEL ALLOWANCE/i

/** Small recurring board/security cheque amounts common on Lordship-style schedules. */
export const WORKBOOK_B1_SMALL_AMOUNTS = [950, 975.2, 975] as const

export const WORKBOOK_B1_FUEL_AMOUNT = 5000
export const WORKBOOK_B1_FUEL_PAYEE_RE = /FUEL|ED FUEL|FUEL ALLOWANCE/i

/**
 * Optional cheque overrides when narration is blank but preparer listed the item in B₁.
 * Prefer extending WORKBOOK_B1_TIMING_PAYEE_RE instead of growing this set.
 */
export const WORKBOOK_B1_TIMING_CHQ_NOS = new Set<string>(['926075'])

/** Round-2 / Group 3 contra amounts (staff withdrawal / SSNIT-style). */
export const WORKBOOK_ROUND2_CONTRA_AMOUNTS = [3000, 3214.89, 3214.9] as const

/**
 * Account902 / 9035 Working (??) add-back: matched finders/levy payments cleared via
 * HSE deposit or inward clearing (preparer first unmatched-debits block).
 * Face unpresented + these offsets = ?? unpresented (e.g. 2,623.18 + 25,953.62 = 28,576.80).
 */
export const WORKBOOK_WORKING_CLEARING_PAYEE_RE =
  /FINDERS\s+FEES?|IBAG|COCOA\s+MARKETING/i

export const WORKBOOK_WORKING_CLEARING_BANK_RE =
  /CLEARING|HSE\s+CHEQUE|CHEQUE\s+DEPOSIT|INWARD\s+LCY/i

/** Preparer first-block clearing amounts (Account902) — keeps Working add-back scoped. */
export const WORKBOOK_WORKING_CLEARING_AMOUNTS = [9978.21, 7605, 3521.55, 1327.31] as const
