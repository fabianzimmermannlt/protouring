'use client'

import { useState, useEffect } from 'react'

// Zahlen-Eingabefeld mit deutscher Formatierung.
// - decimals=0  -> Ganzzahl (z.B. Kapazität 25.000)
// - decimals=2  -> Geldbetrag (z.B. 20,50 / 25.000,00)
// Verhalten: beim Tippen "plain" (ohne Tausenderpunkte, Komma als Dezimal, max `decimals` Stellen),
// beim Verlassen (blur) formatiert mit Tausenderpunkten. So bleibt der Cursor beim Tippen stabil.

function fmtGrouped(n: number | null, decimals: number, grouping: boolean): string {
  if (n === null || !Number.isFinite(n)) return ''
  return n.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouping })
}

function fmtPlain(n: number | null, decimals: number): string {
  if (n === null || !Number.isFinite(n)) return ''
  return n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: decimals, useGrouping: false })
}

function parseDe(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  const n = parseFloat(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function NumericInput({
  value, onCommit, decimals = 0, grouping = true, className, placeholder, readOnly, id,
}: {
  value: number | null
  onCommit: (v: number | null) => void
  decimals?: number
  grouping?: boolean
  className?: string
  placeholder?: string
  readOnly?: boolean
  id?: string
}) {
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState(() => fmtGrouped(value, decimals, grouping))

  // Externe Wertänderung übernehmen, solange nicht gerade getippt wird
  useEffect(() => {
    if (!focused) setText(fmtGrouped(value, decimals, grouping))
  }, [value, focused, decimals, grouping])

  const handleChange = (raw: string) => {
    let s = raw.replace(/[^\d.,]/g, '')
    if (decimals > 0) {
      s = s.replace(/\./g, ',')               // Punkt-Eingabe als Dezimalkomma akzeptieren
      const i = s.indexOf(',')
      if (i !== -1) {
        const intPart = s.slice(0, i).replace(/,/g, '')
        const dec = s.slice(i + 1).replace(/,/g, '').slice(0, decimals)  // max. `decimals` Nachkommastellen
        s = intPart + ',' + dec
      }
    } else {
      s = s.replace(/[.,]/g, '')              // Ganzzahl: keine Dezimalzeichen
    }
    setText(s)
  }

  const handleFocus = () => { setFocused(true); setText(fmtPlain(value, decimals)) }
  const handleBlur = () => {
    setFocused(false)
    const n = parseDe(text)
    setText(fmtGrouped(n, decimals, grouping))
    onCommit(n)
  }

  return (
    <input
      id={id}
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      className={className}
      value={text}
      placeholder={placeholder ?? (decimals > 0 ? '0,00' : '')}
      readOnly={readOnly}
      onFocus={readOnly ? undefined : handleFocus}
      onChange={e => handleChange(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}
