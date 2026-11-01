'use client'

import { useState, useEffect, useCallback } from 'react'
import { DocumentArrowDownIcon, ArrowRightIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import {
  getBookingContracts, getBookingContract, createBookingContract, updateBookingContract, deleteBookingContract, openBookingContractPdf,
  getBookingClauses, getBookingInvoices, createBookingInvoice, deleteBookingInvoice, openBookingInvoicePdf,
  setBookingTicketSales, setBookingCostLines, getBookingSettings,
  type BookingContract, type BookingContractInput, type BookingClause, type BookingInvoice,
  type BookingTicketSale, type BookingCostLine, type BookingSettings, type Termin,
} from '@/lib/api-client'
import { computeSettlement, type SettlementChannel } from '@/lib/booking/settlement'
import { BOOKING_STATUSES } from './BookingModule'

const nnum = (v: unknown) => { const x = Number(String(v ?? '').replace(',', '.')); return isFinite(x) ? x : 0 }
const eur = (n: number, cur = 'EUR') => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + cur
const ART = [{ id: 'vvk', label: 'VVK' }, { id: 'boxoffice', label: 'Abendkasse' }, { id: 'ownshop', label: 'Eigener Shop' }]
const MONEY = [{ id: 'promoter', label: 'Veranstalter' }, { id: 'band', label: 'Band' }]
const DEAL_BASE = [{ id: 'gross', label: '% vom Netto-Ticketumsatz' }, { id: 'netprofit', label: '% vom Nettogewinn (nach Kosten)' }]

export default function EventBookingView({ terminId, termin, isAdmin }: { terminId: number; termin: Termin; isAdmin: boolean }) {
  const [booking, setBooking] = useState<BookingContract | null>(null)
  const [settings, setSettings] = useState<BookingSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [all, bset] = await Promise.all([getBookingContracts(), getBookingSettings().catch(() => null)])
      setSettings(bset)
      const mine = all.find(c => c.termin_id === terminId)
      setBooking(mine ? await getBookingContract(mine.id) : null)
    } catch { /* ignore */ }
    setLoading(false)
  }, [terminId])
  useEffect(() => { load() }, [load])

  const createBooking = async () => {
    setCreating(true)
    try {
      const id = await createBookingContract({
        title: [termin.title || termin.city, 'Booking'].filter(Boolean).join(' – ') || 'Booking',
        status: 'enquiry', termin_id: terminId,
        event_title: termin.title || '', event_date: termin.date ? String(termin.date).slice(0, 10) : '',
        event_city: termin.city || termin.venueCity || '', event_venue: termin.venueName || '',
        currency: 'EUR', deal_type: 'vs', deal_base: 'gross',
        ticket_vat: settings?.ticket_vat ?? '7', fee_vat: settings?.fee_vat ?? '7', artist_vat: settings?.artist_vat ?? '7',
      })
      setBooking(await getBookingContract(id))
    } catch { /* ignore */ }
    setCreating(false)
  }

  if (loading) return <div className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Lädt…</div>
  if (!booking) return (
    <div className="py-10 text-center">
      <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Für dieses Event ist noch kein Booking angelegt.</p>
      {isAdmin && <button onClick={createBooking} disabled={creating} className="btn btn-primary">{creating ? 'Lege an…' : 'Booking anlegen'}</button>}
    </div>
  )
  return <BookingWorkspace booking={booking} settings={settings} isAdmin={isAdmin} onChanged={load} />
}

function BookingWorkspace({ booking, settings, isAdmin, onChanged }: { booking: BookingContract; settings: BookingSettings | null; isAdmin: boolean; onChanged: () => void }) {
  const [f, setF] = useState<BookingContractInput>(() => ({
    status: booking.status, currency: booking.currency ?? 'EUR',
    partner_name: booking.partner_name ?? '', partner_address: booking.partner_address ?? '', partner_email: booking.partner_email ?? '',
    deal_type: booking.deal_type ?? 'vs', deal_base: booking.deal_base ?? 'gross',
    guarantee: booking.guarantee ?? '', pct1: booking.pct1 ?? '', threshold2: booking.threshold2 ?? '', pct2: booking.pct2 ?? '',
    promoter_costs: booking.promoter_costs ?? '', deposit: booking.deposit ?? '', payment_terms: booking.payment_terms ?? '',
    ticket_vat: booking.ticket_vat ?? settings?.ticket_vat ?? '7',
    fee_per_ticket: booking.fee_per_ticket ?? '', fee_vat: booking.fee_vat ?? settings?.fee_vat ?? '7', fee_band_split_pct: booking.fee_band_split_pct ?? '',
    artist_vat: booking.artist_vat ?? settings?.artist_vat ?? '7',
    ticketing_payout_gross: booking.ticketing_payout_gross ?? '', deduct_own_shop: booking.deduct_own_shop ?? '',
    issuer_mode: booking.issuer_mode ?? '', issuer_name: booking.issuer_name ?? '', issuer_address: booking.issuer_address ?? '',
    issuer_taxid: booking.issuer_taxid ?? '', issuer_email: booking.issuer_email ?? '', issuer_phone: booking.issuer_phone ?? '',
    notes: booking.notes ?? '',
  }))
  const [channels, setChannels] = useState<BookingTicketSale[]>(booking.ticket_sales ?? [])
  const [costs, setCosts] = useState<BookingCostLine[]>(booking.cost_lines ?? [])
  const [clauses, setClauses] = useState<BookingClause[]>([])
  const [selected, setSelected] = useState<number[]>((booking.clauses ?? []).map(c => c.clause_id).filter((x): x is number => x != null))
  const [invoices, setInvoices] = useState<BookingInvoice[]>([])
  const [saving, setSaving] = useState(false); const [savedMsg, setSavedMsg] = useState(false); const [invBusy, setInvBusy] = useState(false)

  const loadInvoices = useCallback(() => { getBookingInvoices(booking.id).then(setInvoices).catch(() => {}) }, [booking.id])
  useEffect(() => { getBookingClauses().then(setClauses).catch(() => {}); loadInvoices() }, [loadInvoices])

  const set = (patch: Partial<BookingContractInput>) => setF(prev => ({ ...prev, ...patch }))
  const cur = f.currency || 'EUR'
  const deductOwn = f.deduct_own_shop === '1'

  const st = computeSettlement({
    channels: channels as SettlementChannel[], costs: costs.map(c => ({ net: c.net, vat: c.vat })),
    ticketVat: f.ticket_vat, feePerTicket: f.fee_per_ticket, feeVat: f.fee_vat, feeBandSplitPct: f.fee_band_split_pct,
    artistVat: f.artist_vat, dealBase: f.deal_base, promoterCosts: f.promoter_costs, guarantee: f.guarantee,
    pct1: f.pct1, threshold2: f.threshold2, pct2: f.pct2, ticketingPayoutGross: f.ticketing_payout_gross,
    deductOwnShop: deductOwn, depositNet: f.deposit, depositVat: f.artist_vat,
  })

  const curIdx = BOOKING_STATUSES.findIndex(s => s.id === f.status)
  const nextStatus = curIdx >= 0 && curIdx < BOOKING_STATUSES.length - 1 ? BOOKING_STATUSES[curIdx + 1] : null

  const saveEverything = async (patch: Partial<BookingContractInput> = {}) => {
    await updateBookingContract(booking.id, { ...f, ...patch, clauseIds: selected })
    await setBookingTicketSales(booking.id, channels)
    await setBookingCostLines(booking.id, costs)
  }
  const persist = async (patch: Partial<BookingContractInput> = {}) => {
    setSaving(true)
    try { await saveEverything(patch); setSavedMsg(true); setTimeout(() => setSavedMsg(false), 1500); onChanged() } catch { /* ignore */ }
    setSaving(false)
  }
  const setStatus = (id: string) => { set({ status: id }); persist({ status: id }) }
  const goNext = () => { if (nextStatus) setStatus(nextStatus.id) }
  const toggleClause = (id: number) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  // Kanäle / Nebenkosten
  const addChannel = () => setChannels(p => [...p, { vendor: '', art: 'vvk', money_with: 'promoter', tickets: '', revenue: '' }])
  const setCh = (i: number, patch: Partial<BookingTicketSale>) => setChannels(p => p.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  const rmCh = (i: number) => setChannels(p => p.filter((_, idx) => idx !== i))
  const addCost = () => setCosts(p => [...p, { label: '', net: '', vat: settings?.service_vat ?? '19' }])
  const setCo = (i: number, patch: Partial<BookingCostLine>) => setCosts(p => p.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  const rmCo = (i: number) => setCosts(p => p.filter((_, idx) => idx !== i))

  const createInv = async (kind: 'deposit' | 'final') => {
    setInvBusy(true)
    try {
      await saveEverything()
      if (kind === 'deposit') {
        const net = nnum(f.deposit); const vat = net * nnum(f.artist_vat) / 100
        await createBookingInvoice({ contractId: booking.id, kind, total_net: net, tax_amount: vat, gross_amount: net + vat, deposit_net: net, description: 'Anzahlung / Vorauszahlung gemäß Vereinbarung' })
      } else {
        const deductions = st.rechnungGross - st.payableGross
        await createBookingInvoice({ contractId: booking.id, kind, total_net: st.rechnungNet, tax_amount: st.rechnungVat, gross_amount: st.rechnungGross, deductions_gross: deductions, deposit_net: nnum(f.deposit), description: 'Honorar / Abrechnung gemäß Vereinbarung' })
      }
      loadInvoices(); onChanged()
    } catch { /* ignore */ }
    setInvBusy(false)
  }
  const invGross = (iv: BookingInvoice) => nnum(iv.gross_amount) - nnum(iv.deductions_gross)

  const In = (label: string, key: keyof BookingContractInput, ph = '') => (
    <div><label className="form-label">{label}</label>
      <input className="form-input" inputMode="decimal" disabled={!isAdmin} value={(f[key] as string) ?? ''} onChange={e => set({ [key]: e.target.value } as Partial<BookingContractInput>)} placeholder={ph} /></div>
  )
  const Row = ({ k, v, bold, muted, big, sub }: { k: string; v: string; bold?: boolean; muted?: boolean; big?: boolean; sub?: boolean }) => (
    <div className={`flex justify-between ${sub ? 'pl-3' : ''}`} style={{ padding: '2px 0' }}>
      <span style={{ color: muted ? 'var(--text-muted)' : 'var(--text)' }}>{k}</span>
      <span style={{ color: muted ? 'var(--text-muted)' : 'var(--text)', fontWeight: bold ? 700 : big ? 600 : 400, fontSize: big ? '1.05em' : undefined }}>{v}</span>
    </div>
  )

  return (
    <div className="space-y-5" style={{ maxWidth: 860 }}>
      {/* Statusband */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {BOOKING_STATUSES.map((s, i) => (
          <button key={s.id} onClick={() => isAdmin && setStatus(s.id)} disabled={!isAdmin}
            className="px-2.5 py-1.5 text-xs rounded-lg transition-colors"
            style={{ background: s.id === f.status ? 'var(--primary)' : 'var(--hover)', color: s.id === f.status ? '#fff' : (curIdx >= 0 && i < curIdx) ? 'var(--text)' : 'var(--text-muted)', fontWeight: s.id === f.status ? 600 : 400 }}>
            {s.label}
          </button>
        ))}
        {isAdmin && nextStatus && <button onClick={goNext} className="btn btn-primary ml-2" style={{ padding: '6px 12px' }}>{nextStatus.label} <ArrowRightIcon className="w-4 h-4" /></button>}
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
          <div><label className="form-label">Deal-Basis</label>
            <select className="form-select" disabled={!isAdmin} value={f.deal_base ?? 'gross'} onChange={e => set({ deal_base: e.target.value })}>
              {DEAL_BASE.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select></div>
          {In('Produktionskostengarantie', 'guarantee', '0')}
          {In('% ab erster Karte', 'pct1', 'z.B. 60')}
          {In('2. Schwelle ab Netto', 'threshold2', 'optional')}
          {In('% ab Schwelle', 'pct2', 'optional')}
          {f.deal_base === 'netprofit' && In('Veranstalterkosten', 'promoter_costs')}
          {In('Anzahlung (netto)', 'deposit')}
          <div><label className="form-label">Währung</label><input className="form-input" disabled={!isAdmin} value={f.currency ?? 'EUR'} onChange={e => set({ currency: e.target.value })} /></div>
          <div className="col-span-2 sm:col-span-3"><label className="form-label">Zahlungsziel</label><input className="form-input" disabled={!isAdmin} value={f.payment_terms ?? ''} onChange={e => set({ payment_terms: e.target.value })} placeholder="z.B. 50% bei Vertragsschluss, Rest nach Show" /></div>
        </div>
      </fieldset>

      {/* Vertrag */}
      <fieldset className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
        <legend className="text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }}>VERTRAG</legend>
        {clauses.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Noch keine Bausteine – unter Booking → Bausteine anlegen.</p>
        ) : (
          <div className="space-y-1 border rounded-lg p-2" style={{ borderColor: 'var(--border)', maxHeight: 180, overflowY: 'auto' }}>
            {clauses.map(c => (
              <label key={c.id} className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-[var(--hover)]">
                <input type="checkbox" disabled={!isAdmin} checked={selected.includes(c.id)} onChange={() => toggleClause(c.id)} className="accent-blue-600" />
                <span className="text-sm" style={{ color: 'var(--text)' }}>{c.title}</span><span className="text-xs" style={{ color: 'var(--text-muted)' }}>v{c.latest_version ?? 1}</span>
              </label>
            ))}
          </div>
        )}
        <button onClick={() => openBookingContractPdf(booking.id)} className="btn btn-ghost mt-3"><DocumentArrowDownIcon className="w-4 h-4" />Vertrag-PDF</button>
      </fieldset>

      {/* Abrechnung */}
      <fieldset className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
        <legend className="text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }}>ABRECHNUNG (nach der Show)</legend>

        <div className="flex items-center justify-between mb-1"><span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Ticketing – Vertriebskanäle</span>{isAdmin && <button onClick={addChannel} className="btn btn-ghost" style={{ padding: '4px 10px' }}><PlusIcon className="w-4 h-4" />Kanal</button>}</div>
        {channels.length === 0 ? <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>Kanäle hinzufügen (Eventim, Abendkasse, Eigener Shop …).</p> : (
          <div className="space-y-1.5 mb-2">
            {channels.map((s, i) => (
              <div key={i} className="grid gap-1.5 items-center" style={{ gridTemplateColumns: 'minmax(0,1.3fr) 90px 100px 60px 100px 28px' }}>
                <input className="form-input" disabled={!isAdmin} placeholder="Händler" value={s.vendor ?? ''} onChange={e => setCh(i, { vendor: e.target.value })} />
                <select className="form-select" disabled={!isAdmin} value={s.art ?? 'vvk'} onChange={e => setCh(i, { art: e.target.value })}>{ART.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
                <select className="form-select" disabled={!isAdmin} value={s.money_with ?? 'promoter'} onChange={e => setCh(i, { money_with: e.target.value })} title="Geld liegt bei">{MONEY.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
                <input className="form-input text-right" inputMode="decimal" disabled={!isAdmin} placeholder="Stk" value={s.tickets ?? ''} onChange={e => setCh(i, { tickets: e.target.value })} />
                <input className="form-input text-right" inputMode="decimal" disabled={!isAdmin} placeholder="Brutto €" value={s.revenue ?? ''} onChange={e => setCh(i, { revenue: e.target.value })} />
                {isAdmin ? <button onClick={() => rmCh(i)} className="p-1 text-gray-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button> : <span />}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          {In('USt Tickets %', 'ticket_vat')}
          {In('Ticketgebühr / Ticket', 'fee_per_ticket', 'z.B. 3,38')}
          {In('USt Gebühr %', 'fee_vat')}
          {In('Band-Anteil Gebühr %', 'fee_band_split_pct', 'z.B. 50')}
          {In('USt Künstleranteil %', 'artist_vat')}
          {In('Ticketing-Payout (brutto)', 'ticketing_payout_gross', 'bereits an Band')}
          <div className="flex items-end"><label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            <input type="checkbox" disabled={!isAdmin} checked={deductOwn} onChange={e => set({ deduct_own_shop: e.target.checked ? '1' : '' })} className="accent-blue-600" />
            Eigener Shop verrechnen
          </label></div>
        </div>

        {/* Nebenkosten */}
        <div className="flex items-center justify-between mt-4 mb-1"><span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Nebenkosten</span>{isAdmin && <button onClick={addCost} className="btn btn-ghost" style={{ padding: '4px 10px' }}><PlusIcon className="w-4 h-4" />Position</button>}</div>
        {costs.length > 0 && (
          <div className="space-y-1.5">
            {costs.map((c, i) => (
              <div key={i} className="grid gap-1.5 items-center" style={{ gridTemplateColumns: 'minmax(0,1fr) 110px 70px 28px' }}>
                <input className="form-input" disabled={!isAdmin} placeholder="z.B. Nightliner Buyout" value={c.label ?? ''} onChange={e => setCo(i, { label: e.target.value })} />
                <input className="form-input text-right" inputMode="decimal" disabled={!isAdmin} placeholder="netto €" value={c.net ?? ''} onChange={e => setCo(i, { net: e.target.value })} />
                <input className="form-input text-right" inputMode="decimal" disabled={!isAdmin} placeholder="USt %" value={c.vat ?? ''} onChange={e => setCo(i, { vat: e.target.value })} />
                {isAdmin ? <button onClick={() => rmCo(i)} className="p-1 text-gray-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button> : <span />}
              </div>
            ))}
          </div>
        )}

        {/* Ergebnis */}
        <div className="mt-3 rounded-lg p-3 text-sm" style={{ background: 'var(--hover)' }}>
          <Row k="Ticketeinnahmen brutto" v={eur(st.ticketGross, cur)} muted />
          <Row k={`abzgl. USt (${nnum(f.ticket_vat).toLocaleString('de-DE')} %)`} v={'− ' + eur(st.ticketVatAmt, cur)} muted sub />
          <Row k="Ticketeinnahmen netto" v={eur(st.ticketNet, cur)} />
          <Row k={`Anteil an Ticketumsatz (netto)`} v={eur(st.dealShareNet, cur)} />
          {st.bandFeeShareNet > 0 && <Row k="Anteil an Ticketgebühr (netto)" v={eur(st.bandFeeShareNet, cur)} />}
          {st.costsNet > 0 && <Row k="Nebenkosten (netto)" v={eur(st.costsNet, cur)} />}
          <Row k="Rechnungsbetrag netto" v={eur(st.rechnungNet, cur)} bold />
          <Row k="zzgl. USt" v={eur(st.rechnungVat, cur)} muted sub />
          <Row k="Rechnungsbetrag brutto" v={eur(st.rechnungGross, cur)} bold />
          {st.ticketingPayout > 0 && <Row k="abzgl. Ticketing-Payout" v={'− ' + eur(st.ticketingPayout, cur)} muted />}
          {st.ownShopGross > 0 && <Row k="abzgl. Eigener Shop (bei Band)" v={'− ' + eur(st.ownShopGross, cur)} muted />}
          {st.depositGross > 0 && <Row k="abzgl. Anzahlung" v={'− ' + eur(st.depositGross, cur)} muted />}
          <div className="border-t mt-1 pt-1" style={{ borderColor: 'var(--border)' }}><Row k="Offener Betrag an die Band" v={eur(st.payableGross, cur)} big bold /></div>
        </div>
      </fieldset>

      {/* Rechnungssteller */}
      <fieldset className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
        <legend className="text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }}>RECHNUNGSSTELLER</legend>
        <select className="form-select" disabled={!isAdmin} value={f.issuer_mode || ''} onChange={e => set({ issuer_mode: e.target.value })} style={{ maxWidth: 360 }}>
          <option value="">Standard (aus Booking-Einstellungen / Band)</option>
          <option value="custom">Abweichend (für dieses Event)</option>
        </select>
        {f.issuer_mode === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div><label className="form-label">Name / Firma</label><input className="form-input" disabled={!isAdmin} value={f.issuer_name ?? ''} onChange={e => set({ issuer_name: e.target.value })} /></div>
            <div><label className="form-label">USt-IdNr./St-Nr.</label><input className="form-input" disabled={!isAdmin} value={f.issuer_taxid ?? ''} onChange={e => set({ issuer_taxid: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className="form-label">Adresse</label><textarea className="form-input" rows={2} disabled={!isAdmin} value={f.issuer_address ?? ''} onChange={e => set({ issuer_address: e.target.value })} /></div>
            <div><label className="form-label">E-Mail</label><input className="form-input" disabled={!isAdmin} value={f.issuer_email ?? ''} onChange={e => set({ issuer_email: e.target.value })} /></div>
            <div><label className="form-label">Telefon</label><input className="form-input" disabled={!isAdmin} value={f.issuer_phone ?? ''} onChange={e => set({ issuer_phone: e.target.value })} /></div>
          </div>
        )}
      </fieldset>

      {/* Rechnungen */}
      <fieldset className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
        <legend className="text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }}>RECHNUNGEN</legend>
        {isAdmin && (
          <div className="flex gap-2 flex-wrap mb-3">
            <button onClick={() => createInv('deposit')} disabled={invBusy || nnum(f.deposit) <= 0} className="btn btn-ghost" title={nnum(f.deposit) <= 0 ? 'Keine Anzahlung hinterlegt' : ''}><PlusIcon className="w-4 h-4" />Anzahlungsrechnung</button>
            <button onClick={() => createInv('final')} disabled={invBusy} className="btn btn-primary"><PlusIcon className="w-4 h-4" />Schlussrechnung</button>
          </div>
        )}
        {invoices.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Noch keine Rechnungen. Erst Abrechnung ausfüllen, dann erstellen.</p> : (
          <div className="space-y-1">
            {invoices.map(iv => (
              <div key={iv.id} className="flex items-center gap-3 border rounded-lg px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{iv.invoice_no}</span>
                <span className="text-sm" style={{ color: 'var(--text)' }}>{iv.kind === 'deposit' ? 'Anzahlung' : 'Schlussrechnung'}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{iv.issue_date}</span>
                <span className="text-sm ml-auto" style={{ color: 'var(--text)', fontWeight: 600 }}>{eur(invGross(iv), iv.currency || 'EUR')}</span>
                <button onClick={() => openBookingInvoicePdf(iv.id)} className="p-1 text-gray-400 hover:text-blue-600" title="PDF"><DocumentArrowDownIcon className="w-4 h-4" /></button>
                {isAdmin && <button onClick={async () => { if (!confirm(`Rechnung ${iv.invoice_no} löschen?`)) return; await deleteBookingInvoice(iv.id); loadInvoices() }} className="p-1 text-gray-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>}
              </div>
            ))}
          </div>
        )}
      </fieldset>

      <div><label className="form-label">Weitere Vereinbarungen / Notizen</label><textarea className="form-input" rows={3} disabled={!isAdmin} value={f.notes ?? ''} onChange={e => set({ notes: e.target.value })} /></div>

      {isAdmin && (
        <div className="flex items-center gap-3">
          <button onClick={() => persist()} disabled={saving} className="btn btn-primary">{saving ? 'Speichern…' : 'Speichern'}</button>
          {savedMsg && <span className="text-sm" style={{ color: 'var(--pos, green)' }}>✓ Gespeichert</span>}
          <button onClick={async () => { if (!confirm('Booking für dieses Event löschen?')) return; await deleteBookingContract(booking.id); onChanged() }} className="btn btn-ghost text-red-600 hover:bg-red-50 ml-auto"><TrashIcon className="w-4 h-4" />Booking löschen</button>
        </div>
      )}
    </div>
  )
}
