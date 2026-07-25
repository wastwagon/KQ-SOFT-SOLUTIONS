/** Shared Untitled UI–style sidebar nav classes (280px labeled shell). */

export const SIDEBAR_WIDTH = 'w-[280px]'

export const sidebarNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-primary-50 text-primary-700'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
  }`

export const sidebarSectionLabelClass =
  'px-3 pt-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400'
