/**
 * Bank rules engine - evaluate conditions against transactions
 * Conditions: field, operator, value
 * Operators: equals, contains, starts_with, gt, gte, lt, lte
 */

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
