import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bankRules as bankRulesApi, isSubscriptionInactiveError, unlessSubscriptionInactive } from '../../lib/api'
import { useConfirm } from '../ui/ConfirmDialog'
import { useToast } from '../ui/Toast'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Card from '../ui/Card'
import EmptyState from '../ui/EmptyState'
import Input from '../ui/Input'
import Select from '../ui/Select'
import SubscriptionRenewalPanel from '../SubscriptionRenewalPanel'
import { PageBodySkeleton } from '../ui/Skeleton'
import Badge from '../ui/Badge'

type ConditionRow = { field: string; operator: string; value: string }
const defaultCondition = (): ConditionRow => ({ field: 'description', operator: 'contains', value: '' })

export default function BankRulesSection({ canEdit = true }: { canEdit?: boolean }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [priority, setPriority] = useState(100)
  const [conditions, setConditions] = useState<ConditionRow[]>([defaultCondition()])
  const [action, setAction] = useState<'suggest_match' | 'flag_for_review'>('suggest_match')

  const { data, isLoading, error: rulesQueryError } = useQuery({
    queryKey: ['bank-rules'],
    queryFn: bankRulesApi.list,
  })
  const paywallBlocked = isSubscriptionInactiveError(rulesQueryError)

  const createMutation = useMutation({
    mutationFn: bankRulesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-rules'] })
      setShowForm(false)
      resetForm()
      toast.success('Rule created')
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not create rule', e instanceof Error ? e.message : undefined)
      ),
  })

  const deleteMutation = useMutation({
    mutationFn: bankRulesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-rules'] })
      toast.success('Rule deleted')
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not delete rule', e instanceof Error ? e.message : undefined)
      ),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof bankRulesApi.update>[1] }) =>
      bankRulesApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-rules'] })
      setEditId(null)
      resetForm()
      toast.success('Rule updated')
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not update rule', e instanceof Error ? e.message : undefined)
      ),
  })

  const resetForm = () => {
    setName('')
    setPriority(100)
    setConditions([defaultCondition()])
    setAction('suggest_match')
  }

  const rules = (data?.rules || []) as {
    id: string
    name: string
    priority: number
    conditions: { field: string; operator: string; value: string | number }[]
    action: string
  }[]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const validConditions = conditions
      .filter((c) => c.value.trim() !== '')
      .map((c) => ({
        field: c.field,
        operator: c.operator,
        value: /^(0|-?[1-9]\d*)$/.test(c.value) ? Number(c.value) : c.value,
      }))
    if (validConditions.length === 0) return
    if (editId) {
      updateMutation.mutate({ id: editId, body: { name, priority, conditions: validConditions, action } })
    } else {
      createMutation.mutate({ name, priority, conditions: validConditions, action })
    }
  }

  if (paywallBlocked) {
    return (
      <div className="space-y-4">
        <SubscriptionRenewalPanel />
      </div>
    )
  }
  if (isLoading) {
    return <PageBodySkeleton label="Loading bank rules" />
  }

  if (rulesQueryError && !paywallBlocked) {
    return (
      <Alert
        tone="error"
        title="Could not load bank rules"
        onRetry={() => queryClient.invalidateQueries({ queryKey: ['bank-rules'] })}
      >
        {rulesQueryError instanceof Error ? rulesQueryError.message : 'Something went wrong.'}
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {!canEdit && (
        <Alert tone="info" title="View only">
          Contact an admin or reviewer to add or edit rules.
        </Alert>
      )}
      {rules.length === 0 && !showForm && (
        <EmptyState
          title="No rules yet"
          description="Add a rule to auto-suggest or flag matching bank transactions."
        />
      )}
      {rules.length > 0 && (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="group flex items-center justify-between p-4 border border-border rounded-xl shadow-card bg-white hover:border-primary-200 transition-colors"
            >
              <div>
                <p className="font-semibold text-gray-900">{r.name}</p>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  <Badge tone={r.action === 'suggest_match' ? 'success' : 'warning'} size="sm" className="uppercase tracking-wider">
                    {r.action.replace(/_/g, ' ')}
                  </Badge>
                  <span className="text-[11px] text-gray-500 font-medium">Priority {r.priority}</span>
                </div>
                <p className="mt-1.5 text-xs text-gray-600 leading-relaxed italic">
                  IF{' '}
                  {r.conditions
                    ?.map(
                      (c: { field: string; operator: string; value: unknown }) =>
                        `${c.field} ${c.operator} "${c.value}"`
                    )
                    .join(' AND ')}
                </p>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setEditId(r.id)
                      setName(r.name)
                      setPriority(r.priority)
                      const conds = r.conditions?.length
                        ? r.conditions.map((c: { field: string; operator: string; value: unknown }) => ({
                            field: c.field,
                            operator: c.operator,
                            value: String(c.value ?? ''),
                          }))
                        : [defaultCondition()]
                      setConditions(conds)
                      setAction((r.action as 'suggest_match' | 'flag_for_review') || 'suggest_match')
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Delete this rule?',
                        description: r.name,
                        confirmLabel: 'Delete',
                        tone: 'danger',
                      })
                      if (ok) deleteMutation.mutate(r.id)
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (showForm || editId) ? (
        <Card title={editId ? 'Edit rule' : 'Add rule'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rule name (e.g. Bank fees)"
            required
          />
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500">Conditions (all must match)</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConditions((c) => [...c, defaultCondition()])}>
                Add condition
              </Button>
            </div>
            <div className="space-y-2">
              {conditions.map((cond, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-end gap-2 p-2 bg-white rounded border border-border"
                >
                  <div className="w-32 shrink-0">
                    <Select
                      aria-label="Field"
                      value={cond.field}
                      onChange={(e) =>
                        setConditions((c) =>
                          c.map((x, i) => (i === idx ? { ...x, field: e.target.value } : x))
                        )
                      }
                    >
                      <option value="description">description</option>
                      <option value="details">details</option>
                      <option value="amount">amount</option>
                      <option value="name">name</option>
                    </Select>
                  </div>
                  <div className="w-32 shrink-0">
                    <Select
                      aria-label="Operator"
                      value={cond.operator}
                      onChange={(e) =>
                        setConditions((c) =>
                          c.map((x, i) => (i === idx ? { ...x, operator: e.target.value } : x))
                        )
                      }
                    >
                      <option value="contains">contains</option>
                      <option value="equals">equals</option>
                      <option value="starts_with">starts_with</option>
                      <option value="gt">gt</option>
                      <option value="gte">gte</option>
                      <option value="lt">lt</option>
                      <option value="lte">lte</option>
                    </Select>
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <Input
                      value={cond.value}
                      onChange={(e) =>
                        setConditions((c) =>
                          c.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x))
                        )
                      }
                      placeholder="e.g. BANK CHARGES"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConditions((c) => (c.length > 1 ? c.filter((_, i) => i !== idx) : c))}
                    title="Remove condition"
                    aria-label="Remove condition"
                    className="text-red-600 hover:text-red-700"
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="max-w-md">
            <Select
              label="Action"
              value={action}
              onChange={(e) => setAction(e.target.value as 'suggest_match' | 'flag_for_review')}
            >
              <option value="suggest_match">Suggest match (amount match)</option>
              <option value="flag_for_review">Flag for review</option>
            </Select>
          </div>
          <Input
            type="number"
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="max-w-[8rem]"
            hint="Lower number = higher priority"
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editId ? 'Update' : 'Add'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowForm(false)
                setEditId(null)
                resetForm()
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
        </Card>
      ) : canEdit ? (
        <Button type="button" onClick={() => setShowForm(true)}>
          Add rule
        </Button>
      ) : null}
    </div>
  )
}
