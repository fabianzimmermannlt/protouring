import { useEffect, useRef, useCallback } from 'react'

/**
 * Ruft `fn` sofort auf, dann alle `interval` Millisekunden.
 * Pausiert automatisch wenn der Tab nicht sichtbar ist.
 * Cleanup bei Unmount.
 */
export function usePolling(fn: () => void, interval: number) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  const stableFn = useCallback(() => fnRef.current(), [])

  useEffect(() => {
    stableFn()

    const tick = () => {
      if (document.visibilityState !== 'hidden') stableFn()
    }

    const id = setInterval(tick, interval)
    return () => clearInterval(id)
  }, [stableFn, interval])
}
