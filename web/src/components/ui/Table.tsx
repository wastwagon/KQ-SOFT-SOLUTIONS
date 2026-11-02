import { createContext, useContext, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes, forwardRef } from 'react'

const TableCompactContext = createContext(false)

export function useTableCompact() {
  return useContext(TableCompactContext)
}

/**
 * Lightweight table primitives aligned with Figma golden-path tables.
 * Pass `compact` for dense admin / reconcile / audit rows on desktop.
 */
export const Table = forwardRef<
  HTMLTableElement,
  HTMLAttributes<HTMLTableElement> & { compact?: boolean }
>(({ className = '', compact = false, children, ...props }, ref) => (
  <TableCompactContext.Provider value={compact}>
    <div className="overflow-x-auto">
      <table ref={ref} className={`min-w-full ${className}`} {...props}>
        {children}
      </table>
    </div>
  </TableCompactContext.Provider>
))
Table.displayName = 'Table'

export const TableHead = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', ...props }, ref) => (
    <thead ref={ref} className={`bg-surface border-b border-border ${className}`} {...props} />
  )
)
TableHead.displayName = 'TableHead'

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', ...props }, ref) => (
    <tbody ref={ref} className={`divide-y divide-border-muted bg-white ${className}`} {...props} />
  )
)
TableBody.displayName = 'TableBody'

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className = '', ...props }, ref) => (
    <tr
      ref={ref}
      className={`hover:bg-gray-50/80 transition-colors ${className}`}
      {...props}
    />
  )
)
TableRow.displayName = 'TableRow'

export const TableTh = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => {
    const compact = useTableCompact()
    return (
      <th
        ref={ref}
        className={`sticky top-0 z-10 bg-surface text-left font-semibold uppercase tracking-wider text-gray-500 ${
          compact ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2.5 text-xs'
        } ${className}`}
        {...props}
      />
    )
  }
)
TableTh.displayName = 'TableTh'

export const TableTd = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => {
    const compact = useTableCompact()
    return (
      <td
        ref={ref}
        className={`text-gray-700 ${compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm'} ${className}`}
        {...props}
      />
    )
  }
)
TableTd.displayName = 'TableTd'
