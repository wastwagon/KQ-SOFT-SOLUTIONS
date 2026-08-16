import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiKeys as apiKeysApi, isSubscriptionInactiveError, unlessSubscriptionInactive } from '../../lib/api'
import { useConfirm } from '../ui/ConfirmDialog'
import { useToast } from '../ui/Toast'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../ui/Table'
import SubscriptionRenewalPanel from '../SubscriptionRenewalPanel'
import { PageBodySkeleton } from '../ui/Skeleton'

export default function ApiKeysSection() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [newName, setNewName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  const { data: keys = [], isLoading, error: keysQueryError } = useQuery({
    queryKey: ['api-keys'],
    queryFn: apiKeysApi.list,
  })
  const paywallBlocked = isSubscriptionInactiveError(keysQueryError)

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
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not create key', e instanceof Error ? e.message : undefined)
      ),
  })

  const deleteMutation = useMutation({
    mutationFn: apiKeysApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      toast.success('API key revoked')
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not revoke key', e instanceof Error ? e.message : undefined)
      ),
  })

  if (paywallBlocked) {
    return (
      <div className="space-y-4">
        <SubscriptionRenewalPanel />
      </div>
    )
  }
  if (isLoading) {
    return <PageBodySkeleton label="Loading API keys" />
  }

  if (keysQueryError && !paywallBlocked) {
    return (
      <Alert
        tone="error"
        title="Could not load API keys"
        onRetry={() => queryClient.invalidateQueries({ queryKey: ['api-keys'] })}
      >
        {keysQueryError instanceof Error ? keysQueryError.message : 'Something went wrong.'}
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (newName.trim()) createMutation.mutate(newName.trim())
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <div className="flex-1 min-w-0 sm:min-w-[200px]">
          <Input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Key name (e.g. Integration XYZ)"
          />
        </div>
        <Button type="submit" disabled={!newName.trim()} isLoading={createMutation.isPending}>
          Create key
        </Button>
      </form>
      {createdKey && (
        <Alert tone="warning" title="Save this key — it won’t be shown again">
          <code className="mt-1 block break-all rounded bg-white p-2 text-xs">{createdKey}</code>
        </Alert>
      )}
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHead>
            <tr>
              <TableTh>Name</TableTh>
              <TableTh>Prefix</TableTh>
              <TableTh>Last used</TableTh>
              <TableTh className="w-20" />
            </tr>
          </TableHead>
          <TableBody>
            {keys.length === 0 ? (
              <TableRow>
                <TableTd colSpan={4} className="text-gray-500 text-center">
                  No API keys
                </TableTd>
              </TableRow>
            ) : (
              keys.map((k: { id: string; name: string; keyPrefix: string; lastUsedAt: string | null }) => (
                <TableRow key={k.id}>
                  <TableTd className="font-medium text-gray-900">{k.name}</TableTd>
                  <TableTd className="font-mono">{k.keyPrefix}...</TableTd>
                  <TableTd className="text-gray-500">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : '—'}
                  </TableTd>
                  <TableTd>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
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
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Revoke
                    </Button>
                  </TableTd>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
