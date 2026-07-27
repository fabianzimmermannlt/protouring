'use client'

// Kalkulation – Show-Detail als Bereichs-Tabelle (Phase 3, Schritt 2 v2).
// Je Bereich: Zeilen = Positionen (auch neue anlegbar), Spalten = Soll je Variante
// (+ „gleich in allen Varianten"), dazu ein Ist-Wert pro Position/Show.
// Ist liegt in calc_actuals (pro Position/Show), Soll in calc_entries (je Variante).
// Direktbetrag pro Zelle; strukturierte Bereichs-Rechner (Personal/Fahrzeug) später.

import { useMemo, useState } from 'react'
import Decimal from 'decimal.js'
import { ArrowLeftIcon, PencilIcon, PlusIcon, TrashIcon, LinkIcon } from '@heroicons/react/24/outline'
import {
  createCalcPosition, replaceCalcEntries, setCalcActual, type CalcEntryInput,
} from '@/lib/api-client'
import type { CalcDataset, CalcShow, CalcProject } from '@/lib/calculation/types'
import { buildOverview, entryAmount } from '@/lib/calculation/engine'
import { formatEUR, formatDate } from '@/lib/calculation/format'
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
        Soll je Variante · Ist = tatsächliche Rechnung (für Abrechnung). 🔗 = gleicher Soll in allen Varianten; aufklappen für Alternativen.
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
  const catPosIds = new Set(catPositions.map(p => p.id))

  // Positionen mit Daten für diese Show (Buchung ODER Ist)
  const usedIds = useMemo(() => {
    const s = new Set<string>()
    dataset.entries.forEach(e => { if (e.show_id === show.id && catPosIds.has(e.position_id)) s.add(e.position_id) })
    ;(dataset.actuals ?? []).forEach(a => { if (a.show_id === show.id && catPosIds.has(a.position_id)) s.add(a.position_id) })
    return s
  }, [dataset, show.id, category.id])

  const usedPositions = catPositions.filter(p => usedIds.has(p.id))
  const unusedPositions = catPositions.filter(p => !usedIds.has(p.id))
  const [drafts, setDrafts] = useState<number[]>([])
  const [n, setN] = useState(0)
  const addDraft = () => { setDrafts(d => [...d, n]); setN(n + 1) }

  const colCount = 2 + variants.length + 2 // Position + Soll-cols + Ist + Aktion

  return (
    <div className="pt-card">
      <div className="pt-card-header flex items-center justify-between">
        <span className="pt-card-title">{category.name} <span style={{ opacity: 0.5, fontWeight: 400 }}>· {category.kind === 'income' ? 'Einnahme' : 'Ausgabe'}</span></span>
        <button onClick={addDraft} className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}>
          <PlusIcon className="w-3.5 h-3.5" /> Position
        </button>
      </div>
      <div className="pt-card-body" style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: 620 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 200 }}>Position</th>
              {variants.map(v => <th key={v.id} className="text-right" style={{ minWidth: 110 }}>{v.name}</th>)}
              <th className="text-right" style={{ minWidth: 110, color: '#facc15' }}>Ist</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {usedPositions.length === 0 && drafts.length === 0 && (
              <tr><td colSpan={colCount} className="text-center py-4" style={{ color: '#6b7280' }}>Keine Position – „+ Position".</td></tr>
            )}
            {usedPositions.map(p => (
              <PositionRow key={p.id} show={show} dataset={dataset} project={project}
                positionId={p.id} positionName={p.name} variants={variants} onChanged={onChanged} />
            ))}
            {drafts.map(d => (
              <PositionRow key={`draft-${d}`} show={show} dataset={dataset} project={project}
                positionId={null} positionName="" variants={variants} onChanged={onChanged}
                categoryId={category.id} availablePositions={unusedPositions}
                onRemoveDraft={() => setDrafts(list => list.filter(x => x !== d))} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Positions-Zeile ──────────────────────────────────────────────────────────

interface RowModel { shared: boolean; sharedVal: string; perVar: Record<string, string>; ist: string }

function buildRowModel(dataset: CalcDataset, project: CalcProject, showId: string, positionId: string): RowModel {
  const es = dataset.entries.filter(e => e.show_id === showId && e.position_id === positionId)
  const nullE = es.filter(e => e.variant_id == null)
  const varE = es.filter(e => e.variant_id != null)
  const perVar: Record<string, string> = {}
  varE.forEach(e => { if (e.variant_id) perVar[e.variant_id] = numStr(entryAmount(e, project)) })
  const act = (dataset.actuals ?? []).find(a => a.show_id === showId && a.position_id === positionId)
  return {
    shared: varE.length === 0,
    sharedVal: nullE.length ? numStr(entryAmount(nullE[0], project)) : '',
    perVar,
    ist: act?.amount != null ? String(act.amount) : '',
  }
}

function PositionRow({ show, dataset, project, positionId, positionName, variants, onChanged, categoryId, availablePositions, onRemoveDraft }: {
  show: CalcShow; dataset: CalcDataset; project: CalcProject
  positionId: string | null; positionName: string; variants: Variant[]; onChanged: () => void
  categoryId?: string; availablePositions?: { id: string; name: string }[]; onRemoveDraft?: () => void
}) {
  const isDraft = positionId == null
  const initial = useMemo<RowModel>(
    () => positionId ? buildRowModel(dataset, project, show.id, positionId) : { shared: true, sharedVal: '', perVar: {}, ist: '' },
    [dataset, project, show.id, positionId])

  const [m, setM] = useState<RowModel>(initial)
  const [savedSnap, setSavedSnap] = useState(() => JSON.stringify(initial))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // Draft-Positionswahl
  const [pickMode, setPickMode] = useState<'existing' | 'new'>('existing')
  const [pickId, setPickId] = useState('')
  const [newName, setNewName] = useState('')

  const setShared = (v: boolean) => setM(p => ({ ...p, shared: v }))
  const setSharedVal = (v: string) => setM(p => ({ ...p, sharedVal: v }))
  const setPerVar = (vid: string, v: string) => setM(p => ({ ...p, perVar: { ...p.perVar, [vid]: v } }))

  const sollDirty = JSON.stringify({ ...m, ist: '' }) !== JSON.stringify({ ...JSON.parse(savedSnap), ist: '' })

  const entriesPayload = (): CalcEntryInput[] => {
    if (m.shared) {
      const a = norm(m.sharedVal)
      return a == null ? [] : [{ variant_id: null, amount: a }]
    }
    return variants
      .map(v => ({ v, a: norm(m.perVar[v.id] ?? '') }))
      .filter(x => x.a != null)
      .map(x => ({ variant_id: x.v.id, amount: x.a }))
  }

  const saveSoll = async () => {
    setBusy(true); setErr('')
    try {
      let pid = positionId
      if (isDraft) {
        if (pickMode === 'new') {
          const name = newName.trim()
          if (!name) { setErr('Name fehlt'); setBusy(false); return }
          pid = (await createCalcPosition(categoryId!, name)).id
        } else {
          if (!pickId) { setErr('Position wählen'); setBusy(false); return }
          pid = pickId
        }
      }
      await replaceCalcEntries(show.id, pid!, entriesPayload())
      if (norm(m.ist) != null) await setCalcActual(show.id, pid!, norm(m.ist))
      setSavedSnap(JSON.stringify(m))
      if (isDraft) onRemoveDraft?.()
      onChanged()
    } catch (e: any) { setErr(e?.message ?? 'Fehler'); setBusy(false) }
  }

  const saveIst = async () => {
    if (isDraft || !positionId) return
    try { await setCalcActual(show.id, positionId, norm(m.ist)) } catch { /* still */ }
  }

  const removeRow = async () => {
    if (isDraft) { onRemoveDraft?.(); return }
    if (!confirm(`„${positionName}" aus dieser Show entfernen? (Buchungen + Ist dieser Show)`)) return
    setBusy(true)
    try {
      await replaceCalcEntries(show.id, positionId!, [])
      await setCalcActual(show.id, positionId!, null)
      onChanged()
    } catch (e: any) { setErr(e?.message ?? 'Fehler'); setBusy(false) }
  }

  const cell = { className: 'form-input text-right', style: { fontSize: '0.78rem', padding: '3px 6px' } as const }

  return (
    <tr>
      {/* Position */}
      <td>
        {isDraft ? (
          <div className="space-y-1">
            <div className="flex gap-1 text-[11px]">
              <button onClick={() => setPickMode('existing')} className={pickMode === 'existing' ? 'font-semibold' : ''} style={{ color: pickMode === 'existing' ? '#60a5fa' : '#8b8b8b' }}>Vorhanden</button>
              <span style={{ color: '#555' }}>·</span>
              <button onClick={() => setPickMode('new')} className={pickMode === 'new' ? 'font-semibold' : ''} style={{ color: pickMode === 'new' ? '#60a5fa' : '#8b8b8b' }}>Neu</button>
            </div>
            {pickMode === 'existing' ? (
              <select className="form-input" style={{ fontSize: '0.78rem', padding: '3px 6px' }} value={pickId} onChange={e => setPickId(e.target.value)}>
                <option value="">– wählen –</option>
                {(availablePositions ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : (
              <input className="form-input" style={{ fontSize: '0.78rem', padding: '3px 6px' }} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Neue Position…" />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShared(!m.shared)} title={m.shared ? 'Gleich in allen Varianten (klicken für Alternativen)' : 'Pro Variante (klicken für einen Wert)'}
              className="shrink-0" style={{ color: m.shared ? '#60a5fa' : '#6b7280' }}>
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm" style={{ color: '#e0e0e0' }}>{positionName}</span>
          </div>
        )}
      </td>

      {/* Soll je Variante */}
      {m.shared ? (
        <td colSpan={variants.length} className="text-right">
          <div className="flex items-center justify-end gap-2">
            <span className="text-[10px]" style={{ color: '#8b8b8b' }}>alle Varianten:</span>
            <input inputMode="decimal" {...cell} style={{ ...cell.style, maxWidth: 120 }} value={m.sharedVal} onChange={e => setSharedVal(e.target.value)} placeholder="0" />
          </div>
        </td>
      ) : (
        variants.map(v => (
          <td key={v.id} className="text-right">
            <input inputMode="decimal" {...cell} style={{ ...cell.style, maxWidth: 100 }} value={m.perVar[v.id] ?? ''} onChange={e => setPerVar(v.id, e.target.value)} placeholder="0" />
          </td>
        ))
      )}

      {/* Ist */}
      <td className="text-right">
        <input inputMode="decimal" className="form-input text-right" style={{ fontSize: '0.78rem', padding: '3px 6px', maxWidth: 100 }}
          value={m.ist} onChange={e => setM(p => ({ ...p, ist: e.target.value }))} onBlur={saveIst} placeholder="0" />
      </td>

      {/* Aktion */}
      <td>
        <div className="flex items-center gap-1 justify-end">
          {(sollDirty || isDraft) && (
            <button onClick={saveSoll} disabled={busy} className="btn btn-primary" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
              {busy ? '…' : isDraft ? 'Anlegen' : 'Speichern'}
            </button>
          )}
          <button onClick={removeRow} disabled={busy} className="p-1 text-gray-400 hover:text-red-500" title={isDraft ? 'Verwerfen' : 'Entfernen'}>
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
        {err && <p className="text-[10px] mt-0.5" style={{ color: '#fca5a5' }}>{err}</p>}
      </td>
    </tr>
  )
}
