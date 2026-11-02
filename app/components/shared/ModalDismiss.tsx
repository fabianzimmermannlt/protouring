'use client'

import { useEffect } from 'react'

/**
 * Globales Modal-Schließen: Klick auf den Backdrop (die Overlay-Fläche selbst, nicht den Inhalt)
 * ODER Escape schließt das oberste Modal – app-weit, ohne jedes Modal einzeln zu verdrahten.
 *
 * Erkennt beide Overlay-Konventionen der App: `.modal-overlay` UND Tailwind-Overlays
 * (`fixed inset-0 … bg-black/50`). Ein Backdrop = ein fixed, bildschirmfüllendes Element mit Inhalt.
 *
 * Datenschutz: Beim Öffnen werden die Formularfelder gemerkt; beim Schließen verglichen. Nur bei
 * echten Änderungen (oder window.__pt_isDirty = dirty) kommt „Ungespeicherte Änderungen verwerfen?".
 * Reine Auswahl-Popups (ohne Felder) schließen sofort.
 *
 * Einmalig in app/layout.tsx eingebunden – analog ModalScrollReset.
 */
const snap = new WeakMap<HTMLElement, Map<HTMLElement, string>>()

function isBackdrop(el: HTMLElement | null): el is HTMLElement {
  if (!el || el.nodeType !== 1) return false
  if (el.classList?.contains('modal-overlay')) return true
  let cs: CSSStyleDeclaration
  try { cs = getComputedStyle(el) } catch { return false }
  if (cs.position !== 'fixed' || !el.children.length) return false
  const r = el.getBoundingClientRect()
  if (r.width < window.innerWidth * 0.9 || r.height < window.innerHeight * 0.9) return false
  // Nur echte Overlays: sichtbarer abgedunkelter Hintergrund oder Backdrop-Blur (kein Layout-Container).
  const bg = cs.backgroundColor || ''
  const hasOverlayBg = !!bg && bg !== 'transparent' && !/,\s*0\s*\)\s*$/.test(bg)
  const filt = cs.backdropFilter || (cs as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter || 'none'
  return hasOverlayBg || (filt !== 'none' && !!filt)
}
function allOverlays(): HTMLElement[] {
  const out: HTMLElement[] = []
  document.querySelectorAll<HTMLElement>('.modal-overlay, .fixed').forEach(el => { if (isBackdrop(el)) out.push(el) })
  return out
}
function fieldsOf(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('input, textarea, select')).filter(el => {
    const t = (el as HTMLInputElement).type
    return t !== 'button' && t !== 'submit' && t !== 'reset' && t !== 'file'
  })
}
function valOf(el: HTMLElement): string {
  const inp = el as HTMLInputElement
  if (inp.type === 'checkbox' || inp.type === 'radio') return inp.checked ? '1' : '0'
  return (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value ?? ''
}
function takeSnapshot(overlay: HTMLElement) {
  const m = new Map<HTMLElement, string>()
  for (const el of fieldsOf(overlay)) m.set(el, valOf(el))
  snap.set(overlay, m)
}
function hasChanges(overlay: HTMLElement): boolean {
  const m = snap.get(overlay)
  if (!m) return false
  for (const el of fieldsOf(overlay)) {
    const before = m.get(el)
    if (before === undefined) { if (valOf(el).trim() !== '') return true }   // neues, ausgefülltes Feld
    else if (valOf(el) !== before) return true
  }
  return false
}

export function ModalDismiss() {
  useEffect(() => {
    // Neu erscheinende Overlays nach kurzer Verzögerung snapshotten (React hat dann befüllt).
    const obs = new MutationObserver(muts => {
      for (const mut of muts) for (const node of Array.from(mut.addedNodes)) {
        if (!(node instanceof HTMLElement)) continue
        setTimeout(() => {
          if (!node.isConnected) return
          const cand: HTMLElement[] = []
          if (node.classList?.length || node.children.length) {
            if (isBackdrop(node)) cand.push(node)
            node.querySelectorAll<HTMLElement>('.modal-overlay, .fixed').forEach(el => { if (isBackdrop(el)) cand.push(el) })
          }
          for (const o of cand) if (!snap.has(o)) takeSnapshot(o)
        }, 150)
      }
    })
    obs.observe(document.body, { childList: true, subtree: true })

    const findClose = (overlay: HTMLElement): HTMLElement | null => {
      const explicit = overlay.querySelector<HTMLElement>('[data-modal-close]')
      if (explicit) return explicit
      const header = overlay.querySelector<HTMLElement>('.modal-header button')
      if (header) return header
      const cancel = Array.from(overlay.querySelectorAll<HTMLButtonElement>('button'))
        .find(b => /^(abbrechen|cancel|schlie(ß|ss)en|close)$/i.test((b.textContent || '').trim()))
      if (cancel) return cancel
      // Fallback: der oberste Icon-only-Button (ohne Text, mit SVG) = das „X" im Kopf.
      const iconBtns = Array.from(overlay.querySelectorAll<HTMLButtonElement>('button'))
        .filter(b => b.querySelector('svg') && !(b.textContent || '').trim())
      if (iconBtns.length) return iconBtns.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0]
      return null
    }
    const attemptClose = (overlay: HTMLElement): void => {
      let dirty = hasChanges(overlay)
      if (!dirty) { try { const g = (window as unknown as { __pt_isDirty?: () => boolean }).__pt_isDirty; if (typeof g === 'function' && g()) dirty = true } catch { /* ignore */ } }
      if (dirty && !window.confirm('Ungespeicherte Änderungen verwerfen?')) return
      const btn = findClose(overlay)
      if (btn) btn.click()
    }

    // Backdrop: nur echter Klick auf die Overlay-Fläche selbst (gleicher Start-/Endpunkt, kein Drag).
    let downTarget: EventTarget | null = null
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      downTarget = isBackdrop(t) ? t : null
    }
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (downTarget && t === downTarget && isBackdrop(t)) attemptClose(t)
      downTarget = null
    }
    // Escape: oberstes Modal. stopImmediatePropagation verhindert Doppel-Schließen durch useEscapeKey.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const list = allOverlays()
      if (!list.length) return
      e.stopImmediatePropagation()
      attemptClose(list[list.length - 1])
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('click', onClick, true)
    window.addEventListener('keydown', onKey)
    return () => {
      obs.disconnect()
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [])
  return null
}
