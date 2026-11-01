'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { getAccordionMode, ACCORDION_OPEN_EVENT } from '@/app/lib/accordionMode'

interface Props {
  title: string
  defaultOpen?: boolean
  headerActions?: React.ReactNode
  children: React.ReactNode
  /** Eindeutiger Key → Zustand wird in localStorage gespeichert */
  stateKey?: string
  /** Gruppe für den Exklusiv-Modus: beim Öffnen schließen sich nur Akkordeons
   *  derselben Gruppe. Standard: „default" (ein Set pro Seite). */
  group?: string
  /** Optionaler eigener Titel-Inhalt (statt Uppercase-Label), z. B. „Rolle — Name". */
  titleContent?: React.ReactNode
  className?: string
  /** Innenabstand des Inhaltsbereichs (damit Kacheln nicht am Rand kleben), z. B. "p-4". */
  bodyClassName?: string
}

export function AccordionSection({ title, defaultOpen = false, headerActions, stateKey, group = 'default', titleContent, className = '', bodyClassName = '', children }: Props) {
  const [open, setOpen] = useState(() => {
    if (stateKey && typeof window !== 'undefined') {
      const stored = localStorage.getItem(`accordion_${stateKey}`)
      if (stored !== null) return stored === 'true'
    }
    return defaultOpen
  })

  const selfId = stateKey || title

  // Exklusiv-Modus: schließt sich, wenn ein anderes Akkordeon derselben Gruppe öffnet.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent).detail as { group?: string; id?: string } | undefined
      if (!d || d.group !== group || d.id === selfId) return
      setOpen(prev => {
        if (prev && stateKey && typeof window !== 'undefined') {
          try { localStorage.setItem(`accordion_${stateKey}`, 'false') } catch { /* ignore */ }
        }
        return false
      })
    }
    window.addEventListener(ACCORDION_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(ACCORDION_OPEN_EVENT, onOpen)
  }, [group, selfId, stateKey])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (stateKey && typeof window !== 'undefined') {
      localStorage.setItem(`accordion_${stateKey}`, String(next))
    }
    // Beim Öffnen im Exklusiv-Modus die anderen der Gruppe schließen.
    if (next && typeof window !== 'undefined' && getAccordionMode() === 'exclusive') {
      window.dispatchEvent(new CustomEvent(ACCORDION_OPEN_EVENT, { detail: { group, id: selfId } }))
    }
  }

  return (
    <div className={`border overflow-hidden ${className}`} style={{ background: 'var(--surface)', borderColor: 'var(--border)', borderRadius: 0 }}>
      <div className="flex items-center">
        <button
          onClick={toggle}
          aria-label={title}
          className="flex-1 flex items-center justify-between px-4 py-3 text-left min-w-0"
        >
          {titleContent
            ? <span className="min-w-0 truncate" style={{ color: 'var(--text)' }}>{titleContent}</span>
            : <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{title}</span>}
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-muted)' }}
          />
        </button>
        {headerActions && (
          <div className="pr-3 flex items-center flex-shrink-0" onClick={e => e.stopPropagation()}>
            {headerActions}
          </div>
        )}
      </div>
      {open && <div className={bodyClassName} style={{ borderTop: '1px solid var(--border)' }}>{children}</div>}
    </div>
  )
}
