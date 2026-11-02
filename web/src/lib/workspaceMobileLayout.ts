/** Workspace mobile tab bar (52px row + padding) — keep floating toolbars aligned with SidebarShell main padding. */
export const WORKSPACE_MOBILE_TAB_BAR_HEIGHT = '4.75rem'

/** Offset from viewport bottom for floating UI above the tab bar. */
export function workspaceMobileTabBarOffset(gap = '0.5rem'): string {
  return `calc(${WORKSPACE_MOBILE_TAB_BAR_HEIGHT} + ${gap} + env(safe-area-inset-bottom, 0px))`
}

/** Must match SidebarShell `pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))]`. */
export function workspaceMobileMainPaddingBottom(): string {
  return `calc(${WORKSPACE_MOBILE_TAB_BAR_HEIGHT} + env(safe-area-inset-bottom, 0px))`
}
