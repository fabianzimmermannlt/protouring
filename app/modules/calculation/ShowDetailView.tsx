'use client'

// Kalkulation – Show-Detail als Bereichs-Tabelle (Phase 3).
// Je Bereich: Zeilen = Positionen (auch neue anlegbar), Spalten = Soll je Variante
// (+ „gleich in allen Varianten"), dazu ein Ist-Wert pro Position/Show.
// Ist in calc_actuals (pro Position/Show), Soll in calc_entries (je Variante).

import { useEffect, useMemo, useState, type FocusEvent as RFocusEvent } from 'react'
import Decimal from 'decimal.js'
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, PencilIcon, PlusIcon, TrashIcon, LinkIcon, TruckIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline'
import {
  createCalcPosition, updateCalcPosition, deleteCalcPosition, replaceCalcEntries, copyCalcEntriesToShows, setCalcActual, setCalcOverheadShow, getActiveFunctions, saveFunctionCatalog,
  getVehicles, createVehicle, lockCalcShow, unlockCalcShow, type Vehicle, type CalcEntryInput,
} from '@/lib/api-client'
import { buildAbrechnung, type AbrechnungSnapshot } from '@/lib/calculation/abrechnung'
import AbrechnungView from './AbrechnungView'

interface FuncGroup { group: string; names: string[] }
import type { CalcDataset, CalcShow, CalcProject, CalcEntry } from '@/lib/calculation/types'
import { buildOverview, entryAmount } from '@/lib/calculation/engine'
import { formatEUR, formatMoney, formatDate } from '@/lib/calculation/format'
import { ShowFormModal } from './ShowsView'
import SearchableDropdown from '@/app/components/shared/SearchableDropdown'

// Sichere Formel-Eingabe in Betragsfeldern: "=236+44" → "280", "=(10+2)*3" → "36".
// Kein eval – eigener Mini-Parser (rekursiver Abstieg), centgenau via decimal.js.
// Erlaubt sind nur Ziffern, . , + - * / ( ) sowie ×/x als Malzeichen.
// Rückgabe: Ergebnis als String, oder null wenn keine (gültige) Formel.
function evalFormula(raw: string): string | null {
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

const norm = (v: string): string | null => {
  const t = v.trim()
  if (t.startsWith('=')) return evalFormula(t)        // Formel → Ergebnis (null wenn ungültig)
  const n = t.replace(',', '.')
  return n === '' ? null : n
}
const numStr = (d: Decimal): string => d.toDecimalPlaces(4).toString()

// Löst eine Formel-Eingabe in einem React-kontrollierten <input> beim Verlassen auf:
// setzt den Ergebniswert so, dass Reacts onChange feuert (Anzeige + State werden
// zum Ergebnis). Gilt nur für Betragsfelder (inputMode="decimal"); ungültige oder
// Nicht-Formeln bleiben unverändert. Ein einziger Handler am Container deckt alle
// Betragsfelder ab.
function setInputValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))   // damit Reacts onChange feuert
}
function resolveFormulaBlur(e: RFocusEvent) {
  const el = e.target as HTMLElement
  if (!(el instanceof HTMLInputElement) || el.inputMode !== 'decimal') return
  const formula = el.value
  const r = evalFormula(formula)
  if (r == null || r === formula) return
  el.dataset.formula = formula        // Formel merken – beim erneuten Fokus wieder zeigen
  el.dataset.formulaResult = r
  setInputValue(el, r)
}
// Beim Hineinklicken in ein Betragsfeld die zuletzt eingegebene Formel wieder
// einblenden (spreadsheet-artig), damit man sie nachvollziehen/erweitern kann.
// Nur wenn der Wert noch dem Ergebnis entspricht (also nicht manuell geändert).
function restoreFormulaFocus(e: RFocusEvent) {
  const el = e.target as HTMLElement
  if (!(el instanceof HTMLInputElement) || el.inputMode !== 'decimal') return
  const f = el.dataset.formula
  if (!f || el.value !== el.dataset.formulaResult) return
  setInputValue(el, f)
  requestAnimationFrame(() => { try { el.setSelectionRange(f.length, f.length) } catch { /* egal */ } })
}

// UI-Präferenz (Name/Spezifikation-Häkchen) projektweit merken – gilt für alle
// Shows und übersteht das Verlassen/Wiederkommen (localStorage).
const readPref = (key: string, def: boolean): boolean => {
  if (typeof window === 'undefined') return def
  const v = window.localStorage.getItem(key)
  return v == null ? def : v === '1'
}
const writePref = (key: string, val: boolean) => {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, val ? '1' : '0')
}

// Registry offener (ungespeicherter) Zeilen → globales window.__pt_isDirty,
// dasselbe Flag, das der L2-Nav-Guard (Popup) und beforeunload auswerten.
const dirtyRows = new Set<string>()
function markRowDirty(key: string, dirty: boolean) {
  if (dirty) dirtyRows.add(key); else dirtyRows.delete(key)
  ;(window as unknown as { __pt_isDirty?: boolean }).__pt_isDirty = dirtyRows.size > 0
}
const hv = (v: unknown) => v != null && v !== ''
const entryHasValue = (e: CalcEntry): boolean => hv(e.amount) || hv(e.quantity) || hv(e.distance_km) || hv(e.rental_price)

// Werte einer Position in ALLE aktiven, nicht gesperrten Shows kopieren (mit Warnung).
async function copyRowToAllShows(dataset: CalcDataset, showId: string, positionId: string, entries: CalcEntryInput[], onDone: () => void): Promise<boolean> {
  if (entries.length === 0) { alert('Keine Werte in dieser Zeile zum Kopieren.'); return false }
  const hasVals = (sid: string) => dataset.entries.some(e => e.show_id === sid && e.position_id === positionId && (hv(e.amount) || hv(e.quantity) || hv(e.distance_km) || hv(e.rental_price) || hv(e.nights)))
  const others = dataset.shows.filter(s => s.is_active && !s.locked && s.id !== showId && hasVals(s.id))
  if (others.length && !confirm(`${others.length} weitere Show(s) haben in dieser Position bereits Werte.\n\nMit den Werten dieser Show überschreiben?`)) return false
  await copyCalcEntriesToShows(positionId, entries)
  onDone()
  return true
}

// Tab springt spaltenweise nach unten: Inputs mit gleichem data-calc-col in DOM-
// Reihenfolge; Tab → nächstes Feld unten, Shift+Tab → oben. Erleichtert die Eingabe.
type GridKE = { key: string; shiftKey: boolean; currentTarget: HTMLInputElement; preventDefault: () => void }
function gridTabDown(e: GridKE, col: string) {
  if (e.key !== 'Tab') return
  const nodes = Array.from(document.querySelectorAll<HTMLInputElement>(`input[data-calc-col="${col}"]`))
  const i = nodes.indexOf(e.currentTarget)
  if (i < 0) return
  const next = nodes[i + (e.shiftKey ? -1 : 1)]
  if (next) { e.preventDefault(); next.focus(); next.select() }
}

/** Schützt vor hängenden Requests: bricht nach ms mit Fehler ab. */
function withTimeout<T>(p: Promise<T>, ms = 15000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Zeitüberschreitung – bitte erneut versuchen (Verbindung?).')), ms)),
  ])
}

interface Variant { id: string; name: string }

export default function ShowDetailView({ show, dataset, onChanged, onBack, onPrev, onNext }: {
  show: CalcShow; dataset: CalcDataset; onChanged: () => void; onBack: () => void
  onPrev?: () => void; onNext?: () => void
}) {
  const [editParams, setEditParams] = useState(false)
  const project = dataset.project
  const variants: Variant[] = useMemo(() => [...dataset.variants].sort((a, b) => a.sort_order - b.sort_order), [dataset])
  const categories = useMemo(() => [...dataset.categories].sort((a, b) => a.sort_order - b.sort_order), [dataset])

  // Funktionskatalog (Settings/Kontakte) – aktive Funktionen inkl. custom. Neu angelegte
  // Funktionen werden zurück in den Katalog geschrieben → konsistent mit Settings/Kontakte.
  const [functions, setFunctions] = useState<FuncGroup[]>([])
  const [activeNames, setActiveNames] = useState<string[]>([])
  const loadFunctions = () => {
    getActiveFunctions().then(active => {
      const byGroup: Record<string, string[]> = {}
      active.forEach(f => { if (!byGroup[f.group]) byGroup[f.group] = []; byGroup[f.group].push(f.name) })
      setFunctions(Object.keys(byGroup).map(group => ({ group, names: byGroup[group] })))
      setActiveNames(active.map(f => f.name))
    }).catch(() => {})
  }
  // Fahrzeuge (App-Fuhrpark) für den Transport-Bereich; neu angelegte werden zurückgeschrieben.
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const loadVehicles = () => { getVehicles().then(setVehicles).catch(() => {}) }
  useEffect(() => { loadFunctions(); loadVehicles() }, [])
  // Vor Reload/Schließen warnen, solange ungespeicherte Zeilen offen sind;
  // beim Verlassen der Show-Ansicht das Dirty-Flag sicher zurücksetzen.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if ((window as unknown as { __pt_isDirty?: boolean }).__pt_isDirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', h)
    return () => {
      window.removeEventListener('beforeunload', h)
      dirtyRows.clear()
      ;(window as unknown as { __pt_isDirty?: boolean }).__pt_isDirty = false
    }
  }, [])

  const [resultVar, setResultVar] = useState<string>(project.default_variant_id ?? variants[0]?.id ?? '')

  const summary = useMemo(() => {
    // Zusammenfassung (Gage netto / Ausgaben / Ergebnis) folgt der gewählten
    // Ergebnis-Variante; bei „Ist" auf die Standardvariante zurückfallen.
    const vid = (resultVar && resultVar !== 'ist') ? resultVar : (project.default_variant_id ?? variants[0]?.id ?? null)
    const ov = buildOverview(dataset, { variantId: vid })
    return ov.shows.find(s => s.showId === show.id)
  }, [dataset, show.id, resultVar, project.default_variant_id, variants])

  // ── Sperren / Abrechnung ──
  const chosenVariant = (resultVar && resultVar !== 'ist') ? resultVar : (project.default_variant_id ?? variants[0]?.id ?? null)
  const [busyLock, setBusyLock] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [pinErr, setPinErr] = useState('')
  const lockedSnap = useMemo<AbrechnungSnapshot | null>(() => {
    if (!show.locked || !show.snapshot) return null
    try { const s = JSON.parse(show.snapshot) as AbrechnungSnapshot; return { ...s, lockedAt: show.locked_at ?? null } } catch { return null }
  }, [show.locked, show.snapshot, show.locked_at])

  const doLock = async () => {
    const snap = buildAbrechnung(dataset, show, chosenVariant)
    if (!confirm(`Show mit Variante „${snap.variantName}" sperren und abrechnen?\n\nDanach ist die Show schreibgeschützt (Abrechnung eingefroren). Entsperren nur mit PIN.`)) return
    setBusyLock(true)
    try { await lockCalcShow(show.id, snap); onChanged() } catch (e: any) { alert(e?.message ?? 'Fehler beim Sperren'); setBusyLock(false) }
  }
  const doUnlock = async () => {
    setPinErr('')
    try { await unlockCalcShow(show.id, pin); setUnlockOpen(false); setPin(''); onChanged() }
    catch (e: any) { setPinErr(e?.message ?? 'Entsperren fehlgeschlagen') }
  }

  return (
    <div onBlurCapture={resolveFormulaBlur} onFocusCapture={restoreFormulaFocus}>
      <div className="flex items-start gap-3"
        style={{ position: 'sticky', top: 0, zIndex: 40, background: '#1c1c1c',
          marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20,
          paddingTop: 13, paddingBottom: 13, marginBottom: 12, borderBottom: '1px solid #2a2a2a',
          // oberes Padding-Band des Scroll-Containers (p-5 = 20px) mit Vollfarbe abdecken,
          // damit beim Scrollen keine Tabellenzeilen darüber durchscheinen; + weicher Schlagschatten unten
          boxShadow: '0 -22px 0 0 #1c1c1c, 0 8px 12px -8px rgba(0,0,0,0.8)' }}>
        <button onClick={onBack} className="btn btn-ghost shrink-0" style={{ fontSize: '0.8rem' }}>
          <ArrowLeftIcon className="w-4 h-4" /> Zurück
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onPrev} disabled={!onPrev} className="btn btn-ghost" title="Vorherige Show"
            style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem', opacity: onPrev ? 1 : 0.35, cursor: onPrev ? 'pointer' : 'not-allowed' }}>
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <button onClick={onNext} disabled={!onNext} className="btn btn-ghost" title="Nächste Show"
            style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem', opacity: onNext ? 1 : 0.35, cursor: onNext ? 'pointer' : 'not-allowed' }}>
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1" style={{ minWidth: 0 }}>
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-base font-semibold" style={{ color: '#e0e0e0' }}>
              {show.city || '(ohne Stadt)'}{show.show_date ? ` · ${formatDate(show.show_date)}` : ''}{show.venue ? ` · ${show.venue}` : ''}
            </h3>
            {!show.locked && (
              <>
                <button onClick={() => setEditParams(true)} className="btn btn-ghost" style={{ fontSize: '0.8rem' }}>
                  <PencilIcon className="w-3.5 h-3.5" /> Parameter
                </button>
                <label className="text-xs flex items-center gap-1.5" style={{ color: '#9ca3af' }}>
                  Ergebnis-Spalte:
                  <select className="form-input" style={{ fontSize: '0.75rem', padding: '2px 6px' }} value={resultVar} onChange={e => setResultVar(e.target.value)}>
                    {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    <option value="ist">Ist</option>
                  </select>
                </label>
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              {show.locked ? (
                <>
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#3a2f22', color: '#e0b877' }}>🔒 Abgerechnet</span>
                  <button onClick={() => window.print()} className="btn btn-ghost" style={{ fontSize: '0.78rem' }}>Drucken</button>
                  <button onClick={() => setUnlockOpen(true)} className="btn btn-ghost" style={{ fontSize: '0.78rem' }}>Entsperren</button>
                </>
              ) : (
                <button onClick={doLock} disabled={busyLock} className="btn btn-primary" style={{ fontSize: '0.78rem' }}>{busyLock ? '…' : '🔒 Sperren & abrechnen'}</button>
              )}
            </div>
          </div>
          {!show.locked && summary && (
            <div className="text-xs flex gap-4 mt-1" style={{ color: '#9ca3af' }}>
              <span>Gage netto: <b style={{ color: '#e0e0e0' }}>{formatEUR(summary.gageNet)}</b></span>
              <span>Ausgaben: <b style={{ color: '#e0e0e0' }}>{formatEUR(summary.ausgaben)}</b></span>
              <span>Ergebnis: <b style={{ color: summary.ergebnis.isNegative() ? '#f87171' : '#4ade80' }}>{formatEUR(summary.ergebnis)}</b></span>
            </div>
          )}
        </div>
      </div>
      {show.locked && lockedSnap ? (
        <AbrechnungView snap={lockedSnap} />
      ) : (
        <>
          <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
            🔗 = ein gemeinsamer Soll-Wert für alle Varianten (Standard). Zum Auflösen aufs 🔗 klicken → je Variante ein eigenes Feld (der Wert bleibt erhalten, u.a. bei Var 1). „Ist" = tatsächliche Rechnung (für die Abrechnung).
          </p>
          <div className="space-y-4">
            {categories.map(cat => (
              <CategoryTable key={cat.id} show={show} dataset={dataset} project={project}
                category={cat} variants={variants} onChanged={onChanged}
                functions={functions} activeNames={activeNames} reloadFunctions={loadFunctions}
                vehicles={vehicles} reloadVehicles={loadVehicles} resultVar={resultVar} />
            ))}
          </div>
        </>
      )}

      {editParams && (
        <ShowFormModal projectId={project.id} show={show}
          onClose={() => setEditParams(false)} onSaved={() => { setEditParams(false); onChanged() }} />
      )}

      {unlockOpen && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: 400 }}>
            <div className="modal-header"><h3 className="modal-title">Show entsperren</h3><button onClick={() => { setUnlockOpen(false); setPin(''); setPinErr('') }} className="text-gray-400 hover:text-white">✕</button></div>
            <div className="modal-body space-y-3">
              <div className="text-xs" style={{ color: '#facc15', background: '#332', border: '1px solid #5a4', borderRadius: 6, padding: '8px 10px' }}>
                ⚠️ Superadmin: Entsperren verwirft den eingefrorenen Abrechnungs-Snapshot. Die Show wird wieder editierbar. Nur für Korrekturen/Tests.
              </div>
              <label className="form-label">PIN</label>
              <input type="password" inputMode="numeric" className="form-input" value={pin} autoFocus
                onChange={e => setPin(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') doUnlock() }} placeholder="••••" />
              {pinErr && <p className="text-xs" style={{ color: '#fca5a5' }}>{pinErr}</p>}
            </div>
            <div className="modal-footer flex justify-end gap-2">
              <button onClick={() => { setUnlockOpen(false); setPin(''); setPinErr('') }} className="btn btn-ghost">Abbrechen</button>
              <button onClick={doUnlock} className="btn btn-primary">Entsperren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Bereichs-Tabelle ─────────────────────────────────────────────────────────

function CategoryTable({ show, dataset, project, category, variants, onChanged, functions, activeNames, reloadFunctions, vehicles, reloadVehicles, resultVar }: {
  show: CalcShow; dataset: CalcDataset; project: CalcProject
  category: { id: string; name: string; kind: string }; variants: Variant[]; onChanged: () => void
  functions: FuncGroup[]; activeNames: string[]; reloadFunctions: () => void
  vehicles: Vehicle[]; reloadVehicles: () => void; resultVar: string
}) {
  const catPositions = useMemo(
    () => dataset.positions.filter(p => p.category_id === category.id).sort((a, b) => a.sort_order - b.sort_order),
    [dataset, category.id])
  // Jede angelegte Position erscheint in ALLEN Shows (leer/0), damit nichts vergessen
  // wird. Übergeordnete Posten werden separat (read-only) gerendert → hier ausblenden.
  const rowPositions = catPositions.filter(p => !p.is_overhead)
  const isPersonal = /personal/i.test(category.name)   // Personal: Funktionen statt Positionsliste
  const isUnterkunft = /unterkunft|verpflegung/i.test(category.name)   // nur hier: Hotel-Option
  const isTransport = /transport|logistik|fahrzeug/i.test(category.name) // hier: App-Fahrzeuge
  // Name/Spezifikation jetzt in ALLEN Bereichen (Häkchen in der Bereichs-Titelzeile),
  // gemerkt PRO BEREICH (nicht global!) und über alle Shows/Events hinweg – sonst
  // überschreibt ein Bereich (z.B. Hotel) den Haken eines anderen (Personal).
  const specKey = `pt_calc_show_spec_${category.id}`
  const nameKey = `pt_calc_show_name_${category.id}`
  const [showSpec, setShowSpec] = useState(() => readPref(specKey, true))
  const [showName, setShowName] = useState(() => readPref(nameKey, false))
  useEffect(() => { writePref(specKey, showSpec) }, [specKey, showSpec])
  useEffect(() => { writePref(nameKey, showName) }, [nameKey, showName])

  // Sortierung per 6-Punkte-Griff (Drag & Drop) innerhalb des Bereichs
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const endDrag = () => { setDragId(null); setDragOverId(null) }
  const reorderTo = async (targetId: string) => {
    const src = dragId
    endDrag()
    if (!src || src === targetId) return
    const order = catPositions.map(p => p.id)
    const from = order.indexOf(src)
    if (from < 0 || order.indexOf(targetId) < 0) return
    order.splice(from, 1)
    order.splice(order.indexOf(targetId), 0, src)   // src vor Ziel einfügen
    const updates = order
      .map((id, i) => ({ id, i, cur: catPositions.find(p => p.id === id) }))
      .filter(x => x.cur && x.cur.sort_order !== x.i)
    try {
      await Promise.all(updates.map(x => updateCalcPosition(x.id, { sort_order: x.i })))
      onChanged()
    } catch { /* Sortierung nicht kritisch */ }
  }

  const [adding, setAdding] = useState(false)

  const colCount = 2 + variants.length + 2
  // Festes Spaltenraster → alle Bereichs-Tabellen richten die Felder bündig untereinander aus.
  const COLW = { pos: 480, variant: 245, ist: 230, erg: 145, act: 120 }
  const tableWidth = COLW.pos + variants.length * COLW.variant + COLW.ist + COLW.erg + COLW.act
  // Übergeordnete Kosten dieses Bereichs → read-only Umlage-Zeile in der Show
  const activeShowsList = useMemo(() => dataset.shows.filter(s => s.is_active), [dataset])
  const overheadItems = useMemo(
    () => dataset.positions.filter(p => p.is_overhead && p.category_id === category.id).slice().sort((a, b) => a.sort_order - b.sort_order),
    [dataset, category.id])
  const overheadExcluded = (posId: string, showId: string) => (dataset.overheadExclude ?? []).some(x => x.position_id === posId && x.show_id === showId)
  const showTravel = isPersonal                        // Reisekosten nur beim Personal
  const defaultVar = resultVar || project.default_variant_id || variants[0]?.id || ''
  const defaultVarName = defaultVar === 'ist' ? 'Ist' : (variants.find(v => v.id === defaultVar)?.name ?? '')

  return (
    <div>
    <div className="pt-card">
      <div className="pt-card-header flex items-center justify-between"
        style={{ background: category.kind === 'income' ? '#173a28' : '#26313f', borderLeft: `4px solid ${category.kind === 'income' ? '#4ade80' : '#60a5fa'}` }}>
        <span className="pt-card-title" style={{ color: '#e5e7eb', letterSpacing: '0.02em' }}>
          <span style={{ fontWeight: 700, color: category.kind === 'income' ? '#4ade80' : '#93c5fd' }}>{category.kind === 'income' ? 'EINNAHME' : 'AUSGABE'}</span>
          <span style={{ opacity: 0.55, fontWeight: 400 }}> · </span>{category.name}
        </span>
        <div className="flex items-center gap-3">
          <label className="text-xs flex items-center gap-1.5 cursor-pointer select-none" style={{ color: '#9ca3af' }}>
            <input type="checkbox" checked={showSpec} onChange={e => setShowSpec(e.target.checked)} /> Spezifikation
          </label>
          <label className="text-xs flex items-center gap-1.5 cursor-pointer select-none" style={{ color: '#9ca3af' }}>
            <input type="checkbox" checked={showName} onChange={e => setShowName(e.target.checked)} /> Name
          </label>
        </div>
      </div>
      <div className="pt-card-body" style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ tableLayout: 'fixed', width: tableWidth, minWidth: tableWidth }}>
          <thead>
            <tr>
              <th style={{ width: COLW.pos }}>Position</th>
              {variants.map(v => <th key={v.id} className="text-right" style={{ width: COLW.variant }}>{v.name}</th>)}
              <th className="text-right" style={{ width: COLW.ist, color: '#facc15' }}>Ist</th>
              <th className="text-right" style={{ width: COLW.erg }}>Ergebnis{defaultVarName && <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.6 }}> ({defaultVarName})</span>}</th>
              <th style={{ width: COLW.act }} />
            </tr>
          </thead>
          <tbody>
            {rowPositions.length === 0 && !adding && (
              <tr><td colSpan={colCount} className="text-center py-4" style={{ color: '#6b7280' }}>Noch keine Position – unten „+ Neue Position".</td></tr>
            )}
            {rowPositions.map(p => (
              p.pos_type === 'hotel' ? (
                <HotelRow key={p.id} show={show} dataset={dataset}
                  positionId={p.id} positionName={p.name} who={p.spec ?? null} showSpec={showSpec} showName={showName}
                  variants={variants} onChanged={onChanged} defaultVar={defaultVar}
                  dragging={dragId === p.id} dropTarget={dragOverId === p.id && dragId != null && dragId !== p.id}
                  onDragStartRow={() => setDragId(p.id)} onDragEnterRow={() => { if (dragId && dragId !== p.id) setDragOverId(p.id) }}
                  onDragEndRow={endDrag} onDropRow={() => reorderTo(p.id)} />
              ) : p.pos_type === 'vehicle' ? (
                <VehicleRow key={p.id} show={show} dataset={dataset}
                  positionId={p.id} positionName={p.name} snapshot={p} showSpec={showSpec}
                  variants={variants} onChanged={onChanged} defaultVar={defaultVar}
                  dragging={dragId === p.id} dropTarget={dragOverId === p.id && dragId != null && dragId !== p.id}
                  onDragStartRow={() => setDragId(p.id)} onDragEnterRow={() => { if (dragId && dragId !== p.id) setDragOverId(p.id) }}
                  onDragEndRow={endDrag} onDropRow={() => reorderTo(p.id)} />
              ) : (
                <PositionRow key={p.id} show={show} dataset={dataset} project={project}
                  positionId={p.id} positionName={p.name} positionSpec={p.spec ?? null} positionPerson={p.person ?? null} showSpec={showSpec} showName={showName}
                  variants={variants} onChanged={onChanged}
                  showTravel={showTravel} defaultVar={defaultVar}
                  dragging={dragId === p.id} dropTarget={dragOverId === p.id && dragId != null && dragId !== p.id}
                  onDragStartRow={() => setDragId(p.id)} onDragEnterRow={() => { if (dragId && dragId !== p.id) setDragOverId(p.id) }}
                  onDragEndRow={endDrag} onDropRow={() => reorderTo(p.id)} />
              )
            ))}
            {overheadItems.map(item => {
              const rawSoll = new Decimal(String(dataset.entries.find(e => e.position_id === item.id && e.show_id == null)?.amount ?? 0) || 0)
              const pct = item.allocation_pct != null && item.allocation_pct !== '' ? new Decimal(String(item.allocation_pct)) : new Decimal(100)
              const soll = rawSoll.times(pct).div(100)   // Anteil auf diese Kalkulation
              const includedCount = activeShowsList.filter(s => !overheadExcluded(item.id, s.id)).length
              const included = !overheadExcluded(item.id, show.id)
              const share = included && includedCount > 0 ? soll.div(includedCount) : new Decimal(0)
              return (
                <OverheadShowRow key={'oh-' + item.id} positionId={item.id} showId={show.id} name={item.name}
                  variantCols={variants.length} included={included} includedCount={includedCount}
                  soll={soll} share={share} onChanged={onChanged} />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
    {/* Fußzeile AUSSERHALB der .pt-card (overflow:hidden!): Anlege-Button bzw. Dropdown
        liegen direkt unter dem Bereich – so sieht man sofort, dass etwas passiert. */}
    <div style={{ padding: '8px 2px 2px', position: 'relative', zIndex: 30 }}>
      {adding ? (
        <div className="flex items-center gap-2" style={{ maxWidth: 440 }}>
          <div style={{ flex: 1 }}>
            <AddPositionControl category={category} isPersonal={isPersonal} isUnterkunft={isUnterkunft} isTransport={isTransport}
              catPositions={catPositions} functions={functions} activeNames={activeNames} reloadFunctions={reloadFunctions}
              vehicles={vehicles} reloadVehicles={reloadVehicles}
              onDone={() => { setAdding(false); onChanged() }} />
          </div>
          <button onClick={() => setAdding(false)} className="btn btn-ghost shrink-0" style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}>Abbrechen</button>
          <button onClick={() => setAdding(false)} className="btn btn-primary shrink-0" style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}>Fertig</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="btn btn-ghost inline-flex items-center gap-1" style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', color: '#93c5fd' }}>
          <PlusIcon className="w-3.5 h-3.5" /> Neue Position
        </button>
      )}
    </div>
    </div>
  )
}

// ── Positions-Zeile ──────────────────────────────────────────────────────────

interface RowModel { shared: boolean; sharedVal: string; perVar: Record<string, string>; travelKm: Record<string, string>; travelRate: Record<string, string>; travelFix: Record<string, string>; ist: string; istTravelKm: string; istTravelRate: string; istTravelFix: string }

const sollSnap = (x: RowModel) => JSON.stringify({ shared: x.shared, sharedVal: x.sharedVal, perVar: x.perVar, travelKm: x.travelKm, travelRate: x.travelRate, travelFix: x.travelFix })

// Hintergrund-Tönung für Eingabefelder, deren Wert für ALLE Varianten gilt (verknüpft)
const linkedCellBg = 'rgba(96,165,250,0.14)'

// Kompaktes 🔗-Symbol: verknüpft (blau) = ein gemeinsames Feld für alle Varianten;
// Klick löst auf → je Variante ein eigenes Eingabefeld erscheint.
function LinkBadge({ shared, onClick }: { shared: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      title={shared
        ? 'Verknüpft: ein gemeinsamer Wert für ALLE Varianten. Klicken → je Variante ein eigenes Feld.'
        : 'Pro Variante getrennt: jede Variante hat ein eigenes Feld. Klicken → wieder ein gemeinsamer Wert für alle.'}
      className="shrink-0" style={{ color: shared ? '#60a5fa' : '#6b7280', marginTop: 2 }}>
      <LinkIcon className="w-4 h-4" />
    </button>
  )
}

function buildRowModel(dataset: CalcDataset, project: CalcProject, showId: string, positionId: string, variants: Variant[]): RowModel {
  const es = dataset.entries.filter(e => e.show_id === showId && e.position_id === positionId)
  const baseE = es.filter(e => (e.kind ?? 'base') !== 'travel')
  const travelE = es.filter(e => e.kind === 'travel')
  const nullE = baseE.filter(e => e.variant_id == null)
  const varE = baseE.filter(e => e.variant_id != null)
  const shared = varE.length === 0            // nur eine „gilt für alle"-Buchung (oder gar keine) → verknüpft
  // Platzhalter-Buchungen (übernommene Positionen ohne Werte) leer anzeigen, nicht „0"
  const disp = (e: CalcEntry) => entryHasValue(e) ? numStr(entryAmount(e, project)) : ''
  const sharedVal = nullE.length ? disp(nullE[0]) : ''
  const perVar: Record<string, string> = {}
  if (nullE.length) variants.forEach(v => { perVar[v.id] = sharedVal })     // Startwerte auch für den Aufgelöst-Fall
  varE.forEach(e => { if (e.variant_id) perVar[e.variant_id] = disp(e) })

  // Reise pro Variante (variant_id) + geerbt aus „gilt für alle" (variant_id NULL)
  const travelKm: Record<string, string> = {}
  const travelRate: Record<string, string> = {}
  const travelFix: Record<string, string> = {}
  const tNull = travelE.find(e => e.variant_id == null)
  if (tNull) variants.forEach(v => {
    travelKm[v.id] = tNull.quantity != null ? String(tNull.quantity) : ''
    travelRate[v.id] = tNull.unit_price != null ? String(tNull.unit_price) : ''
    travelFix[v.id] = tNull.amount != null ? String(tNull.amount) : ''
  })
  travelE.filter(e => e.variant_id != null).forEach(e => {
    if (!e.variant_id) return
    travelKm[e.variant_id] = e.quantity != null ? String(e.quantity) : ''
    travelRate[e.variant_id] = e.unit_price != null ? String(e.unit_price) : ''
    travelFix[e.variant_id] = e.amount != null ? String(e.amount) : ''
  })

  const act = (dataset.actuals ?? []).find(a => a.show_id === showId && a.position_id === positionId)
  return {
    shared, sharedVal, perVar, travelKm, travelRate, travelFix,
    ist: act?.amount != null ? String(act.amount) : '',
    istTravelKm: act?.travel_km != null ? String(act.travel_km) : '',
    istTravelRate: act?.travel_rate != null ? String(act.travel_rate) : '',
    istTravelFix: act?.travel_fix != null ? String(act.travel_fix) : '',
  }
}

function PositionRow({ show, dataset, project, positionId, positionName, positionSpec, positionPerson, showSpec, showName, variants, onChanged, showTravel, defaultVar, dragging, dropTarget, onDragStartRow, onDragEnterRow, onDragEndRow, onDropRow }: {
  show: CalcShow; dataset: CalcDataset; project: CalcProject
  positionId: string; positionName: string; positionSpec: string | null; positionPerson: string | null; showSpec: boolean; showName: boolean
  variants: Variant[]; onChanged: () => void
  showTravel: boolean; defaultVar: string
  dragging: boolean; dropTarget: boolean
  onDragStartRow: () => void; onDragEnterRow: () => void; onDragEndRow: () => void; onDropRow: () => void
}) {
  const initial = useMemo<RowModel>(() => buildRowModel(dataset, project, show.id, positionId, variants), [dataset, project, show.id, positionId, variants])
  const [m, setM] = useState<RowModel>(initial)
  const [savedSnap, setSavedSnap] = useState(() => sollSnap(initial))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [travelOpen, setTravelOpen] = useState(() => variants.some(v => (initial.travelKm[v.id] ?? '') !== '' || (initial.travelRate[v.id] ?? '') !== '' || (initial.travelFix[v.id] ?? '') !== ''))
  // Spezifikation + Name werden PRO SHOW gespeichert (calc_actuals); Positionswert nur als Fallback.
  const actMeta = (dataset.actuals ?? []).find(a => a.show_id === show.id && a.position_id === positionId)
  const [spec, setSpec] = useState(actMeta?.spec ?? positionSpec ?? '')
  const saveSpec = async () => { try { await setCalcActual(show.id, positionId, { spec: spec.trim() || null }); onChanged() } catch { /* still */ } }
  const [person, setPerson] = useState(actMeta?.person ?? positionPerson ?? '')
  const savePerson = async () => { try { await setCalcActual(show.id, positionId, { person: person.trim() || null }); onChanged() } catch { /* still */ } }
  const [nameVal, setNameVal] = useState(positionName)
  const saveName = async () => {
    const nn = nameVal.trim()
    if (!nn || nn === positionName) { setNameVal(positionName); return }
    try { await updateCalcPosition(positionId, { name: nn }); onChanged() } catch { setNameVal(positionName) }
  }

  const sollDirty = sollSnap(m) !== savedSnap
  // Ungespeicherte Zeile global melden (Nav-Guard/Popup + beforeunload)
  useEffect(() => {
    const key = `${show.id}:${positionId}`
    markRowDirty(key, sollDirty)
    return () => markRowDirty(key, false)
  }, [sollDirty, show.id, positionId])

  // Verknüpfung umschalten. WICHTIG: beim Auflösen bleibt der Wert erhalten
  // (wird in leere Varianten-Spalten übernommen, u.a. Var 1) statt gelöscht zu werden.
  const toggleLink = () => setM(p => {
    if (p.shared) {
      const perVar = { ...p.perVar }
      variants.forEach(v => { if ((perVar[v.id] ?? '') === '') perVar[v.id] = p.sharedVal })
      return { ...p, shared: false, perVar }
    }
    const first = variants.map(v => p.perVar[v.id]).find(x => (x ?? '') !== '') ?? ''
    return { ...p, shared: true, sharedVal: p.sharedVal || first }
  })

  const travelRes = (vid: string): Decimal | null => {
    const km = norm(m.travelKm[vid] ?? ''), rate = norm(m.travelRate[vid] ?? ''), fix = norm(m.travelFix[vid] ?? '')
    const hasKm = km != null && rate != null
    if (!hasKm && fix == null) return null
    try {
      let r = new Decimal(0)
      if (hasKm) r = r.plus(new Decimal(km!).times(rate!))
      if (fix != null) r = r.plus(new Decimal(fix))
      return r
    } catch { return null }
  }
  const istTravelRes = (): Decimal | null => {
    const km = norm(m.istTravelKm), rate = norm(m.istTravelRate), fix = norm(m.istTravelFix)
    const hasKm = km != null && rate != null
    if (!hasKm && fix == null) return null
    try {
      let r = new Decimal(0)
      if (hasKm) r = r.plus(new Decimal(km!).times(rate!))
      if (fix != null) r = r.plus(new Decimal(fix))
      return r
    } catch { return null }
  }
  // Zeilenergebnis (Soll) für die Standardvariante: Grundbetrag + Reise
  const rowResultSoll = (): Decimal => {
    let sum = new Decimal(0)
    if (defaultVar === 'ist') {
      const b = norm(m.ist); if (b != null) { try { sum = sum.plus(b) } catch { /* ignore */ } }
      const t = istTravelRes(); if (t) sum = sum.plus(t)
      return sum
    }
    const baseStr = m.shared ? m.sharedVal : (m.perVar[defaultVar] ?? '')
    const b = norm(baseStr); if (b != null) { try { sum = sum.plus(b) } catch { /* ignore */ } }
    const t = travelRes(defaultVar); if (t) sum = sum.plus(t)
    return sum
  }

  const entriesPayload = (): CalcEntryInput[] => {
    const base: CalcEntryInput[] = m.shared
      ? (norm(m.sharedVal) == null ? [] : [{ kind: 'base', variant_id: null, amount: norm(m.sharedVal) }])
      : variants.map(v => ({ v, a: norm(m.perVar[v.id] ?? '') })).filter(x => x.a != null).map(x => ({ kind: 'base', variant_id: x.v.id, amount: x.a }))
    const travel: CalcEntryInput[] = []
    if (showTravel) variants.forEach(v => {
      const km = norm(m.travelKm[v.id] ?? ''), rate = norm(m.travelRate[v.id] ?? ''), fix = norm(m.travelFix[v.id] ?? '')
      const hasKm = km != null && rate != null
      if (hasKm || fix != null) travel.push({ kind: 'travel', variant_id: v.id, quantity: hasKm ? km : null, unit_price: hasKm ? rate : null, amount: fix })
    })
    return [...base, ...travel]
  }

  const saveSoll = async () => {
    setBusy(true); setErr('')
    try {
      await withTimeout(replaceCalcEntries(show.id, positionId, entriesPayload()))
      setSavedSnap(sollSnap(m))
      onChanged()
    } catch (e: any) { setErr(e?.message ?? 'Fehler beim Speichern') }
    finally { setBusy(false) }
  }
  const saveIst = async () => {
    try { await withTimeout(setCalcActual(show.id, positionId, { amount: norm(m.ist), travel_km: norm(m.istTravelKm), travel_rate: norm(m.istTravelRate), travel_fix: norm(m.istTravelFix) })); onChanged() }
    catch (e: any) { setErr(e?.message ?? 'Ist konnte nicht gespeichert werden') }
  }
  const removeRow = async () => {
    // Positionen erscheinen in allen Shows → Löschen entfernt die Position aus der
    // gesamten Kalkulation (inkl. aller Buchungen/Ist). Warnen, wenn woanders Werte hängen.
    const filled = (v: string | number | null | undefined) => v != null && String(v).trim() !== ''
    const usedElsewhere = dataset.entries.some(e => e.position_id === positionId && e.show_id !== show.id)
      || (dataset.actuals ?? []).some(a => a.position_id === positionId && a.show_id !== show.id && (filled(a.amount) || filled(a.travel_km)))
    const msg = usedElsewhere
      ? `„${positionName}" komplett löschen? Achtung: in anderen Shows sind bereits Werte erfasst – diese gehen mit verloren.`
      : `„${positionName}" aus der Kalkulation löschen?`
    if (!confirm(msg)) return
    setBusy(true)
    try {
      await deleteCalcPosition(positionId)   // löscht Position + alle Buchungen/Ist in allen Shows
      onChanged()
    } catch (e: any) { setErr(e?.message ?? 'Fehler'); setBusy(false) }
  }

  const cell = { className: 'form-input text-right', style: { fontSize: '0.8rem', padding: '3px 8px', width: '100%', fontVariantNumeric: 'tabular-nums' } as const }
  const tvCell = { className: 'form-input', inputMode: 'decimal' as const, style: { fontSize: '0.72rem', padding: '2px 6px', width: '100%', textAlign: 'right' as const } }
  const travelActive = travelOpen || variants.some(v => (m.travelKm[v.id] ?? '') !== '' || (m.travelRate[v.id] ?? '') !== '' || (m.travelFix[v.id] ?? '') !== '')

  return (
    <>
      <tr onDragOver={e => e.preventDefault()} onDragEnter={onDragEnterRow} onDrop={onDropRow}
        style={{
          opacity: dragging ? 0.35 : 1,
          background: dragging ? '#243044' : (dropTarget ? '#1c2b3a' : undefined),
          boxShadow: dropTarget ? 'inset 0 2px 0 0 #60a5fa' : undefined,
          transition: 'background 120ms ease, opacity 120ms ease',
        }}>
        <td>
          <div className="flex items-start gap-1.5">
            <span draggable onDragStart={onDragStartRow} onDragEnd={onDragEndRow}
              title="Zum Sortieren ziehen" className="shrink-0 cursor-grab active:cursor-grabbing"
              style={{ color: dragging ? '#60a5fa' : '#6b7280', lineHeight: 0, marginTop: 4 }}>
              <svg width="9" height="15" viewBox="0 0 9 15" fill="currentColor" aria-hidden="true">
                <circle cx="2.2" cy="3" r="1.25" /><circle cx="6.8" cy="3" r="1.25" />
                <circle cx="2.2" cy="7.5" r="1.25" /><circle cx="6.8" cy="7.5" r="1.25" />
                <circle cx="2.2" cy="12" r="1.25" /><circle cx="6.8" cy="12" r="1.25" />
              </svg>
            </span>
            <LinkBadge shared={m.shared} onClick={toggleLink} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-center gap-1.5">
                <input value={nameVal} onChange={e => setNameVal(e.target.value)} onBlur={saveName}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  title="Name bearbeiten"
                  className="text-sm"
                  style={{ color: '#e0e0e0', background: 'transparent', border: '1px solid transparent', borderRadius: 4, padding: '1px 4px', whiteSpace: 'nowrap', width: `${Math.max(6, nameVal.length + 1)}ch`, minWidth: 60 }}
                  onFocus={e => { e.target.style.border = '1px solid #4a4a4a'; e.target.style.background = '#1f2937' }}
                  onBlurCapture={e => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent' }} />
                {/* Spezifikation + Reise rechtsbündig vor Variante 1 */}
                <div className="flex items-center gap-1.5" style={{ marginLeft: 'auto' }}>
                  {showSpec && (
                    <input className="form-input text-right" style={{ fontSize: '0.72rem', padding: '1px 5px', width: 120 }} value={spec}
                      onChange={e => setSpec(e.target.value)} onBlur={saveSpec} placeholder="Spezifikation" />
                  )}
                  {showTravel && (
                    <button onClick={() => setTravelOpen(o => !o)} title="Reisekosten (km × Preis)"
                      className="shrink-0 inline-flex items-center gap-1 rounded"
                      style={{ fontSize: '0.7rem', padding: '2px 6px', color: travelActive ? '#111827' : '#cbd5e1', background: travelActive ? '#facc15' : 'transparent', border: `1px solid ${travelActive ? '#facc15' : '#4a4a4a'}` }}>
                      <TruckIcon className="w-3.5 h-3.5" /> Reise
                    </button>
                  )}
                </div>
              </div>
              {showName && (
                <input value={person} onChange={e => setPerson(e.target.value)} onBlur={savePerson}
                  className="form-input" placeholder="Name (Person)"
                  style={{ fontSize: '0.72rem', padding: '1px 6px', marginTop: 3, width: '100%', maxWidth: 200 }} />
              )}
            </div>
          </div>
        </td>

        {variants.map((v, idx) => (
          <td key={v.id} className="text-right" style={{ padding: '4px 8px' }}>
            {m.shared ? (
              idx === 0 ? (
                <input inputMode="decimal" {...cell} data-calc-col={v.id} onKeyDown={e => gridTabDown(e, v.id)}
                  value={m.sharedVal}
                  onChange={e => {
                    const val = e.target.value
                    setM(p => {
                      const perVar: Record<string, string> = {}
                      variants.forEach(vv => { perVar[vv.id] = val })
                      return { ...p, sharedVal: val, perVar }
                    })
                  }}
                  placeholder="0" title="Verknüpft: ein Wert für alle Varianten (🔗 klicken zum Auflösen)"
                  style={{ ...cell.style, color: '#93c5fd', background: linkedCellBg }} />
              ) : (
                <div title="Verknüpft mit Variante 1 (🔗 klicken zum Auflösen)"
                  style={{ ...cell.style, color: '#6b7280', minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  <LinkIcon className="w-3 h-3" style={{ opacity: 0.6 }} />{norm(m.sharedVal) != null ? m.sharedVal : '–'}
                </div>
              )
            ) : (
              <input inputMode="decimal" {...cell} data-calc-col={v.id} onKeyDown={e => gridTabDown(e, v.id)}
                value={m.perVar[v.id] ?? ''}
                onChange={e => { const val = e.target.value; setM(p => ({ ...p, perVar: { ...p.perVar, [v.id]: val } })) }}
                placeholder="0" style={{ ...cell.style }} />
            )}
          </td>
        ))}

        <td className="text-right" style={{ padding: '4px 8px' }}>
          <input inputMode="decimal" className="form-input text-right" data-calc-col="ist" onKeyDown={e => gridTabDown(e, 'ist')} style={{ fontSize: '0.8rem', padding: '3px 8px', width: '100%', fontVariantNumeric: 'tabular-nums' }}
            value={m.ist} onChange={e => setM(p => ({ ...p, ist: e.target.value }))} onBlur={saveIst} placeholder="0" />
        </td>

        <td className="text-right" style={{ padding: '4px 8px', fontVariantNumeric: 'tabular-nums', color: '#e5e7eb', fontWeight: 500 }}>
          {formatMoney(rowResultSoll())}
        </td>

        <td>
          <div className="flex items-center gap-1 justify-end">
            {sollDirty && (
              <button onClick={saveSoll} disabled={busy} className="btn btn-primary" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                {busy ? '…' : 'Speichern'}
              </button>
            )}
            <button onClick={async () => { setBusy(true); try { const ok = await copyRowToAllShows(dataset, show.id, positionId, entriesPayload(), onChanged); if (ok) setSavedSnap(sollSnap(m)) } catch (e: any) { setErr(e?.message ?? 'Fehler') } finally { setBusy(false) } }}
              disabled={busy} className="p-1 text-gray-400 hover:text-blue-400" title="Werte auf alle Termine kopieren">
              <DocumentDuplicateIcon className="w-3.5 h-3.5" />
            </button>
            <button onClick={removeRow} disabled={busy} className="p-1 text-gray-400 hover:text-red-500" title="Entfernen">
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          {err && <p className="text-[10px] mt-0.5" style={{ color: '#fca5a5' }}>{err}</p>}
        </td>
      </tr>

      {showTravel && travelOpen && (
        <tr>
          <td style={{ verticalAlign: 'top' }}>
            <div className="flex items-center gap-1 text-xs" style={{ color: '#facc15', paddingLeft: 22, whiteSpace: 'nowrap' }} title="km × €/km plus optionaler Fixpreis (z.B. Zugticket)">
              <TruckIcon className="w-3.5 h-3.5" /> Reise <span style={{ color: '#6b7280', fontSize: 10 }}>km×€ + Fix</span>
              {travelActive && (
                <button onClick={() => setM(p => ({ ...p, travelKm: {}, travelRate: {}, travelFix: {} }))} className="text-gray-500 hover:text-red-500 ml-1" title="Reisekosten löschen">✕</button>
              )}
            </div>
          </td>
          {variants.map(v => {
            const res = travelRes(v.id)
            return (
              <td key={v.id} style={{ padding: '2px 6px', verticalAlign: 'middle' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <input {...tvCell} style={{ ...tvCell.style, flex: 1, minWidth: 0 }} value={m.travelKm[v.id] ?? ''} placeholder="km"
                    onChange={e => setM(p => ({ ...p, travelKm: { ...p.travelKm, [v.id]: e.target.value } }))} />
                  <input {...tvCell} style={{ ...tvCell.style, flex: 1, minWidth: 0 }} value={m.travelRate[v.id] ?? ''} placeholder="€/km"
                    onChange={e => setM(p => ({ ...p, travelRate: { ...p.travelRate, [v.id]: e.target.value } }))} />
                  <input {...tvCell} style={{ ...tvCell.style, flex: 1, minWidth: 0 }} value={m.travelFix[v.id] ?? ''} placeholder="Fix €" title="Fixpreis (z.B. Zugticket)"
                    onChange={e => setM(p => ({ ...p, travelFix: { ...p.travelFix, [v.id]: e.target.value } }))} />
                  <span style={{ flex: '1.7 1 0', minWidth: 56, textAlign: 'right', fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{res != null ? formatMoney(res) : ''}</span>
                </div>
              </td>
            )
          })}
          <td style={{ padding: '2px 6px', verticalAlign: 'middle' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <input {...tvCell} style={{ ...tvCell.style, flex: 1, minWidth: 0 }} value={m.istTravelKm} placeholder="km"
                onChange={e => setM(p => ({ ...p, istTravelKm: e.target.value }))} onBlur={saveIst} />
              <input {...tvCell} style={{ ...tvCell.style, flex: 1, minWidth: 0 }} value={m.istTravelRate} placeholder="€/km"
                onChange={e => setM(p => ({ ...p, istTravelRate: e.target.value }))} onBlur={saveIst} />
              <input {...tvCell} style={{ ...tvCell.style, flex: 1, minWidth: 0 }} value={m.istTravelFix} placeholder="Fix €" title="Fixpreis (z.B. Zugticket)"
                onChange={e => setM(p => ({ ...p, istTravelFix: e.target.value }))} onBlur={saveIst} />
              <span style={{ flex: '1.7 1 0', minWidth: 56, textAlign: 'right', fontSize: 11, color: '#facc15', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{istTravelRes() != null ? formatMoney(istTravelRes()!) : ''}</span>
            </div>
          </td>
          <td />
          <td />
        </tr>
      )}
    </>
  )
}

// ── Übergeordnete Kosten: read-only Umlage-Zeile in der Show ──────────────────
// Betrag wird zentral im Tab „Übergeordnet" gepflegt; hier nur Anzeige + Häkchen
// (diese Show ab-/anwählen). Umlage = Soll ÷ Anzahl angehakter Shows (Regel 4).
function OverheadShowRow({ positionId, showId, name, variantCols, included, includedCount, soll, share, onChanged }: {
  positionId: string; showId: string; name: string; variantCols: number
  included: boolean; includedCount: number; soll: Decimal; share: Decimal; onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const toggle = async () => {
    setBusy(true)
    try { await setCalcOverheadShow(positionId, showId, !included); onChanged() } finally { setBusy(false) }
  }
  return (
    <tr style={{ background: '#20262e' }} title="Übergeordneter Posten – Betrag im Tab Übergeordnet pflegen">
      <td>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={included} disabled={busy} onChange={toggle}
            title={included ? 'Gilt für diese Show (klicken zum Abwählen)' : 'Für diese Show abgewählt (klicken zum Anhaken)'} />
          <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: '#33312a', color: '#d6c98a' }}>übergeordnet</span>
          <span className="text-sm" style={{ color: included ? '#cbd5e1' : '#6b7280', whiteSpace: 'nowrap' }}>{name}</span>
        </div>
      </td>
      <td colSpan={variantCols + 1} className="text-xs" style={{ color: '#6b7280' }}>
        {included
          ? `Umlage über ${includedCount} Show${includedCount !== 1 ? 's' : ''} · ${formatMoney(soll)} gesamt`
          : 'für diese Show abgewählt'}
      </td>
      <td className="text-right" style={{ fontVariantNumeric: 'tabular-nums', color: included ? '#93c5fd' : '#6b7280', fontWeight: 500 }}>
        {included ? formatMoney(share) : '—'}
      </td>
      <td />
    </tr>
  )
}

// ── Hotel-Zeile: Betrag = Zimmer × Nächte × €/Nacht, pro Variante (mit 🔗) ─────
interface HVals { rooms: string; nights: string; price: string }
interface HModel { shared: boolean; s: HVals; perVar: Record<string, HVals>; ist: string }
const emptyH = (): HVals => ({ rooms: '', nights: '', price: '' })
const hSnap = (m: HModel) => JSON.stringify({ shared: m.shared, s: m.s, perVar: m.perVar })
const hProd = (v: HVals): Decimal | null => {
  const r = norm(v.rooms), n = norm(v.nights), p = norm(v.price)
  if (r == null || n == null || p == null) return null
  try { return new Decimal(r).times(n).times(p) } catch { return null }
}

function buildHotelModel(dataset: CalcDataset, showId: string, positionId: string, variants: Variant[]): HModel {
  const es = dataset.entries.filter(e => e.show_id === showId && e.position_id === positionId && e.kind === 'hotel')
  const nullE = es.filter(e => e.variant_id == null)
  const varE = es.filter(e => e.variant_id != null)
  const toVals = (e?: CalcEntry): HVals => ({
    rooms: e?.quantity != null ? String(e.quantity) : '',
    nights: e?.nights != null ? String(e.nights) : '',
    price: e?.unit_price != null ? String(e.unit_price) : '',
  })
  const s = nullE.length ? toVals(nullE[0]) : emptyH()
  const perVar: Record<string, HVals> = {}
  variants.forEach(v => { perVar[v.id] = nullE.length ? { ...s } : emptyH() })
  varE.forEach(e => { if (e.variant_id) perVar[e.variant_id] = toVals(e) })
  const ist = (() => {
    const a = (dataset.actuals ?? []).find(x => x.show_id === showId && x.position_id === positionId)
    return a?.amount != null ? String(a.amount) : ''
  })()
  return { shared: varE.length === 0, s, perVar, ist }
}

function HotelRow({ show, dataset, positionId, positionName, who, showSpec, showName, variants, onChanged, defaultVar, dragging, dropTarget, onDragStartRow, onDragEnterRow, onDragEndRow, onDropRow }: {
  show: CalcShow; dataset: CalcDataset; positionId: string; positionName: string; who: string | null; showSpec: boolean; showName: boolean
  variants: Variant[]; onChanged: () => void; defaultVar: string
  dragging: boolean; dropTarget: boolean
  onDragStartRow: () => void; onDragEnterRow: () => void; onDragEndRow: () => void; onDropRow: () => void
}) {
  const initial = useMemo(() => buildHotelModel(dataset, show.id, positionId, variants), [dataset, show.id, positionId, variants])
  const [m, setM] = useState<HModel>(initial)
  const [savedSnap, setSavedSnap] = useState(() => hSnap(initial))
  const [nameVal, setNameVal] = useState(positionName)
  const hotelAct = (dataset.actuals ?? []).find(a => a.show_id === show.id && a.position_id === positionId)
  const [whoVal, setWhoVal] = useState(hotelAct?.spec ?? who ?? '')
  const [personVal, setPersonVal] = useState(hotelAct?.person ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const dirty = hSnap(m) !== savedSnap
  const saveWho = async () => { try { await setCalcActual(show.id, positionId, { spec: whoVal.trim() || null }); onChanged() } catch { /* still */ } }
  const savePerson = async () => { try { await setCalcActual(show.id, positionId, { person: personVal.trim() || null }); onChanged() } catch { /* still */ } }

  useEffect(() => {
    const key = `${show.id}:${positionId}`
    markRowDirty(key, dirty)
    return () => markRowDirty(key, false)
  }, [dirty, show.id, positionId])

  const setVals = (vid: string, patch: Partial<HVals>) => setM(p => {
    if (p.shared) return { ...p, s: { ...p.s, ...patch } }
    return { ...p, perVar: { ...p.perVar, [vid]: { ...(p.perVar[vid] ?? emptyH()), ...patch } } }
  })
  const toggleLink = () => setM(p => {
    if (p.shared) {
      const perVar = { ...p.perVar }
      variants.forEach(v => { const cur = perVar[v.id] ?? emptyH(); if (!cur.rooms && !cur.nights && !cur.price) perVar[v.id] = { ...p.s } })
      return { ...p, shared: false, perVar }
    }
    const first = variants.map(v => p.perVar[v.id]).find(x => x && (x.rooms || x.nights || x.price)) ?? p.s
    return { ...p, shared: true, s: { ...first } }
  })

  const valsFor = (vid: string): HVals => (m.shared ? m.s : (m.perVar[vid] ?? emptyH()))
  const rowResult = (): Decimal => {
    if (defaultVar === 'ist') { const b = norm(m.ist); if (b != null) { try { return new Decimal(b) } catch { /* */ } } return new Decimal(0) }
    return hProd(valsFor(defaultVar)) ?? new Decimal(0)
  }

  const payload = (): CalcEntryInput[] => {
    const any = (v: HVals) => norm(v.rooms) != null || norm(v.nights) != null || norm(v.price) != null
    if (m.shared) return any(m.s) ? [{ kind: 'hotel', variant_id: null, quantity: norm(m.s.rooms), nights: norm(m.s.nights), unit_price: norm(m.s.price) }] : []
    return variants.map(v => ({ v, val: m.perVar[v.id] ?? emptyH() })).filter(x => any(x.val))
      .map(x => ({ kind: 'hotel', variant_id: x.v.id, quantity: norm(x.val.rooms), nights: norm(x.val.nights), unit_price: norm(x.val.price) }))
  }

  const saveSoll = async () => {
    setBusy(true); setErr('')
    try { await withTimeout(replaceCalcEntries(show.id, positionId, payload())); setSavedSnap(hSnap(m)); onChanged() }
    catch (e: any) { setErr(e?.message ?? 'Fehler beim Speichern') }
    finally { setBusy(false) }
  }
  const copyAll = async () => { setBusy(true); try { const ok = await copyRowToAllShows(dataset, show.id, positionId, payload(), onChanged); if (ok) setSavedSnap(hSnap(m)) } catch (e: any) { setErr(e?.message ?? 'Fehler') } finally { setBusy(false) } }
  const saveIst = async () => {
    try { await withTimeout(setCalcActual(show.id, positionId, { amount: norm(m.ist) })); onChanged() }
    catch (e: any) { setErr(e?.message ?? 'Ist konnte nicht gespeichert werden') }
  }
  const saveName = async () => { const nn = nameVal.trim(); if (!nn || nn === positionName) { setNameVal(positionName); return } try { await updateCalcPosition(positionId, { name: nn }); onChanged() } catch { setNameVal(positionName) } }
  const removeRow = async () => {
    if (!confirm(`„${positionName}${who ? ' · ' + who : ''}" (Hotel) aus der Kalkulation löschen?`)) return
    setBusy(true)
    try { await deleteCalcPosition(positionId); onChanged() } catch (e: any) { setErr(e?.message ?? 'Fehler'); setBusy(false) }
  }

  const hCell = { className: 'form-input', inputMode: 'decimal' as const, style: { fontSize: '0.7rem', padding: '2px 4px', width: '100%', textAlign: 'right' as const } }

  return (
    <tr onDragOver={e => e.preventDefault()} onDragEnter={onDragEnterRow} onDrop={onDropRow}
      style={{ background: dragging ? '#243044' : (dropTarget ? '#1c2b3a' : '#211f17'), opacity: dragging ? 0.35 : 1, boxShadow: dropTarget ? 'inset 0 2px 0 0 #60a5fa' : undefined }}>
      <td style={{ verticalAlign: 'top' }}>
        <div className="flex items-start gap-1.5">
          <span draggable onDragStart={onDragStartRow} onDragEnd={onDragEndRow} title="Zum Sortieren ziehen"
            className="shrink-0 cursor-grab active:cursor-grabbing" style={{ color: dragging ? '#60a5fa' : '#6b7280', lineHeight: 0, marginTop: 4 }}>
            <svg width="9" height="15" viewBox="0 0 9 15" fill="currentColor" aria-hidden="true">
              <circle cx="2.2" cy="3" r="1.25" /><circle cx="6.8" cy="3" r="1.25" />
              <circle cx="2.2" cy="7.5" r="1.25" /><circle cx="6.8" cy="7.5" r="1.25" />
              <circle cx="2.2" cy="12" r="1.25" /><circle cx="6.8" cy="12" r="1.25" />
            </svg>
          </span>
          <LinkBadge shared={m.shared} onClick={toggleLink} />
          <div style={{ minWidth: 0 }}>
            <div className="flex items-center gap-1.5">
              <input value={nameVal} onChange={e => setNameVal(e.target.value)} onBlur={saveName}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} title="Name bearbeiten" className="text-sm"
                style={{ color: '#e0e0e0', background: 'transparent', border: '1px solid transparent', borderRadius: 4, padding: '1px 4px', whiteSpace: 'nowrap', width: `${Math.max(5, nameVal.length + 1)}ch`, minWidth: 44 }}
                onFocus={e => { e.target.style.border = '1px solid #4a4a4a' }} onBlurCapture={e => { e.target.style.border = '1px solid transparent' }} />
              {showSpec && (
                <input value={whoVal} onChange={e => setWhoVal(e.target.value)} onBlur={saveWho}
                  className="form-input" placeholder="Spezifikation (z.B. Band, Crew, 1…)" style={{ fontSize: '0.72rem', padding: '1px 6px', width: 190 }} />
              )}
            </div>
            {showName && (
              <input value={personVal} onChange={e => setPersonVal(e.target.value)} onBlur={savePerson}
                className="form-input" placeholder="Name (Person)"
                style={{ fontSize: '0.72rem', padding: '1px 6px', marginTop: 3, width: '100%', maxWidth: 200 }} />
            )}
          </div>
        </div>
      </td>

      {variants.map((v, idx) => {
        const val = valsFor(v.id)
        const prod = hProd(val)
        const mirror = m.shared && idx > 0
        return (
          <td key={v.id} style={{ padding: '4px 8px', verticalAlign: 'top' }}>
            {mirror ? (
              <div title="Verknüpft mit Variante 1 (🔗 klicken zum Auflösen)"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, minHeight: 24, color: '#6b7280', fontSize: 12 }}>
                <LinkIcon className="w-3 h-3" style={{ opacity: 0.6 }} />
                <span>{val.rooms || '–'}×{val.nights || '–'}×{val.price || '–'}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 3 }}>
                <input {...hCell} value={val.rooms} placeholder="Zi" title="Zimmer" onChange={e => setVals(v.id, { rooms: e.target.value })}
                  style={{ ...hCell.style, color: m.shared ? '#93c5fd' : undefined, background: m.shared ? linkedCellBg : undefined }} />
                <span style={{ color: '#555', fontSize: 10, alignSelf: 'center' }}>×</span>
                <input {...hCell} value={val.nights} placeholder="Nä" title="Nächte" onChange={e => setVals(v.id, { nights: e.target.value })}
                  style={{ ...hCell.style, color: m.shared ? '#93c5fd' : undefined, background: m.shared ? linkedCellBg : undefined }} />
                <span style={{ color: '#555', fontSize: 10, alignSelf: 'center' }}>×</span>
                <input {...hCell} value={val.price} placeholder="€/N" title="€ pro Nacht" onChange={e => setVals(v.id, { price: e.target.value })}
                  style={{ ...hCell.style, color: m.shared ? '#93c5fd' : undefined, background: m.shared ? linkedCellBg : undefined }} />
              </div>
            )}
            <div className="text-right" style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{prod != null ? formatMoney(prod) : ''}</div>
          </td>
        )
      })}

      <td className="text-right" style={{ padding: '4px 8px', verticalAlign: 'top' }}>
        <input inputMode="decimal" className="form-input text-right" data-calc-col="ist" onKeyDown={e => gridTabDown(e, 'ist')} style={{ fontSize: '0.8rem', padding: '3px 8px', width: '100%', fontVariantNumeric: 'tabular-nums' }}
          value={m.ist} onChange={e => setM(p => ({ ...p, ist: e.target.value }))} onBlur={saveIst} placeholder="0" />
      </td>

      <td className="text-right" style={{ padding: '4px 8px', verticalAlign: 'top', fontVariantNumeric: 'tabular-nums', color: '#e5e7eb', fontWeight: 500 }}>
        {formatMoney(rowResult())}
      </td>

      <td style={{ verticalAlign: 'top' }}>
        <div className="flex items-center gap-1 justify-end">
          {dirty && (
            <button onClick={saveSoll} disabled={busy} className="btn btn-primary" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>{busy ? '…' : 'Speichern'}</button>
          )}
          <button onClick={copyAll} disabled={busy} className="p-1 text-gray-400 hover:text-blue-400" title="Werte auf alle Termine kopieren"><DocumentDuplicateIcon className="w-3.5 h-3.5" /></button>
          <button onClick={removeRow} disabled={busy} className="p-1 text-gray-400 hover:text-red-500" title="Löschen"><TrashIcon className="w-3.5 h-3.5" /></button>
        </div>
        {err && <p className="text-[10px] mt-0.5" style={{ color: '#fca5a5' }}>{err}</p>}
      </td>
    </tr>
  )
}

// ── Fahrzeug-Zeile: Miete + Mehr-km × Preis, optional Sprit-Zeile (Strecke/100×Verbrauch×€/L) ──
interface VVals { rental: string; km: string; included: string; extra: string; cons: string; price: string }
interface VModel { shared: boolean; s: VVals; perVar: Record<string, VVals>; ist: string; fuelIst: string; fuelOn: boolean }
const emptyV = (): VVals => ({ rental: '', km: '', included: '', extra: '', cons: '', price: '' })
const vSnapKey = (m: VModel) => JSON.stringify({ shared: m.shared, s: m.s, perVar: m.perVar, fuelOn: m.fuelOn })
const vAmount = (v: VVals): Decimal => {
  const rental = new Decimal(norm(v.rental) ?? '0')
  const km = new Decimal(norm(v.km) ?? '0')
  const inc = new Decimal(norm(v.included) ?? '0')
  const ex = new Decimal(norm(v.extra) ?? '0')
  try { return rental.plus(Decimal.max(0, km.minus(inc)).times(ex)) } catch { return new Decimal(0) }
}
const fuelAmount = (v: VVals): Decimal => {
  const km = new Decimal(norm(v.km) ?? '0')
  const cons = new Decimal(norm(v.cons) ?? '0')
  const price = new Decimal(norm(v.price) ?? '0')
  try { return km.div(100).times(cons).times(price) } catch { return new Decimal(0) }
}
const vFilled = (v: VVals) => !!(v.rental || v.km || v.included || v.extra || v.cons || v.price)

function buildVehicleModel(dataset: CalcDataset, showId: string, positionId: string, variants: Variant[]): VModel {
  const es = dataset.entries.filter(e => e.show_id === showId && e.position_id === positionId && (e.kind === 'vehicle' || e.kind === 'fuel'))
  const veNull = es.find(e => e.kind === 'vehicle' && e.variant_id == null)
  const fuNull = es.find(e => e.kind === 'fuel' && e.variant_id == null)
  const veVar = es.filter(e => e.kind === 'vehicle' && e.variant_id != null)
  const fuVar = es.filter(e => e.kind === 'fuel' && e.variant_id != null)
  const mk = (ve?: CalcEntry, fu?: CalcEntry): VVals => ({
    rental: ve?.rental_price != null ? String(ve.rental_price) : '',
    km: ve?.distance_km != null ? String(ve.distance_km) : (fu?.distance_km != null ? String(fu.distance_km) : ''),
    included: ve?.included_km != null ? String(ve.included_km) : '',
    extra: ve?.price_extra_km != null ? String(ve.price_extra_km) : '',
    cons: fu?.quantity != null ? String(fu.quantity) : '',
    price: fu?.unit_price != null ? String(fu.unit_price) : '',
  })
  const s = (veNull || fuNull) ? mk(veNull, fuNull) : emptyV()
  const perVar: Record<string, VVals> = {}
  variants.forEach(v => { perVar[v.id] = (veNull || fuNull) ? { ...s } : emptyV() })
  veVar.forEach(e => { if (e.variant_id) perVar[e.variant_id] = { ...(perVar[e.variant_id] ?? emptyV()), rental: e.rental_price != null ? String(e.rental_price) : '', km: e.distance_km != null ? String(e.distance_km) : '', included: e.included_km != null ? String(e.included_km) : '', extra: e.price_extra_km != null ? String(e.price_extra_km) : '' } })
  fuVar.forEach(e => { if (e.variant_id) perVar[e.variant_id] = { ...(perVar[e.variant_id] ?? emptyV()), cons: e.quantity != null ? String(e.quantity) : '', price: e.unit_price != null ? String(e.unit_price) : '', km: perVar[e.variant_id]?.km || (e.distance_km != null ? String(e.distance_km) : '') } })
  const actIst = (dataset.actuals ?? []).find(x => x.show_id === showId && x.position_id === positionId)
  const ist = actIst?.amount != null ? String(actIst.amount) : ''
  const fuelIst = actIst?.fuel_amount != null ? String(actIst.fuel_amount) : ''
  return { shared: veVar.length === 0 && fuVar.length === 0, s, perVar, ist, fuelIst, fuelOn: !!(fuNull || fuVar.length) }
}

function VehicleRow({ show, dataset, positionId, positionName, snapshot, showSpec, variants, onChanged, defaultVar, dragging, dropTarget, onDragStartRow, onDragEnterRow, onDragEndRow, onDropRow }: {
  show: CalcShow; dataset: CalcDataset; positionId: string; positionName: string; snapshot: CalcDataset['positions'][number]; showSpec: boolean
  variants: Variant[]; onChanged: () => void; defaultVar: string
  dragging: boolean; dropTarget: boolean
  onDragStartRow: () => void; onDragEnterRow: () => void; onDragEndRow: () => void; onDropRow: () => void
}) {
  const initial = useMemo(() => buildVehicleModel(dataset, show.id, positionId, variants), [dataset, show.id, positionId, variants])
  const [m, setM] = useState<VModel>(initial)
  const [savedSnap, setSavedSnap] = useState(() => vSnapKey(initial))
  const [nameVal, setNameVal] = useState(positionName)
  const vehAct = (dataset.actuals ?? []).find(a => a.show_id === show.id && a.position_id === positionId)
  const [info, setInfo] = useState(vehAct?.person ?? snapshot.person ?? '')
  const saveInfo = async () => { try { await setCalcActual(show.id, positionId, { person: info.trim() || null }); onChanged() } catch { /* still */ } }
  const [specVal, setSpecVal] = useState(vehAct?.spec ?? '')
  const saveSpec = async () => { try { await setCalcActual(show.id, positionId, { spec: specVal.trim() || null }); onChanged() } catch { /* still */ } }
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const dirty = vSnapKey(m) !== savedSnap
  const snapStr = (v: unknown) => (v == null || v === '') ? '' : String(v)
  const hasDefaults = !!(snapStr(snapshot.veh_rental) || snapStr(snapshot.veh_included) || snapStr(snapshot.veh_extra))

  useEffect(() => {
    const key = `${show.id}:${positionId}`
    markRowDirty(key, dirty)
    return () => markRowDirty(key, false)
  }, [dirty, show.id, positionId])

  const setVals = (vid: string, patch: Partial<VVals>) => setM(p => {
    if (p.shared) return { ...p, s: { ...p.s, ...patch } }
    return { ...p, perVar: { ...p.perVar, [vid]: { ...(p.perVar[vid] ?? emptyV()), ...patch } } }
  })
  const toggleLink = () => setM(p => {
    if (p.shared) {
      const perVar = { ...p.perVar }
      variants.forEach(v => { const cur = perVar[v.id] ?? emptyV(); if (!vFilled(cur)) perVar[v.id] = { ...p.s } })
      return { ...p, shared: false, perVar }
    }
    const first = variants.map(v => p.perVar[v.id]).find(x => x && vFilled(x)) ?? p.s
    return { ...p, shared: true, s: { ...first } }
  })
  const applyDefaults = () => setM(p => {
    const patch: Partial<VVals> = { rental: snapStr(snapshot.veh_rental), included: snapStr(snapshot.veh_included), extra: snapStr(snapshot.veh_extra) }
    if (p.shared) return { ...p, s: { ...p.s, ...patch } }
    const perVar = { ...p.perVar }; variants.forEach(v => { perVar[v.id] = { ...(perVar[v.id] ?? emptyV()), ...patch } })
    return { ...p, perVar }
  })
  const toggleFuel = () => setM(p => {
    if (p.fuelOn) return { ...p, fuelOn: false }
    // beim Aktivieren Verbrauch/Preis aus den Fahrzeugdaten vorbefüllen, falls leer
    const c = snapStr(snapshot.veh_consumption), pr = snapStr(snapshot.veh_price)
    const fill = (v: VVals): VVals => ({ ...v, cons: v.cons || c, price: v.price || pr })
    if (p.shared) return { ...p, fuelOn: true, s: fill(p.s) }
    const perVar = { ...p.perVar }; variants.forEach(v => { perVar[v.id] = fill(perVar[v.id] ?? emptyV()) })
    return { ...p, fuelOn: true, perVar }
  })

  const valsFor = (vid: string): VVals => (m.shared ? m.s : (m.perVar[vid] ?? emptyV()))
  const cellTotal = (v: VVals): Decimal => vAmount(v).plus(m.fuelOn ? fuelAmount(v) : new Decimal(0))
  const rowResult = (): Decimal => {
    if (defaultVar === 'ist') {
      let r = new Decimal(0)
      const b = norm(m.ist); if (b != null) { try { r = r.plus(b) } catch { /* */ } }
      const f = norm(m.fuelIst); if (f != null) { try { r = r.plus(f) } catch { /* */ } }
      return r
    }
    return cellTotal(valsFor(defaultVar))
  }

  const payload = (): CalcEntryInput[] => {
    const out: CalcEntryInput[] = []
    const anyVe = (v: VVals) => norm(v.rental) != null || norm(v.km) != null || norm(v.included) != null || norm(v.extra) != null
    const anyFu = (v: VVals) => m.fuelOn && norm(v.km) != null && norm(v.cons) != null && norm(v.price) != null
    const mkVe = (variant_id: string | null, v: VVals): CalcEntryInput => ({ kind: 'vehicle', variant_id, rental_price: norm(v.rental), distance_km: norm(v.km), included_km: norm(v.included), price_extra_km: norm(v.extra) })
    const mkFu = (variant_id: string | null, v: VVals): CalcEntryInput => ({ kind: 'fuel', variant_id, distance_km: norm(v.km), quantity: norm(v.cons), unit_price: norm(v.price) })
    if (m.shared) {
      if (anyVe(m.s)) out.push(mkVe(null, m.s))
      if (anyFu(m.s)) out.push(mkFu(null, m.s))
    } else {
      variants.forEach(v => {
        const val = m.perVar[v.id] ?? emptyV()
        if (anyVe(val)) out.push(mkVe(v.id, val))
        if (anyFu(val)) out.push(mkFu(v.id, val))
      })
    }
    return out
  }

  const saveSoll = async () => {
    setBusy(true); setErr('')
    try { await withTimeout(replaceCalcEntries(show.id, positionId, payload())); setSavedSnap(vSnapKey(m)); onChanged() }
    catch (e: any) { setErr(e?.message ?? 'Fehler beim Speichern') }
    finally { setBusy(false) }
  }
  const copyAll = async () => { setBusy(true); try { const ok = await copyRowToAllShows(dataset, show.id, positionId, payload(), onChanged); if (ok) setSavedSnap(vSnapKey(m)) } catch (e: any) { setErr(e?.message ?? 'Fehler') } finally { setBusy(false) } }
  const saveIst = async () => {
    try { await withTimeout(setCalcActual(show.id, positionId, { amount: norm(m.ist) })); onChanged() }
    catch (e: any) { setErr(e?.message ?? 'Ist konnte nicht gespeichert werden') }
  }
  const saveIstFuel = async () => {
    try { await withTimeout(setCalcActual(show.id, positionId, { fuel_amount: norm(m.fuelIst) })); onChanged() }
    catch (e: any) { setErr(e?.message ?? 'Ist-Sprit konnte nicht gespeichert werden') }
  }
  const saveName = async () => { const nn = nameVal.trim(); if (!nn || nn === positionName) { setNameVal(positionName); return } try { await updateCalcPosition(positionId, { name: nn }); onChanged() } catch { setNameVal(positionName) } }
  const removeRow = async () => {
    if (!confirm(`„${positionName}" (Fahrzeug) aus der Kalkulation löschen?`)) return
    setBusy(true)
    try { await deleteCalcPosition(positionId); onChanged() } catch (e: any) { setErr(e?.message ?? 'Fehler'); setBusy(false) }
  }

  const vCell = { className: 'form-input', inputMode: 'decimal' as const, style: { fontSize: '0.75rem', padding: '2px 5px', width: '100%', textAlign: 'right' as const } }
  const tvCell = { className: 'form-input', inputMode: 'decimal' as const, style: { fontSize: '0.72rem', padding: '2px 6px', width: '100%', textAlign: 'right' as const } }

  return (
    <>
    <tr onDragOver={e => e.preventDefault()} onDragEnter={onDragEnterRow} onDrop={onDropRow}
      style={{ background: dragging ? '#243044' : (dropTarget ? '#1c2b3a' : '#1a2420'), opacity: dragging ? 0.35 : 1, boxShadow: dropTarget ? 'inset 0 2px 0 0 #60a5fa' : undefined }}>
      <td style={{ verticalAlign: 'top' }}>
        <div className="flex items-start gap-1.5">
          <span draggable onDragStart={onDragStartRow} onDragEnd={onDragEndRow} title="Zum Sortieren ziehen"
            className="shrink-0 cursor-grab active:cursor-grabbing" style={{ color: dragging ? '#60a5fa' : '#6b7280', lineHeight: 0, marginTop: 4 }}>
            <svg width="9" height="15" viewBox="0 0 9 15" fill="currentColor" aria-hidden="true">
              <circle cx="2.2" cy="3" r="1.25" /><circle cx="6.8" cy="3" r="1.25" />
              <circle cx="2.2" cy="7.5" r="1.25" /><circle cx="6.8" cy="7.5" r="1.25" />
              <circle cx="2.2" cy="12" r="1.25" /><circle cx="6.8" cy="12" r="1.25" />
            </svg>
          </span>
          <LinkBadge shared={m.shared} onClick={toggleLink} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center gap-1.5">
              <input value={nameVal} onChange={e => setNameVal(e.target.value)} onBlur={saveName}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} title="Name bearbeiten" className="text-sm"
                style={{ color: '#e0e0e0', background: 'transparent', border: '1px solid transparent', borderRadius: 4, padding: '1px 4px', whiteSpace: 'nowrap', width: `${Math.max(5, nameVal.length + 1)}ch`, minWidth: 44 }}
                onFocus={e => { e.target.style.border = '1px solid #4a4a4a' }} onBlurCapture={e => { e.target.style.border = '1px solid transparent' }} />
              <div className="flex items-center gap-1.5" style={{ marginLeft: 'auto' }}>
                <button onClick={toggleFuel} title="Sprit-Zeile (Strecke/100 × Verbrauch × €/L)"
                  className="shrink-0 inline-flex items-center gap-1 rounded"
                  style={{ fontSize: '0.7rem', padding: '2px 6px', color: m.fuelOn ? '#111827' : '#cbd5e1', background: m.fuelOn ? '#facc15' : 'transparent', border: `1px solid ${m.fuelOn ? '#facc15' : '#4a4a4a'}` }}>
                  ⛽ Sprit
                </button>
              </div>
            </div>
            <input value={info} onChange={e => setInfo(e.target.value)} onBlur={saveInfo}
              className="form-input" placeholder="Route / Vermieter / Info"
              style={{ fontSize: '0.72rem', padding: '1px 6px', marginTop: 3, width: '100%', maxWidth: 280 }} />
            {showSpec && (
              <input value={specVal} onChange={e => setSpecVal(e.target.value)} onBlur={saveSpec}
                className="form-input" placeholder="Spezifikation" style={{ fontSize: '0.72rem', padding: '1px 6px', marginTop: 3, width: '100%', maxWidth: 200 }} />
            )}
            {hasDefaults && (
              <button onClick={applyDefaults} title="Miete/inkl. km/€ pro Mehr-km aus den Fahrzeugdaten übernehmen"
                className="text-xs" style={{ color: '#60a5fa', marginTop: 2, display: 'inline-block' }}>Fahrzeugwerte übernehmen</button>
            )}
          </div>
        </div>
      </td>

      {variants.map((v, idx) => {
        const val = valsFor(v.id)
        const mirror = m.shared && idx > 0
        return (
          <td key={v.id} style={{ padding: '4px 8px', verticalAlign: 'top' }}>
            {mirror ? (
              <div title="Verknüpft mit Variante 1 (🔗 klicken zum Auflösen)"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, minHeight: 24, color: '#6b7280', fontSize: 12 }}>
                <LinkIcon className="w-3 h-3" style={{ opacity: 0.6 }} /><span>verknüpft</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <input {...vCell} style={{ ...vCell.style, flex: '1 1 46%', color: m.shared ? '#93c5fd' : undefined, background: m.shared ? linkedCellBg : undefined }} value={val.rental} placeholder="Miete" title="Fixmiete" onChange={e => setVals(v.id, { rental: e.target.value })} />
                <input {...vCell} style={{ ...vCell.style, flex: '1 1 46%', color: m.shared ? '#93c5fd' : undefined, background: m.shared ? linkedCellBg : undefined }} value={val.km} placeholder="km" title="gefahrene km" onChange={e => setVals(v.id, { km: e.target.value })} />
                <input {...vCell} style={{ ...vCell.style, flex: '1 1 46%', color: m.shared ? '#93c5fd' : undefined, background: m.shared ? linkedCellBg : undefined }} value={val.included} placeholder="inkl." title="inkl. km" onChange={e => setVals(v.id, { included: e.target.value })} />
                <input {...vCell} style={{ ...vCell.style, flex: '1 1 46%', color: m.shared ? '#93c5fd' : undefined, background: m.shared ? linkedCellBg : undefined }} value={val.extra} placeholder="€/km" title="€ pro Mehr-km" onChange={e => setVals(v.id, { extra: e.target.value })} />
              </div>
            )}
            <div className="text-right" style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(cellTotal(val))}</div>
          </td>
        )
      })}

      <td className="text-right" style={{ padding: '4px 8px', verticalAlign: 'top' }}>
        <input inputMode="decimal" className="form-input text-right" data-calc-col="ist" onKeyDown={e => gridTabDown(e, 'ist')} style={{ fontSize: '0.8rem', padding: '3px 8px', width: '100%', fontVariantNumeric: 'tabular-nums' }}
          value={m.ist} onChange={e => setM(p => ({ ...p, ist: e.target.value }))} onBlur={saveIst} placeholder="0" />
        <input inputMode="decimal" className="form-input text-right" title="Ist-Spritkosten (fixer Betrag) – wird zum Ist addiert"
          style={{ fontSize: '0.72rem', padding: '2px 8px', width: '100%', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}
          value={m.fuelIst} onChange={e => setM(p => ({ ...p, fuelIst: e.target.value }))} onBlur={saveIstFuel} placeholder="⛽ Sprit" />
      </td>

      <td className="text-right" style={{ padding: '4px 8px', verticalAlign: 'top', fontVariantNumeric: 'tabular-nums', color: '#e5e7eb', fontWeight: 500 }}>
        {formatMoney(rowResult())}
      </td>

      <td style={{ verticalAlign: 'top' }}>
        <div className="flex items-center gap-1 justify-end">
          {dirty && (
            <button onClick={saveSoll} disabled={busy} className="btn btn-primary" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>{busy ? '…' : 'Speichern'}</button>
          )}
          <button onClick={copyAll} disabled={busy} className="p-1 text-gray-400 hover:text-blue-400" title="Werte auf alle Termine kopieren"><DocumentDuplicateIcon className="w-3.5 h-3.5" /></button>
          <button onClick={removeRow} disabled={busy} className="p-1 text-gray-400 hover:text-red-500" title="Löschen"><TrashIcon className="w-3.5 h-3.5" /></button>
        </div>
        {err && <p className="text-[10px] mt-0.5" style={{ color: '#fca5a5' }}>{err}</p>}
      </td>
    </tr>

    {m.fuelOn && (
      <tr style={{ background: '#211f17' }}>
        <td style={{ verticalAlign: 'top' }}>
          <div className="flex items-center gap-1 text-xs" title="Strecke/100 × Verbrauch × €/L"
            style={{ color: '#facc15', paddingLeft: 22, whiteSpace: 'nowrap' }}>
            ⛽ Sprit <span style={{ color: '#6b7280', fontSize: 10 }}>L/100 × €/L</span>
          </div>
        </td>
        {variants.map((v, idx) => {
          const val = valsFor(v.id)
          const mirror = m.shared && idx > 0
          return (
            <td key={v.id} style={{ padding: '2px 6px', verticalAlign: 'middle' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {mirror ? (
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280', fontSize: 11 }}>
                    <LinkIcon className="w-3 h-3" style={{ opacity: 0.6 }} />verknüpft
                  </span>
                ) : (
                  <>
                    <input {...tvCell} style={{ ...tvCell.style, flex: 1, minWidth: 0, color: m.shared ? '#93c5fd' : undefined, background: m.shared ? linkedCellBg : undefined }} value={val.cons} placeholder="L/100" title="Verbrauch L/100 km" onChange={e => setVals(v.id, { cons: e.target.value })} />
                    <input {...tvCell} style={{ ...tvCell.style, flex: 1, minWidth: 0, color: m.shared ? '#93c5fd' : undefined, background: m.shared ? linkedCellBg : undefined }} value={val.price} placeholder="€/L" title="Spritpreis €/L" onChange={e => setVals(v.id, { price: e.target.value })} />
                  </>
                )}
                <span style={{ flex: '1.7 1 0', minWidth: 56, textAlign: 'right', fontSize: 11, color: '#facc15', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatMoney(fuelAmount(val))}</span>
              </div>
            </td>
          )
        })}
        <td /><td /><td />
      </tr>
    )}
    </>
  )
}

// ── Position anlegen: Dropdown mit Vorschlägen (bisherige Einträge) + „Neu anlegen" ──
interface PItem { id: string; name: string; group?: string; kind: 'function' | 'name' | 'hotel' | 'vehicle' }

function AddPositionControl({ category, isPersonal, isUnterkunft, isTransport, catPositions, functions, activeNames, reloadFunctions, vehicles, reloadVehicles, onDone }: {
  category: { id: string; name: string }
  isPersonal: boolean; isUnterkunft: boolean; isTransport: boolean
  catPositions: CalcDataset['positions']
  functions: FuncGroup[]; activeNames: string[]; reloadFunctions: () => void
  vehicles: Vehicle[]; reloadVehicles: () => void
  onDone: () => void
}) {
  // Im Transport-Bereich getrennt: Fahrzeug (aus Fuhrpark) ODER Sonstiges (frei: Sprit, Maut, Vignette …)
  const [tMode, setTMode] = useState<'vehicle' | 'other'>('vehicle')
  const asVehicle = isTransport && tMode === 'vehicle'

  const items = useMemo<PItem[]>(() => {
    if (isPersonal) return functions.flatMap(g => g.names.map(n => ({ id: `${g.group}::${n}`, name: n, group: g.group, kind: 'function' as const })))
    if (asVehicle) return vehicles.map(v => ({ id: `veh:${v.id}`, name: v.designation, group: v.vehicleType || undefined, kind: 'vehicle' as const }))
    const seen = new Set<string>()
    const names: PItem[] = []
    catPositions.filter(p => !p.is_overhead && p.pos_type !== 'vehicle').forEach(p => {
      const key = p.name.toLowerCase()
      if (!seen.has(key)) { seen.add(key); names.push({ id: p.name, name: p.name, kind: p.pos_type === 'hotel' ? 'hotel' : 'name' }) }
    })
    if (isUnterkunft && !seen.has('hotel')) names.unshift({ id: '__hotel__', name: 'Hotel', kind: 'hotel' })
    return names
  }, [isPersonal, isUnterkunft, asVehicle, functions, vehicles, catPositions])

  const commit = async (data: { name: string; spec?: string | null; kind: PItem['kind'] | 'new' }) => {
    const name = data.name.trim()
    if (!name) return
    if (asVehicle) {
      // Neu getipptes Fahrzeug → in den App-Fuhrpark schreiben (bidirektional)
      let snap: { rental?: string; included?: string; extra?: string; consumption?: string; price?: string } | undefined
      if (data.kind === 'new') {
        await createVehicle({ designation: name, vehicleType: '', driver: '', licensePlate: '', dimensions: '', powerConnection: '', hasTrailer: false, trailerDimensions: '', trailerLicensePlate: '', seats: '', sleepingPlaces: '', notes: '' })
        reloadVehicles()
      } else {
        const v = vehicles.find(x => x.designation === name)
        if (v) snap = { rental: v.rentalPrice, included: v.includedKm, extra: v.priceExtraKm, consumption: v.fuelConsumption, price: v.fuelPrice }
      }
      await createCalcPosition(category.id, name, null, false, 'vehicle', snap)
    } else if (data.kind === 'hotel' || (isUnterkunft && name.toLowerCase() === 'hotel')) {
      await createCalcPosition(category.id, 'Hotel', null, false, 'hotel')
    } else if (isPersonal) {
      if (data.kind === 'new' && !activeNames.includes(name)) { await saveFunctionCatalog([...activeNames, name]); reloadFunctions() }
      await createCalcPosition(category.id, name, data.spec?.trim() || null)
    } else {
      await createCalcPosition(category.id, name)
    }
    onDone()
  }

  return (
    <div>
      {isTransport && (
        <div className="flex gap-1 text-[11px]" style={{ marginBottom: 5 }}>
          <button onClick={() => setTMode('vehicle')} style={{ color: tMode === 'vehicle' ? '#60a5fa' : '#8b8b8b', fontWeight: tMode === 'vehicle' ? 600 : 400 }}>Fahrzeug</button>
          <span style={{ color: '#555' }}>·</span>
          <button onClick={() => setTMode('other')} style={{ color: tMode === 'other' ? '#60a5fa' : '#8b8b8b', fontWeight: tMode === 'other' ? 600 : 400 }}>Sonstiges (Sprit, Maut …)</button>
        </div>
      )}
      <SearchableDropdown<PItem>
        key={isTransport ? tMode : 'std'}
        value={null}
        placeholder={isPersonal ? 'Funktion wählen oder neu…' : (asVehicle ? 'Fahrzeug wählen oder neu…' : (isUnterkunft ? 'Position wählen (z.B. Hotel) oder neu…' : 'Position wählen oder neu…'))}
        items={items}
        filterFn={(it, q) => it.name.toLowerCase().includes(q.toLowerCase())}
        renderValue={it => it.name}
        renderItem={it => (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: '0.82rem', color: '#e0e0e0' }}>{it.name}</span>
            {it.group && <span style={{ fontSize: '0.68rem', color: '#6b7280' }}>{it.group}</span>}
          </div>
        )}
        onSelect={it => { if (it) commit({ name: it.name, kind: it.kind }) }}
        createLabel={isPersonal ? 'Neue Funktion anlegen' : (asVehicle ? 'Neues Fahrzeug anlegen' : 'Neue Position anlegen')}
        renderCreateForm={(_onCreated, onCancel) => (
          <InlineNewForm isPersonal={isPersonal} namePlaceholder={asVehicle ? 'Neues Fahrzeug…' : (isPersonal ? 'Neue Funktion…' : (isTransport ? 'z.B. Sprit, Maut, Vignette…' : 'Neue Position…'))} onCreate={(name, spec) => commit({ name, spec, kind: 'new' })} onCancel={onCancel} />
        )}
      />
    </div>
  )
}

function InlineNewForm({ isPersonal, namePlaceholder, onCreate, onCancel }: { isPersonal: boolean; namePlaceholder?: string; onCreate: (name: string, spec: string | null) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [spec, setSpec] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async () => {
    if (!name.trim()) { setErr('Name fehlt'); return }
    setBusy(true); setErr('')
    try { await onCreate(name.trim(), spec.trim() || null) } catch (e: any) { setErr(e?.message ?? 'Fehler'); setBusy(false) }
  }
  return (
    <div className="space-y-2">
      <input className="form-input" style={{ fontSize: '0.8rem', padding: '4px 8px', width: '100%' }} value={name}
        onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit() }}
        placeholder={namePlaceholder ?? (isPersonal ? 'Neue Funktion…' : 'Neue Position…')} autoFocus />
      {isPersonal && (
        <input className="form-input" style={{ fontSize: '0.8rem', padding: '4px 8px', width: '100%' }} value={spec}
          onChange={e => setSpec(e.target.value)} placeholder="Spezifikation (optional)" />
      )}
      <div className="flex items-center gap-2">
        <button onClick={submit} disabled={busy} className="btn btn-primary" style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}>{busy ? '…' : 'Anlegen'}</button>
        <button onClick={onCancel} className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}>Abbrechen</button>
        {err && <span className="text-[11px]" style={{ color: '#fca5a5' }}>{err}</span>}
      </div>
    </div>
  )
}
