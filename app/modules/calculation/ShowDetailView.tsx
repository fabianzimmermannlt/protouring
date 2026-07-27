'use client'

// Kalkulation – Show-Detail als Bereichs-Tabelle (Phase 3).
// Je Bereich: Zeilen = Positionen (auch neue anlegbar), Spalten = Soll je Variante
// (+ „gleich in allen Varianten"), dazu ein Ist-Wert pro Position/Show.
// Ist in calc_actuals (pro Position/Show), Soll in calc_entries (je Variante).

import { useEffect, useMemo, useState } from 'react'
import Decimal from 'decimal.js'
import { ArrowLeftIcon, PencilIcon, PlusIcon, TrashIcon, LinkIcon, TruckIcon } from '@heroicons/react/24/outline'
import {
  createCalcPosition, updateCalcPosition, deleteCalcPosition, replaceCalcEntries, setCalcActual, getActiveFunctions, saveFunctionCatalog, type CalcEntryInput,
} from '@/lib/api-client'

interface FuncGroup { group: string; names: string[] }
import type { CalcDataset, CalcShow, CalcProject, CalcEntry } from '@/lib/calculation/types'
import { buildOverview, entryAmount } from '@/lib/calculation/engine'
import { formatEUR, formatMoney, formatDate } from '@/lib/calculation/format'
import { ShowFormModal } from './ShowsView'

const norm = (v: string): string | null => { const t = v.trim().replace(',', '.'); return t === '' ? null : t }
const numStr = (d: Decimal): string => d.toDecimalPlaces(4).toString()
const hv = (v: unknown) => v != null && v !== ''
const entryHasValue = (e: CalcEntry): boolean => hv(e.amount) || hv(e.quantity) || hv(e.distance_km) || hv(e.rental_price)

/** Schützt vor hängenden Requests: bricht nach ms mit Fehler ab. */
function withTimeout<T>(p: Promise<T>, ms = 15000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Zeitüberschreitung – bitte erneut versuchen (Verbindung?).')), ms)),
  ])
}

interface Variant { id: string; name: string }

export default function ShowDetailView({ show, dataset, onChanged, onBack }: {
  show: CalcShow; dataset: CalcDataset; onChanged: () => void; onBack: () => void
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
  useEffect(() => { loadFunctions() }, [])

  const [resultVar, setResultVar] = useState<string>(project.default_variant_id ?? variants[0]?.id ?? '')
  const [showSpec, setShowSpec] = useState(true)
  const [showName, setShowName] = useState(false)

  const summary = useMemo(() => {
    const ov = buildOverview(dataset, { variantId: project.default_variant_id ?? variants[0]?.id ?? null })
    return ov.shows.find(s => s.showId === show.id)
  }, [dataset, show.id, project.default_variant_id, variants])

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={onBack} className="btn btn-ghost" style={{ fontSize: '0.8rem' }}>
          <ArrowLeftIcon className="w-4 h-4" /> Zurück
        </button>
        <h3 className="text-base font-semibold" style={{ color: '#e0e0e0' }}>
          {show.city || '(ohne Stadt)'}{show.show_date ? ` · ${formatDate(show.show_date)}` : ''}{show.venue ? ` · ${show.venue}` : ''}
        </h3>
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
        <label className="text-xs flex items-center gap-1.5 cursor-pointer select-none" style={{ color: '#9ca3af' }}>
          <input type="checkbox" checked={showSpec} onChange={e => setShowSpec(e.target.checked)} /> Spezifikation
        </label>
        <label className="text-xs flex items-center gap-1.5 cursor-pointer select-none" style={{ color: '#9ca3af' }}>
          <input type="checkbox" checked={showName} onChange={e => setShowName(e.target.checked)} /> Name
        </label>
        {summary && (
          <div className="ml-auto text-xs flex gap-4" style={{ color: '#9ca3af' }}>
            <span>Gage netto: <b style={{ color: '#e0e0e0' }}>{formatEUR(summary.gageNet)}</b></span>
            <span>Ausgaben: <b style={{ color: '#e0e0e0' }}>{formatEUR(summary.ausgaben)}</b></span>
            <span>Ergebnis: <b style={{ color: summary.ergebnis.isNegative() ? '#f87171' : '#4ade80' }}>{formatEUR(summary.ergebnis)}</b></span>
          </div>
        )}
      </div>
      <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
        🔗 = ein gemeinsamer Soll-Wert für alle Varianten (Standard). Zum Auflösen aufs 🔗 klicken → je Variante ein eigenes Feld (der Wert bleibt erhalten, u.a. bei Var 1). „Ist" = tatsächliche Rechnung (für die Abrechnung).
      </p>

      <div className="space-y-4">
        {categories.map(cat => (
          <CategoryTable key={cat.id} show={show} dataset={dataset} project={project}
            category={cat} variants={variants} onChanged={onChanged}
            functions={functions} activeNames={activeNames} reloadFunctions={loadFunctions} resultVar={resultVar} showSpec={showSpec} showName={showName} />
        ))}
      </div>

      {editParams && (
        <ShowFormModal projectId={project.id} show={show}
          onClose={() => setEditParams(false)} onSaved={() => { setEditParams(false); onChanged() }} />
      )}
    </div>
  )
}

// ── Bereichs-Tabelle ─────────────────────────────────────────────────────────

function CategoryTable({ show, dataset, project, category, variants, onChanged, functions, activeNames, reloadFunctions, resultVar, showSpec, showName }: {
  show: CalcShow; dataset: CalcDataset; project: CalcProject
  category: { id: string; name: string; kind: string }; variants: Variant[]; onChanged: () => void
  functions: FuncGroup[]; activeNames: string[]; reloadFunctions: () => void; resultVar: string; showSpec: boolean; showName: boolean
}) {
  const catPositions = useMemo(
    () => dataset.positions.filter(p => p.category_id === category.id).sort((a, b) => a.sort_order - b.sort_order),
    [dataset, category.id])
  const catPosIds = useMemo(() => new Set(catPositions.map(p => p.id)), [catPositions])

  const usedIds = useMemo(() => {
    const s = new Set<string>()
    dataset.entries.forEach(e => { if (e.show_id === show.id && catPosIds.has(e.position_id)) s.add(e.position_id) })
    ;(dataset.actuals ?? []).forEach(a => { if (a.show_id === show.id && catPosIds.has(a.position_id)) s.add(a.position_id) })
    return s
  }, [dataset, show.id, catPosIds])

  // Positionen, die diese Session zusätzlich in die Tabelle geholt wurden (auch ohne Daten)
  const [addedIds, setAddedIds] = useState<string[]>([])
  const rowPositions = catPositions.filter(p => usedIds.has(p.id) || addedIds.includes(p.id))
  const rowIds = new Set(rowPositions.map(p => p.id))
  const availablePositions = catPositions.filter(p => !rowIds.has(p.id))
  const isPersonal = /personal/i.test(category.name)   // Personal: Funktionen statt Positionsliste

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
  const [mode, setMode] = useState<'existing' | 'new' | 'function'>(isPersonal ? 'function' : 'existing')
  const [pickId, setPickId] = useState('')
  const [newName, setNewName] = useState('')
  const [funcName, setFuncName] = useState('')
  const [funcSpec, setFuncSpec] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const doAdd = async () => {
    setBusy(true); setErr('')
    try {
      let pid = pickId
      if (mode === 'function' || mode === 'new') {
        const name = (mode === 'function' ? funcName : newName).trim()
        if (!name) { setErr(mode === 'function' ? 'Funktion wählen' : 'Name fehlt'); setBusy(false); return }
        if (isPersonal) {
          // neu angelegte Funktion → in den Katalog (Settings/Kontakte) schreiben
          if (mode === 'new' && !activeNames.includes(name)) { await saveFunctionCatalog([...activeNames, name]); reloadFunctions() }
          // Personal: IMMER neue Position (mehrere gleiche Funktionen erlaubt), mit Spezifikation
          pid = (await createCalcPosition(category.id, name, funcSpec.trim() || null)).id
        } else {
          const existing = catPositions.find(p => p.name === name)
          pid = existing ? existing.id : (await createCalcPosition(category.id, name)).id
        }
      } else if (!pid) { setErr('Position wählen'); setBusy(false); return }
      setAddedIds(prev => prev.includes(pid) ? prev : [...prev, pid])
      setAdding(false); setPickId(''); setNewName(''); setFuncName(''); setFuncSpec(''); setMode(isPersonal ? 'function' : 'existing')
      onChanged() // Katalog neu laden, damit die neue Position auftaucht
    } catch (e: any) { setErr(e?.message ?? 'Fehler'); setBusy(false); return }
    setBusy(false)
  }

  const colCount = 2 + variants.length + 2
  const showTravel = isPersonal                        // Reisekosten nur beim Personal
  const defaultVar = resultVar || project.default_variant_id || variants[0]?.id || ''
  const defaultVarName = defaultVar === 'ist' ? 'Ist' : (variants.find(v => v.id === defaultVar)?.name ?? '')

  return (
    <div className="pt-card">
      <div className="pt-card-header flex items-center justify-between"
        style={{ background: category.kind === 'income' ? '#173a28' : '#26313f', borderLeft: `4px solid ${category.kind === 'income' ? '#4ade80' : '#60a5fa'}` }}>
        <span className="pt-card-title" style={{ color: '#e5e7eb', letterSpacing: '0.02em' }}>{category.name} <span style={{ opacity: 0.55, fontWeight: 400 }}>· {category.kind === 'income' ? 'Einnahme' : 'Ausgabe'}</span></span>
        <button onClick={() => setAdding(a => !a)} className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}>
          <PlusIcon className="w-3.5 h-3.5" /> Position
        </button>
      </div>
      <div className="pt-card-body" style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: 620 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 200 }}>Position</th>
              {variants.map(v => <th key={v.id} className="text-right" style={{ minWidth: 130 }}>{v.name}</th>)}
              <th className="text-right" style={{ minWidth: 130, color: '#facc15' }}>Ist</th>
              <th className="text-right" style={{ minWidth: 110 }}>Ergebnis{defaultVarName && <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.6 }}> ({defaultVarName})</span>}</th>
              <th style={{ minWidth: 96 }} />
            </tr>
          </thead>
          <tbody>
            {rowPositions.length === 0 && !adding && (
              <tr><td colSpan={colCount} className="text-center py-4" style={{ color: '#6b7280' }}>Keine Position – „+ Position".</td></tr>
            )}
            {rowPositions.map(p => (
              <PositionRow key={p.id} show={show} dataset={dataset} project={project}
                positionId={p.id} positionName={p.name} positionSpec={p.spec ?? null} positionPerson={p.person ?? null} showSpec={showSpec} showName={showName}
                variants={variants} onChanged={onChanged}
                showTravel={showTravel} defaultVar={defaultVar} onRemove={() => setAddedIds(prev => prev.filter(x => x !== p.id))}
                dragging={dragId === p.id} dropTarget={dragOverId === p.id && dragId != null && dragId !== p.id}
                onDragStartRow={() => setDragId(p.id)} onDragEnterRow={() => { if (dragId && dragId !== p.id) setDragOverId(p.id) }}
                onDragEndRow={endDrag} onDropRow={() => reorderTo(p.id)} />
            ))}
            {adding && (
              <tr>
                <td colSpan={colCount}>
                  <div className="flex flex-wrap items-center gap-2 py-1">
                    <div className="flex gap-1 text-[11px]">
                      {isPersonal ? (
                        <button onClick={() => setMode('function')} style={{ color: mode === 'function' ? '#60a5fa' : '#8b8b8b', fontWeight: mode === 'function' ? 600 : 400 }}>Funktion</button>
                      ) : (
                        <button onClick={() => setMode('existing')} style={{ color: mode === 'existing' ? '#60a5fa' : '#8b8b8b', fontWeight: mode === 'existing' ? 600 : 400 }}>Vorhanden</button>
                      )}
                      <span style={{ color: '#555' }}>·</span>
                      <button onClick={() => setMode('new')} style={{ color: mode === 'new' ? '#60a5fa' : '#8b8b8b', fontWeight: mode === 'new' ? 600 : 400 }}>Neu</button>
                    </div>
                    {mode === 'function' ? (
                      <select className="form-input" style={{ fontSize: '0.78rem', padding: '3px 6px', minWidth: 200 }} value={funcName} onChange={e => setFuncName(e.target.value)} autoFocus>
                        <option value="">– Funktion –</option>
                        {functions.map(g => (
                          <optgroup key={g.group} label={g.group}>
                            {g.names.map(n => <option key={n} value={n}>{n}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    ) : mode === 'existing' ? (
                      <select className="form-input" style={{ fontSize: '0.78rem', padding: '3px 6px', minWidth: 200 }} value={pickId} onChange={e => setPickId(e.target.value)}>
                        <option value="">– vorhandene Position –</option>
                        {availablePositions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    ) : (
                      <input className="form-input" style={{ fontSize: '0.78rem', padding: '3px 6px', minWidth: 200 }} value={newName} onChange={e => setNewName(e.target.value)} placeholder={isPersonal ? 'Neue Funktion…' : 'Neue Position…'} autoFocus />
                    )}
                    {isPersonal && (
                      <input className="form-input" style={{ fontSize: '0.78rem', padding: '3px 6px', width: 170 }} value={funcSpec} onChange={e => setFuncSpec(e.target.value)} placeholder="Name/Spez. (optional)" />
                    )}
                    <button onClick={doAdd} disabled={busy} className="btn btn-primary" style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}>{busy ? '…' : 'Hinzufügen'}</button>
                    <button onClick={() => { setAdding(false); setErr('') }} className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}>Abbrechen</button>
                    {err && <span className="text-[11px]" style={{ color: '#fca5a5' }}>{err}</span>}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Positions-Zeile ──────────────────────────────────────────────────────────

interface RowModel { shared: boolean; sharedVal: string; perVar: Record<string, string>; travelKm: Record<string, string>; travelRate: Record<string, string>; ist: string; istTravelKm: string; istTravelRate: string }

const sollSnap = (x: RowModel) => JSON.stringify({ shared: x.shared, sharedVal: x.sharedVal, perVar: x.perVar, travelKm: x.travelKm, travelRate: x.travelRate })

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
  const tNull = travelE.find(e => e.variant_id == null)
  if (tNull) variants.forEach(v => {
    travelKm[v.id] = tNull.quantity != null ? String(tNull.quantity) : ''
    travelRate[v.id] = tNull.unit_price != null ? String(tNull.unit_price) : ''
  })
  travelE.filter(e => e.variant_id != null).forEach(e => {
    if (!e.variant_id) return
    travelKm[e.variant_id] = e.quantity != null ? String(e.quantity) : ''
    travelRate[e.variant_id] = e.unit_price != null ? String(e.unit_price) : ''
  })

  const act = (dataset.actuals ?? []).find(a => a.show_id === showId && a.position_id === positionId)
  return {
    shared, sharedVal, perVar, travelKm, travelRate,
    ist: act?.amount != null ? String(act.amount) : '',
    istTravelKm: act?.travel_km != null ? String(act.travel_km) : '',
    istTravelRate: act?.travel_rate != null ? String(act.travel_rate) : '',
  }
}

function PositionRow({ show, dataset, project, positionId, positionName, positionSpec, positionPerson, showSpec, showName, variants, onChanged, onRemove, showTravel, defaultVar, dragging, dropTarget, onDragStartRow, onDragEnterRow, onDragEndRow, onDropRow }: {
  show: CalcShow; dataset: CalcDataset; project: CalcProject
  positionId: string; positionName: string; positionSpec: string | null; positionPerson: string | null; showSpec: boolean; showName: boolean
  variants: Variant[]; onChanged: () => void; onRemove: () => void
  showTravel: boolean; defaultVar: string
  dragging: boolean; dropTarget: boolean
  onDragStartRow: () => void; onDragEnterRow: () => void; onDragEndRow: () => void; onDropRow: () => void
}) {
  const initial = useMemo<RowModel>(() => buildRowModel(dataset, project, show.id, positionId, variants), [dataset, project, show.id, positionId, variants])
  const [m, setM] = useState<RowModel>(initial)
  const [savedSnap, setSavedSnap] = useState(() => sollSnap(initial))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [travelOpen, setTravelOpen] = useState(() => variants.some(v => (initial.travelKm[v.id] ?? '') !== '' || (initial.travelRate[v.id] ?? '') !== ''))
  const [spec, setSpec] = useState(positionSpec ?? '')
  const saveSpec = async () => { try { await updateCalcPosition(positionId, { spec: spec.trim() || null }) } catch { /* still */ } }
  const [person, setPerson] = useState(positionPerson ?? '')
  const savePerson = async () => { try { await updateCalcPosition(positionId, { person: person.trim() || null }); onChanged() } catch { /* still */ } }
  const [nameVal, setNameVal] = useState(positionName)
  const saveName = async () => {
    const nn = nameVal.trim()
    if (!nn || nn === positionName) { setNameVal(positionName); return }
    try { await updateCalcPosition(positionId, { name: nn }); onChanged() } catch { setNameVal(positionName) }
  }

  const sollDirty = sollSnap(m) !== savedSnap

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
    const km = norm(m.travelKm[vid] ?? ''), rate = norm(m.travelRate[vid] ?? '')
    if (km == null || rate == null) return null
    try { return new Decimal(km).times(rate) } catch { return null }
  }
  const istTravelRes = (): Decimal | null => {
    const km = norm(m.istTravelKm), rate = norm(m.istTravelRate)
    if (km == null || rate == null) return null
    try { return new Decimal(km).times(rate) } catch { return null }
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
      const km = norm(m.travelKm[v.id] ?? ''), rate = norm(m.travelRate[v.id] ?? '')
      if (km != null && rate != null) travel.push({ kind: 'travel', variant_id: v.id, quantity: km, unit_price: rate })
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
    try { await withTimeout(setCalcActual(show.id, positionId, { amount: norm(m.ist), travel_km: norm(m.istTravelKm), travel_rate: norm(m.istTravelRate) })) }
    catch (e: any) { setErr(e?.message ?? 'Ist konnte nicht gespeichert werden') }
  }
  const removeRow = async () => {
    const hasDataHere = entriesPayload().length > 0 || norm(m.ist) != null
    // Wird die Position in ANDEREN Shows (oder als Fixkosten) verwendet? Dann nur hier entfernen.
    const filled = (v: string | number | null | undefined) => v != null && String(v).trim() !== ''
    const usedElsewhere = dataset.entries.some(e => e.position_id === positionId && e.show_id !== show.id)
      || (dataset.actuals ?? []).some(a => a.position_id === positionId && a.show_id !== show.id && (filled(a.amount) || filled(a.travel_km)))
    const msg = usedElsewhere
      ? `„${positionName}" aus dieser Show entfernen? Buchungen + Ist nur dieser Show – in anderen Shows bleibt die Position erhalten.`
      : `„${positionName}" komplett aus der Kalkulation löschen?`
    if ((hasDataHere || !usedElsewhere) && !confirm(msg)) return
    setBusy(true)
    try {
      if (hasDataHere) { await replaceCalcEntries(show.id, positionId, []); await setCalcActual(show.id, positionId, { amount: null, travel_km: null, travel_rate: null }) }
      if (!usedElsewhere) await deleteCalcPosition(positionId)
      onRemove()
      onChanged()
    } catch (e: any) { setErr(e?.message ?? 'Fehler'); setBusy(false) }
  }

  const cell = { className: 'form-input text-right', style: { fontSize: '0.8rem', padding: '3px 8px', width: '100%', fontVariantNumeric: 'tabular-nums' } as const }
  const tvCell = { className: 'form-input', inputMode: 'decimal' as const, style: { fontSize: '0.72rem', padding: '2px 6px', width: '100%', textAlign: 'right' as const } }
  const travelActive = travelOpen || variants.some(v => (m.travelKm[v.id] ?? '') !== '' || (m.travelRate[v.id] ?? '') !== '')

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
          <div className="flex items-center gap-1.5">
            <span draggable onDragStart={onDragStartRow} onDragEnd={onDragEndRow}
              title="Zum Sortieren ziehen" className="shrink-0 cursor-grab active:cursor-grabbing"
              style={{ color: dragging ? '#60a5fa' : '#6b7280', lineHeight: 0 }}>
              <svg width="9" height="15" viewBox="0 0 9 15" fill="currentColor" aria-hidden="true">
                <circle cx="2.2" cy="3" r="1.25" /><circle cx="6.8" cy="3" r="1.25" />
                <circle cx="2.2" cy="7.5" r="1.25" /><circle cx="6.8" cy="7.5" r="1.25" />
                <circle cx="2.2" cy="12" r="1.25" /><circle cx="6.8" cy="12" r="1.25" />
              </svg>
            </span>
            <button onClick={toggleLink}
              title={m.shared ? 'Verknüpft: gleicher Wert in allen Varianten (klicken zum Auflösen)' : 'Pro Variante (klicken zum Verknüpfen)'}
              className="shrink-0" style={{ color: m.shared ? '#60a5fa' : '#6b7280' }}>
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
            <input value={nameVal} onChange={e => setNameVal(e.target.value)} onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              title="Name bearbeiten"
              className="text-sm"
              style={{ color: '#e0e0e0', background: 'transparent', border: '1px solid transparent', borderRadius: 4, padding: '1px 4px', whiteSpace: 'nowrap', width: `${Math.max(6, nameVal.length + 1)}ch`, minWidth: 60 }}
              onFocus={e => { e.target.style.border = '1px solid #4a4a4a'; e.target.style.background = '#1f2937' }}
              onBlurCapture={e => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent' }} />
            {showSpec ? (
              <input className="form-input" style={{ fontSize: '0.72rem', padding: '1px 5px', width: 110 }} value={spec}
                onChange={e => setSpec(e.target.value)} onBlur={saveSpec} placeholder="Spezifikation" />
            ) : (spec ? <span className="text-xs" style={{ color: '#9ca3af' }}>· {spec}</span> : null)}
            {showTravel && (
              <button onClick={() => setTravelOpen(o => !o)} title="Reisekosten (km × Preis)"
                className="shrink-0 inline-flex items-center gap-1 rounded"
                style={{ fontSize: '0.7rem', padding: '2px 6px', color: travelActive ? '#111827' : '#cbd5e1', background: travelActive ? '#facc15' : 'transparent', border: `1px solid ${travelActive ? '#facc15' : '#4a4a4a'}` }}>
                <TruckIcon className="w-3.5 h-3.5" /> Reise
              </button>
            )}
          </div>
          {showName && (
            <input value={person} onChange={e => setPerson(e.target.value)} onBlur={savePerson}
              className="form-input" placeholder="Name (Person)"
              style={{ fontSize: '0.72rem', padding: '1px 6px', marginTop: 3, marginLeft: 22, width: 'calc(100% - 22px)', maxWidth: 220 }} />
          )}
        </td>

        {variants.map(v => (
          <td key={v.id} className="text-right" style={{ padding: '4px 8px' }}>
            <input inputMode="decimal" {...cell}
              value={m.shared ? m.sharedVal : (m.perVar[v.id] ?? '')}
              onChange={e => {
                const val = e.target.value
                setM(p => {
                  if (!p.shared) return { ...p, perVar: { ...p.perVar, [v.id]: val } }
                  const perVar: Record<string, string> = {}
                  variants.forEach(vv => { perVar[vv.id] = val })
                  return { ...p, sharedVal: val, perVar }
                })
              }}
              placeholder="0"
              title={m.shared ? 'Verknüpft: gleicher Wert in allen Varianten' : undefined}
              style={{ ...cell.style, color: m.shared ? '#93c5fd' : undefined }} />
          </td>
        ))}

        <td className="text-right" style={{ padding: '4px 8px' }}>
          <input inputMode="decimal" className="form-input text-right" style={{ fontSize: '0.8rem', padding: '3px 8px', width: '100%', fontVariantNumeric: 'tabular-nums' }}
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
            <div className="flex items-center gap-1 text-xs" style={{ color: '#facc15', paddingLeft: 22 }}>
              <TruckIcon className="w-3.5 h-3.5" /> Reise <span style={{ color: '#6b7280', fontSize: 10 }}>(km × €/km)</span>
              {travelActive && (
                <button onClick={() => setM(p => ({ ...p, travelKm: {}, travelRate: {} }))} className="text-gray-500 hover:text-red-500 ml-1" title="Reisekosten löschen">✕</button>
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
                  <span style={{ flex: 1, minWidth: 0, textAlign: 'right', fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{res != null ? formatMoney(res) : ''}</span>
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
              <span style={{ flex: 1, minWidth: 0, textAlign: 'right', fontSize: 11, color: '#facc15', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{istTravelRes() != null ? formatMoney(istTravelRes()!) : ''}</span>
            </div>
          </td>
          <td />
          <td />
        </tr>
      )}
    </>
  )
}
