import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function listFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
  )
}

type FocusTrapOptions = {
  /** Element to focus when the trap activates (defaults to first focusable). */
  initialFocusRef?: RefObject<HTMLElement | null>
  /** Element to restore focus to when the trap deactivates. */
  restoreFocusRef?: RefObject<HTMLElement | null>
}

/**
 * Traps Tab/Shift+Tab inside `containerRef` while `active`.
 * Restores focus to `restoreFocusRef` (or the previously focused element) on deactivate.
 */
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  options: FocusTrapOptions = {}
) {
  const { initialFocusRef, restoreFocusRef } = options

  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusInitial = () => {
      const preferred = initialFocusRef?.current
      if (preferred && container.contains(preferred)) {
        preferred.focus()
        return
      }
      const items = listFocusable(container)
      ;(items[0] ?? container).focus()
    }

    // Defer so newly mounted dialog content is in the DOM.
    const t = window.setTimeout(focusInitial, 0)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = listFocusable(container)
      if (items.length === 0) {
        e.preventDefault()
        container.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement
      if (e.shiftKey) {
        if (current === first || !container.contains(current)) {
          e.preventDefault()
          last.focus()
        }
      } else if (current === last || !container.contains(current)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKeyDown)
      const restore = restoreFocusRef?.current ?? previouslyFocused
      if (restore && typeof restore.focus === 'function') {
        restore.focus()
      }
    }
  }, [active, containerRef, initialFocusRef, restoreFocusRef])
}
