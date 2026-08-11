export type CountScope = 'unmatched' | 'all'

export type CountBucketCategory =
  | 'only_cash_book'
  | 'only_bank'
  | 'open_cb_surplus'
  | 'open_bank_surplus'
  | 'batch_cancel'

export interface CountAmountRow {
  amountKey: string
  amount: number
  cashBookCount: number
  bankCount: number
  difference: number
  category: CountBucketCategory
  cashBookTxIds: string[]
  bankTxIds: string[]
}

export interface CountLaneResult {
  lane: 'receipts_credits' | 'payments_debits'
  cashBookLabel: 'Received' | 'Payment'
  bankLabel: 'Lodgment' | 'Debits'
  rows: CountAmountRow[]
  summary: {
    onlyCashBook: number
    onlyBank: number
    openCbSurplus: number
    openBankSurplus: number
    batchCancel: number
  }
}

export interface CountMatchDiagnostic {
  scope: CountScope
  invertedSides: boolean
  amountTolerance: number
  receiptsCredits: CountLaneResult
  paymentsDebits: CountLaneResult
  brsDetails: {
    onlyCashBookReceived: CountAmountRow[]
    onlyCashBookPayments: CountAmountRow[]
    onlyBankLodgments: CountAmountRow[]
    onlyBankDebits: CountAmountRow[]
    openReceiptsVsCreditsCbSurplus: CountAmountRow[]
    openReceiptsVsCreditsBankSurplus: CountAmountRow[]
    openPaymentsVsDebitsCbSurplus: CountAmountRow[]
    openPaymentsVsDebitsBankSurplus: CountAmountRow[]
  }
  cancelSchedule: {
    receiptsEqualsCredits: CountAmountRow[]
    paymentsEqualsDebits: CountAmountRow[]
  }
  meta?: {
    bankAccountId: string | null
    laneTruncated: boolean
    clearsNote?: string
  }
}
