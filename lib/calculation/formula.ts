'use client'

// Formel-Eingabe in Betragsfeldern der Kalkulation ("=236+44" → "280").
// Kein eval – eigener Mini-Parser (rekursiver Abstieg), centgenau via decimal.js.
// Persistenz je Feld über einen stabilen data-fkey; die Handler werden per
// Event-Delegation (onBlurCapture/onFocusCapture) an einem Container aufgehängt.

import { useEffect, useRef, type FocusEvent as RFocusEvent } from 'react'
import { setCalcFormula } from '@/lib/api-client'
import type { CalcFormula } from '@/lib/calculation/types'
import { evalFormula, formulaNorm } from '@/lib/calculation/formula-core'

// Reine Formel-/Zahl-Normalisierung liegt in formula-core.ts (React-/API-frei, unit-testbar);
// hier nur re-exportieren, damit bestehende Importe aus '@/lib/calculation/formula' weiter gehen.
export { evalFormula, formulaNorm }

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

  // Feldwerte werden deutsch (Komma) angezeigt; Ergebnisvergleiche daher zahl-normalisiert
  // (Punkt/Komma egal), damit auch Altbestand mit Punkt-Ergebnis noch die Formel wiedereinblendet.
  const sameNum = (a: string, b: string) => a.replace(',', '.') === b.replace(',', '.')
  const onFormulaBlur = (e: RFocusEvent) => {
    const el = e.target as HTMLElement
    if (!(el instanceof HTMLInputElement) || el.inputMode !== 'decimal') return
    const fkey = el.dataset.fkey
    const raw = el.value
    const r = evalFormula(raw)
    if (r != null && r !== raw) {
      const rDisp = r.replace('.', ',')   // Ergebnis deutsch anzeigen (Komma)
      if (fkey) {
        mapRef.current.set(fkey, { formula: raw, result: rDisp })
        setCalcFormula(projectId, fkey, raw, rDisp).catch(() => {})
      }
      setInputValue(el, rDisp)
      return
    }
    if (fkey) {
      const stored = mapRef.current.get(fkey)
      if (stored && !sameNum(stored.result, raw)) {
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
    if (!stored || !sameNum(el.value, stored.result)) return
    setInputValue(el, stored.formula)
    const f = stored.formula
    requestAnimationFrame(() => { try { el.setSelectionRange(f.length, f.length) } catch { /* egal */ } })
  }
  return { onFormulaBlur, onFormulaFocus }
}
