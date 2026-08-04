'use client'

// Formel-Eingabe in Betragsfeldern der Kalkulation ("=236+44" → "280").
// Kein eval – eigener Mini-Parser (rekursiver Abstieg), centgenau via decimal.js.
// Persistenz je Feld über einen stabilen data-fkey; die Handler werden per
// Event-Delegation (onBlurCapture/onFocusCapture) an einem Container aufgehängt.

import Decimal from 'decimal.js'
import { useEffect, useRef, type FocusEvent as RFocusEvent } from 'react'
import { setCalcFormula } from '@/lib/api-client'
import type { CalcFormula } from '@/lib/calculation/types'

// "=236+44" → "280", "=(10+2)*3" → "36", "=100*1,19" → "119".
// Erlaubt Ziffern, . , + - * / ( ) sowie ×/x als Malzeichen. null = keine (gültige) Formel.
export function evalFormula(raw: string): string | null {
  let s = raw.trim()
  if (!s.startsWith('=')) return null
  s = s.slice(1).replace(/[×x·∙]/gi, '*').replace(/[–—]/g, '-').replace(/\s+/g, '').replace(/,/g, '.')
  if (s === '' || !/^[0-9.+\-*/()]+$/.test(s)) return null
  let i = 0
  const cur = () => s[i]
  function factor(): Decimal | null {
    if (cur() === '+') { i++; return factor() }
    if (cur() === '-') { i++; const f = factor(); return f == null ? null : f.neg() }
    if (cur() === '(') {
      i++; const e = expr()
      if (e == null || cur() !== ')') return null
      i++; return e
    }
    let j = i
    while (j < s.length && /[0-9.]/.test(s[j])) j++
    const tok = s.slice(i, j)
    if (tok === '' || tok === '.' || (tok.match(/\./g) || []).length > 1) return null
    i = j
    try { return new Decimal(tok) } catch { return null }
  }
  function term(): Decimal | null {
    let left = factor(); if (left == null) return null
    while (cur() === '*' || cur() === '/') {
      const op = s[i++]; const r = factor(); if (r == null) return null
      if (op === '/' && r.isZero()) return null
      left = op === '*' ? left.times(r) : left.div(r)
    }
    return left
  }
  function expr(): Decimal | null {
    let left = term(); if (left == null) return null
    while (cur() === '+' || cur() === '-') {
      const op = s[i++]; const r = term(); if (r == null) return null
      left = op === '+' ? left.plus(r) : left.minus(r)
    }
    return left
  }
  const out = expr()
  if (out == null || i !== s.length) return null
  return out.toDecimalPlaces(4).toString()
}

// norm() für Betragsfelder: Formel auswerten, sonst Komma→Punkt. Leer = null.
export function formulaNorm(v: string): string | null {
  const t = v.trim()
  if (t.startsWith('=')) return evalFormula(t)
  const n = t.replace(',', '.')
  return n === '' ? null : n
}

// Setzt den Wert eines React-kontrollierten <input> so, dass Reacts onChange feuert
// (prototype value-Setter umgeht Reacts Value-Tracker → Change wird erkannt).
export function setInputValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

type FormulaMap = Map<string, { formula: string; result: string }>

// Liefert die beiden Delegation-Handler für einen Container. blur: Formel →
// Ergebnis einsetzen + dauerhaft speichern (bzw. verworfene Formel löschen).
// focus: gemerkte Formel wieder einblenden (nur solange Wert == Ergebnis).
// Betroffen sind nur Betragsfelder (inputMode="decimal") mit data-fkey.
export function useFormulaFields(projectId: string, formulas: CalcFormula[] | undefined) {
  const mapRef = useRef<FormulaMap>(new Map())
  const projRef = useRef<string | null>(null)
  useEffect(() => {
    // Einmal je Projekt aus dem Dataset initialisieren; danach imperativ pflegen,
    // damit zwischenzeitliche Reloads eine frische Formel nicht verwerfen.
    if (projRef.current === projectId) return
    projRef.current = projectId
    const m: FormulaMap = new Map()
    for (const f of formulas ?? []) m.set(f.fkey, { formula: f.formula, result: f.result })
    mapRef.current = m
  }, [projectId, formulas])

  const onFormulaBlur = (e: RFocusEvent) => {
    const el = e.target as HTMLElement
    if (!(el instanceof HTMLInputElement) || el.inputMode !== 'decimal') return
    const fkey = el.dataset.fkey
    const raw = el.value
    const r = evalFormula(raw)
    if (r != null && r !== raw) {
      if (fkey) {
        mapRef.current.set(fkey, { formula: raw, result: r })
        setCalcFormula(projectId, fkey, raw, r).catch(() => {})
      }
      setInputValue(el, r)
      return
    }
    if (fkey) {
      const stored = mapRef.current.get(fkey)
      if (stored && stored.result !== raw) {
        mapRef.current.delete(fkey)
        setCalcFormula(projectId, fkey, null, '').catch(() => {})
      }
    }
  }
  const onFormulaFocus = (e: RFocusEvent) => {
    const el = e.target as HTMLElement
    if (!(el instanceof HTMLInputElement) || el.inputMode !== 'decimal') return
    const fkey = el.dataset.fkey
    const stored = fkey ? mapRef.current.get(fkey) : undefined
    if (!stored || el.value !== stored.result) return
    setInputValue(el, stored.formula)
    const f = stored.formula
    requestAnimationFrame(() => { try { el.setSelectionRange(f.length, f.length) } catch { /* egal */ } })
  }
  return { onFormulaBlur, onFormulaFocus }
}
