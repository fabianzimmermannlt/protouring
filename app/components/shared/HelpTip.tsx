'use client'

import { useState } from 'react'

/**
 * Kleines Hilfe-Icon (Fragezeichen im Kreis). Zeigt den Erklärtext als Tooltip
 * bei Hover (Desktop) bzw. Tap (Touch). Wiederverwendbar für kurze Inline-Hilfen,
 * damit erklärender Fließtext die UI nicht aufbläht.
 */
export function HelpTip({ text, align = 'left', className = '' }: { text: string; align?: 'left' | 'right'; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className={`relative inline-flex align-middle ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Hilfe"
        onClick={e => { e.preventDefault(); setOpen(o => !o) }}
        className="inline-flex items-center justify-center rounded-full font-semibold select-none"
        style={{ width: 15, height: 15, fontSize: 10, lineHeight: 1, border: '1px solid var(--border-strong)', color: 'var(--text-muted)', background: 'transparent', cursor: 'help' }}
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 rounded-md p-2 shadow-lg font-normal normal-case tracking-normal"
          style={{
            bottom: '150%',
            [align === 'right' ? 'right' : 'left']: 0,
            width: 260,
            fontSize: 12,
            lineHeight: 1.4,
            background: 'var(--surface-3)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            whiteSpace: 'normal',
          } as React.CSSProperties}
        >
          {text}
        </span>
      )}
    </span>
  )
}
