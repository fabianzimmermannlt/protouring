import { useEffect, useRef } from 'react'

/**
 * Scrollt das modal-body beim Öffnen automatisch nach oben.
 * Gibt einen ref zurück der auf das .modal-body div gesetzt werden muss.
 */
export function useModalScrollReset<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    ref.current?.scrollTo(0, 0)
  }, [])
  return ref
}
