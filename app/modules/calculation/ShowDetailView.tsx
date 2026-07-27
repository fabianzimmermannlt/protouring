'use client'

// Kalkulation – Show-Detail als Bereichs-Tabelle (Phase 3).
// Je Bereich: Zeilen = Positionen (auch neue anlegbar), Spalten = Soll je Variante
// (+ „gleich in allen Varianten"), dazu ein Ist-Wert pro Position/Show.
// Ist in calc_actuals (pro Position/Show), Soll in calc_entries (je Variante).

import { useMemo, useState } from 'react'
import Decimal from 'decimal.js'
import { ArrowLeftIcon, PencilIcon, PlusIcon, TrashIcon, LinkIcon, TruckIcon } from '@heroicons/react/24/outline'
import {
  createCalcPosition, replaceCalcEntries, setCalcActual, type CalcEntryInput,
} from '@/lib/api-client'
import type { CalcDataset, CalcShow, CalcProject } from '@/lib/calculation/types'
import { buildOverview, entryAmount } from '@/lib/calculation/engine'
import { formatEUR, formatMoney, formatDate } from '@/lib/calculation/format'
import { ShowFormModal } from './ShowsView'

const norm = (v: string): string | null => { const t = v.trim().replace(',', '.'); return t === '' ? null : t }
const numStr = (d: Decimal): string => d.toDecimalPlaces(4).toString()

interface Variant { id: string; name: string }

export default function ShowDetailView({ show, dataset, onChanged, onBack }: {
  show: CalcShow; dataset: CalcDataset; onChanged: () => void; onBack: () => void
}) {
  const [editParams, setEditParams] = useState(false)
  const project = dataset.project
  const variants: Variant[] = useMemo(() => [...dataset.variants].sort((a, b) => a.sort_order - b.sort_order), [dataset])
  const categories = useMemo(() => [...dataset.categories].sort((a, b) => a.sort_order - b.sort_order), [dataset])

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
            category={cat} variants={variants} onChanged={onChanged} />
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

function CategoryTable({ show, dataset, project, category, variants, onChanged }: {
  show: CalcShow; dataset: CalcDataset; project: CalcProject
  category: { id: string; name: string; kind: string }; variants: Variant[]; onChanged: () => void
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

  const [adding, setAdding] = useState(false)
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [pickId, setPickId] = useState('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const doAdd = async () => {
    setBusy(true); setErr('')
    try {
      let pid = pickId
      if (mode === 'new') {
        const name = newName.trim()
        if (!name) { setErr('Name fehlt'); setBusy(false); return }
        pid = (await createCalcPosition(category.id, name)).id
      } else if (!pid) { setErr('Position wählen'); setBusy(false); return }
      setAddedIds(prev => prev.includes(pid) ? prev : [...prev, pid])
      setAdding(false); setPickId(''); setNewName(''); setMode('existing')
      onChanged() // Katalog neu laden, damit die neue Position auftaucht
    } catch (e: any) { setErr(e?.message ?? 'Fehler'); setBusy(false); return }
    setBusy(false)
  }

  const colCount = 2 + variants.length + 2
  const showTravel = /personal/i.test(category.name)   // Reisekosten nur beim Personal
  const defaultVar = project.default_variant_id ?? variants[0]?.id ?? ''
  const defaultVarName = variants.find(v => v.id === defaultVar)?.name ?? ''

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
              <th className="text-right" style={{ minWidth: 100 }}>Ergebnis{defaultVarName && <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.6 }}> ({defaultVarName})</span>}</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {rowPositions.length === 0 && !adding && (
              <tr><td colSpan={colCount} className="text-center py-4" style={{ color: '#6b7280' }}>Keine Position – „+ Position".</td></tr>
            )}
            {rowPositions.map(p => (
              <PositionRow key={p.id} show={show} dataset={dataset} project={project}
                positionId={p.id} positionName={p.name} variants={variants} onChanged={onChanged}
                showTravel={showTravel} defaultVar={defaultVar} onRemove={() => setAddedIds(prev => prev.filter(x => x !== p.id))} />
            ))}
            {adding && (
              <tr>
                <td colSpan={colCount}>
                  <div className="flex flex-wrap items-center gap-2 py-1">
                    <div className="flex gap-1 text-[11px]">
                      <button onClick={() => setMode('existing')} style={{ color: mode === 'existing' ? '#60a5fa' : '#8b8b8b', fontWeight: mode === 'existing' ? 600 : 400 }}>Vorhanden</button>
                      <span style={{ color: '#555' }}>·</span>
                      <button onClick={() => setMode('new')} style={{ color: mode === 'new' ? '#60a5fa' : '#8b8b8b', fontWeight: mode === 'new' ? 600 : 400 }}>Neu</button>
                    </div>
                    {mode === 'existing' ? (
                      <select className="form-input" style={{ fontSize: '0.78rem', padding: '3px 6px', minWidth: 200 }} value={pickId} onChange={e => setPickId(e.target.value)}>
                        <option value="">– vorhandene Position –</option>
                        {availablePositions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    ) : (
                      <input className="form-input" style={{ fontSize: '0.78rem', padding: '3px 6px', minWidth: 200 }} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Neue Position…" autoFocus />
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
  const sharedVal = nullE.length ? numStr(entryAmount(nullE[0], project)) : ''
  const perVar: Record<string, string> = {}
  if (nullE.length) variants.forEach(v => { perVar[v.id] = sharedVal })     // Startwerte auch für den Aufgelöst-Fall
  varE.forEach(e => { if (e.variant_id) perVar[e.variant_id] = numStr(entryAmount(e, project)) })

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

function PositionRow({ show, dataset, project, positionId, positionName, variants, onChanged, onRemove, showTravel, defaultVar }: {
  show: CalcShow; dataset: CalcDataset; project: CalcProject
  positionId: string; positionName: string; variants: Variant[]; onChanged: () => void; onRemove: () => void
  showTravel: boolean; defaultVar: string
}) {
  const initial = useMemo<RowModel>(() => buildRowModel(dataset, project, show.id, positionId, variants), [dataset, project, show.id, positionId, variants])
  const [m, setM] = useState<RowModel>(initial)
  const [savedSnap, setSavedSnap] = useState(() => sollSnap(initial))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [travelOpen, setTravelOpen] = useState(() => variants.some(v => (initial.travelKm[v.id] ?? '') !== '' || (initial.travelRate[v.id] ?? '') !== ''))

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
      await replaceCalcEntries(show.id, positionId, entriesPayload())
      setSavedSnap(sollSnap(m))
      onChanged()
    } catch (e: any) { setErr(e?.message ?? 'Fehler'); setBusy(false) }
  }
  const saveIst = async () => {
    try { await setCalcActual(show.id, positionId, { amount: norm(m.ist), travel_km: norm(m.istTravelKm), travel_rate: norm(m.istTravelRate) }) } catch { /* still */ }
  }
  const removeRow = async () => {
    const hasData = entriesPayload().length > 0 || norm(m.ist) != null
    if (hasData && !confirm(`„${positionName}" aus dieser Show entfernen? (Buchungen + Ist dieser Show)`)) return
    setBusy(true)
    try {
      if (hasData) { await replaceCalcEntries(show.id, positionId, []); await setCalcActual(show.id, positionId, { amount: null, travel_km: null, travel_rate: null }) }
      onRemove()
      onChanged()
    } catch (e: any) { setErr(e?.message ?? 'Fehler'); setBusy(false) }
  }

  const cell = { className: 'form-input text-right', style: { fontSize: '0.8rem', padding: '3px 8px', width: '100%', fontVariantNumeric: 'tabular-nums' } as const }
  const tvCell = { className: 'form-input', inputMode: 'decimal' as const, style: { fontSize: '0.72rem', padding: '2px 6px', width: '100%', textAlign: 'right' as const } }
  const travelActive = travelOpen || variants.some(v => (m.travelKm[v.id] ?? '') !== '' || (m.travelRate[v.id] ?? '') !== '')

  return (
    <>
      <tr>
        <td>
          <div className="flex items-center gap-1.5">
            <button onClick={toggleLink}
              title={m.shared ? 'Verknüpft: gleicher Wert in allen Varianten (klicken zum Auflösen)' : 'Pro Variante (klicken zum Verknüpfen)'}
              className="shrink-0" style={{ color: m.shared ? '#60a5fa' : '#6b7280' }}>
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm" style={{ color: '#e0e0e0' }}>{positionName}</span>
            {showTravel && (
              <button onClick={() => setTravelOpen(o => !o)} title="Reisekosten (km × Preis)"
                className="shrink-0 inline-flex items-center gap-1 rounded"
                style={{ fontSize: '0.7rem', padding: '2px 6px', color: travelActive ? '#111827' : '#cbd5e1', background: travelActive ? '#facc15' : 'transparent', border: `1px solid ${travelActive ? '#facc15' : '#4a4a4a'}` }}>
                <TruckIcon className="w-3.5 h-3.5" /> Reise
              </button>
            )}
          </div>
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
