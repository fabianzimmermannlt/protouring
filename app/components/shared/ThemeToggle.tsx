'use client'

import { useEffect, useState } from 'react'

// Hell/Dunkel-Umschalter: setzt/entfernt die Klasse `.dark` an <html> (Tailwind
// darkMode: 'class') und merkt sich die Wahl in localStorage. Der No-Flash-Skript
// im Root-Layout wendet die Wahl vor dem ersten Zeichnen an.
export function ThemeToggle({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    if (typeof document !== 'undefined') setDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggle = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('pt-theme', next ? 'dark' : 'light') } catch { /* ignore */ }
    setDark(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? 'Zu Hell-Modus wechseln' : 'Zu Dunkel-Modus wechseln'}
      aria-label="Hell/Dunkel umschalten"
      className={className}
    >
      <span aria-hidden style={{ fontSize: '1rem', lineHeight: 1 }}>{dark ? '☀️' : '🌙'}</span>
      {showLabel && <span style={{ marginLeft: 8 }}>{dark ? 'Hell-Modus' : 'Dunkel-Modus'}</span>}
    </button>
  )
}
