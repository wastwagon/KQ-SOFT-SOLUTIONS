/**
 * Single source of truth for header → column index suggestions (preview + web Map UI).
 * Safe to import from the browser bundle (no Node-only APIs).
 */

export type MappingConfidence = 'high' | 'medium' | 'low'

export function normHeader(h: string): string {
  return (h || '').toLowerCase().replace(/[\s_]+/g, ' ').trim()
}

export function buildSmartSuggestedMapping(
  headers: string[],
  isCashBook: boolean,
  existingSuggested: Record<string, number> = {}
): Record<string, number> {
  const out = { ...existingSuggested }
  const normalized = headers.map(normHeader)

  const find = (patterns: RegExp[]): number => {
    const idx = normalized.findIndex((h) => patterns.some((p) => p.test(h)))
    return idx >= 0 ? idx : -1
  }

  if (isCashBook) {
    if (out.date == null) {
      const i = find([/^date$/, /transaction\s*date/, /value\s*date/, /txn\s*date/, /posting\s*date/, /transaction_date/])
      if (i >= 0) out.date = i
    }
    if (out.name == null) {
      const i = find([/^name$/, /description/, /particulars/, /narrative/, /payee/, /party/])
      if (i >= 0) out.name = i
    }
    if (out.details == null) {
      const i = find([/^details$/, /particulars/, /narrative/, /memo/, /remarks/])
      if (i >= 0) out.details = i
    }
    if (out.doc_ref == null) {
      const i = find([/^doc ref$/, /^doc_ref$/, /^ref$/, /reference/, /voucher/, /receipt\s*no/])
      if (i >= 0) out.doc_ref = i
    }
    if (out.chq_no == null) {
      const i = find([/^chq no$/, /^chq_no$/, /chq\s*no/, /cheque\s*no/, /cheque\s*number/, /chq$/])
      if (i >= 0) out.chq_no = i
    }
    if (out.accode == null) {
      const i = find([/^accode$/, /account\s*code/, /ac\s*code/, /^code$/])
      if (i >= 0) out.accode = i
    }
    if (out.amt_received == null) {
      const i = find([/amt\s*received/, /amount\s*received/, /receipts?/, /^received$/, /credit/, /\bcr\b/, /deposit/])
      if (i >= 0) out.amt_received = i
    }
    if (out.amt_paid == null) {
      const i = find([/amt\s*paid/, /amount\s*paid/, /payments?/, /^paid$/, /debit/, /\bdr\b/, /withdrawal/])
      if (i >= 0) out.amt_paid = i
    }
    if (out.amt_received == null && out.amt_paid == null) {
      const i = find([/^amount$/, /^amt$/, /total/])
      if (i >= 0) {
        out.amt_received = i
        out.amt_paid = i
      }
    }
  } else {
    if (out.transaction_date == null) {
      const i = find([/^date$/, /transaction\s*date/, /value\s*date/, /txn\s*date/, /posting\s*date/, /transaction_date/])
      if (i >= 0) out.transaction_date = i
    }
    if (out.description == null) {
      const i = find([/^description$/, /particulars/, /narrative/, /details/, /memo/, /remarks/])
      if (i >= 0) out.description = i
    }
    if (out.credit == null) {
      const i = find([/^credit$/, /\bcr\b/, /deposits?/, /in(?:ward)?/])
      if (i >= 0) out.credit = i
    }
    if (out.debit == null) {
      const i = find([/^debit$/, /\bdr\b/, /withdrawals?/, /out(?:ward)?/])
      if (i >= 0) out.debit = i
    }
    if (out.credit == null && out.debit == null) {
      const i = find([/^amount$/, /^amt$/, /total/])
      if (i >= 0) {
        out.credit = i
        out.debit = i
      }
    }
  }

  return out
}

export function getMappingConfidence(
  headers: string[],
  mapping: Record<string, number>
): Record<string, MappingConfidence> {
  const out: Record<string, MappingConfidence> = {}
  const STRONG: Record<string, RegExp[]> = {
    date: [/^date$/, /transaction\s*date/, /value\s*date/, /posting\s*date/],
    transaction_date: [/^date$/, /transaction\s*date/, /value\s*date/, /posting\s*date/],
    description: [/^description$/, /particulars/, /narrative/, /details/, /memo/, /remarks/],
    name: [/^name$/, /payee/, /party/, /description/],
    details: [/^details$/, /particulars/, /narrative/, /memo/, /remarks/],
    doc_ref: [/^doc ref$/, /^doc_ref$/, /^ref$/, /reference/, /voucher/],
    chq_no: [/^chq no$/, /^chq_no$/, /cheque\s*no/, /cheque\s*number/],
    accode: [/^accode$/, /account\s*code/, /ac\s*code/],
    amt_received: [/amt\s*received/, /amount\s*received/, /receipts?/, /^received$/, /^credit$/, /\bcr\b/],
    amt_paid: [/amt\s*paid/, /amount\s*paid/, /payments?/, /^paid$/, /^debit$/, /\bdr\b/],
    credit: [/^credit$/, /\bcr\b/, /deposits?/],
    debit: [/^debit$/, /\bdr\b/, /withdrawals?/],
  }
  const SOFT: Record<string, RegExp[]> = {
    doc_ref: [/ref/, /receipt/, /number/],
    chq_no: [/chq/, /cheque/, /number/],
    amt_received: [/received/, /credit/, /deposit/, /amount/, /amt/],
    amt_paid: [/paid/, /debit/, /withdrawal/, /amount/, /amt/],
    credit: [/credit/, /deposit/, /amount/, /amt/],
    debit: [/debit/, /withdrawal/, /amount/, /amt/],
  }
  for (const [field, idx] of Object.entries(mapping)) {
    const header = normHeader(headers[idx] || '')
    if (!header) {
      out[field] = 'low'
      continue
    }
    const strong = (STRONG[field] || []).some((p) => p.test(header))
    if (strong) {
      out[field] = 'high'
      continue
    }
    const soft = (SOFT[field] || [/amount/, /date/, /desc/, /ref/, /details/]).some((p) => p.test(header))
    out[field] = soft ? 'medium' : 'low'
  }
  return out
}
