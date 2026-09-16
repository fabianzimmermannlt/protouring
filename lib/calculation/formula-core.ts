// Reine (React-/API-freie) Formel- und Zahl-Normalisierung für Betragsfelder der
// Kalkulation. Bewusst ohne weitere Imports außer decimal.js, damit unit-testbar.
// Kein eval – eigener Mini-Parser (rekursiver Abstieg), centgenau via decimal.js.

import Decimal from 'decimal.js'

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
// WICHTIG: Gibt NIE einen ungültigen Zahlen-String zurück. Bei Teil-/Fehleingaben
// (nur ",", ".", "-", "1,2,3" …) → null, damit nachgelagerte new Decimal(...) nicht
// werfen und die Seite abstürzt (mit Verlust ungespeicherter Eingaben).
export function formulaNorm(v: string): string | null {
  const t = v.trim()
  if (t.startsWith('=')) return evalFormula(t)
  const n = t.replace(/,/g, '.')
  if (n === '') return null
  try {
    const d = new Decimal(n)
    return d.isFinite() ? n : null
  } catch {
    return null
  }
}
