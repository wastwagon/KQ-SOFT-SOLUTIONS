import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bankRules as bankRulesApi } from '../../lib/api'
import { useConfirm } from '../ui/ConfirmDialog'
import { useToast } from '../ui/Toast'

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

  const { data, isLoading } = useQuery({
    queryKey: ['bank-rules'],
    queryFn: bankRulesApi.list,
  })

  const createMutation = useMutation({
    mutationFn: bankRulesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-rules'] })
      setShowForm(false)
      resetForm()
      toast.success('Rule created')
    },
    onError: (err) =>
      toast.error('Could not create rule', err instanceof Error ? err.message : undefined),
  })

  const deleteMutation = useMutation({
    mutationFn: bankRulesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-rules'] })
      toast.success('Rule deleted')
    },
    onError: (err) =>
      toast.error('Could not delete rule', err instanceof Error ? err.message : undefined),
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
      toast.error('Could not update rule', err instanceof Error ? err.message : undefined),
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

  if (isLoading) return <p className="text-sm text-gray-500">Loading rules...</p>

  return (
    <div className="space-y-4">
      {!canEdit && (
        <p className="text-sm text-amber-600">
          You have view-only access to bank rules. Contact an admin or reviewer to add or edit rules.
        </p>
      )}
      {rules.length === 0 && !showForm && (
        <div className="py-8 text-center rounded-xl border border-gray-200 bg-gray-50/50">
          <p className="text-base font-semibold tracking-tight text-gray-900">No rules yet</p>
          <p className="mt-1 text-sm text-gray-600">Add a rule to auto-suggest or flag matching bank transactions.</p>
        </div>
      )}
      {rules.length > 0 && (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="group flex items-center justify-between p-4 border border-gray-200 rounded-xl shadow-sm bg-white hover:border-primary-200 transition-colors"
            >
              <div>
                <p className="font-semibold text-gray-900">{r.name}</p>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      r.action === 'suggest_match'
                        ? 'bg-green-50 text-green-700 border border-green-100'
                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}
                  >
                    {r.action.replace(/_/g, ' ')}
                  </span>
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
                  <button
                    type="button"
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
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Delete this rule?',
                        description: r.name,
                        confirmLabel: 'Delete',
                        tone: 'danger',
                      })
                      if (ok) deleteMutation.mutate(r.id)
                    }}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (showForm || editId) ? (
        <form onSubmit={handleSubmit} className="p-5 border border-gray-200 rounded-xl bg-gray-50/80 space-y-4 shadow-sm">
          <h3 className="text-base font-semibold tracking-tight text-gray-900">
            {editId ? 'Edit rule' : 'Add rule'}
          </h3>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rule name (e.g. Bank fees)"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            required
          />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs text-gray-500 font-medium">Conditions (all must match)</label>
              <button
                type="button"
                onClick={() => setConditions((c) => [...c, defaultCondition()])}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                + Add condition
              </button>
            </div>
            <div className="space-y-2">
              {conditions.map((cond, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-end gap-2 p-2 bg-white rounded border border-gray-200"
                >
                  <select
                    value={cond.field}
                    onChange={(e) =>
                      setConditions((c) =>
                        c.map((x, i) => (i === idx ? { ...x, field: e.target.value } : x))
                      )
                    }
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm w-28 bg-white text-gray-900"
                  >
                    <option value="description">description</option>
                    <option value="details">details</option>
                    <option value="amount">amount</option>
                    <option value="name">name</option>
                  </select>
                  <select
                    value={cond.operator}
                    onChange={(e) =>
                      setConditions((c) =>
                        c.map((x, i) => (i === idx ? { ...x, operator: e.target.value } : x))
                      )
                    }
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm w-28 bg-white text-gray-900"
                  >
                    <option value="contains">contains</option>
                    <option value="equals">equals</option>
                    <option value="starts_with">starts_with</option>
                    <option value="gt">gt</option>
                    <option value="gte">gte</option>
                    <option value="lt">lt</option>
                    <option value="lte">lte</option>
                  </select>
                  <input
                    value={cond.value}
                    onChange={(e) =>
                      setConditions((c) =>
                        c.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x))
                      )
                    }
                    placeholder="e.g. BANK CHARGES"
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm flex-1 min-w-[100px] bg-white text-gray-900 placeholder-gray-500"
                  />
                  <button
                    type="button"
                    onClick={() => setConditions((c) => (c.length > 1 ? c.filter((_, i) => i !== idx) : c))}
                    className="text-red-600 hover:text-red-700 text-sm px-1"
                    title="Remove condition"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as 'suggest_match' | 'flag_for_review')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
            >
              <option value="suggest_match">Suggest match (amount match)</option>
              <option value="flag_for_review">Flag for review</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Priority</label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-24 bg-white text-gray-900"
            />
            <span className="text-xs text-gray-500 ml-2">(lower = higher priority)</span>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2.5 font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 text-sm shadow-sm focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all"
            >
              {editId ? 'Update' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setEditId(null)
                resetForm()
              }}
              className="px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-100 text-gray-700 text-sm font-medium shadow-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : canEdit ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 shadow-sm hover:shadow text-sm focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all"
        >
          + Add rule
        </button>
      ) : null}
    </div>
  )
}
