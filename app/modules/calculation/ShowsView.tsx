'use client'

// Kalkulation – Shows verwalten (Phase 3, Schritt 1).
// Liste aller Shows + Maske pro Show (Deal-Parameter). Anlegen/Ändern/Löschen/
// Deaktivieren. Buchungen der Show folgen in Schritt 2. Siehe ADR-105.

import { useState, useEffect, useMemo } from 'react'
import Decimal from 'decimal.js'
import { PencilIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import { createCalcShow, updateCalcShow, deleteCalcShow, copyCalcPositions, getTermine, type CalcShowInput, type Termin } from '@/lib/api-client'
import type { CalcDataset, CalcShow, DealType } from '@/lib/calculation/types'
import { formatDate } from '@/lib/calculation/format'
import { dealTicketThresholds, type DealTicketThresholds } from '@/lib/calculation/engine'
import { useSortable } from '@/app/hooks/useSortable'
import ShowDetailView from './ShowDetailView'

const DEAL_TYPES: { value: DealType; label: string }[] = [
  { value: 'guarantee', label: 'Garantie (Festgage)' },
  { value: 'vs', label: 'Garantie vs. Deal (das Höhere)' },
  { value: 'plus', label: 'Garantie + Deal' },
  { value: 'door', label: 'Door / nur Deal' },
]
const dealLabel = (t?: DealType) => DEAL_TYPES.find(d => d.value === (t ?? 'vs'))?.label ?? t

const deNum = (n: number) => n.toLocaleString('de-DE')
const thresholdsForShow = (show: CalcShow): DealTicketThresholds => dealTicketThresholds({
  dealType: show.deal_type ?? 'vs',
  guarantee: show.guarantee ?? '0',
  deal_share: show.deal_share ?? '0',
  break_even: show.break_even ?? '0',
  ticket_price: show.ticket_price ?? '0',
  capacity: show.capacity ?? null,
  vvk: show.vvk ?? null,
})

/** Kompaktes Badge für die Shows-Tabelle (VS: „Deal ab X · noch Y"; sonst „Break X"). */
function dealBadgeText(info: DealTicketThresholds): string | null {
  if (!info.applicable) return null
  if (info.dealType === 'vs') {
    if (info.dealTickets == null) return null
    let s = `Deal ab ${deNum(info.dealTickets)}`
    if (info.vvk != null) s += info.vvk >= info.dealTickets ? ' ✓' : ` · noch ${deNum(info.dealTickets - info.vvk)}`
    if (info.capacity != null && info.dealTickets > info.capacity) s += ' ⚠︎'
    return s
  }
  return info.breakTickets != null ? `Break ${deNum(info.breakTickets)}` : null
}

/** Ausführlicher Live-Hinweis im Show-Formular. */
function DealHintBox({ info }: { info: DealTicketThresholds }) {
  let content: string | null = null
  if (info.note === 'no-ticketprice') {
    content = 'Ticketpreis eingeben, um die Break-/Deal-Schwelle zu berechnen.'
  } else if (info.dealType === 'vs' && info.note === 'no-share') {
    content = `Break-Even bei ~${deNum(info.breakTickets ?? 0)} Tickets. Deal-Anteil 0 % – der Deal kann die Garantie nie schlagen.`
  } else if (info.dealType === 'vs' && info.dealTickets != null) {
    const parts = [`Break-Even bei ~${deNum(info.breakTickets ?? 0)} Tickets`]
    let deal = `Deal schlägt Garantie ab ~${deNum(info.dealTickets)} Tickets`
    if (info.capacity != null) {
      deal += info.dealTickets > info.capacity
        ? ` (über Kapazität – mit ${deNum(info.capacity)} Plätzen nicht erreichbar)`
        : ` (${Math.round(info.dealTickets / info.capacity * 100)} % der Kapazität)`
    }
    parts.push(deal)
    if (info.vvk != null) {
      parts.push(info.vvk >= info.dealTickets
        ? `✓ mit VVK ${deNum(info.vvk)} bereits erreicht`
        : `bei VVK ${deNum(info.vvk)} noch ${deNum(info.dealTickets - info.vvk)} Tickets`)
    }
    content = parts.join(' · ')
  } else if (info.applicable && info.breakTickets != null) {
    const suffix = info.dealType === 'door' ? ' – ab da gibt es Deal-Einnahmen' : ' – ab da kommt der Deal-Anteil obendrauf'
    content = `Break-Even bei ~${deNum(info.breakTickets)} Tickets${suffix}`
  }
  if (!content) return null
  return (
    <div className="text-xs rounded-md px-3 py-2" style={{ background: 'var(--primary-soft)', color: 'var(--text)', border: '1px solid var(--primary)' }}>
      🎟️ {content}
    </div>
  )
}

export default function ShowsView({ dataset, projectId, onChanged, guardNav }: {
  dataset: CalcDataset
  projectId: string
  onChanged: () => void
  guardNav?: (fn: () => void) => void
}) {
  const [modal, setModal] = useState<{ open: boolean; show: CalcShow | null }>({ open: false, show: null })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const shows = [...dataset.shows].sort((a, b) => a.sort_order - b.sort_order)

  // Sortierbare Tabelle (wie Fahrzeuge/Venues): Klick auf Spaltentitel sortiert.
  const sortRows = useMemo(() => shows.map(s => ({
    show: s,
    date: s.show_date ?? '',
    city: s.city ?? '',
    venue: s.venue ?? '',
    guarantee: s.guarantee != null ? Number(s.guarantee) : 0,
    deal: dealLabel(s.deal_type),
    prov: s.commission != null ? Number(s.commission) : 0,
    active: s.is_active ? '1' : '0',
  })), [shows])
  const { sortKey, sortDir, sorted, toggleSort } = useSortable(sortRows, 'date')

  const detailShow = detailId ? dataset.shows.find(s => s.id === detailId) : null
  if (detailId && detailShow) {
    const go = (fn: () => void) => (guardNav ? guardNav(fn) : fn())
    // Prev/Next folgt der aktuellen Tabellen-Sortierung (Standard: Datum)
    const idx = sorted.findIndex(r => r.show.id === detailId)
    const prev = idx > 0 ? sorted[idx - 1].show : null
    const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1].show : null
    // WICHTIG: key={detailShow.id} → beim Wechsel (Prev/Next) wird die Detailansicht
    // inkl. aller Zeilen-States neu gemountet; sonst zeigt/speichert sie Werte der
    // vorherigen Show (useState wird bei Prop-Wechsel nicht neu initialisiert).
    return <ShowDetailView key={detailShow.id} show={detailShow} dataset={dataset} onChanged={onChanged}
      onBack={() => go(() => setDetailId(null))}
      onPrev={prev ? () => go(() => setDetailId(prev.id)) : undefined}
      onNext={next ? () => go(() => setDetailId(next.id)) : undefined} />
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
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{shows.length} Show(s)</p>
        <button onClick={() => setModal({ open: true, show: null })} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>
          <PlusIcon className="w-4 h-4" /> Neue Show
        </button>
      </div>

      <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              {([
                { k: 'date', label: 'Datum' },
                { k: 'city', label: 'Stadt' },
                { k: 'venue', label: 'Venue' },
                { k: 'guarantee', label: 'Garantie', right: true },
                { k: 'deal', label: 'Deal' },
                { k: 'prov', label: 'Prov.', right: true },
                { k: 'active', label: 'Aktiv' },
              ] as const).map(c => (
                <th key={c.k} className={`sortable${'right' in c && c.right ? ' text-right' : ''}`}
                  onClick={() => toggleSort(c.k)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  {c.label}
                  <span className={`sort-indicator${sortKey === c.k ? ' active' : ''}`}>{sortKey === c.k ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                </th>
              ))}
              <th style={{ width: 72 }} />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-6" style={{ color: 'var(--text-muted)' }}>Noch keine Shows – „Neue Show" anlegen.</td></tr>
            ) : sorted.map(({ show }) => (
              <tr key={show.id} style={{ opacity: show.is_active ? 1 : 0.5 }}>
                <td className="text-xs">{formatDate(show.show_date)}</td>
                <td className="font-medium text-sm">
                  <button onClick={() => setDetailId(show.id)} className="hover:underline" style={{ color: 'var(--primary-2)' }} title="Buchungen öffnen">
                    {show.city || '(öffnen)'}
                  </button>
                </td>
                <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{show.venue || '—'}</td>
                <td className="text-right text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {show.guarantee != null ? Number(show.guarantee).toLocaleString('de-DE') + ' €' : '—'}
                </td>
                <td className="text-xs">
                  {dealLabel(show.deal_type)}
                  {(() => { const b = dealBadgeText(thresholdsForShow(show)); return b ? <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{b}</div> : null })()}
                </td>
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
  const [events, setEvents] = useState<Termin[]>([])
  const [eventPick, setEventPick] = useState('')
  useEffect(() => { if (!show) getTermine().then(setEvents).catch(() => {/* Events optional */}) }, [show])
  const applyEvent = (id: string) => {
    setEventPick(id)
    const ev = events.find(e => String(e.id) === id)
    if (!ev) return
    setF(p => ({
      ...p,
      show_date: ev.date ? String(ev.date).slice(0, 10) : p.show_date,
      city: ev.city || ev.venueCity || p.city,
      venue: ev.venueName || p.venue,
      capacity: ev.capacity != null ? String(ev.capacity) : p.capacity,
    }))
  }
  const otherShows = (shows ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
  const set = (k: keyof FormState, v: string | boolean) => setF(p => ({ ...p, [k]: v }))
  const showDeal = f.deal_type !== 'guarantee'
  const noGuarantee = f.deal_type === 'door'   // Door / nur Deal: keine Garantie
  const dealInfo = dealTicketThresholds({
    dealType: f.deal_type,
    guarantee: f.guarantee || '0',
    deal_share: pctToRatio(f.deal_sharePct) ?? '0',
    break_even: f.break_even || '0',
    ticket_price: f.ticket_price || '0',
    capacity: f.capacity.trim() ? parseInt(f.capacity, 10) : null,
    vvk: f.vvk.trim() ? parseInt(f.vvk, 10) : null,
  })

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
          {!show && events.length > 0 && (
            <div style={{ background: '#1e2a24', border: '1px solid #2f5c46', borderRadius: 6, padding: '8px 10px' }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Aus Event übernehmen (Datum, Ort, Venue)</label>
              <select className="form-input" value={eventPick} onChange={e => applyEvent(e.target.value)}>
                <option value="">– manuell eingeben –</option>
                {events.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.date ? formatDate(String(ev.date).slice(0, 10)) + ' · ' : ''}{ev.city || ev.venueCity || '?'}{ev.venueName ? ' · ' + ev.venueName : ''}{ev.title ? ' — ' + ev.title : ''}
                  </option>
                ))}
              </select>
              <p style={{ color: 'var(--text-subtle)', fontSize: 11, marginTop: 4 }}>Felder werden vorbefüllt und bleiben editierbar.</p>
            </div>
          )}
          {!show && otherShows.length > 0 && (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Positionen übernehmen von (optional)</label>
              <select className="form-input" value={copyFrom} onChange={e => setCopyFrom(e.target.value)}>
                <option value="">– keine (leere Show) –</option>
                {otherShows.map(s => <option key={s.id} value={s.id}>{s.city || '(ohne Stadt)'}{s.show_date ? ' · ' + formatDate(s.show_date) : ''}</option>)}
              </select>
              {copyFrom && (
                <label className="flex items-center gap-2 mt-2 text-sm cursor-pointer select-none" style={{ color: 'var(--text)' }}>
                  <input type="checkbox" checked={copyWithValues} onChange={e => setCopyWithValues(e.target.checked)} />
                  auch die Werte übernehmen <span style={{ color: 'var(--text-subtle)', fontSize: 11 }}>(sonst nur leere Positionen)</span>
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

          {showDeal && <DealHintBox info={dealInfo} />}

          <div>
            <label className="form-label">Notiz</label>
            <textarea className="form-input" rows={2} value={f.note} onChange={e => set('note', e.target.value)} />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-sm" style={{ color: 'var(--text)' }}>
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
