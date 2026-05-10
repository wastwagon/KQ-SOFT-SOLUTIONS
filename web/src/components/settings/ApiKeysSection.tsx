import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiKeys as apiKeysApi } from '../../lib/api'
import { useConfirm } from '../ui/ConfirmDialog'
import { useToast } from '../ui/Toast'

export default function ApiKeysSection() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [newName, setNewName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: apiKeysApi.list,
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => apiKeysApi.create({ name }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setNewName('')
      setCreatedKey(data.key)
      toast.success('API key created')
      setTimeout(() => setCreatedKey(null), 15000)
    },
    onError: (err) =>
      toast.error('Could not create key', err instanceof Error ? err.message : undefined),
  })

  const deleteMutation = useMutation({
    mutationFn: apiKeysApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      toast.success('API key revoked')
    },
    onError: (err) =>
      toast.error('Could not revoke key', err instanceof Error ? err.message : undefined),
  })

  if (isLoading) return <p className="text-sm text-gray-500">Loading...</p>

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (newName.trim()) createMutation.mutate(newName.trim())
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Key name (e.g. Integration XYZ)"
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <button
          type="submit"
          disabled={createMutation.isPending || !newName.trim()}
          className="px-4 py-2.5 font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 text-sm shadow-sm hover:shadow focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all"
        >
          {createMutation.isPending ? 'Creating...' : 'Create key'}
        </button>
      </form>
      {createdKey && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <p className="font-medium text-amber-800 mb-1">Save this key — it won&apos;t be shown again</p>
          <code className="block p-2 bg-white rounded break-all text-xs">{createdKey}</code>
        </div>
      )}
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Prefix
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Last used
                </th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted bg-white">
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-gray-500 text-center">
                    No API keys
                  </td>
                </tr>
              ) : (
                keys.map((k: { id: string; name: string; keyPrefix: string; lastUsedAt: string | null }) => (
                  <tr key={k.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{k.name}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{k.keyPrefix}...</td>
                    <td className="px-4 py-3 text-gray-500">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Revoke this API key?',
                            description: `Integrations using "${k.name}" will stop working immediately.`,
                            confirmLabel: 'Revoke',
                            tone: 'danger',
                          })
                          if (ok) deleteMutation.mutate(k.id)
                        }}
                        disabled={deleteMutation.isPending}
                        className="text-red-600 hover:text-red-700 text-xs"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
