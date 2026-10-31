'use client'

import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, DocumentArrowDownIcon, ClockIcon, ArchiveBoxIcon, ArrowUturnLeftIcon, XMarkIcon } from '@heroicons/react/24/outline'
import {
  getBookingClauses, createBookingClause, updateBookingClause, archiveBookingClause, deleteBookingClause, getBookingClauseVersions,
  getBookingContracts, getBookingContract, createBookingContract, updateBookingContract, deleteBookingContract, openBookingContractPdf,
  getTermine, getEffectiveRole, canEdit as canEditArea,
  type BookingClause, type BookingClauseVersion, type BookingContract, type BookingContractInput, type Termin,
} from '@/lib/api-client'

const DEAL_TYPES: { id: string; label: string }[] = [
  { id: 'guarantee', label: 'Festgage' },
  { id: 'vs', label: 'Garantie vs. Deal' },
  { id: 'plus', label: 'Garantie plus Deal' },
  { id: 'door', label: 'Door Deal' },
]
// Pipeline-Status eines Bookings (ein Gig durchläuft diese Reihenfolge).
export const BOOKING_STATUSES: { id: string; label: string }[] = [
  { id: 'enquiry',   label: 'Angefragt' },
  { id: 'hold',      label: 'Option' },
  { id: 'confirmed', label: 'Bestätigt' },
  { id: 'contract',  label: 'Vertrag' },
  { id: 'invoiced',  label: 'Rechnung' },
  { id: 'settled',   label: 'Abgerechnet' },
]
export const STATUS_LABEL: Record<string, string> = {
  ...Object.fromEntries(BOOKING_STATUSES.map(s => [s.id, s.label])),
  // Fallbacks für evtl. alte Werte aus Phase 1
  draft: 'Entwurf', sent: 'Versendet', signed: 'Unterschrieben', done: 'Abgeschlossen',
}

export default function BookingModule({ activeSubTab }: { activeSubTab?: string }) {
  const canEdit = canEditArea('booking', getEffectiveRole())
  const sub = activeSubTab === 'bausteine' ? 'bausteine' : 'contracts'
  return (
    <div className="p-5">
      {sub === 'bausteine' ? <BausteineTab canEdit={canEdit} /> : <ContractsTab canEdit={canEdit} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Bausteine (versionierte Vertragsbausteine)
// ═══════════════════════════════════════════════════════════════════════════
function BausteineTab({ canEdit }: { canEdit: boolean }) {
  const [clauses, setClauses] = useState<BookingClause[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ clause: BookingClause | null } | null>(null)
  const [historyFor, setHistoryFor] = useState<BookingClause | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getBookingClauses({ archived: showArchived }).then(setClauses).catch(() => {}).finally(() => setLoading(false))
  }, [showArchived])
  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4" style={{ maxWidth: 820 }}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Vertragsbausteine</h2>
        {canEdit && !showArchived && (
          <button onClick={() => setModal({ clause: null })} className="btn btn-primary"><PlusIcon className="w-4 h-4" />Neuer Baustein</button>
        )}
      </div>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Feste Textbausteine für Verträge. Beim Bearbeiten kannst du eine <strong>neue Version</strong> speichern – alte Versionen bleiben erhalten.
        Platzhalter: <code>{'{{gage}}'}</code> <code>{'{{deal}}'}</code> <code>{'{{datum}}'}</code> <code>{'{{stadt}}'}</code> <code>{'{{venue}}'}</code> <code>{'{{partner}}'}</code> <code>{'{{artist}}'}</code> <code>{'{{ticketpreis}}'}</code> <code>{'{{anzahlung}}'}</code>.
      </p>

      <div className="flex items-center gap-1">
        <button onClick={() => setShowArchived(false)} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${!showArchived ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--hover)]'}`}>Aktiv</button>
        <button onClick={() => setShowArchived(true)} className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${showArchived ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--hover)]'}`}><ArchiveBoxIcon className="w-4 h-4" />Archiv</button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Lädt…</div>
      ) : clauses.length === 0 ? (
        <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{showArchived ? 'Kein archivierter Baustein' : 'Noch keine Bausteine angelegt'}</div>
      ) : (
        <div className="space-y-2">
          {clauses.map(c => (
            <div key={c.id} className="border rounded-lg p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium" style={{ color: 'var(--text)' }}>{c.title}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--hover)', color: 'var(--text-muted)' }}>v{c.latest_version ?? 1}</span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap line-clamp-3" style={{ color: 'var(--text-muted)' }}>{c.latest_body || '—'}</p>
                </div>
                {canEdit && (
                  <div className="flex gap-1 flex-shrink-0">
                    {!showArchived && <>
                      <button onClick={() => setHistoryFor(c)} className="p-1 text-gray-400 hover:text-blue-600" title={`Versionen (${c.version_count ?? 1})`}><ClockIcon className="w-4 h-4" /></button>
                      <button onClick={() => setModal({ clause: c })} className="p-1 text-gray-400 hover:text-blue-600" title="Bearbeiten"><PencilIcon className="w-4 h-4" /></button>
                      <button onClick={async () => { await archiveBookingClause(c.id, true); load() }} className="p-1 text-gray-400 hover:text-gray-700" title="Archivieren"><ArchiveBoxIcon className="w-4 h-4" /></button>
                    </>}
                    {showArchived && <>
                      <button onClick={async () => { await archiveBookingClause(c.id, false); load() }} className="p-1 text-gray-400 hover:text-green-600" title="Wiederherstellen"><ArrowUturnLeftIcon className="w-4 h-4" /></button>
                      <button onClick={async () => { if (!confirm(`„${c.title}" endgültig löschen?`)) return; await deleteBookingClause(c.id); load() }} className="p-1 text-gray-400 hover:text-red-600" title="Endgültig löschen"><TrashIcon className="w-4 h-4" /></button>
                    </>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <ClauseModal clause={modal.clause} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}
      {historyFor && <HistoryModal clause={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  )
}

function ClauseModal({ clause, onClose, onSaved }: { clause: BookingClause | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(clause?.title ?? '')
  const [body, setBody] = useState(clause?.latest_body ?? '')
  const [saving, setSaving] = useState(false)
  const isEdit = !!clause
  const bodyChanged = isEdit && body !== (clause?.latest_body ?? '')

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      if (isEdit) await updateBookingClause(clause!.id, { title, body, newVersion: bodyChanged })
      else await createBookingClause({ title, body })
      onSaved()
    } catch { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Baustein bearbeiten' : 'Neuer Baustein'}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-[var(--text)]"><XMarkIcon className="w-4 h-4" /></button>
        </div>
        <div className="modal-body space-y-3">
          <div>
            <label className="form-label">Titel</label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="z.B. Leistungsumfang" autoFocus />
          </div>
          <div>
            <label className="form-label">Text</label>
            <textarea className="form-input" rows={10} value={body} onChange={e => setBody(e.target.value)} placeholder="Vertragstext … Platzhalter wie {{gage}} werden im Vertrag ersetzt." />
          </div>
          {isEdit && (
            <p className="text-xs" style={{ color: bodyChanged ? 'var(--accent)' : 'var(--text-muted)' }}>
              {bodyChanged ? 'Der Text wurde geändert → beim Speichern wird eine neue Version angelegt (alte bleibt erhalten).' : 'Text unverändert → keine neue Version.'}
            </p>
          )}
        </div>
        <div className="modal-footer justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
          <button onClick={save} disabled={saving || !title.trim()} className="btn btn-primary">{saving ? 'Speichern…' : 'Speichern'}</button>
        </div>
      </div>
    </div>
  )
}

function HistoryModal({ clause, onClose }: { clause: BookingClause; onClose: () => void }) {
  const [versions, setVersions] = useState<BookingClauseVersion[]>([])
  useEffect(() => { getBookingClauseVersions(clause.id).then(setVersions).catch(() => {}) }, [clause.id])
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Versionen – {clause.title}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-[var(--text)]"><XMarkIcon className="w-4 h-4" /></button>
        </div>
        <div className="modal-body space-y-3">
          {versions.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Keine Versionen.</p> : versions.map(v => (
            <div key={v.id} className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: 'var(--hover)', color: 'var(--text-muted)' }}>v{v.version}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(v.created_at).toLocaleString('de-DE')}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{v.body || '—'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Verträge
// ═══════════════════════════════════════════════════════════════════════════
function ContractsTab({ canEdit }: { canEdit: boolean }) {
  const [contracts, setContracts] = useState<BookingContract[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ contract: BookingContract | null } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getBookingContracts().then(setContracts).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4" style={{ maxWidth: 960 }}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Verträge</h2>
        {canEdit && <button onClick={() => setModal({ contract: null })} className="btn btn-primary"><PlusIcon className="w-4 h-4" />Neuer Vertrag</button>}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Lädt…</div>
      ) : contracts.length === 0 ? (
        <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Noch keine Verträge angelegt</div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead><tr>
              <th>Titel</th><th>Veranstaltung</th><th>Veranstalter</th><th>Status</th><th style={{ width: 120 }}></th>
            </tr></thead>
            <tbody>
              {contracts.map(c => (
                <tr key={c.id} className="hoverable">
                  <td className="font-medium">{c.title}<div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{c.contract_no}</div></td>
                  <td>{[c.event_date ? new Date(c.event_date).toLocaleDateString('de-DE') : null, c.event_city, c.event_venue].filter(Boolean).join(' · ') || '—'}</td>
                  <td>{c.partner_name || '—'}</td>
                  <td><span className="badge">{STATUS_LABEL[c.status] ?? c.status}</span></td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openBookingContractPdf(c.id)} className="p-1 text-gray-400 hover:text-blue-600" title="PDF öffnen"><DocumentArrowDownIcon className="w-4 h-4" /></button>
                      {canEdit && <>
                        <button onClick={() => setModal({ contract: c })} className="p-1 text-gray-400 hover:text-blue-600" title="Bearbeiten"><PencilIcon className="w-4 h-4" /></button>
                        <button onClick={async () => { if (!confirm(`Vertrag „${c.title}" löschen?`)) return; await deleteBookingContract(c.id); load() }} className="p-1 text-gray-400 hover:text-red-600" title="Löschen"><TrashIcon className="w-4 h-4" /></button>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <ContractModal contract={modal.contract} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}
    </div>
  )
}

function ContractModal({ contract, onClose, onSaved }: { contract: BookingContract | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!contract
  const [f, setF] = useState<BookingContractInput>(() => ({
    title: contract?.title ?? '', status: contract?.status ?? 'confirmed',
    termin_id: contract?.termin_id ?? null,
    event_title: contract?.event_title ?? '', event_date: contract?.event_date ?? '', event_city: contract?.event_city ?? '', event_venue: contract?.event_venue ?? '',
    partner_name: contract?.partner_name ?? '', partner_address: contract?.partner_address ?? '', partner_email: contract?.partner_email ?? '',
    currency: contract?.currency ?? 'EUR', deal_type: contract?.deal_type ?? 'guarantee',
    guarantee: contract?.guarantee ?? '', deal_share: contract?.deal_share ?? '', break_even: contract?.break_even ?? '',
    vvk: contract?.vvk ?? '', ticket_price: contract?.ticket_price ?? '', deposit: contract?.deposit ?? '',
    payment_terms: contract?.payment_terms ?? '', notes: contract?.notes ?? '',
  }))
  const [clauses, setClauses] = useState<BookingClause[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [events, setEvents] = useState<Termin[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getBookingClauses().then(setClauses).catch(() => {})
    getTermine().then(setEvents).catch(() => {})
  }, [])
  // vorhandene Baustein-Auswahl beim Bearbeiten laden
  useEffect(() => {
    if (!contract) return
    getBookingContract(contract.id).then(full => {
      setSelected((full.clauses ?? []).map(cc => cc.clause_id).filter((x): x is number => x != null))
    }).catch(() => {})
  }, [contract])

  const set = (patch: Partial<BookingContractInput>) => setF(prev => ({ ...prev, ...patch }))
  const applyEvent = (id: string) => {
    const ev = events.find(e => String(e.id) === id)
    if (!ev) { set({ termin_id: null }); return }
    set({
      termin_id: ev.id,
      event_title: ev.title || '',
      event_date: ev.date ? String(ev.date).slice(0, 10) : '',
      event_city: ev.city || ev.venueCity || '',
      event_venue: ev.venueName || '',
    })
  }
  const toggleClause = (id: number) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const save = async () => {
    if (!f.title?.trim()) return
    setSaving(true)
    try {
      const payload: BookingContractInput = { ...f, clauseIds: selected }
      if (isEdit) await updateBookingContract(contract!.id, payload)
      else await createBookingContract(payload)
      onSaved()
    } catch { setSaving(false) }
  }

  const num = (label: string, key: keyof BookingContractInput, ph = '') => (
    <div>
      <label className="form-label">{label}</label>
      <input className="form-input" inputMode="decimal" value={(f[key] as string) ?? ''} onChange={e => set({ [key]: e.target.value } as Partial<BookingContractInput>)} placeholder={ph} />
    </div>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container max-w-3xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Vertrag bearbeiten' : 'Neuer Vertrag'}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-[var(--text)]"><XMarkIcon className="w-4 h-4" /></button>
        </div>
        <div className="modal-body space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="form-label">Titel</label>
              <input className="form-input" value={f.title ?? ''} onChange={e => set({ title: e.target.value })} placeholder="z.B. Auftrittsvertrag Open Air 2026" autoFocus />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-select" value={f.status ?? 'confirmed'} onChange={e => set({ status: e.target.value })}>
                {BOOKING_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Event übernehmen (optional)</label>
              <select className="form-select" value={f.termin_id ? String(f.termin_id) : ''} onChange={e => applyEvent(e.target.value)}>
                <option value="">— manuell —</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{[ev.date ? String(ev.date).slice(0, 10) : '', ev.title || ev.city].filter(Boolean).join(' · ')}</option>)}
              </select>
            </div>
          </div>

          <fieldset className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
            <legend className="text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }}>VERANSTALTUNG</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="form-label">Titel</label><input className="form-input" value={f.event_title ?? ''} onChange={e => set({ event_title: e.target.value })} /></div>
              <div><label className="form-label">Datum</label><input type="date" className="form-input" value={f.event_date ?? ''} onChange={e => set({ event_date: e.target.value })} /></div>
              <div><label className="form-label">Ort</label><input className="form-input" value={f.event_city ?? ''} onChange={e => set({ event_city: e.target.value })} /></div>
              <div><label className="form-label">Venue</label><input className="form-input" value={f.event_venue ?? ''} onChange={e => set({ event_venue: e.target.value })} /></div>
            </div>
          </fieldset>

          <fieldset className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
            <legend className="text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }}>VERANSTALTER</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="form-label">Name / Firma</label><input className="form-input" value={f.partner_name ?? ''} onChange={e => set({ partner_name: e.target.value })} /></div>
              <div><label className="form-label">E-Mail</label><input className="form-input" value={f.partner_email ?? ''} onChange={e => set({ partner_email: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="form-label">Adresse</label><textarea className="form-input" rows={2} value={f.partner_address ?? ''} onChange={e => set({ partner_address: e.target.value })} /></div>
            </div>
          </fieldset>

          <fieldset className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
            <legend className="text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }}>DEAL / KONDITIONEN</legend>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="form-label">Deal-Art</label>
                <select className="form-select" value={f.deal_type ?? 'guarantee'} onChange={e => set({ deal_type: e.target.value })}>
                  {DEAL_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </div>
              {num('Garantie / Festgage', 'guarantee', '0')}
              {num('Deal-Anteil % ', 'deal_share', 'z.B. 70')}
              {num('Break-Even', 'break_even')}
              {num('Ticketpreis', 'ticket_price')}
              {num('VVK (Stück)', 'vvk')}
              {num('Anzahlung', 'deposit')}
              <div>
                <label className="form-label">Währung</label>
                <input className="form-input" value={f.currency ?? 'EUR'} onChange={e => set({ currency: e.target.value })} />
              </div>
              <div className="col-span-2 sm:col-span-3"><label className="form-label">Zahlungsziel</label><input className="form-input" value={f.payment_terms ?? ''} onChange={e => set({ payment_terms: e.target.value })} placeholder="z.B. 50% bei Vertragsschluss, Rest am Showtag" /></div>
            </div>
          </fieldset>

          <div>
            <label className="form-label">Vertragsbausteine (jeweils aktuelle Version)</label>
            {clauses.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Noch keine Bausteine – lege welche unter „Bausteine" an.</p>
            ) : (
              <div className="space-y-1 border rounded-lg p-2" style={{ borderColor: 'var(--border)', maxHeight: 220, overflowY: 'auto' }}>
                {clauses.map(c => (
                  <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--hover)]">
                    <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleClause(c.id)} className="accent-blue-600" />
                    <span className="text-sm" style={{ color: 'var(--text)' }}>{c.title}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>v{c.latest_version ?? 1}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="form-label">Weitere Vereinbarungen</label>
            <textarea className="form-input" rows={3} value={f.notes ?? ''} onChange={e => set({ notes: e.target.value })} />
          </div>
        </div>
        <div className="modal-footer justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost">Abbrechen</button>
          <button onClick={save} disabled={saving || !f.title?.trim()} className="btn btn-primary">{saving ? 'Speichern…' : 'Speichern'}</button>
        </div>
      </div>
    </div>
  )
}
