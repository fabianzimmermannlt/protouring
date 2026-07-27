'use client'

// Kalkulation – Shows verwalten (Phase 3, Schritt 1).
// Liste aller Shows + Maske pro Show (Deal-Parameter). Anlegen/Ändern/Löschen/
// Deaktivieren. Buchungen der Show folgen in Schritt 2. Siehe ADR-105.

import { useState } from 'react'
import Decimal from 'decimal.js'
import { PencilIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import { createCalcShow, updateCalcShow, deleteCalcShow, copyCalcPositions, type CalcShowInput } from '@/lib/api-client'
import type { CalcDataset, CalcShow, DealType } from '@/lib/calculation/types'
import { formatDate } from '@/lib/calculation/format'
import ShowDetailView from './ShowDetailView'

const DEAL_TYPES: { value: DealType; label: string }[] = [
  { value: 'guarantee', label: 'Garantie (Festgage)' },
  { value: 'vs', label: 'Garantie vs. Deal (das Höhere)' },
  { value: 'plus', label: 'Garantie + Deal' },
  { value: 'door', label: 'Door / nur Deal' },
]
const dealLabel = (t?: DealType) => DEAL_TYPES.find(d => d.value === (t ?? 'vs'))?.label ?? t

export default function ShowsView({ dataset, projectId, onChanged }: {
  dataset: CalcDataset
  projectId: string
  onChanged: () => void
}) {
  const [modal, setModal] = useState<{ open: boolean; show: CalcShow | null }>({ open: false, show: null })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const shows = [...dataset.shows].sort((a, b) => a.sort_order - b.sort_order)

  const detailShow = detailId ? dataset.shows.find(s => s.id === detailId) : null
  if (detailId && detailShow) {
    return <ShowDetailView show={detailShow} dataset={dataset} onChanged={onChanged} onBack={() => setDetailId(null)} />
  }

  const handleDelete = async (show: CalcShow) => {
    if (!confirm(`Show „${show.city ?? ''}${show.show_date ? ' · ' + formatDate(show.show_date) : ''}" wirklich löschen? Alle Buchungen dieser Show werden mitgelöscht.`)) return
    setBusyId(show.id)
    try { await deleteCalcShow(show.id); onChanged() }
    catch (e: any) { alert(e?.message ?? 'Löschen fehlgeschlagen') }
    finally { setBusyId(null) }
  }

  const toggleActive = async (show: CalcShow) => {
    setBusyId(show.id)
    try { await updateCalcShow(show.id, { ...showToInput(show), is_active: !show.is_active }); onChanged() }
    catch (e: any) { alert(e?.message ?? 'Speichern fehlgeschlagen') }
    finally { setBusyId(null) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm" style={{ color: '#9ca3af' }}>{shows.length} Show(s)</p>
        <button onClick={() => setModal({ open: true, show: null })} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>
          <PlusIcon className="w-4 h-4" /> Neue Show
        </button>
      </div>

      <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Stadt</th>
              <th>Venue</th>
              <th className="text-right">Garantie</th>
              <th>Deal</th>
              <th className="text-right">Prov.</th>
              <th>Aktiv</th>
              <th style={{ width: 72 }} />
            </tr>
          </thead>
          <tbody>
            {shows.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-6" style={{ color: '#9ca3af' }}>Noch keine Shows – „Neue Show" anlegen.</td></tr>
            ) : shows.map(show => (
              <tr key={show.id} style={{ opacity: show.is_active ? 1 : 0.5 }}>
                <td className="text-xs">{formatDate(show.show_date)}</td>
                <td className="font-medium text-sm">
                  <button onClick={() => setDetailId(show.id)} className="hover:underline" style={{ color: '#60a5fa' }} title="Buchungen öffnen">
                    {show.city || '(öffnen)'}
                  </button>
                </td>
                <td className="text-xs" style={{ color: '#9ca3af' }}>{show.venue || '—'}</td>
                <td className="text-right text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {show.guarantee != null ? Number(show.guarantee).toLocaleString('de-DE') + ' €' : '—'}
                </td>
                <td className="text-xs">{dealLabel(show.deal_type)}</td>
                <td className="text-right text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {show.commission != null ? new Decimal(show.commission).times(100).toDecimalPlaces(2).toString() + ' %' : '—'}
                </td>
                <td>
                  <label className="inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={!!show.is_active} disabled={busyId === show.id} onChange={() => toggleActive(show)} />
                  </label>
                </td>
                <td>
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => setModal({ open: true, show })} className="p-1 text-gray-400 hover:text-blue-500" title="Bearbeiten">
                      <PencilIcon className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(show)} disabled={busyId === show.id} className="p-1 text-gray-400 hover:text-red-500" title="Löschen">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal.open && (
        <ShowFormModal
          projectId={projectId}
          show={modal.show}
          shows={dataset.shows}
          onClose={() => setModal({ open: false, show: null })}
          onSaved={() => { setModal({ open: false, show: null }); onChanged() }}
        />
      )}
    </div>
  )
}

// ── Maske ────────────────────────────────────────────────────────────────────

interface FormState {
  show_date: string; city: string; venue: string; deal_type: DealType
  guarantee: string; commissionPct: string; deal_sharePct: string; break_even: string
  capacity: string; vvk: string; ticket_price: string; is_active: boolean; note: string
}

function showToInput(s: CalcShow): CalcShowInput {
  return {
    show_date: s.show_date ?? null, city: s.city ?? null, venue: s.venue ?? null,
    capacity: s.capacity ?? null, ticket_price: s.ticket_price != null ? String(s.ticket_price) : null,
    guarantee: s.guarantee != null ? String(s.guarantee) : null,
    deal_share: s.deal_share != null ? String(s.deal_share) : null,
    break_even: s.break_even != null ? String(s.break_even) : null,
    commission: s.commission != null ? String(s.commission) : null,
    deal_type: s.deal_type ?? 'vs', is_active: s.is_active, note: s.note ?? null,
  }
}

/** '12,5' | '12.5' → '12.5' ; '' → null */
const norm = (v: string): string | null => { const t = v.trim().replace(',', '.'); return t === '' ? null : t }
const pctToRatio = (v: string): string | null => { const t = norm(v); return t == null ? null : new Decimal(t).div(100).toString() }
const ratioToPct = (v: unknown): string => (v == null || v === '') ? '' : new Decimal(String(v)).times(100).toDecimalPlaces(4).toString()

export function ShowFormModal({ projectId, show, onClose, onSaved, shows }: {
  projectId: string; show: CalcShow | null; onClose: () => void; onSaved: () => void; shows?: CalcShow[]
}) {
  const [f, setF] = useState<FormState>(() => ({
    show_date: show?.show_date ?? '', city: show?.city ?? '', venue: show?.venue ?? '',
    deal_type: show?.deal_type ?? 'vs',
    guarantee: show?.guarantee != null ? String(show.guarantee) : '',
    commissionPct: ratioToPct(show?.commission),
    deal_sharePct: ratioToPct(show?.deal_share),
    break_even: show?.break_even != null && String(show.break_even) !== '0' ? String(show.break_even) : '',
    capacity: show?.capacity != null ? String(show.capacity) : '',
    vvk: show?.vvk != null ? String(show.vvk) : '',
    ticket_price: show?.ticket_price != null ? String(show.ticket_price) : '',
    is_active: show ? show.is_active : true, note: show?.note ?? '',
  }))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [copyFrom, setCopyFrom] = useState('')
  const [copyWithValues, setCopyWithValues] = useState(false)
  const otherShows = (shows ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
  const set = (k: keyof FormState, v: string | boolean) => setF(p => ({ ...p, [k]: v }))
  const showDeal = f.deal_type !== 'guarantee'
  const noGuarantee = f.deal_type === 'door'   // Door / nur Deal: keine Garantie

  const save = async () => {
    setSaving(true); setErr('')
    try {
      const data: CalcShowInput = {
        show_date: f.show_date || null, city: f.city || null, venue: f.venue || null,
        deal_type: f.deal_type,
        guarantee: noGuarantee ? null : norm(f.guarantee), commission: pctToRatio(f.commissionPct),
        deal_share: showDeal ? pctToRatio(f.deal_sharePct) : null,
        break_even: showDeal ? norm(f.break_even) : null,
        capacity: showDeal && f.capacity.trim() ? parseInt(f.capacity, 10) : null,
        vvk: showDeal && f.vvk.trim() ? parseInt(f.vvk, 10) : null,
        ticket_price: showDeal ? norm(f.ticket_price) : null,
        is_active: f.is_active, note: f.note || null,
      }
      if (show) await updateCalcShow(show.id, data)
      else {
        const created = await createCalcShow(projectId, data)
        if (copyFrom) await copyCalcPositions(created.id, copyFrom, copyWithValues)
      }
      onSaved()
    } catch (e: any) { setErr(e?.message ?? 'Speichern fehlgeschlagen'); setSaving(false) }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3 className="modal-title">{show ? 'Show bearbeiten' : 'Neue Show'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="modal-body space-y-4">
          {!show && otherShows.length > 0 && (
            <div style={{ background: '#242424', border: '1px solid #3c3c3c', borderRadius: 6, padding: '8px 10px' }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Positionen übernehmen von (optional)</label>
              <select className="form-input" value={copyFrom} onChange={e => setCopyFrom(e.target.value)}>
                <option value="">– keine (leere Show) –</option>
                {otherShows.map(s => <option key={s.id} value={s.id}>{s.city || '(ohne Stadt)'}{s.show_date ? ' · ' + formatDate(s.show_date) : ''}</option>)}
              </select>
              {copyFrom && (
                <label className="flex items-center gap-2 mt-2 text-sm cursor-pointer select-none" style={{ color: '#e0e0e0' }}>
                  <input type="checkbox" checked={copyWithValues} onChange={e => setCopyWithValues(e.target.checked)} />
                  auch die Werte übernehmen <span style={{ color: '#6b7280', fontSize: 11 }}>(sonst nur leere Positionen)</span>
                </label>
              )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="form-label">Datum</label>
              <input type="date" className="form-input" value={f.show_date} onChange={e => set('show_date', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Stadt</label>
              <input className="form-input" value={f.city} onChange={e => set('city', e.target.value)} placeholder="z.B. Bremen" />
            </div>
            <div>
              <label className="form-label">Venue</label>
              <input className="form-input" value={f.venue} onChange={e => set('venue', e.target.value)} placeholder="Festival / Club" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Deal-Typ</label>
              <select className="form-select" value={f.deal_type} onChange={e => set('deal_type', e.target.value as DealType)}>
                {DEAL_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label" style={{ opacity: noGuarantee ? 0.4 : 1 }}>Garantie (€)</label>
              <input inputMode="decimal" className="form-input" value={noGuarantee ? '' : f.guarantee} disabled={noGuarantee}
                onChange={e => set('guarantee', e.target.value)} placeholder={noGuarantee ? 'entfällt bei nur Deal' : 'z.B. 16000'}
                style={{ opacity: noGuarantee ? 0.4 : 1 }} title={noGuarantee ? 'Bei „Door / nur Deal" gibt es keine Garantie' : undefined} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Provision (%)</label>
              <input inputMode="decimal" className="form-input" value={f.commissionPct} onChange={e => set('commissionPct', e.target.value)} placeholder="z.B. 15" />
            </div>
            {showDeal && (
              <div>
                <label className="form-label">Deal-Anteil (%)</label>
                <input inputMode="decimal" className="form-input" value={f.deal_sharePct} onChange={e => set('deal_sharePct', e.target.value)} placeholder="z.B. 70" />
              </div>
            )}
          </div>

          {showDeal && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Break Even (€)</label>
                <input inputMode="decimal" className="form-input" value={f.break_even} onChange={e => set('break_even', e.target.value)} placeholder="0 = am Eintritt" />
              </div>
              <div>
                <label className="form-label">Ticketpreis (€)</label>
                <input inputMode="decimal" className="form-input" value={f.ticket_price} onChange={e => set('ticket_price', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Kapazität</label>
                <input inputMode="numeric" className="form-input" value={f.capacity} onChange={e => set('capacity', e.target.value)} placeholder="Plätze (geplant)" />
              </div>
              <div>
                <label className="form-label">VVK-Stand</label>
                <input inputMode="numeric" className="form-input" value={f.vvk} onChange={e => set('vvk', e.target.value)} placeholder="verkaufte Tickets (tatsächlich)" />
              </div>
            </div>
          )}

          <div>
            <label className="form-label">Notiz</label>
            <textarea className="form-input" rows={2} value={f.note} onChange={e => set('note', e.target.value)} />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-sm" style={{ color: '#e0e0e0' }}>
            <input type="checkbox" checked={f.is_active} onChange={e => set('is_active', e.target.checked)} />
            Aktiv (zählt in Übersicht &amp; Fixkostenumlage)
          </label>

          {err && <p className="text-xs" style={{ color: '#fca5a5' }}>{err}</p>}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? 'Speichert…' : 'Speichern'}</button>
        </div>
      </div>
    </div>
  )
}
