import { COUNT_MATCH_SELECT_CAP } from './countMatchExport'

export type CountSelectMode = 'all' | 'overlap'

export type CountMatchSelection = {
  cashBookTxIds: string[]
  bankTxIds: string[]
  overlap: number
  leftoverCb: number
  leftoverBank: number
  capped: boolean
}

export type OpenCountListKey =
  | 'open_recv_cb'
  | 'open_recv_bank'
  | 'open_pay_cb'
  | 'open_pay_bank'

export type OnlyCountListKey =
  | 'only_cb_received'
  | 'only_cb_payment'
  | 'only_bank_lodgment'
  | 'only_bank_debits'

const OPEN_LEFTOVER_ONLY: Record<
  OpenCountListKey,
  { cb: OnlyCountListKey; bank: OnlyCountListKey }
> = {
  open_recv_cb: { cb: 'only_cb_received', bank: 'only_bank_lodgment' },
  open_recv_bank: { cb: 'only_cb_received', bank: 'only_bank_lodgment' },
  open_pay_cb: { cb: 'only_cb_payment', bank: 'only_bank_debits' },
  open_pay_bank: { cb: 'only_cb_payment', bank: 'only_bank_debits' },
}

/** After an Open overlap is matched, leftovers belong on this Only list. */
export function leftoverOnlyListKey(
  openKey: string,
  leftoverCb: number,
  leftoverBank: number
): OnlyCountListKey | null {
  if (!(openKey in OPEN_LEFTOVER_ONLY)) return null
  const dest = OPEN_LEFTOVER_ONLY[openKey as OpenCountListKey]
  if (leftoverCb > 0) return dest.cb
  if (leftoverBank > 0) return dest.bank
  return null
}

/** Shared with the API unit test — keep behaviour aligned. */
export function countMatchSelection(
  cashBookTxIds: string[],
  bankTxIds: string[],
  mode: CountSelectMode,
  cap = COUNT_MATCH_SELECT_CAP
): CountMatchSelection {
  const overlap = Math.min(cashBookTxIds.length, bankTxIds.length)
  const leftoverCb = Math.max(0, cashBookTxIds.length - overlap)
  const leftoverBank = Math.max(0, bankTxIds.length - overlap)
  const rawCb = mode === 'overlap' ? cashBookTxIds.slice(0, overlap) : [...cashBookTxIds]
  const rawBank = mode === 'overlap' ? bankTxIds.slice(0, overlap) : [...bankTxIds]
  const capped = rawCb.length > cap || rawBank.length > cap
  return {
    cashBookTxIds: rawCb.slice(0, cap),
    bankTxIds: rawBank.slice(0, cap),
    overlap,
    leftoverCb,
    leftoverBank,
    capped,
  }
}
