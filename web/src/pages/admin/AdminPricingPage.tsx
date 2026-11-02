import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import PageLoadError from '../../components/ui/PageLoadError'
import PageHeader from '../../components/layout/PageHeader'
import { PageBodySkeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import type { FeatureGroup } from '../../lib/plans'

type PricingPageConfig = {
  featureGroups: FeatureGroup[]
  extraFeatureCatalog: { id: string; label: string; hint: string }[]
}

export default function AdminPricingPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState<PricingPageConfig | null>(null)
  const dragGroupIndex = useRef<number | null>(null)
  const dragRow = useRef<{ groupIndex: number; rowIndex: number } | null>(null)
  const [draggingGroup, setDraggingGroup] = useState<number | null>(null)
  const [overGroup, setOverGroup] = useState<number | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'pricing-page'],
    queryFn: () => api('/admin/pricing-page') as Promise<PricingPageConfig>,
  })

  const config = form ?? data

  const saveMutation = useMutation({
    mutationFn: (body: PricingPageConfig) =>
      api('/admin/pricing-page', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing-page'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] })
      queryClient.invalidateQueries({ queryKey: ['public', 'plans'] })
      toast.success('Pricing page layout saved', 'Landing comparison table updated.')
      setForm(null)
    },
    onError: (err) => {
      toast.error('Could not save', err instanceof Error ? err.message : undefined)
    },
  })

  if (isLoading || !config) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Platform admin" title="Pricing page layout" />
        <PageBodySkeleton label="Loading pricing layout" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Platform admin" title="Pricing page layout" />
        <PageLoadError title="Could not load layout" error={error} onRetry={() => void refetch()} />
      </div>
    )
  }

  const working = form ?? config

  function updateGroup(index: number, patch: Partial<FeatureGroup>) {
    setForm((prev) => {
      const base: PricingPageConfig = prev ?? structuredClone(working)
      const groups = [...base.featureGroups]
      groups[index] = { ...groups[index], ...patch }
      return { ...base, featureGroups: groups }
    })
  }

  function updateRow(gi: number, fi: number, patch: Partial<FeatureGroup['features'][0]>) {
    setForm((prev) => {
      const base: PricingPageConfig = prev ?? structuredClone(working)
      const groups = [...base.featureGroups]
      const features = [...groups[gi].features]
      features[fi] = { ...features[fi], ...patch }
      groups[gi] = { ...groups[gi], features }
      return { ...base, featureGroups: groups }
    })
  }

  function reorderGroups(from: number, to: number) {
    if (from === to) return
    setForm((prev) => {
      const base: PricingPageConfig = prev ?? structuredClone(working)
      const groups = [...base.featureGroups]
      const [item] = groups.splice(from, 1)
      groups.splice(to, 0, item)
      return { ...base, featureGroups: groups }
    })
  }

  function reorderRows(groupIndex: number, from: number, to: number) {
    if (from === to) return
    setForm((prev) => {
      const base: PricingPageConfig = prev ?? structuredClone(working)
      const groups = [...base.featureGroups]
      const features = [...groups[groupIndex].features]
      const [item] = features.splice(from, 1)
      features.splice(to, 0, item)
      groups[groupIndex] = { ...groups[groupIndex], features }
      return { ...base, featureGroups: groups }
    })
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Pricing page layout"
        subtitle={
          <p className="text-gray-500">
            Add or edit comparison-table sections and rows. Drag the grip handle to reorder
            sections or rows, then save. Plan packages and cell values are edited under Plans.
          </p>
        }
        actions={
          <Button
            onClick={() => saveMutation.mutate(working)}
            isLoading={saveMutation.isPending}
            disabled={!form}
          >
            Save layout
          </Button>
        }
      />

      <Card title="Extra organisation feature flags">
        <p className="text-xs text-gray-500 mb-4">
          Optional flags you can toggle per plan in Plans (in addition to built-in product features).
        </p>
        <div className="space-y-3">
          {working.extraFeatureCatalog.map((f, i) => (
            <div key={f.id || i} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                label="Flag id"
                value={f.id}
                onChange={(e) => {
                  const next = [...working.extraFeatureCatalog]
                  next[i] = { ...next[i], id: e.target.value }
                  setForm({ ...working, extraFeatureCatalog: next })
                }}
                className="font-mono text-sm"
              />
              <Input
                label="Label"
                value={f.label}
                onChange={(e) => {
                  const next = [...working.extraFeatureCatalog]
                  next[i] = { ...next[i], label: e.target.value }
                  setForm({ ...working, extraFeatureCatalog: next })
                }}
              />
              <div className="flex items-end gap-2">
                <Input
                  label="Hint"
                  value={f.hint}
                  onChange={(e) => {
                    const next = [...working.extraFeatureCatalog]
                    next[i] = { ...next[i], hint: e.target.value }
                    setForm({ ...working, extraFeatureCatalog: next })
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600 shrink-0 mb-0.5"
                  onClick={() => {
                    const next = working.extraFeatureCatalog.filter((_, j) => j !== i)
                    setForm({ ...working, extraFeatureCatalog: next })
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setForm({
                ...working,
                extraFeatureCatalog: [
                  ...working.extraFeatureCatalog,
                  { id: '', label: '', hint: '' },
                ],
              })
            }
          >
            <Plus className="w-4 h-4 mr-1" />
            Add feature flag
          </Button>
        </div>
      </Card>

      {working.featureGroups.map((group, gi) => (
        <Card
          key={gi}
          title={
            <>
              <button
                type="button"
                draggable
                aria-label={`Drag to reorder section ${gi + 1}`}
                className="inline-flex cursor-grab active:cursor-grabbing p-1 mr-1 rounded text-gray-400 hover:bg-gray-100 align-middle"
                onDragStart={(e) => {
                  dragGroupIndex.current = gi
                  setDraggingGroup(gi)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => {
                  dragGroupIndex.current = null
                  setDraggingGroup(null)
                  setOverGroup(null)
                }}
              >
                <GripVertical className="w-4 h-4" aria-hidden />
              </button>
              {`Section ${gi + 1}`}
            </>
          }
          className={`${draggingGroup === gi ? 'opacity-60' : ''} ${overGroup === gi && draggingGroup !== gi ? 'ring-2 ring-primary-400' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setOverGroup(gi)
          }}
          onDragLeave={() => {
            if (overGroup === gi) setOverGroup(null)
          }}
          onDrop={(e) => {
            e.preventDefault()
            const from = dragGroupIndex.current
            dragGroupIndex.current = null
            setDraggingGroup(null)
            setOverGroup(null)
            if (from != null) reorderGroups(from, gi)
          }}
        >
          <Input
            label="Section title"
            value={group.title}
            onChange={(e) => updateGroup(gi, { title: e.target.value })}
            className="mb-4 max-w-md"
          />
          <div className="flex justify-end -mt-2 mb-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-600"
              onClick={() => {
                const groups = working.featureGroups.filter((_, j) => j !== gi)
                setForm({ ...working, featureGroups: groups })
              }}
            >
              Remove section
            </Button>
          </div>
          <div className="space-y-3">
            {group.features.map((row, fi) => (
              <div
                key={row.id || fi}
                className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 items-end"
                onDragOver={(e) => {
                  e.preventDefault()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const from = dragRow.current
                  dragRow.current = null
                  if (from && from.groupIndex === gi) reorderRows(gi, from.rowIndex, fi)
                }}
              >
                <button
                  type="button"
                  draggable
                  aria-label="Drag to reorder row"
                  className="cursor-grab active:cursor-grabbing p-2 mb-0.5 rounded text-gray-400 hover:bg-gray-100 hidden sm:block"
                  onDragStart={(e) => {
                    dragRow.current = { groupIndex: gi, rowIndex: fi }
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => {
                    dragRow.current = null
                  }}
                >
                  <GripVertical className="w-4 h-4" aria-hidden />
                </button>
                <Input
                  label="Row id"
                  value={row.id}
                  onChange={(e) => updateRow(gi, fi, { id: e.target.value })}
                  className="font-mono text-sm"
                />
                <Input
                  label="Label"
                  value={row.label}
                  onChange={(e) => updateRow(gi, fi, { label: e.target.value })}
                />
                <Input
                  label="Tooltip (optional)"
                  value={row.hint ?? ''}
                  onChange={(e) => updateRow(gi, fi, { hint: e.target.value || undefined })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => {
                    const features = group.features.filter((_, j) => j !== fi)
                    updateGroup(gi, { features })
                  }}
                >
                  Remove row
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const features = [...group.features, { id: '', label: '' }]
                updateGroup(gi, { features })
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add row
            </Button>
          </div>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() =>
          setForm({
            ...working,
            featureGroups: [...working.featureGroups, { title: 'New section', features: [{ id: '', label: '' }] }],
          })
        }
      >
        <Plus className="w-4 h-4 mr-1.5" />
        Add comparison section
      </Button>
    </div>
  )
}
