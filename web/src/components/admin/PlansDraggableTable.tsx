import { useEffect, useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../ui/Table'

export type SortablePlanRow = {
  id: string
  slug: string
  name: string
  sortOrder?: number
  usersLimit: number
  projectsPerMonth: number
  transactionsPerMonth: number
  bankAccounts: number
  monthlyGhs: number
  quarterlyGhs: number
  yearlyGhs: number
  active: boolean
}

function sortPlans<T extends SortablePlanRow>(plans: T[]): T[] {
  return [...plans].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.slug.localeCompare(b.slug)
  )
}

function fmtLimit(n: number) {
  return n < 0 ? 'Unlimited' : n.toLocaleString()
}

type Props = {
  plans: SortablePlanRow[]
  onReorder: (orderedIds: string[]) => void
  reordering?: boolean
  onEdit: (plan: SortablePlanRow) => void
  onDelete: (plan: SortablePlanRow) => void
}

export default function PlansDraggableTable({
  plans,
  onReorder,
  reordering,
  onEdit,
  onDelete,
}: Props) {
  const [rows, setRows] = useState(() => sortPlans(plans))
  const dragId = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  useEffect(() => {
    setRows(sortPlans(plans))
  }, [plans])

  function moveRow(fromId: string, toId: string) {
    if (fromId === toId) return
    setRows((prev) => {
      const next = [...prev]
      const fromIdx = next.findIndex((p) => p.id === fromId)
      const toIdx = next.findIndex((p) => p.id === toId)
      if (fromIdx < 0 || toIdx < 0) return prev
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      onReorder(next.map((p) => p.id))
      return next
    })
  }

  return (
    <Table compact>
      <TableHead>
        <tr>
          <TableTh className="w-10" aria-label="Reorder" />
          <TableTh>Package</TableTh>
          <TableTh className="text-right w-16">Order</TableTh>
          <TableTh className="text-right">Seats</TableTh>
          <TableTh className="text-right">Projects</TableTh>
          <TableTh className="text-right">Tx / calendar mo</TableTh>
          <TableTh className="text-right">Banks</TableTh>
          <TableTh className="text-right">Monthly</TableTh>
          <TableTh className="text-right">Quarterly</TableTh>
          <TableTh className="text-right">Yearly</TableTh>
          <TableTh className="text-right">Actions</TableTh>
        </tr>
      </TableHead>
      <TableBody>
        {rows.map((p) => {
          const dragging = draggingId === p.id
          const over = overId === p.id && draggingId !== p.id
          return (
            <TableRow
              key={p.id}
              onDragOver={(e) => {
                e.preventDefault()
                setOverId(p.id)
              }}
              onDragLeave={() => {
                if (overId === p.id) setOverId(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                const from = dragId.current
                dragId.current = null
                setDraggingId(null)
                setOverId(null)
                if (from) moveRow(from, p.id)
              }}
              className={`${dragging ? 'opacity-40' : ''} ${over ? 'ring-2 ring-inset ring-primary-400 bg-primary-50/40' : ''} ${reordering ? 'opacity-70' : ''}`}
            >
              <TableTd className="w-10 text-gray-400">
                <button
                  type="button"
                  draggable={!reordering}
                  disabled={reordering}
                  aria-label={`Drag to reorder ${p.name}`}
                  className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-100 disabled:opacity-50"
                  onDragStart={(e) => {
                    dragId.current = p.id
                    setDraggingId(p.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => {
                    dragId.current = null
                    setDraggingId(null)
                    setOverId(null)
                  }}
                >
                  <GripVertical className="w-4 h-4" aria-hidden />
                </button>
              </TableTd>
              <TableTd>
                <div className="font-medium text-gray-900">{p.name}</div>
                <div className="font-mono text-xs text-gray-500">{p.slug}</div>
                {p.active === false ? (
                  <Badge tone="neutral" size="sm" shape="soft" className="mt-1">
                    Inactive
                  </Badge>
                ) : null}
              </TableTd>
              <TableTd className="text-right text-xs font-mono text-gray-500">{p.sortOrder ?? 0}</TableTd>
              <TableTd className="text-right">{fmtLimit(p.usersLimit)}</TableTd>
              <TableTd className="text-right">{fmtLimit(p.projectsPerMonth)}</TableTd>
              <TableTd className="text-right">{fmtLimit(p.transactionsPerMonth)}</TableTd>
              <TableTd className="text-right">{fmtLimit(p.bankAccounts)}</TableTd>
              <TableTd className="text-right">{p.monthlyGhs}</TableTd>
              <TableTd className="text-right">{p.quarterlyGhs}</TableTd>
              <TableTd className="text-right">{p.yearlyGhs}</TableTd>
              <TableTd className="text-right">
                <Button type="button" variant="ghost" size="xs" onClick={() => onEdit(p)}>
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onDelete(p)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Delete
                </Button>
              </TableTd>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
