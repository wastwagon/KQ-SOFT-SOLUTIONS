import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Pencil, Trash2, X } from 'lucide-react'
import ProjectStatusPill, { type ProjectStatus } from './ProjectStatusPill'
import { useConfirm } from '../ui/ConfirmDialog'
import { useToast } from '../ui/Toast'

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
  onSave: (body: { name: string; clientId: string | null; currency: Currency }) => void
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
  const [editClientId, setEditClientId] = useState(project.client?.id ?? '')
  const [editCurrency, setEditCurrency] = useState<Currency>(
    (project.currency as Currency) || 'GHS'
  )

  const startEdit = () => {
    setEditName(project.name)
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
    onSave({ name: trimmed, clientId: editClientId || null, currency: editCurrency })
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
    <header className="space-y-3">
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
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Project name"
                aria-label="Project name"
                className="min-h-[44px] flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 sm:max-w-[320px]"
              />
              <select
                value={editClientId}
                onChange={(e) => setEditClientId(e.target.value)}
                aria-label="Client"
                className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">— No client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value as Currency)}
                aria-label="Currency"
                className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="GHS">GHS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={submitEdit}
                  disabled={isUpdating}
                  className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-600/20 transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
                >
                  {isUpdating ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Cancel
                </button>
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
                  <button
                    type="button"
                    onClick={startEdit}
                    className="inline-flex items-center gap-1 rounded font-medium text-primary-600 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit details
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {canDelete && !editing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </header>
  )
}
