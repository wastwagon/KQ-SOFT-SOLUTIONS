import { useState, type ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Badge from '../ui/Badge'

export interface ListToolbarProps {
  search?: ReactNode
  /** Secondary filters — inline on md+, in drawer on small screens when set. */
  filters?: ReactNode
  /** Export and actions — inline on md+, in drawer on small screens when filters exist. */
  actions?: ReactNode
  activeFilterCount?: number
  drawerTitle?: string
  className?: string
  /** Accessible name for the toolbar group. */
  ariaLabel?: string
}

/**
 * List pages (workspace + platform admin): keep PageHeader for title/primary CTA; search + filters here.
 * See docs/UI_CHROME_GUIDE.md.
 */
export default function ListToolbar({
  search,
  filters,
  actions,
  activeFilterCount = 0,
  drawerTitle = 'Filters & actions',
  className = '',
  ariaLabel = 'List filters',
}: ListToolbarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const hasExtras = filters != null || actions != null
  const mobileDrawer = filters != null

  return (
    <>
      <div
        className={`flex flex-col gap-3 sm:flex-row sm:items-center ${search == null && hasExtras ? 'sm:justify-end' : ''} ${className}`}
        role="group"
        aria-label={ariaLabel}
      >
        {search != null && <div className="min-w-0 flex-1">{search}</div>}
        {hasExtras && (
          <>
            <div className="hidden md:flex flex-wrap items-center gap-2 shrink-0">
              {filters}
              {actions}
            </div>
            {mobileDrawer ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="md:hidden shrink-0"
                onClick={() => setDrawerOpen(true)}
                aria-expanded={drawerOpen}
              >
                <SlidersHorizontal className="w-4 h-4 mr-1.5" aria-hidden />
                Filters
                {activeFilterCount > 0 && (
                  <Badge tone="brand" size="sm" shape="soft" className="ml-1.5">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            ) : (
              actions && <div className="flex md:hidden shrink-0 flex-wrap gap-2">{actions}</div>
            )}
          </>
        )}
      </div>

      {mobileDrawer && (
        <Modal
          open={drawerOpen}
          title={drawerTitle}
          onClose={() => setDrawerOpen(false)}
          footer={
            <Button type="button" variant="primary" onClick={() => setDrawerOpen(false)}>
              Done
            </Button>
          }
        >
          <div className="space-y-4">
            {filters && <div className="space-y-2">{filters}</div>}
            {actions && <div className="flex flex-col gap-2 pt-2 border-t border-border">{actions}</div>}
          </div>
        </Modal>
      )}
    </>
  )
}

/** @deprecated Use `ListToolbarProps` */
export type AdminListToolbarProps = ListToolbarProps