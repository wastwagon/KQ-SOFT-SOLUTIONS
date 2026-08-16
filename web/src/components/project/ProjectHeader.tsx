import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Pencil, Trash2, X } from 'lucide-react'
import ProjectStatusPill, { type ProjectStatus } from './ProjectStatusPill'
import { useConfirm } from '../ui/ConfirmDialog'
import { useToast } from '../ui/Toast'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'

/**
 * Project context bar used at the top of <ProjectDetail>.  Responsibilities:
 *   - Breadcrumb back to the projects list.
 *   - Inline rename / re-assign (client + currency) for users with edit perms.
 *   - Status pill so users always know where the project is in the workflow.
 *   - Delete action that uses the branded confirm dialog and toast.
 *
 * Header layout is intentionally compact so it doesn't dominate the dense
 * BRS workflow underneath.
 */
type Currency = 'GHS' | 'USD' | 'EUR'

interface ClientLite {
  id: string
  name: string
}

export interface ProjectHeaderProject {
  name: string
  status: ProjectStatus
  currency?: string | null
  /** Business name as on bank statement — printed BRS company line when set. */
  statementBusinessName?: string | null
  client?: ClientLite | null
}

interface ProjectHeaderProps {
  project: ProjectHeaderProject
  clients: ClientLite[]
  /** Inline rename / client / currency update. */
  canEdit: boolean
  /** Allowed to permanently delete the project. */
  canDelete: boolean
  isUpdating?: boolean
  isDeleting?: boolean
  onSave: (body: {
    name: string
    statementBusinessName: string | null
    clientId: string | null
    currency: Currency
  }) => void
  onDelete: () => void
}

export default function ProjectHeader({
  project,
  clients,
  canEdit,
  canDelete,
  isUpdating,
  isDeleting,
  onSave,
  onDelete,
}: ProjectHeaderProps) {
  const confirm = useConfirm()
  const toast = useToast()

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(project.name)
  const [editStatementBusinessName, setEditStatementBusinessName] = useState(
    project.statementBusinessName ?? ''
  )
  const [editClientId, setEditClientId] = useState(project.client?.id ?? '')
  const [editCurrency, setEditCurrency] = useState<Currency>(
    (project.currency as Currency) || 'GHS'
  )

  const startEdit = () => {
    setEditName(project.name)
    setEditStatementBusinessName(project.statementBusinessName ?? '')
    setEditClientId(project.client?.id ?? '')
    setEditCurrency((project.currency as Currency) || 'GHS')
    setEditing(true)
  }

  const cancelEdit = () => setEditing(false)

  const submitEdit = () => {
    const trimmed = editName.trim()
    if (!trimmed) {
      toast.warning('Project name required')
      return
    }
    onSave({
      name: trimmed,
      statementBusinessName: editStatementBusinessName.trim() || null,
      clientId: editClientId || null,
      currency: editCurrency,
    })
    setEditing(false)
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete "${project.name}"?`,
      description:
        'This permanently removes the project, all uploaded documents, transactions, and matches. The action cannot be undone.',
      confirmLabel: 'Delete project',
      tone: 'danger',
    })
    if (ok) onDelete()
  }

  return (
    <header className="rounded-xl border border-border bg-white shadow-card px-5 py-5 sm:px-7 sm:py-6 space-y-4">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex items-center gap-1 text-gray-500">
          <li>
            <Link
              to="/projects"
              className="rounded font-medium text-gray-500 transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Projects
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-4 w-4" />
          </li>
          <li
            aria-current="page"
            className="truncate font-medium text-gray-700"
            title={project.name}
          >
            {project.name}
          </li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing && canEdit ? (
            <div className="flex w-full max-w-2xl flex-col gap-3">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Project name"
                aria-label="Project name"
              />
              <Input
                value={editStatementBusinessName}
                onChange={(e) => setEditStatementBusinessName(e.target.value)}
                placeholder="Business name as on bank statement (printed BRS)"
                aria-label="Business name as on bank statement"
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="sm:min-w-[180px] sm:flex-1">
                  <Select
                    value={editClientId}
                    onChange={(e) => setEditClientId(e.target.value)}
                    aria-label="Client"
                  >
                    <option value="">— No client —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="sm:w-32">
                  <Select
                    value={editCurrency}
                    onChange={(e) => setEditCurrency(e.target.value as Currency)}
                    aria-label="Currency"
                  >
                    <option value="GHS">GHS</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button type="button" onClick={submitEdit} isLoading={isUpdating}>
                    Save
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    <X className="h-4 w-4 mr-1.5" aria-hidden="true" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                  {project.name}
                </h1>
                <ProjectStatusPill status={project.status} />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-600">
                {project.statementBusinessName && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-gray-400">On statement</span>
                    <span className="font-medium text-gray-700">{project.statementBusinessName}</span>
                  </span>
                )}
                {project.client && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-gray-400">Client</span>
                    <span className="font-medium text-gray-700">{project.client.name}</span>
                  </span>
                )}
                {project.currency && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-gray-400">Currency</span>
                    <span className="font-medium text-gray-700">{project.currency}</span>
                  </span>
                )}
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={startEdit}
                    className="text-primary-600 hover:text-primary-700"
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                    Edit details
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {canDelete && !editing && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleDelete}
            isLoading={isDeleting}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Delete
          </Button>
        )}
      </div>
    </header>
  )
}
