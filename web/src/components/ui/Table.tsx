import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes, forwardRef } from 'react'

/**
 * Lightweight table primitives aligned with Figma golden-path tables.
 * Compose: <Table><TableHead>…</TableHead><TableBody>…</TableBody></Table>
 */

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className = '', children, ...props }, ref) => (
    <div className="overflow-x-auto">
      <table ref={ref} className={`min-w-full ${className}`} {...props}>
        {children}
      </table>
    </div>
  )
)
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
  ({ className = '', ...props }, ref) => (
    <th
      ref={ref}
      className={`px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 ${className}`}
      {...props}
    />
  )
)
TableTh.displayName = 'TableTh'

export const TableTd = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className = '', ...props }, ref) => (
    <td ref={ref} className={`px-6 py-4 text-sm text-gray-700 ${className}`} {...props} />
  )
)
TableTd.displayName = 'TableTd'
