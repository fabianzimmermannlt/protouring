'use client'

import { useState, useEffect, useCallback } from 'react'
import { DocumentArrowDownIcon, ArrowRightIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import {
  getBookingContracts, getBookingContract, createBookingContract, updateBookingContract, deleteBookingContract, openBookingContractPdf,
  getBookingClauses,
  getBookingInvoices, createBookingInvoice, deleteBookingInvoice, openBookingInvoicePdf,
  type BookingContract, type BookingContractInput, type BookingClause, type BookingInvoice, type Termin,
} from '@/lib/api-client'

const nnum = (v: unknown) => { const x = Number(String(v ?? '').replace(',', '.')); return isFinite(x) ? x : 0 }
const eur = (n: number, cur = 'EUR') => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + cur
// Deal-Berechnung (Netto-Honorar) – spiegelt die Serverlogik für die Live-Vorschau.
function computeDue(f: { deal_type?: string | null; guarantee?: unknown; deal_share?: unknown; break_even?: unknown; ticket_price?: unknown; actual_tickets?: unknown; actual_revenue?: unknown }) {
  const revenue = (f.actual_revenue != null && f.actual_revenue !== '') ? nnum(f.actual_revenue) : nnum(f.actual_tickets) * nnum(f.ticket_price)
  let share = nnum(f.deal_share); if (share > 1) share = share / 100
  const over = Math.max(0, revenue - nnum(f.break_even)) * share
  const g = nnum(f.guarantee)
  switch (f.deal_type) {
    case 'vs': return Math.max(g, over)
    case 'plus': return g + over
    case 'door': return over
    default: return g
  }
}
import { BOOKING_STATUSES } from './BookingModule'

const DEAL_TYPES = [
  { id: 'guarantee', label: 'Festgage' },
  { id: 'vs', label: 'Garantie vs. Deal' },
  { id: 'plus', label: 'Garantie plus Deal' },
  { id: 'door', label: 'Door Deal' },
]

/** Pro-Event-Booking: Statusband + Deal + Vertrag. Ein Booking je Event (MVP). */
export default function EventBookingView({ terminId, termin, isAdmin }: { terminId: number; termin: Termin; isAdmin: boolean }) {
  const [booking, setBooking] = useState<BookingContract | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const all = await getBookingContracts()
      const mine = all.find(c => c.termin_id === terminId)
      if (mine) {
        const full = await getBookingContract(mine.id)
        setBooking(full)
      } else setBooking(null)
    } catch { /* ignore */ }
    setLoading(false)
  }, [terminId])
  useEffect(() => { load() }, [load])

  const createBooking = async () => {
    setCreating(true)
    try {
      const id = await createBookingContract({
        title: [termin.title || termin.city, 'Booking'].filter(Boolean).join(' – ') || 'Booking',
        status: 'enquiry',
        termin_id: terminId,
        event_title: termin.title || '',
        event_date: termin.date ? String(termin.date).slice(0, 10) : '',
        event_city: termin.city || termin.venueCity || '',
        event_venue: termin.venueName || '',
        currency: 'EUR',
        deal_type: 'guarantee',
      })
      const full = await getBookingContract(id)
      setBooking(full)
    } catch { /* ignore */ }
    setCreating(false)
  }

  if (loading) return <div className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Lädt…</div>

  if (!booking) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Für dieses Event ist noch kein Booking angelegt.</p>
        {isAdmin && <button onClick={createBooking} disabled={creating} className="btn btn-primary">{creating ? 'Lege an…' : 'Booking anlegen'}</button>}
      </div>
    )
  }

  return <BookingWorkspace booking={booking} isAdmin={isAdmin} onChanged={load} />
}

function BookingWorkspace({ booking, isAdmin, onChanged }: { booking: BookingContract; isAdmin: boolean; onChanged: () => void }) {
  const [f, setF] = useState<BookingContractInput>({
    status: booking.status, deal_type: booking.deal_type ?? 'guarantee', currency: booking.currency ?? 'EUR',
    guarantee: booking.guarantee ?? '', deal_share: booking.deal_share ?? '', break_even: booking.break_even ?? '',
    vvk: booking.vvk ?? '', ticket_price: booking.ticket_price ?? '', deposit: booking.deposit ?? '',
    payment_terms: booking.payment_terms ?? '', notes: booking.notes ?? '',
    partner_name: booking.partner_name ?? '', partner_address: booking.partner_address ?? '', partner_email: booking.partner_email ?? '',
    actual_tickets: booking.actual_tickets ?? '', actual_revenue: booking.actual_revenue ?? '',
  })
  const [clauses, setClauses] = useState<BookingClause[]>([])
  const [selected, setSelected] = useState<number[]>((booking.clauses ?? []).map(c => c.clause_id).filter((x): x is number => x != null))
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [invoices, setInvoices] = useState<BookingInvoice[]>([])
  const [taxRate, setTaxRate] = useState('19')
  const [invBusy, setInvBusy] = useState(false)

  const loadInvoices = useCallback(() => { getBookingInvoices(booking.id).then(setInvoices).catch(() => {}) }, [booking.id])
  useEffect(() => { getBookingClauses().then(setClauses).catch(() => {}); loadInvoices() }, [loadInvoices])

  const set = (patch: Partial<BookingContractInput>) => setF(prev => ({ ...prev, ...patch }))
  const curIdx = BOOKING_STATUSES.findIndex(s => s.id === f.status)
  const nextStatus = curIdx >= 0 && curIdx < BOOKING_STATUSES.length - 1 ? BOOKING_STATUSES[curIdx + 1] : null

  const persist = async (patch: Partial<BookingContractInput>) => {
    setSaving(true)
    try {
      await updateBookingContract(booking.id, { ...f, ...patch, clauseIds: selected })
      setSavedMsg(true); setTimeout(() => setSavedMsg(false), 1500)
      onChanged()
    } catch { /* ignore */ }
    setSaving(false)
  }

  const saveAll = () => persist({})
  const goNext = () => { if (nextStatus) { set({ status: nextStatus.id }); persist({ status: nextStatus.id }) } }
  const setStatus = (id: string) => { set({ status: id }); persist({ status: id }) }
  const toggleClause = (id: number) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const due = computeDue(f)
  const deposit = nnum(f.deposit)
  const remaining = Math.max(0, due - deposit)
  const cur = f.currency || 'EUR'

  // Rechnung erstellen: erst aktuellen Stand speichern (Beträge werden serverseitig daraus berechnet), dann anlegen.
  const createInv = async (kind: 'deposit' | 'final') => {
    setInvBusy(true)
    try {
      await updateBookingContract(booking.id, { ...f, clauseIds: selected })
      await createBookingInvoice({ contractId: booking.id, kind, tax_rate: taxRate, service_date: (f as { event_date?: string }).event_date || booking.event_date || undefined })
      loadInvoices(); onChanged()
    } catch { /* ignore */ }
    setInvBusy(false)
  }
  const invGross = (iv: BookingInvoice) => {
    const r = nnum(iv.tax_rate) / 100
    const net = Math.max(0, nnum(iv.total_net) - nnum(iv.deposit_net))
    return net * (1 + r)
  }

  const num = (label: string, key: keyof BookingContractInput, ph = '') => (
    <div>
      <label className="form-label">{label}</label>
      <input className="form-input" inputMode="decimal" disabled={!isAdmin} value={(f[key] as string) ?? ''} onChange={e => set({ [key]: e.target.value } as Partial<BookingContractInput>)} placeholder={ph} />
    </div>
  )

  return (
    <div className="space-y-5" style={{ maxWidth: 820 }}>
      {/* Statusband */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {BOOKING_STATUSES.map((s, i) => {
          const active = s.id === f.status
          const done = curIdx >= 0 && i < curIdx
          return (
            <button key={s.id} onClick={() => isAdmin && setStatus(s.id)} disabled={!isAdmin}
              className="px-2.5 py-1.5 text-xs rounded-lg transition-colors"
              style={{
                background: active ? 'var(--primary)' : done ? 'var(--pos-soft, var(--hover))' : 'var(--hover)',
                color: active ? '#fff' : done ? 'var(--pos, var(--text))' : 'var(--text-muted)',
                fontWeight: active ? 600 : 400,
              }}>
              {s.label}
            </button>
          )
        })}
        {isAdmin && nextStatus && (
          <button onClick={goNext} className="btn btn-primary ml-2" style={{ padding: '6px 12px' }}>
            {nextStatus.label} <ArrowRightIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Veranstalter */}
      <fieldset className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
        <legend className="text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }}>VERANSTALTER</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="form-label">Name / Firma</label><input className="form-input" disabled={!isAdmin} value={f.partner_name ?? ''} onChange={e => set({ partner_name: e.target.value })} /></div>
          <div><label className="form-label">E-Mail</label><input className="form-input" disabled={!isAdmin} value={f.partner_email ?? ''} onChange={e => set({ partner_email: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="form-label">Adresse</label><textarea className="form-input" rows={2} disabled={!isAdmin} value={f.partner_address ?? ''} onChange={e => set({ partner_address: e.target.value })} /></div>
        </div>
      </fieldset>

      {/* Deal */}
      <fieldset className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
        <legend className="text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }}>DEAL / KONDITIONEN</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="form-label">Deal-Art</label>
            <select className="form-select" disabled={!isAdmin} value={f.deal_type ?? 'guarantee'} onChange={e => set({ deal_type: e.target.value })}>
              {DEAL_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          {num('Garantie / Festgage', 'guarantee', '0')}
          {num('Deal-Anteil %', 'deal_share', 'z.B. 70')}
          {num('Break-Even', 'break_even')}
          {num('Ticketpreis', 'ticket_price')}
          {num('VVK (Stück)', 'vvk')}
          {num('Anzahlung', 'deposit')}
          <div><label className="form-label">Währung</label><input className="form-input" disabled={!isAdmin} value={f.currency ?? 'EUR'} onChange={e => set({ currency: e.target.value })} /></div>
          <div className="col-span-2 sm:col-span-3"><label className="form-label">Zahlungsziel</label><input className="form-input" disabled={!isAdmin} value={f.payment_terms ?? ''} onChange={e => set({ payment_terms: e.target.value })} placeholder="z.B. 50% bei Vertragsschluss, Rest am Showtag" /></div>
        </div>
      </fieldset>

      {/* Vertrag */}
      <fieldset className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
        <legend className="text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }}>VERTRAG</legend>
        <label className="form-label">Bausteine (jeweils aktuelle Version)</label>
        {clauses.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Noch keine Bausteine – lege welche unter Booking → Bausteine an.</p>
        ) : (
          <div className="space-y-1 border rounded-lg p-2" style={{ borderColor: 'var(--border)', maxHeight: 200, overflowY: 'auto' }}>
            {clauses.map(c => (
              <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--hover)]">
                <input type="checkbox" disabled={!isAdmin} checked={selected.includes(c.id)} onChange={() => toggleClause(c.id)} className="accent-blue-600" />
                <span className="text-sm" style={{ color: 'var(--text)' }}>{c.title}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>v{c.latest_version ?? 1}</span>
              </label>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 mt-3">
          <button onClick={() => openBookingContractPdf(booking.id)} className="btn btn-ghost"><DocumentArrowDownIcon className="w-4 h-4" />Vertrag-PDF</button>
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{booking.contract_no}</span>
        </div>
      </fieldset>

      {/* Abrechnung (nach der Show) */}
      <fieldset className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
        <legend className="text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }}>ABRECHNUNG (nach der Show)</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {num('Verkaufte Tickets (Ist)', 'actual_tickets')}
          {num('Tatsächliche Einnahmen', 'actual_revenue', 'optional – sonst Tickets × Preis')}
        </div>
        <div className="mt-3 rounded-lg p-3 text-sm" style={{ background: 'var(--hover)' }}>
          <div className="flex justify-between py-0.5"><span style={{ color: 'var(--text-muted)' }}>Einnahmen (Basis)</span><span style={{ color: 'var(--text)' }}>{eur((f.actual_revenue != null && f.actual_revenue !== '') ? nnum(f.actual_revenue) : nnum(f.actual_tickets) * nnum(f.ticket_price), cur)}</span></div>
          <div className="flex justify-between py-0.5"><span style={{ color: 'var(--text-muted)' }}>Honorar (Deal)</span><span style={{ color: 'var(--text)', fontWeight: 600 }}>{eur(due, cur)}</span></div>
          {deposit > 0 && <div className="flex justify-between py-0.5"><span style={{ color: 'var(--text-muted)' }}>abzgl. Anzahlung</span><span style={{ color: 'var(--text)' }}>− {eur(deposit, cur)}</span></div>}
          <div className="flex justify-between py-0.5 border-t mt-1 pt-1" style={{ borderColor: 'var(--border)' }}><span style={{ color: 'var(--text-muted)' }}>Restbetrag (netto)</span><span style={{ color: 'var(--text)', fontWeight: 700 }}>{eur(remaining, cur)}</span></div>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Netto-Beträge. USt wird auf der Rechnung ausgewiesen.</p>
        </div>
      </fieldset>

      {/* Rechnungen */}
      <fieldset className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
        <legend className="text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }}>RECHNUNGEN</legend>
        {isAdmin && (
          <div className="flex items-end gap-2 flex-wrap mb-3">
            <div style={{ width: 90 }}>
              <label className="form-label">USt %</label>
              <input className="form-input" inputMode="decimal" value={taxRate} onChange={e => setTaxRate(e.target.value)} />
            </div>
            <button onClick={() => createInv('deposit')} disabled={invBusy || deposit <= 0} className="btn btn-ghost" title={deposit <= 0 ? 'Keine Anzahlung im Deal hinterlegt' : ''}><PlusIcon className="w-4 h-4" />Anzahlungsrechnung</button>
            <button onClick={() => createInv('final')} disabled={invBusy} className="btn btn-primary"><PlusIcon className="w-4 h-4" />Schlussrechnung</button>
          </div>
        )}
        {invoices.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Noch keine Rechnungen. Zuerst Deal/Abrechnung ausfüllen, dann Rechnung erstellen.</p>
        ) : (
          <div className="space-y-1">
            {invoices.map(iv => (
              <div key={iv.id} className="flex items-center gap-3 border rounded-lg px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{iv.invoice_no}</span>
                <span className="text-sm" style={{ color: 'var(--text)' }}>{iv.kind === 'deposit' ? 'Anzahlung' : 'Schlussrechnung'}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{iv.issue_date}</span>
                <span className="text-sm ml-auto" style={{ color: 'var(--text)', fontWeight: 600 }}>{eur(invGross(iv), iv.currency || 'EUR')}</span>
                <button onClick={() => openBookingInvoicePdf(iv.id)} className="p-1 text-gray-400 hover:text-blue-600" title="PDF"><DocumentArrowDownIcon className="w-4 h-4" /></button>
                {isAdmin && <button onClick={async () => { if (!confirm(`Rechnung ${iv.invoice_no} löschen?`)) return; await deleteBookingInvoice(iv.id); loadInvoices() }} className="p-1 text-gray-400 hover:text-red-600" title="Löschen"><TrashIcon className="w-4 h-4" /></button>}
              </div>
            ))}
          </div>
        )}
      </fieldset>

      <div>
        <label className="form-label">Weitere Vereinbarungen / Notizen</label>
        <textarea className="form-input" rows={3} disabled={!isAdmin} value={f.notes ?? ''} onChange={e => set({ notes: e.target.value })} />
      </div>

      {isAdmin && (
        <div className="flex items-center gap-3">
          <button onClick={saveAll} disabled={saving} className="btn btn-primary">{saving ? 'Speichern…' : 'Speichern'}</button>
          {savedMsg && <span className="text-sm" style={{ color: 'var(--pos, green)' }}>✓ Gespeichert</span>}
          <button onClick={async () => { if (!confirm('Booking für dieses Event löschen?')) return; await deleteBookingContract(booking.id); onChanged() }}
            className="btn btn-ghost text-red-600 hover:bg-red-50 ml-auto"><TrashIcon className="w-4 h-4" />Booking löschen</button>
        </div>
      )}
    </div>
  )
}
