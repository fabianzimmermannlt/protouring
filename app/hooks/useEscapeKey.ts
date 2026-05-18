import { useEffect } from 'react'

/**
 * Calls `onEscape` when the Escape key is pressed.
 * Use in modals, pickers, and overlays.
 */
export function useEscapeKey(onEscape: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onEscape])
}
