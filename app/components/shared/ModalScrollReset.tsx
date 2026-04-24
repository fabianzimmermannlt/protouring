'use client'

import { useEffect } from 'react'

/**
 * Globaler MutationObserver: Wenn ein .modal-body ins DOM kommt,
 * wird es sofort nach oben gescrollt.
 * Einmalig in app/layout.tsx eingebunden — kein manuelles Handling in jedem Modal.
 */
export function ModalScrollReset() {
  useEffect(() => {
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue
          // Direkt ein modal-body?
          if (node.classList.contains('modal-body')) {
            node.scrollTop = 0
          }
          // Oder modal-body darin?
          const body = node.querySelector('.modal-body')
          if (body instanceof HTMLElement) {
            body.scrollTop = 0
          }
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
