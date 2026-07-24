'use client'

// Kalkulation – Show-Detail mit Buchungs-Editor (Phase 3, Schritt 2).
// Zeigt Deal-Parameter (bearbeitbar via Maske) + alle Buchungen dieser Show,
// gruppiert nach Bereich. Menge×Preis ODER Fahrzeugrechnung, Variante, Ist.

import { useMemo, useState } from 'react'
import Decimal from 'decimal.js'
import { ArrowLeftIcon, PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { createCalcEntry, updateCalcEntry, deleteCalcEntry, type CalcEntryInput } from '@/lib/api-client'
import type { CalcDataset, CalcShow, CalcEntry, CalcProject } from '@/lib/calculation/types'
import { buildOverview, entryAmount } from '@/lib/calculation/engine'
import { formatEUR, formatDate } from '@/lib/calculation/format'
import { ShowFormModal } from './ShowsView'

const norm = (v: string): string | null => { const t = v.trim().replace(',', '.'); return t === '' ? null : t }

type Mode = 'simple' | 'vehicle'
const modeOf = (e: Partial<CalcEntry>): Mode =>
  (e.distance_km != null && e.distance_km !== '') || (e.rental_price != null && e.rental_price !== '') ? 'vehicle' : 'simple'

export default function ShowDetailView({ show, dataset, onChanged, onBack }: {
  show: CalcShow; dataset: CalcDataset; onChanged: () => void; onBack: () => void
}) {
  const [editParams, setEditParams] = useState(false)
  const project = dataset.project
  const variantsSorted = useMemo(() => [...dataset.variants].sort((a, b) => a.sort_order - b.sort_order), [dataset])
  const categoriesSorted = useMemo(() => [...dataset.categories].sort((a, b) => a.sort_order - b.sort_order), [dataset])
  const posById = useMemo(() => new Map(dataset.positions.map(p => [p.id, p])), [dataset])
  const catOfPos = (posId: string) => posById.get(posId)?.category_id

  // Buchungen dieser Show, gruppiert nach Bereich
  const entriesByCat = useMemo(() => {
    const m = new Map<string, CalcEntry[]>()
    dataset.entries.filter(e => e.show_id === show.id).forEach(e => {
      const cat = catOfPos(e.position_id)
      if (!cat) return
      if (!m.has(cat)) m.set(cat, [])
      m.get(cat)!.push(e)
    })
    return m
  }, [dataset, show.id])

  // Kompakte Kennzahl-Zeile (Standardvariante)
  const summary = useMemo(() => {
    const ov = buildOverview(dataset, { variantId: project.default_variant_id ?? variantsSorted[0]?.id ?? null })
    return ov.shows.find(s => s.showId === show.id)
  }, [dataset, show.id, project.default_variant_id, variantsSorted])

  // Draft-Buchungen (neu) je Bereich
  const [drafts, setDrafts] = useState<Record<string, number>>({}) // catId → nächste Draft-Nummer
  const [draftList, setDraftList] = useState<{ key: string; catId: string }[]>([])
  const addDraft = (catId: string) => {
    const n = (drafts[catId] ?? 0) + 1
    setDrafts(p => ({ ...p, [catId]: n }))
    setDraftList(l => [...l, { key: `${catId}-${n}`, catId }])
  }
  const removeDraft = (key: string) => setDraftList(l => l.filter(d => d.key !== key))

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
        Buchungen dieser Show, nach Bereich. „Alle Varianten" = gilt in jeder Variante; sonst nur in der gewählten.
      </p>

      <div className="space-y-4">
        {categoriesSorted.map(cat => {
          const entries = entriesByCat.get(cat.id) ?? []
          const catDrafts = draftList.filter(d => d.catId === cat.id)
          return (
            <div key={cat.id} className="pt-card">
              <div className="pt-card-header flex items-center justify-between">
                <span className="pt-card-title">{cat.name} <span style={{ opacity: 0.5, fontWeight: 400 }}>· {cat.kind === 'income' ? 'Einnahme' : 'Ausgabe'}</span></span>
                <button onClick={() => addDraft(cat.id)} className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}>
                  <PlusIcon className="w-3.5 h-3.5" /> Buchung
                </button>
              </div>
              <div className="pt-card-body space-y-2">
                {entries.length === 0 && catDrafts.length === 0 && (
                  <p className="text-xs" style={{ color: '#6b7280' }}>Keine Buchung in diesem Bereich.</p>
                )}
                {entries.map(e => (
                  <EntryEditor key={e.id} entry={e} categoryId={cat.id}
                    project={project} variants={variantsSorted} positions={dataset.positions}
                    showId={show.id} onChanged={onChanged} />
                ))}
                {catDrafts.map(d => (
                  <EntryEditor key={d.key} entry={null} categoryId={cat.id}
                    project={project} variants={variantsSorted} positions={dataset.positions}
                    showId={show.id} onChanged={onChanged} onRemoveDraft={() => removeDraft(d.key)} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {editParams && (
        <ShowFormModal projectId={project.id} show={show}
          onClose={() => setEditParams(false)}
          onSaved={() => { setEditParams(false); onChanged() }} />
      )}
    </div>
  )
}

// ── Eine Buchung bearbeiten/anlegen ──────────────────────────────────────────

interface Fields {
  position_id: string
  variant_id: string        // '' = alle
  mode: Mode
  quantity: string; unit_price: string
  rental_price: string; distance_km: string; included_km: string; price_extra_km: string
  ist_amount: string; note: string
}

function fieldsFrom(e: CalcEntry | null): Fields {
  const g = (v: unknown) => (v == null ? '' : String(v))
  return {
    position_id: e?.position_id ?? '',
    variant_id: e?.variant_id ?? '',
    mode: e ? modeOf(e) : 'simple',
    quantity: g(e?.quantity), unit_price: g(e?.unit_price),
    rental_price: g(e?.rental_price), distance_km: g(e?.distance_km),
    included_km: g(e?.included_km), price_extra_km: g(e?.price_extra_km),
    ist_amount: g(e?.ist_amount), note: g(e?.note),
  }
}

function EntryEditor({ entry, categoryId, project, variants, positions, showId, onChanged, onRemoveDraft }: {
  entry: CalcEntry | null
  categoryId: string
  project: CalcProject
  variants: { id: string; name: string }[]
  positions: { id: string; name: string; category_id: string }[]
  showId: string
  onChanged: () => void
  onRemoveDraft?: () => void
}) {
  const isDraft = !entry
  const [f, setF] = useState<Fields>(() => fieldsFrom(entry))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: keyof Fields, v: string) => setF(p => ({ ...p, [k]: v }))
  const original = useMemo(() => JSON.stringify(fieldsFrom(entry)), [entry])
  const dirty = JSON.stringify(f) !== original

  const catPositions = positions.filter(p => p.category_id === categoryId)
  const posName = positions.find(p => p.id === f.position_id)?.name

  // Live-Betrag
  const betrag = useMemo(() => {
    const e: Partial<CalcEntry> = f.mode === 'vehicle'
      ? { distance_km: norm(f.distance_km), rental_price: norm(f.rental_price), included_km: norm(f.included_km), price_extra_km: norm(f.price_extra_km) }
      : { quantity: norm(f.quantity), unit_price: norm(f.unit_price) }
    try { return entryAmount(e as CalcEntry, project) } catch { return new Decimal(0) }
  }, [f, project])

  const toInput = (): CalcEntryInput => ({
    position_id: f.position_id,
    variant_id: f.variant_id || null,
    quantity: f.mode === 'simple' ? norm(f.quantity) : null,
    unit_price: f.mode === 'simple' ? norm(f.unit_price) : null,
    distance_km: f.mode === 'vehicle' ? norm(f.distance_km) : null,
    rental_price: f.mode === 'vehicle' ? norm(f.rental_price) : null,
    included_km: f.mode === 'vehicle' ? norm(f.included_km) : null,
    price_extra_km: f.mode === 'vehicle' ? norm(f.price_extra_km) : null,
    ist_amount: norm(f.ist_amount),
    note: f.note || null,
  })

  const save = async () => {
    if (isDraft && !f.position_id) { setErr('Position wählen'); return }
    setBusy(true); setErr('')
    try {
      if (isDraft) { await createCalcEntry(showId, toInput()); onRemoveDraft?.() }
      else await updateCalcEntry(entry!.id, toInput())
      onChanged()
    } catch (e: any) { setErr(e?.message ?? 'Fehler'); setBusy(false) }
  }
  const del = async () => {
    if (!entry) { onRemoveDraft?.(); return }
    if (!confirm('Buchung löschen?')) return
    setBusy(true)
    try { await deleteCalcEntry(entry.id); onChanged() }
    catch (e: any) { setErr(e?.message ?? 'Fehler'); setBusy(false) }
  }

  const inp = { className: 'form-input', style: { fontSize: '0.78rem', padding: '3px 6px' } as const }

  return (
    <div style={{ border: '1px solid #3c3c3c', borderRadius: 6, padding: '8px 10px', background: '#242424' }}>
      <div className="flex flex-wrap items-end gap-2">
        {/* Position */}
        <div style={{ minWidth: 180, flex: '1 1 180px' }}>
          <label className="block text-[10px] mb-0.5" style={{ color: '#8b8b8b' }}>Position</label>
          {isDraft ? (
            <select {...inp} value={f.position_id} onChange={e => set('position_id', e.target.value)}>
              <option value="">– wählen –</option>
              {catPositions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : <div className="text-sm" style={{ color: '#e0e0e0', paddingTop: 2 }}>{posName}</div>}
        </div>
        {/* Variante */}
        <div style={{ width: 130 }}>
          <label className="block text-[10px] mb-0.5" style={{ color: '#8b8b8b' }}>Variante</label>
          <select {...inp} value={f.variant_id} onChange={e => set('variant_id', e.target.value)}>
            <option value="">Alle Varianten</option>
            {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        {/* Modus */}
        <div style={{ width: 120 }}>
          <label className="block text-[10px] mb-0.5" style={{ color: '#8b8b8b' }}>Erfassung</label>
          <select {...inp} value={f.mode} onChange={e => set('mode', e.target.value)}>
            <option value="simple">Menge × Preis</option>
            <option value="vehicle">Fahrzeug</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 mt-2">
        {f.mode === 'simple' ? (
          <>
            <Field label="Menge" v={f.quantity} on={v => set('quantity', v)} w={70} />
            <Field label="Einzelpreis €" v={f.unit_price} on={v => set('unit_price', v)} w={100} />
          </>
        ) : (
          <>
            <Field label="Miete €" v={f.rental_price} on={v => set('rental_price', v)} w={90} />
            <Field label="Strecke km" v={f.distance_km} on={v => set('distance_km', v)} w={80} />
            <Field label="Inkl. km" v={f.included_km} on={v => set('included_km', v)} w={70} />
            <Field label="€/Mehr-km" v={f.price_extra_km} on={v => set('price_extra_km', v)} w={80} />
          </>
        )}
        <div style={{ width: 110 }}>
          <label className="block text-[10px] mb-0.5" style={{ color: '#8b8b8b' }}>Soll (Betrag)</label>
          <div className="text-sm font-medium" style={{ color: '#e0e0e0', fontVariantNumeric: 'tabular-nums', paddingTop: 2 }}>{formatEUR(betrag)}</div>
        </div>
        <Field label="Ist €" v={f.ist_amount} on={v => set('ist_amount', v)} w={100} />
        <div className="ml-auto flex items-center gap-1">
          {(dirty || isDraft) && (
            <button onClick={save} disabled={busy} className="btn btn-primary" style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}>
              {busy ? '…' : isDraft ? 'Anlegen' : 'Speichern'}
            </button>
          )}
          <button onClick={del} disabled={busy} className="p-1 text-gray-400 hover:text-red-500" title={isDraft ? 'Verwerfen' : 'Löschen'}>
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {err && <p className="text-[11px] mt-1" style={{ color: '#fca5a5' }}>{err}</p>}
    </div>
  )
}

function Field({ label, v, on, w }: { label: string; v: string; on: (v: string) => void; w: number }) {
  return (
    <div style={{ width: w }}>
      <label className="block text-[10px] mb-0.5" style={{ color: '#8b8b8b' }}>{label}</label>
      <input inputMode="decimal" className="form-input" style={{ fontSize: '0.78rem', padding: '3px 6px' }}
        value={v} onChange={e => on(e.target.value)} />
    </div>
  )
}
