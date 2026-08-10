/**
 * Bank rules engine - evaluate conditions against transactions
 * Conditions: field, operator, value
 * Operators: equals, contains, starts_with, gt, gte, lt, lte
 */

import {
  datesWithinWindow,
  descriptionSimilarity,
  shareReferenceEvidence,
  type Tx,
} from './matching.js'

export interface Condition {
  field: string  // description | details | amount | name
  operator: string
  value: string | number
}

export interface BankRule {
  id: string
  name: string
  priority: number
  conditions: Condition[]
  action: string
}

export interface TxLike {
  id: string
  date: Date | null
  name: string | null
  details: string | null
  amount: number
  docRef?: string | null
  chqNo?: string | null
}

function evalCondition(tx: TxLike, c: Condition): boolean {
  const fieldVal = c.field === 'description' || c.field === 'details'
    ? (tx.details || tx.name || '')
    : c.field === 'amount'
      ? tx.amount
      : c.field === 'name'
        ? (tx.name || '')
        : ''
  const strVal = String(fieldVal).toLowerCase()
  const ruleVal = c.value
  const strRule = String(ruleVal).toLowerCase()
  const numVal = typeof fieldVal === 'number' ? fieldVal : parseFloat(String(fieldVal))
  const numRule = typeof ruleVal === 'number' ? ruleVal : parseFloat(String(ruleVal))

  switch (c.operator) {
    case 'equals':
      return typeof fieldVal === 'number' ? numVal === numRule : strVal === strRule
    case 'contains':
      return strVal.includes(strRule)
    case 'starts_with':
      return strVal.startsWith(strRule)
    case 'gt':
      return numVal > numRule
    case 'gte':
      return numVal >= numRule
    case 'lt':
      return numVal < numRule
    case 'lte':
      return numVal <= numRule
    default:
      return false
  }
}

export function ruleMatchesTx(tx: TxLike, rule: BankRule): boolean {
  if (!rule.conditions || !Array.isArray(rule.conditions)) return false
  return rule.conditions.every((c) => evalCondition(tx, c))
}

export function getMatchingRule(tx: TxLike, rules: BankRule[]): BankRule | null {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority)
  for (const r of sorted) {
    if (ruleMatchesTx(tx, r)) return r
  }
  return null
}

export interface BankRuleMatchPick {
  cashBookTx: Tx
  confidence: number
  corroboration: 'date+ref' | 'date' | 'ref' | 'description'
}

/**
 * For rule action suggest_match: require amount + corroboration
 * (date within window, shared ref/chq/doc, or narration similarity ≥ 0.3).
 * Amount alone is never enough.
 */
export function pickBankRuleCashBookMatch(
  bankTx: Tx,
  cashBookTxs: Tx[],
  matchedCbIds: Set<string>,
  options: { amountTolerance: number; dateWindowDays?: number; minDescScore?: number } = {
    amountTolerance: 0.01,
  }
): BankRuleMatchPick | null {
  const amountTolerance = options.amountTolerance
  const dateWindowDays = options.dateWindowDays ?? 3
  const minDescScore = options.minDescScore ?? 0.3

  type Scored = BankRuleMatchPick & { rank: number }
  const scored: Scored[] = []

  for (const cb of cashBookTxs) {
    if (matchedCbIds.has(cb.id)) continue
    if (Math.abs(cb.amount - bankTx.amount) > amountTolerance) continue

    const dateOk = datesWithinWindow(cb.date, bankTx.date, dateWindowDays)
    const refOk = shareReferenceEvidence(cb, bankTx)
    const descScore = descriptionSimilarity(
      [cb.details, cb.name].filter(Boolean).join(' '),
      [bankTx.details, bankTx.name].filter(Boolean).join(' ')
    )
    const descOk = descScore >= minDescScore
    if (!dateOk && !refOk && !descOk) continue

    let corroboration: BankRuleMatchPick['corroboration']
    let confidence: number
    let rank: number
    if (dateOk && refOk) {
      corroboration = 'date+ref'
      confidence = 0.88
      rank = 4
    } else if (dateOk) {
      corroboration = 'date'
      confidence = 0.85
      rank = 3
    } else if (refOk) {
      corroboration = 'ref'
      confidence = 0.85
      rank = 2
    } else {
      corroboration = 'description'
      confidence = 0.8
      rank = 1
    }
    scored.push({ cashBookTx: cb, confidence, corroboration, rank })
  }

  if (!scored.length) return null
  scored.sort((a, b) => b.rank - a.rank || b.confidence - a.confidence)
  const best = scored[0]!
  // Ambiguous: two equally ranked amount matches with same corroboration class
  if (scored.length > 1 && scored[1]!.rank === best.rank) return null
  return { cashBookTx: best.cashBookTx, confidence: best.confidence, corroboration: best.corroboration }
}
