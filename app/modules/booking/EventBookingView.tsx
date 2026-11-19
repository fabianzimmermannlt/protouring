'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { DocumentArrowDownIcon, ArrowRightIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import { SortableList } from '@/app/components/shared/SortableList'
import { TitleWithRole } from '@/app/components/shared/TitleWithRole'
import {
  getBookingContracts, getBookingContract, createBookingContract, updateBookingContract, deleteBookingContract, openBookingContractPdf,
  getBookingClauses, getBookingInvoices, createBookingInvoice, deleteBookingInvoice, openBookingInvoicePdf,
  previewBookingInvoice, openBookingSettlementPdf, type SettlementKA,
  setBookingTicketSales, setBookingCostLines, setBookingClauseOverrides, getBookingSettings,
  getVenue, updateVenue, getPartner, updatePartner, type PartnerFormData, getTerminPartners, getPartnerTypes,
  type BookingContract, type BookingContractInput, type BookingClause, type BookingInvoice,
  type BookingTicketSale, type BookingCostLine, type BookingSettings, type Termin, type Partner, type TerminPartner,
} from '@/lib/api-client'
import { AccordionSection } from '@/app/components/shared/AccordionSection'
import { HelpTip } from '@/app/components/shared/HelpTip'
import { PartnerPickerModal } from '@/app/components/shared/modals/PartnerPickerModal'

// Parteien aus dem verknüpften Event (Venue + Partner) zusammenstellen – strukturierte
// Adressen aus den Stammdaten, damit man im Booking nichts doppelt tippt.
async function partiesFromEvent(termin: Termin, settings: BookingSettings | null): Promise<Partial<BookingContractInput>> {
  const out: Partial<BookingContractInput> = {}
  if (settings?.rep_name) { out.rep_name = settings.rep_name; out.rep_address = settings.rep_address ?? '' }
  try {
    if (termin.partnerId) {
      const p = await getPartner(String(termin.partnerId))
      out.partner_name = p.companyName || ''
      out.partner_address = [p.street, [p.postalCode, p.city].filter(Boolean).join(' '), p.country].filter(Boolean).join('\n')
      out.partner_email = p.email || ''
    }
  } catch { /* ignore */ }
  try {
    if (termin.venueId) {
      const v = await getVenue(String(termin.venueId))
      out.event_venue = v.name || termin.venueName || ''
      out.venue_address = [v.street, [v.postalCode, v.city].filter(Boolean).join(' '), v.country].filter(Boolean).join('\n')
      if (v.city) out.event_city = v.city
    }
  } catch { /* ignore */ }
  return out
}
import { computeSettlement, parseNum, type SettlementChannel } from '@/lib/booking/settlement'
import { BOOKING_STATUSES } from './BookingModule'

const nnum = parseNum
const eur = (n: number, cur = 'EUR') => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + cur
// Betrag deutsch fürs Anzeigen in read-only Feldern: 32000 → "32.000,00" (ohne Währung); leer bleibt leer.
const amtDE = (v: unknown) => (v == null || v === '') ? '' : parseNum(v).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const intDE = (v: unknown) => (v == null || v === '') ? '' : parseNum(v).toLocaleString('de-DE', { maximumFractionDigits: 0 })

// Preiskategorie (Vorverkauf-Szenario je PK, wie FKP): eigenes Kontingent + Holds/Comps/Kills + Preise.
type PriceCat = { name: string; cap: string; holds: string; comps: string; kills: string; price: string; akprice: string }
const catVerk = (c: PriceCat) => Math.max(0, parseNum(c.cap) - parseNum(c.holds) - parseNum(c.comps) - parseNum(c.kills))
const catEinnahme = (c: PriceCat) => catVerk(c) * parseNum(c.price)

// Editierbares Zahlenfeld: zeigt den Wert deutsch formatiert (20000 → "20.000,00"),
// solange das Feld NICHT fokussiert ist. Beim Reinklicken erscheint der reine Wert zum
// Bearbeiten (kein Umformatieren beim Tippen → kein Cursor-Springen). kind steuert die
// Darstellung: 'money' = Betrag mit 2 Nachkommastellen, 'int' = ganze Zahl mit Tausender-Punkt,
// 'raw' = unverändert (z.B. Prozentwerte).
function NumInput({ value, onChange, kind = 'money', disabled, readOnly, placeholder, className = 'form-input', style, title, align }: {
  value: string; onChange: (v: string) => void; kind?: 'money' | 'int' | 'raw';
  disabled?: boolean; readOnly?: boolean; placeholder?: string; className?: string; style?: React.CSSProperties; title?: string; align?: 'right'
}) {
  const [focused, setFocused] = useState(false)
  const raw = value ?? ''
  const display = (focused && !readOnly) || raw === '' || kind === 'raw'
    ? raw
    : (kind === 'int' ? intDE(raw) : amtDE(raw))
  return (
    <input
      className={className + (align === 'right' ? ' text-right' : '')}
      inputMode="decimal" disabled={disabled} readOnly={readOnly} placeholder={placeholder} title={title} style={style}
      value={display}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={e => onChange(e.target.value)}
    />
  )
}
const ART = [{ id: 'vvk', label: 'VVK' }, { id: 'boxoffice', label: 'Abendkasse' }, { id: 'ownshop', label: 'Eigener Shop' }]
const MONEY = [{ id: 'promoter', label: 'Veranstalter' }, { id: 'band', label: 'Band' }]
const DEAL_BASE = [
  { id: 'gross', label: 'Netto-Ticketumsatz (% of gross)' },
  { id: 'netprofit', label: 'Nettogewinn ab Break-Even (% of net)' },
]
// Zusammensetzbares Deal-Modell: wenige Bausteine (Fixgage? Beteiligung? Verhältnis? Basis?),
// aus denen sich alle gängigen Deals ergeben. Die Presets setzen nur die Schalter;
// der Rechner bleibt generisch. „custom" blendet alle Schalter einzeln ein.
const DEAL_MODELS: { id: string; label: string; fix: boolean; part: boolean; type?: string; base?: string }[] = [
  { id: 'fix', label: 'Fixgage', fix: true, part: false, type: 'guarantee' },
  { id: 'participation', label: 'Nur Beteiligung (ggf. mit Stufen)', fix: false, part: true, type: 'vs', base: 'gross' },
  { id: 'vs', label: 'Fixgage gegen Beteiligung – das Höhere', fix: true, part: true, type: 'vs', base: 'gross' },
  { id: 'plus', label: 'Fixgage plus Beteiligung', fix: true, part: true, type: 'plus', base: 'gross' },
  { id: 'vs_break', label: 'Fixgage gegen Beteiligung ab Break-Even', fix: true, part: true, type: 'vs', base: 'netprofit' },
]
const TIER_BASIS = [
  { id: 'revenue', label: 'Netto-Umsatz (€)' },
  { id: 'tickets', label: 'Ticketzahl (Stück)' },
]
// Für Bestandsverträge ohne gespeichertes Preset: aus den vorhandenen Werten ableiten.
const deriveDealModel = (b: { deal_model?: string | null; guarantee?: string | null; deal_base?: string | null; deal_type?: string | null; deal_tiers?: string | null; pct1?: string | null }): string => {
  if (b.deal_model) return b.deal_model
  const num = (v: unknown) => { const x = Number(String(v ?? '').replace(',', '.')); return isFinite(x) ? x : 0 }
  const hasFix = num(b.guarantee) > 0
  let hasPart = false
  try { const t = b.deal_tiers ? JSON.parse(b.deal_tiers) : null; if (Array.isArray(t) && t.some((x: { pct?: unknown }) => num(x.pct) > 0)) hasPart = true } catch { /* */ }
  if (!hasPart && num(b.pct1) > 0) hasPart = true
  if (hasFix && !hasPart) return 'fix'
  if (!hasFix && hasPart) return 'participation'
  if (hasFix && hasPart) return b.deal_base === 'netprofit' ? 'vs_break' : (b.deal_type === 'plus' ? 'plus' : 'vs')
  return 'vs'
}
const VENUE_ROLE = 'Venue'
const roleLabel = (r?: string) => r || 'Beteiligte/r'
interface Party { role: string; name: string; street: string; postalCode: string; city: string; country: string; email: string; taxid: string; partner_id?: number }
// Adresse für PDF/Rechnung aus den strukturierten Feldern zusammensetzen.
const composeAddr = (p: { street?: string; postalCode?: string; city?: string; country?: string }) =>
  [p.street, [p.postalCode, p.city].filter(Boolean).join(' '), p.country].filter(Boolean).join('\n')
const emptyParty = (role = 'promoter'): Party => ({ role, name: '', street: '', postalCode: '', city: '', country: '', email: '', taxid: '' })

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
      const parties = await partiesFromEvent(termin, settings)
      const id = await createBookingContract({
        title: [termin.title || termin.city, 'Booking'].filter(Boolean).join(' – ') || 'Booking',
        status: 'enquiry', termin_id: terminId,
        event_title: termin.title || '', event_date: termin.date ? String(termin.date).slice(0, 10) : '',
        event_city: termin.city || termin.venueCity || '', event_venue: termin.venueName || '',
        currency: 'EUR', deal_type: 'vs', deal_base: 'gross',
        ticket_vat: settings?.ticket_vat ?? '7', fee_vat: settings?.fee_vat ?? '7', artist_vat: settings?.artist_vat ?? '7',
        ...parties,
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
  return <BookingWorkspace booking={booking} settings={settings} termin={termin} isAdmin={isAdmin} onChanged={load} />
}

function BookingWorkspace({ booking, settings, termin, isAdmin, onChanged }: { booking: BookingContract; settings: BookingSettings | null; termin: Termin; isAdmin: boolean; onChanged: () => void }) {
  const [f, setF] = useState<BookingContractInput>(() => ({
    status: booking.status, currency: booking.currency ?? 'EUR',
    rep_name: booking.rep_name ?? '', rep_address: booking.rep_address ?? '',
    partner_name: booking.partner_name ?? '', partner_address: booking.partner_address ?? '', partner_email: booking.partner_email ?? '',
    individual_terms: booking.individual_terms ?? '',
    deal_type: booking.deal_type ?? 'vs', deal_base: booking.deal_base ?? 'gross',
    deal_model: deriveDealModel(booking), tier_basis: booking.tier_basis ?? 'revenue',
    guarantee: booking.guarantee ?? '', pct1: booking.pct1 ?? '', threshold2: booking.threshold2 ?? '', pct2: booking.pct2 ?? '',
    promoter_costs: booking.promoter_costs ?? '', deposit: booking.deposit ?? '', payment_terms: booking.payment_terms ?? '',
    ticket_vat: booking.ticket_vat ?? settings?.ticket_vat ?? '7',
    fee_per_ticket: booking.fee_per_ticket ?? '', fee_vat: booking.fee_vat ?? settings?.fee_vat ?? '7', fee_band_split_pct: booking.fee_band_split_pct ?? '',
    artist_vat: booking.artist_vat ?? settings?.artist_vat ?? '7',
    ticketing_payout_gross: booking.ticketing_payout_gross ?? '', deduct_own_shop: booking.deduct_own_shop ?? '',
    issuer_mode: booking.issuer_mode ?? '', issuer_name: booking.issuer_name ?? '', issuer_address: booking.issuer_address ?? '',
    issuer_taxid: booking.issuer_taxid ?? '', issuer_email: booking.issuer_email ?? '', issuer_phone: booking.issuer_phone ?? '',
    notes: booking.notes ?? '',
    // Variable Vertragsangaben (statt fix im Baustein): Event-Details, Zahlungstermine, Bank, Support
    capacity: booking.capacity ?? '', doors_time: booking.doors_time ?? '', show_time: booking.show_time ?? '',
    deposit_due: booking.deposit_due ?? '', balance_due: booking.balance_due ?? '',
    bank_details: booking.bank_details ?? '', support_acts: booking.support_acts ?? '',
    vk_holds: booking.vk_holds ?? '', vk_comps: booking.vk_comps ?? '', vk_kills: booking.vk_kills ?? '',
    vk_base_price: booking.vk_base_price ?? '', ak_price: booking.ak_price ?? '',
  }))
  const [channels, setChannels] = useState<BookingTicketSale[]>(booking.ticket_sales ?? [])
  const [costs, setCosts] = useState<BookingCostLine[]>(booking.cost_lines ?? [])
  const [tiers, setTiers] = useState<{ from: string; pct: string }[]>(() => {
    try { const t = booking.deal_tiers ? JSON.parse(booking.deal_tiers) : null; if (Array.isArray(t) && t.length) return t.map((x: { from?: unknown; pct?: unknown }) => ({ from: String(x.from ?? ''), pct: String(x.pct ?? '') })) } catch { /* */ }
    const base: { from: string; pct: string }[] = [{ from: '0', pct: booking.pct1 ?? '' }]
    if (booking.threshold2 && booking.pct2) base.push({ from: booking.threshold2, pct: booking.pct2 })
    return base
  })
  // Preiskategorien = Vorverkauf-Szenario je PK (Kontingent/Holds/Comps/Kills/Preise), wie FKP.
  // Eine Quelle für Mengen UND Preise; speist die Vertrags-§5.1 und die Abrechnung (Kanal-Zuordnung).
  const [cats, setCats] = useState<PriceCat[]>(() => {
    try {
      const t = booking.price_categories ? JSON.parse(booking.price_categories) : null
      if (Array.isArray(t) && t.length) return t.map((x: Record<string, unknown>) => ({
        name: String(x.name ?? ''), cap: String(x.cap ?? ''), holds: String(x.holds ?? ''),
        comps: String(x.comps ?? ''), kills: String(x.kills ?? ''),
        price: String(x.price ?? x.face ?? ''), akprice: String(x.akprice ?? ''),
      }))
    } catch { /* */ }
    // Migration: aus den früheren Haus-Einzelwerten eine Zeile „Cat. 01" bilden.
    const legacy = [booking.capacity, booking.vk_base_price, booking.vk_holds, booking.vk_comps, booking.vk_kills, booking.ak_price]
    if (legacy.some(v => (v ?? '') !== '')) return [{
      name: 'Cat. 01', cap: booking.capacity ?? '', holds: booking.vk_holds ?? '', comps: booking.vk_comps ?? '',
      kills: booking.vk_kills ?? '', price: booking.vk_base_price ?? '', akprice: booking.ak_price ?? '',
    }]
    return []
  })
  // Ticketsysteme / Shops (Eigener Shop, Eventim …): zum Vertragszeitpunkt definiert, speisen §4 Refundierung
  // und §5.1 Preisstruktur; in der Abrechnung als Händler-Auswahl. Face Value/Gebühr sind NICHT je Shop (FKP).
  // Vertriebskanäle/Shops MIT je-Händler-Refundierung. Zum Vertragszeitpunkt definiert (speisen §4/§5.1);
  // in der Abrechnung Händler-Auswahl + Gebühren-Quelle. Abwärtskompatibel: alte Namensliste (string[]).
  const [shops, setShops] = useState<{ name: string; fee: string }[]>(() => {
    try {
      const t = booking.ticket_systems ? JSON.parse(booking.ticket_systems) : null
      if (Array.isArray(t)) {
        const rows = t.map((x: unknown) => typeof x === 'string'
          ? { name: x.trim(), fee: '' }
          : { name: String((x as { name?: unknown })?.name ?? '').trim(), fee: String((x as { fee?: unknown })?.fee ?? '') }
        ).filter(s => s.name)
        if (rows.length) return rows
      }
    } catch { /* */ }
    const seen = new Set<string>(); const fromChans: { name: string; fee: string }[] = []
    for (const s of (booking.ticket_sales ?? [])) {
      if ((s.art ?? 'vvk') === 'boxoffice') continue
      const v = (s.vendor ?? '').trim()
      if (v && !seen.has(v)) { seen.add(v); fromChans.push({ name: v, fee: String(s.chan_fee ?? '') }) }
    }
    if (fromChans.length) return fromChans
    return [{ name: 'Eigener Shop', fee: '' }, { name: 'Eventim', fee: '' }]
  })
  const [parties, setParties] = useState<Party[]>(() => {
    const norm = (x: Partial<Party> & { address?: string }): Party => ({
      role: x.role ?? 'other', name: x.name ?? '',
      // strukturierte Felder; Legacy-Einzelstring landet als Fallback in „Straße"
      street: x.street ?? x.address ?? '', postalCode: x.postalCode ?? '', city: x.city ?? '', country: x.country ?? '',
      email: x.email ?? '', taxid: x.taxid ?? '', partner_id: x.partner_id,
    })
    try { const p = booking.parties ? JSON.parse(booking.parties) : null; if (Array.isArray(p) && p.length) return p.map(norm) } catch { /* */ }
    const list: Party[] = []
    if (booking.rep_name) list.push(norm({ role: 'agency', name: booking.rep_name, address: booking.rep_address ?? '' }))
    if (booking.partner_name) list.push(norm({ role: 'promoter', name: booking.partner_name, address: booking.partner_address ?? '', email: booking.partner_email ?? '' }))
    return list
  })
  const [showPicker, setShowPicker] = useState(false)
  const [clauses, setClauses] = useState<BookingClause[]>([])
  // Pro-Vertrag Baustein-Overrides: Häkchen (included) + eigener Text. Fehlt ein Eintrag → an + Bibliothekstext.
  const [clauseOv, setClauseOv] = useState<Record<number, { included: boolean; body: string }>>(() => {
    const m: Record<number, { included: boolean; body: string }> = {}
    for (const r of (booking.clauses ?? [])) {
      if (r.clause_id != null) m[r.clause_id] = { included: r.included !== 0, body: r.body || '' }
    }
    return m
  })
  const [editingClause, setEditingClause] = useState<number | null>(null)
  // Stammdaten-Abgleich: Master-Partner je partner_id laden, Abweichungen anzeigen (beide Richtungen).
  const [masters, setMasters] = useState<Record<number, Partner>>({})
  const [cmpOpen, setCmpOpen] = useState<number | null>(null)
  const [invoices, setInvoices] = useState<BookingInvoice[]>([])
  const [eventPartners, setEventPartners] = useState<TerminPartner[]>([])
  const [roleOptions, setRoleOptions] = useState<string[]>([])
  const [invBusy, setInvBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [autoState, setAutoState] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')

  const loadInvoices = useCallback(() => { getBookingInvoices(booking.id).then(setInvoices).catch(() => {}) }, [booking.id])
  useEffect(() => {
    getBookingClauses().then(setClauses).catch(() => {})
    getTerminPartners(termin.id).then(setEventPartners).catch(() => {})
    getPartnerTypes().then(ts => setRoleOptions(ts.filter(t => t.visible).map(t => t.name))).catch(() => {})
    loadInvoices()
  }, [loadInvoices, termin.id])

  // Kapazität: eine Quelle = der Venue-Datensatz. Beim Laden aus dem Venue vorbefüllen
  // (wenn im Booking noch leer); Änderungen hier werden beim Speichern in den Venue
  // zurückgeschrieben → keine doppelte Pflege. (siehe venueCapRef-Write-back)
  const venueCapRef = useRef<{ id: string; capacity: string } | null>(null)
  useEffect(() => {
    if (!termin.venueId) return
    let alive = true
    getVenue(String(termin.venueId)).then(v => {
      if (!alive) return
      venueCapRef.current = { id: String(termin.venueId), capacity: v.capacity || '' }
      if (!(f.capacity ?? '').toString().trim() && v.capacity) set({ capacity: v.capacity })
    }).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termin.venueId])

  const set = (patch: Partial<BookingContractInput>) => setF(prev => ({ ...prev, ...patch }))
  const cur = f.currency || 'EUR'
  const deductOwn = f.deduct_own_shop === '1'
  // Deal-Modell auflösen (steuert, welche Felder sichtbar sind und ob Stufen in die Rechnung gehen).
  const dmId = f.deal_model ?? 'vs'
  const isCustomDeal = dmId === 'custom'
  const dm = DEAL_MODELS.find(m => m.id === dmId)
  const showFix = isCustomDeal || (dm?.fix ?? true)
  const showPart = isCustomDeal || (dm?.part ?? true)
  const tierOnTickets = f.tier_basis === 'tickets'

  // Refundierung je Händler als Map (Name → Gebühr) für den Rechenkern (vor globaler Standard-Gebühr).
  const shopFees = Object.fromEntries(shops.filter(s => s.name.trim() && String(s.fee).trim() !== '').map(s => [s.name.trim(), s.fee]))
  const st = computeSettlement({
    channels: channels as SettlementChannel[], costs: costs.map(c => ({ net: c.net, vat: c.vat })),
    ticketVat: f.ticket_vat, feePerTicket: f.fee_per_ticket, shopFees, feeVat: f.fee_vat, feeBandSplitPct: f.fee_band_split_pct,
    artistVat: f.artist_vat, dealBase: f.deal_base, promoterCosts: f.promoter_costs, guarantee: f.guarantee,
    dealType: f.deal_type, tierBasis: f.tier_basis,
    tiers: showPart ? tiers : [], ticketingPayoutGross: f.ticketing_payout_gross,
    deductOwnShop: deductOwn, depositNet: f.deposit, depositVat: f.artist_vat,
  })

  const curIdx = BOOKING_STATUSES.findIndex(s => s.id === f.status)
  const nextStatus = curIdx >= 0 && curIdx < BOOKING_STATUSES.length - 1 ? BOOKING_STATUSES[curIdx + 1] : null

  const saveEverything = async (patch: Partial<BookingContractInput> = {}) => {
    // Zuordnung in die Bestandsfelder (PDF/Rechnung) – rollenname-tolerant:
    // Venue = Rolle „Venue"; Vertretung = Rolle enthält „Agent"/„Vertret"; Vertragspartner
    // = erste übrige Partei (Reihenfolge ist vom Nutzer steuerbar).
    const venue = parties.find(p => p.role === VENUE_ROLE)
    const nonVenue = parties.filter(p => p.role !== VENUE_ROLE)
    const agency = nonVenue.find(p => /agent|vertret/i.test(p.role))
    const promoter = nonVenue.find(p => p !== agency) || nonVenue[0]
    const sync: Partial<BookingContractInput> = {
      parties: JSON.stringify(parties.filter(p => p.name || p.street || p.city)),
      rep_name: agency?.name ?? '', rep_address: agency ? composeAddr(agency) : '',
      partner_name: promoter?.name ?? '', partner_address: promoter ? composeAddr(promoter) : '', partner_email: promoter?.email ?? '',
      ...(venue ? { event_venue: venue.name, venue_address: composeAddr(venue) } : {}),
    }
    await updateBookingContract(booking.id, { ...f, ...sync, ...patch, deal_tiers: JSON.stringify(tiers.filter(t => t.pct !== '' || t.from === '0')), price_categories: JSON.stringify(cats.filter(c => c.name || c.price || c.cap)), ticket_systems: JSON.stringify(shops.map(s => ({ name: s.name.trim(), fee: String(s.fee ?? '').trim() })).filter(s => s.name)) })
    await setBookingTicketSales(booking.id, channels)
    await setBookingCostLines(booking.id, costs)
    // Pro-Vertrag Baustein-Overrides (nur Abweichungen: ausgeschlossen oder eigener Text).
    const ovList = Object.entries(clauseOv)
      .filter(([, v]) => !v.included || (v.body || '').trim())
      .map(([cid, v]) => ({ clause_id: Number(cid), included: v.included ? 1 : 0, body: v.body || '' }))
    await setBookingClauseOverrides(booking.id, ovList)
    // Kapazität in den Venue-Datensatz zurückschreiben (eine Quelle, keine Dopplung).
    const capNow = ((patch.capacity ?? f.capacity) ?? '').toString().trim()
    if (venueCapRef.current && capNow && capNow !== venueCapRef.current.capacity) {
      try {
        const v = await getVenue(venueCapRef.current.id)
        await updateVenue(venueCapRef.current.id, { ...v, capacity: capNow })
        venueCapRef.current.capacity = capNow
      } catch { /* Venue-Sync ist best effort */ }
    }
  }
  // ── Auto-Save (debounced) – kein „Speichern"-Knopf mehr nötig ──────────────
  const firstRun = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!isAdmin) return
    if (firstRun.current) { firstRun.current = false; return }
    setAutoState('pending')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setAutoState('saving')
      try { await saveEverything(); setAutoState('saved') } catch { setAutoState('error') }
    }, 800)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // bewusst auf die editierbaren Zustände hören:
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, parties, channels, costs, tiers, cats, shops, clauseOv])

  const setStatus = (id: string) => set({ status: id })   // Auto-Save übernimmt das Speichern
  const goNext = () => { if (nextStatus) setStatus(nextStatus.id) }

  // Kanäle / Nebenkosten
  const addChannel = () => setChannels(p => [...p, { vendor: '', category: '', art: 'vvk', money_with: 'promoter', tickets: '', price: '', revenue: '' }])
  // Brutto wird aus Stück × Preis berechnet. Nur wenn ein Preis gesetzt ist; sonst bleibt
  // ein ggf. direkt eingetragenes Brutto erhalten (Altbestand / Pauschal-Eingabe).
  const setCh = (i: number, patch: Partial<BookingTicketSale>) => setChannels(p => p.map((s, idx) => {
    if (idx !== i) return s
    const next = { ...s, ...patch }
    if ('tickets' in patch || 'price' in patch) {
      const hasPrice = (next.price ?? '') !== ''
      if (hasPrice) next.revenue = (nnum(next.tickets) * nnum(next.price)).toFixed(2)
    }
    return next
  }))
  const rmCh = (i: number) => setChannels(p => p.filter((_, idx) => idx !== i))
  const addCost = () => setCosts(p => [...p, { label: '', net: '', vat: settings?.service_vat ?? '19' }])
  const setCo = (i: number, patch: Partial<BookingCostLine>) => setCosts(p => p.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  const rmCo = (i: number) => setCosts(p => p.filter((_, idx) => idx !== i))
  const addCat = () => setCats(p => [...p, { name: '', cap: '', holds: '', comps: '', kills: '', price: '', akprice: '' }])
  const setCat = (i: number, patch: Partial<PriceCat>) => setCats(p => p.map((c, idx) => idx === i ? { ...c, ...patch } : c))
  const rmCat = (i: number) => setCats(p => p.filter((_, idx) => idx !== i))
  const addShop = () => setShops(p => [...p, { name: '', fee: '' }])
  const setShop = (i: number, patch: Partial<{ name: string; fee: string }>) => setShops(p => p.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  const rmShop = (i: number) => setShops(p => p.filter((_, idx) => idx !== i))
  const addTier = () => setTiers(p => [...p, { from: '', pct: '' }])
  const setTier = (i: number, patch: Partial<{ from: string; pct: string }>) => setTiers(p => p.map((t, idx) => idx === i ? { ...t, ...patch } : t))
  const rmTier = (i: number) => setTiers(p => p.filter((_, idx) => idx !== i))

  // Deal-Modell: Preset setzt nur die Schalter (deal_type/deal_base), der Rechner bleibt generisch.
  const applyDealModel = (id: string) => {
    const m = DEAL_MODELS.find(x => x.id === id)
    const patch: Partial<BookingContractInput> = { deal_model: id }
    if (m?.type) patch.deal_type = m.type
    if (m?.base) patch.deal_base = m.base
    set(patch)
  }
  // Parteien
  const setParty = (i: number, patch: Partial<Party>) => setParties(p => p.map((x, idx) => idx === i ? { ...x, ...patch } : x))
  const rmParty = (i: number) => setParties(p => p.filter((_, idx) => idx !== i))

  // Master-Partner (Stammdaten) der verknüpften Parteien laden – für den Abgleich.
  useEffect(() => {
    const ids = Array.from(new Set(parties.map(p => p.partner_id).filter((x): x is number => !!x)))
    const missing = ids.filter(id => !(id in masters))
    if (!missing.length) return
    let alive = true
    Promise.all(missing.map(id => getPartner(String(id)).then(m => [id, m] as const).catch(() => null)))
      .then(res => { if (!alive) return; const add: Record<number, Partner> = {}; for (const r of res) if (r) add[r[0]] = r[1]; if (Object.keys(add).length) setMasters(prev => ({ ...prev, ...add })) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parties])

  // Feld-Zuordnung Vertragspartei ↔ Partner-Stammsatz; liefert die abweichenden Felder.
  const PARTY_FIELD_MAP: [keyof Party, keyof Partner, string][] = [
    ['name', 'companyName', 'Name / Firma'], ['street', 'street', 'Straße'], ['postalCode', 'postalCode', 'PLZ'],
    ['city', 'city', 'Ort'], ['country', 'country', 'Land'], ['email', 'email', 'E-Mail'], ['taxid', 'taxId', 'USt-IdNr./St-Nr.'],
  ]
  const partyDiffs = (p: Party) => {
    const m = p.partner_id ? masters[p.partner_id] : undefined
    if (!m) return []
    return PARTY_FIELD_MAP
      .map(([pk, mk, label]) => ({ label, master: String(m[mk] ?? '').trim(), contract: String(p[pk] ?? '').trim() }))
      .filter(d => d.master !== d.contract)
  }
  const pullFromMaster = (i: number) => {
    const p = parties[i]; const m = p.partner_id ? masters[p.partner_id] : undefined; if (!m) return
    setParty(i, { name: m.companyName, street: m.street, postalCode: m.postalCode, city: m.city, country: m.country, email: m.email, taxid: m.taxId })
    setCmpOpen(null)
  }
  const pushToMaster = async (i: number) => {
    const p = parties[i]; const id = p.partner_id; const m = id ? masters[id] : undefined; if (!id || !m) return
    if (!confirm(`Änderungen von „${p.name || 'dieser Partei'}" in die Partner-Stammdaten speichern?\n\nGilt dann für ALLE Events/Verträge, die diesen Partner nutzen.`)) return
    const updated: PartnerFormData = {
      type: m.type, companyName: p.name, street: p.street, postalCode: p.postalCode, city: p.city,
      state: m.state, country: p.country, contactPerson: m.contactPerson, email: p.email, phone: m.phone,
      taxId: p.taxid, billingAddress: m.billingAddress, notes: m.notes,
    }
    try { await updatePartner(String(id), updated); setMasters(prev => ({ ...prev, [id]: { ...m, ...updated } })); setCmpOpen(null) }
    catch { alert('Speichern in Stammdaten fehlgeschlagen.') }
  }
  const reorderParties = (from: number, to: number) => setParties(p => { const n = [...p]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n })
  // Partei aus gewähltem Partner hinzufügen (Snapshot aus Stammdaten – strukturiert, kein Freitext)
  const onPickPartner = (p: Partner) => {
    setShowPicker(false)
    setParties(prev => {
      if (prev.some(x => x.partner_id === Number(p.id))) return prev
      return [...prev, { role: p.type || roleOptions[0] || '', name: p.companyName || '', street: p.street || '', postalCode: p.postalCode || '', city: p.city || '', country: p.country || '', email: p.email || '', taxid: p.taxId || '', partner_id: Number(p.id) }]
    })
  }
  // Einen verknüpften Event-Partner als Partei übernehmen (Adresse strukturiert aus Stammsatz).
  const addEventPartner = async (link: TerminPartner) => {
    if (parties.some(x => x.partner_id === link.partner_id)) return
    const party: Party = { role: link.role || link.partner_type || roleOptions[0] || '', name: link.company_name || '', street: '', postalCode: '', city: link.city || '', country: '', email: link.email || '', taxid: '', partner_id: link.partner_id }
    try { const m = await getPartner(String(link.partner_id)); party.street = m.street || ''; party.postalCode = m.postalCode || ''; party.city = m.city || party.city; party.country = m.country || ''; party.email = m.email || party.email; party.taxid = m.taxId || '' } catch { /* */ }
    setParties(prev => prev.some(x => x.partner_id === link.partner_id) ? prev : [...prev, party])
  }
  // Das Event-Venue als Partei übernehmen.
  const addEventVenue = async () => {
    if (!termin.venueId || parties.some(x => x.role === 'venue')) return
    try {
      const v = await getVenue(String(termin.venueId))
      setParties(prev => prev.some(x => x.role === VENUE_ROLE) ? prev
        : [...prev, { role: VENUE_ROLE, name: v.name || termin.venueName || '', street: v.street || '', postalCode: v.postalCode || '', city: v.city || '', country: v.country || '', email: '', taxid: '' }])
    } catch { /* */ }
  }
  const onEventSelect = (value: string) => {
    if (value === '__venue') { addEventVenue(); return }
    const link = eventPartners.find(l => String(l.id) === value)
    if (link) addEventPartner(link)
  }

  // USt je Satz aufschlüsseln (7 % / 19 % getrennt) – Künstleranteil + Nebenkosten nach Satz gruppiert.
  const vatBreakdown = (kind: 'deposit' | 'final') => {
    const groups: Record<string, { rate: number; base: number; amount: number }> = {}
    const add = (rate: number, base: number) => {
      if (base === 0) return
      const key = rate.toFixed(2)
      const g = groups[key] || { rate, base: 0, amount: 0 }
      g.base += base; g.amount += base * rate / 100; groups[key] = g
    }
    if (kind === 'deposit') add(nnum(f.artist_vat), nnum(f.deposit))
    else { add(nnum(f.artist_vat), st.artistShareNet); for (const c of costs) add(nnum(c.vat), nnum(c.net)) }
    return Object.values(groups).sort((a, b) => a.rate - b.rate)
  }
  // Einzelpositionen (je Position Netto + USt-Satz) – §14 Abs. 4 UStG.
  const invPositions = (kind: 'deposit' | 'final') => {
    if (kind === 'deposit') return [{ label: 'Anzahlung / Vorauszahlung gemäß Vereinbarung', net: nnum(f.deposit), rate: nnum(f.artist_vat) }]
    const rows = [{ label: 'Gage / Beteiligung (Künstleranteil)', net: st.artistShareNet, rate: nnum(f.artist_vat) }]
    for (const c of costs) if (nnum(c.net) !== 0) rows.push({ label: c.label || 'Nebenkosten', net: nnum(c.net), rate: nnum(c.vat) })
    return rows
  }
  const createInv = async (kind: 'deposit' | 'final') => {
    setInvBusy(true)
    try {
      await saveEverything()
      if (kind === 'deposit') {
        const net = nnum(f.deposit); const vat = net * nnum(f.artist_vat) / 100
        await createBookingInvoice({ contractId: booking.id, kind, total_net: net, tax_amount: vat, gross_amount: net + vat, deposit_net: net, vat_breakdown: vatBreakdown(kind), positions: invPositions(kind), description: 'Anzahlung / Vorauszahlung gemäß Vereinbarung' })
      } else {
        const deductions = st.rechnungGross - st.payableGross
        await createBookingInvoice({ contractId: booking.id, kind, total_net: st.rechnungNet, tax_amount: st.rechnungVat, gross_amount: st.rechnungGross, deductions_gross: deductions, deposit_net: nnum(f.deposit), vat_breakdown: vatBreakdown(kind), positions: invPositions(kind), description: 'Honorar / Abrechnung gemäß Vereinbarung' })
      }
      loadInvoices(); onChanged()
    } catch { /* ignore */ }
    setInvBusy(false)
  }
  // Rechnungs-Vorschau (Entwurf, Wasserzeichen) aus denselben Werten wie das echte Erstellen –
  // nur ohne zu speichern/Nummer zu vergeben, damit man sie vorher sehen kann.
  const previewInv = async (kind: 'deposit' | 'final') => {
    setInvBusy(true)
    try {
      await saveEverything()
      if (kind === 'deposit') {
        const net = nnum(f.deposit); const vat = net * nnum(f.artist_vat) / 100
        await previewBookingInvoice({ contractId: booking.id, kind, total_net: net, tax_amount: vat, gross_amount: net + vat, deposit_net: net, vat_breakdown: vatBreakdown(kind), positions: invPositions(kind), description: 'Anzahlung / Vorauszahlung gemäß Vereinbarung' })
      } else {
        const deductions = st.rechnungGross - st.payableGross
        await previewBookingInvoice({ contractId: booking.id, kind, total_net: st.rechnungNet, tax_amount: st.rechnungVat, gross_amount: st.rechnungGross, deductions_gross: deductions, deposit_net: nnum(f.deposit), vat_breakdown: vatBreakdown(kind), positions: invPositions(kind), description: 'Honorar / Abrechnung gemäß Vereinbarung' })
      }
    } catch { /* ignore */ }
    setInvBusy(false)
  }
  // Konzertabrechnung (KA) nach FKP-Layout: Rohzahlen aus dem Rechenkern (st) + gruppierte Zeilen.
  const buildKA = (): SettlementKA => {
    const pctStr = (v: number) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %'
    // Ticketeinnahme: Kanäle nach Händler×Kategorie gruppieren, je Rabattstufe eine Unterzeile.
    const groups: SettlementKA['ticketGroups'] = []
    for (const ch of channels) {
      const vendor = (ch.vendor || '').trim(), category = (ch.category || '').trim()
      const price = nnum(ch.price), tickets = nnum(ch.tickets)
      const einn = (ch.price ?? '') !== '' ? tickets * price : nnum(ch.revenue)
      let g = groups.find(x => x.vendor === vendor && x.category === category)
      if (!g) { g = { vendor, category, price, tickets: 0, einnahme: 0, boxoffice: false, subs: [] }; groups.push(g) }
      g.tickets += tickets; g.einnahme += einn
      if (ch.art === 'boxoffice') g.boxoffice = true
      if (!g.price) g.price = price
      g.subs.push({ label: (ch.rabattstufe || '').trim(), price, tickets, einnahme: einn })
    }
    // Refundierung: je Kategorie (ohne Abendkasse). Effektive Gebühr/Ticket wie in computeSettlement:
    // Kanal-Override (chan_fee) > Händler-Gebühr (shopFees) > globale Standard-Gebühr; Abendkasse = 0.
    const globalFee = nnum(f.fee_per_ticket)
    const byCat: Record<string, { tickets: number; betrag: number }> = {}
    for (const ch of channels) {
      if (ch.art === 'boxoffice') continue
      const sf = shopFees[(ch.vendor || '').trim()]
      const fee = (ch.chan_fee ?? '') !== '' ? nnum(ch.chan_fee)
        : (sf != null && String(sf).trim() !== '' ? nnum(sf) : globalFee)
      if (fee <= 0) continue
      const cat = (ch.category || '').trim() || '—'
      const t = nnum(ch.tickets)
      const e = byCat[cat] || { tickets: 0, betrag: 0 }
      e.tickets += t; e.betrag += t * fee
      byCat[cat] = e
    }
    const refundRows: SettlementKA['refundRows'] = Object.entries(byCat).map(
      ([cat, v]) => ({ category: cat, fee: v.tickets ? v.betrag / v.tickets : 0, tickets: v.tickets, betrag: v.betrag })
    )
    // Deal / Veranstaltungsabrechnung.
    const base = f.deal_base === 'netprofit' ? 'netprofit' : 'gross'
    const guar = nnum(f.guarantee)
    const T = tiers.map(t => ({ from: nnum(t.from), pct: nnum(t.pct) })).sort((a, b) => a.from - b.from)
    const baseAmt = st.dealBaseAmt
    const tierAmt = T.map((t, i) => { const lower = t.from, upper = i + 1 < T.length ? T[i + 1].from : Infinity; return baseAmt > lower ? (Math.min(baseAmt, upper) - lower) * t.pct / 100 : 0 })
    const rawShare = tierAmt.reduce((a, b) => a + b, 0)
    const guaranteeWon = guar >= rawShare
    const applied = st.dealShareNet
    const t1pct = T[0]?.pct ?? 0
    let dealLabel = '', dealDescription = ''
    const dealLines: SettlementKA['dealLines'] = []
    if (base === 'netprofit') {
      dealLabel = 'AM - vs. % of net Deal'
      dealDescription = 'Beteiligung am Nettogewinn & Übernahme der Kosten, wenn dieser die Produktionskostengarantie übersteigt'
      dealLines.push({ label: `Kosten ${f.partner_name || 'Veranstalter'}`, valueStr: eur(nnum(f.promoter_costs), cur) })
      dealLines.push({ label: 'Nettogewinn', valueStr: eur(baseAmt, cur) })
      dealLines.push({ label: `Produktionskostengarantie lt. Vereinbarung ${eur(guar, cur)} gegen ${pctStr(t1pct)} von ${eur(baseAmt, cur)}`, valueStr: eur(applied, cur) })
    } else {
      dealLabel = `AM - vs. % of gross${T.length > 1 ? ' / 2nd threshold' : ''} Deal`
      dealDescription = 'Beteiligung an den Nettoeinnahmen, wenn diese die Produktionskostengarantie übersteigt'
      const line1Val = T.length > 1 ? (guaranteeWon ? guar : tierAmt[0]) : applied
      dealLines.push({ label: `Produktionskostengarantie lt. Vereinbarung ${eur(guar, cur)} gegen ${pctStr(t1pct)} ab der ersten Karte`, valueStr: eur(line1Val, cur) })
      if (T.length > 1) dealLines.push({ label: `und ${pctStr(T[1].pct)} ab einer Nettoeinnahme von ${eur(T[1].from, cur)}`, valueStr: eur(guaranteeWon ? 0 : (tierAmt[1] || 0), cur) })
    }
    const anteilVatPct = nnum(f.artist_vat)
    const anteilVatAmt = st.artistShareNet * anteilVatPct / 100
    const deductions: SettlementKA['deductions'] = []
    if (st.ticketingPayout > 0) deductions.push({ label: `abzgl. Ticketing Payout (inkl. MwSt. ${pctStr(nnum(f.ticket_vat))})`, amount: st.ticketingPayout })
    if (st.ownShopGross > 0) deductions.push({ label: 'abzgl. Eigener Shop (bei Band)', amount: st.ownShopGross })
    if (st.depositGross > 0) deductions.push({ label: 'abzgl. Anzahlung', amount: st.depositGross })
    return {
      currency: cur,
      ticketGroups: groups, totalTickets: st.totalTickets,
      ticketGross: st.ticketGross, ticketVatPct: nnum(f.ticket_vat), ticketVatAmt: st.ticketVatAmt, ticketNet: st.ticketNet,
      refundRows, feeGross: st.feeTotalGross, feeVatPct: nnum(f.fee_vat), feeVatAmt: st.feeVatAmt, feeNet: st.feeNet,
      dealLabel, dealDescription, dealLines,
      anteilTicketNet: st.dealShareNet, bandSplitPct: nnum(f.fee_band_split_pct), anteilRefundNet: st.bandFeeShareNet,
      anteilNet: st.artistShareNet, anteilVatPct, anteilVatAmt, anteilGross: st.artistShareNet + anteilVatAmt,
      costRows: costs.map(c => ({ label: c.label || 'Position', vatPct: nnum(c.vat), net: nnum(c.net) })),
      costsNet: st.costsNet, costsVatAmt: st.costsVat, costsGross: st.costsNet + st.costsVat,
      rechnungNet: st.rechnungNet, rechnungVatAmt: st.rechnungVat, rechnungGross: st.rechnungGross,
      deductions, payableGross: st.payableGross,
    }
  }
  const onSettlementPdf = async () => {
    setPdfBusy(true)
    try { await saveEverything(); await openBookingSettlementPdf(booking.id, buildKA()) } catch { /* ignore */ }
    setPdfBusy(false)
  }
  const invGross = (iv: BookingInvoice) => nnum(iv.gross_amount) - nnum(iv.deductions_gross)

  const In = (label: string, key: keyof BookingContractInput, ph = '', help?: string, kind: 'money' | 'int' | 'raw' = 'money') => (
    <div><label className="form-label inline-flex items-center gap-1">{label}{help && <HelpTip text={help} />}</label>
      <NumInput kind={kind} disabled={!isAdmin} value={(f[key] as string) ?? ''} onChange={v => set({ [key]: v } as Partial<BookingContractInput>)} placeholder={ph} /></div>
  )
  const Row = ({ k, v, bold, muted, big, sub }: { k: string; v: string; bold?: boolean; muted?: boolean; big?: boolean; sub?: boolean }) => (
    <div className={`flex justify-between ${sub ? 'pl-3' : ''}`} style={{ padding: '2px 0' }}>
      <span style={{ color: muted ? 'var(--text-muted)' : 'var(--text)' }}>{k}</span>
      <span style={{ color: muted ? 'var(--text-muted)' : 'var(--text)', fontWeight: bold ? 700 : big ? 600 : 400, fontSize: big ? '1.05em' : undefined }}>{v}</span>
    </div>
  )

  return (
    <div className="space-y-5">
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

      {/* ── Bereich 1: Vertrag (alle Angaben für den Vertrag; endet mit dem Vertrag-PDF-Button) ── */}
      <div className="flex items-center gap-3 pt-1">
        <span className="inline-flex items-center justify-center rounded-full text-xs font-bold" style={{ width: 24, height: 24, background: 'var(--primary)', color: '#fff' }}>1</span>
        <div>
          <div className="text-base font-bold leading-tight" style={{ color: 'var(--text)' }}>Vertrag</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Alle Angaben für den Vertrag – unten erzeugt der Button das Vertrags-PDF.</div>
        </div>
      </div>

      {/* Parteien */}
      <fieldset className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
        <legend className="text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }}>PARTEIEN</legend>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <HelpTip text="Parteienkette, z. B.: Artist → Vertretung → Veranstalter → Venue. Name und Adresse sind aus den Stammdaten vorbelegt." />
          {isAdmin && (
            <div className="flex gap-2 items-center ml-auto">
              <select className="detail-input" style={{ width: 'auto', minWidth: 190 }} value="" onChange={e => { if (e.target.value) onEventSelect(e.target.value) }}>
                <option value="">+ Aus Event übernehmen…</option>
                {eventPartners.filter(l => !parties.some(x => x.partner_id === l.partner_id)).map(l => (
                  <option key={l.id} value={String(l.id)}>{[l.company_name, l.role || l.partner_type].filter(Boolean).join(' — ')}</option>
                ))}
                {termin.venueId && !parties.some(x => x.role === 'venue') && <option value="__venue">Venue: {termin.venueName || 'Venue'}</option>}
              </select>
              <button onClick={() => setShowPicker(true)} className="btn btn-ghost whitespace-nowrap" style={{ padding: '4px 10px' }}><PlusIcon className="w-4 h-4" />Partner wählen</button>
            </div>
          )}
        </div>
        {parties.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Noch keine Parteien. Über „Aus Event übernehmen" einen verknüpften Partner/das Venue wählen, oder „Partner wählen" aus den Stammdaten.</p>
        ) : (
          <SortableList
            items={parties}
            disabled={!isAdmin}
            getKey={(_, i) => i}
            onReorder={reorderParties}
            renderItem={(p, i) => (
              <AccordionSection
                title={p.name || 'Partei'}
                bodyClassName="p-3"
                titleContent={<TitleWithRole name={p.name || '— ohne Namen —'} role={roleLabel(p.role)} />}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div><label className="detail-label">Rolle</label>
                    <select className="detail-input" disabled={!isAdmin} value={p.role} onChange={e => setParty(i, { role: e.target.value })}>
                      {Array.from(new Set([...roleOptions, VENUE_ROLE, p.role].filter(Boolean))).map(r => <option key={r} value={r}>{r}</option>)}
                    </select></div>
                  <div><label className="detail-label">Name / Firma</label><input className="detail-input" disabled={!isAdmin} value={p.name} onChange={e => setParty(i, { name: e.target.value })} /></div>
                  <div><label className="detail-label">Straße</label><input className="detail-input" disabled={!isAdmin} value={p.street} onChange={e => setParty(i, { street: e.target.value })} /></div>
                  <div><label className="detail-label">PLZ</label><input className="detail-input" disabled={!isAdmin} value={p.postalCode} onChange={e => setParty(i, { postalCode: e.target.value })} /></div>
                  <div><label className="detail-label">Ort</label><input className="detail-input" disabled={!isAdmin} value={p.city} onChange={e => setParty(i, { city: e.target.value })} /></div>
                  <div><label className="detail-label">Land</label><input className="detail-input" disabled={!isAdmin} value={p.country} onChange={e => setParty(i, { country: e.target.value })} /></div>
                  <div><label className="detail-label">E-Mail</label><input className="detail-input" disabled={!isAdmin} value={p.email} onChange={e => setParty(i, { email: e.target.value })} /></div>
                  <div><label className="detail-label">USt-IdNr./St-Nr.</label><input className="detail-input" disabled={!isAdmin} value={p.taxid} onChange={e => setParty(i, { taxid: e.target.value })} /></div>
                  {p.partner_id && masters[p.partner_id] && (() => {
                    const diffs = partyDiffs(p)
                    if (!diffs.length) return <div className="sm:col-span-2 lg:col-span-3 text-[11px]" style={{ color: 'var(--text-subtle)' }}>Aus Partner-Stammdaten übernommen – stimmt mit dem Stammsatz überein.</div>
                    return (
                      <div className="sm:col-span-2 lg:col-span-3 rounded-md p-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--accent)' }}>
                        <button type="button" onClick={() => setCmpOpen(cmpOpen === i ? null : i)} className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--accent)' }}>⇄ Weicht vom Stammdatensatz ab ({diffs.length}) {cmpOpen === i ? '▴' : '▾'}</button>
                        {cmpOpen === i && (
                          <div className="mt-2">
                            <div className="grid gap-1 text-[11px]" style={{ gridTemplateColumns: '90px 1fr 1fr' }}>
                              <span style={{ color: 'var(--text-subtle)' }}>Feld</span><span style={{ color: 'var(--text-subtle)' }}>Stammdaten</span><span style={{ color: 'var(--text-subtle)' }}>Vertrag</span>
                              {diffs.map(d => (
                                <div key={d.label} className="contents">
                                  <span style={{ color: 'var(--text-muted)' }}>{d.label}</span>
                                  <span style={{ color: 'var(--text)' }}>{d.master || '—'}</span>
                                  <span style={{ color: 'var(--text)' }}>{d.contract || '—'}</span>
                                </div>
                              ))}
                            </div>
                            {isAdmin && (
                              <div className="flex gap-2 mt-2 flex-wrap">
                                <button type="button" onClick={() => pullFromMaster(i)} className="btn btn-ghost" style={{ padding: '3px 10px' }}>← Stammdaten übernehmen</button>
                                <button type="button" onClick={() => pushToMaster(i)} className="btn btn-ghost" style={{ padding: '3px 10px' }}>→ In Stammdaten speichern</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  {isAdmin && <div className="sm:col-span-2 lg:col-span-3 flex justify-end"><button onClick={() => rmParty(i)} className="btn btn-ghost text-red-600 hover:bg-red-50" style={{ padding: '4px 10px' }}><TrashIcon className="w-4 h-4" />Entfernen</button></div>}
                </div>
              </AccordionSection>
            )}
          />
        )}
      </fieldset>

      {/* Veranstaltung (variable Details für § 1 / § 5) */}
      <fieldset className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
        <legend className="text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }}>VERANSTALTUNG</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="form-label">Kapazität</label>
            <NumInput kind="int" disabled={!isAdmin} value={(f.capacity as string) ?? ''} onChange={v => set({ capacity: v })} placeholder="z.B. 2200" />
            {termin.venueId ? <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>Wird im Venue-Datensatz gespeichert</p> : null}
          </div>
          <div><label className="form-label">Einlass</label><input type="time" className="form-input" disabled={!isAdmin} value={f.doors_time ?? ''} onChange={e => set({ doors_time: e.target.value })} /></div>
          <div><label className="form-label">Beginn</label><input type="time" className="form-input" disabled={!isAdmin} value={f.show_time ?? ''} onChange={e => set({ show_time: e.target.value })} /></div>
        </div>
        <div className="mt-3"><label className="form-label">Support Act(s)</label><input className="form-input" disabled={!isAdmin} value={f.support_acts ?? ''} onChange={e => set({ support_acts: e.target.value })} placeholder="z.B. Rogers" /></div>
      </fieldset>

      {/* Deal */}
      <fieldset className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
        <legend className="text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }}>DEAL / KONDITIONEN</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div><label className="form-label inline-flex items-center gap-1">Deal-Modell
            <HelpTip text="Baukasten aus wenigen Schaltern. Fixgage = feste Gage. Nur Beteiligung = Prozent vom Umsatz (ggf. mit Stufen). „gegen“ (vs.) = der höhere Wert aus Fixgage und Beteiligung gilt. „plus“ = beides wird addiert. „ab Break-Even“ = die Beteiligung greift erst auf den Umsatz oberhalb der fixen Break-Even-Summe des Veranstalters. „Benutzerdefiniert“ blendet alle Schalter einzeln ein." /></label>
            <select className="form-select" disabled={!isAdmin} value={dmId} onChange={e => applyDealModel(e.target.value)}>
              {DEAL_MODELS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              <option value="custom">Benutzerdefiniert</option>
            </select></div>
          {showFix && In('Fixgage / Garantie (netto)', 'guarantee', '0')}
          <div><label className="form-label">Währung</label><input className="form-input" disabled={!isAdmin} value={f.currency ?? 'EUR'} onChange={e => set({ currency: e.target.value })} /></div>
        </div>

        {/* Beteiligung (nur wenn das Modell eine Beteiligung hat) */}
        {showPart && (
          <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {isCustomDeal && (
                <div><label className="form-label inline-flex items-center gap-1">Verhältnis
                  <HelpTip text="„gegen“ (vs.): der höhere Wert aus Fixgage und Beteiligung gilt – entweder/oder. „plus“: Fixgage und Beteiligung werden addiert." /></label>
                  <select className="form-select" disabled={!isAdmin} value={f.deal_type === 'plus' ? 'plus' : 'vs'} onChange={e => set({ deal_type: e.target.value })}>
                    <option value="vs">gegen Fixgage – das Höhere</option>
                    <option value="plus">plus Fixgage – addiert</option>
                  </select></div>
              )}
              <div><label className="form-label inline-flex items-center gap-1">Beteiligungs-Basis
                <HelpTip text="Worauf die Prozente gerechnet werden. „Netto-Ticketumsatz“: vom gesamten Netto-Umsatz. „Nettogewinn ab Break-Even“: nur vom Umsatz oberhalb der fixen Break-Even-Summe des Veranstalters." /></label>
                <select className="form-select" disabled={!isAdmin} value={f.deal_base ?? 'gross'} onChange={e => set({ deal_base: e.target.value })}>
                  {DEAL_BASE.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select></div>
              {f.deal_base === 'netprofit' && In('Break-Even Veranstalter (netto)', 'promoter_costs', '0', 'Die fixe Break-Even-Summe des Veranstalters (eine Zahl, keine Positionsliste). Erst oberhalb dieses Betrags greift die Beteiligung.')}
              <div><label className="form-label inline-flex items-center gap-1">Stufen-Basis
                <HelpTip text="Woran die Stufen-Schwellen hängen: am Netto-Umsatz (€) oder an der verkauften Ticketzahl (Stück). Der Prozentsatz gilt jeweils für den Bereich oberhalb der Schwelle." /></label>
                <select className="form-select" disabled={!isAdmin} value={f.tier_basis ?? 'revenue'} onChange={e => set({ tier_basis: e.target.value })}>
                  {TIER_BASIS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select></div>
            </div>

            {/* Stufen (beliebig viele, progressiv) */}
            <div className="flex items-center justify-between mt-3 mb-1">
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Beteiligung / Stufen</span>
              {isAdmin && <button onClick={addTier} className="btn btn-ghost" style={{ padding: '4px 10px' }}><PlusIcon className="w-4 h-4" />Stufe</button>}
            </div>
            <div className="space-y-1.5">
              {tiers.map((t, i) => (
                <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: 'minmax(0,1fr) 120px 28px' }}>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {i === 0
                      ? 'ab Beginn'
                      : <span className="flex items-center gap-1">ab {tierOnTickets ? 'Ticket' : 'Netto-Umsatz'} <NumInput kind={tierOnTickets ? 'int' : 'money'} align="right" disabled={!isAdmin} style={{ width: 120 }} value={t.from} onChange={v => setTier(i, { from: v })} placeholder={tierOnTickets ? 'z.B. 1000' : 'z.B. 44859,81'} /> {tierOnTickets ? 'Stück' : '€'}</span>}
                  </div>
                  <div className="flex items-center gap-1"><input className="form-input text-right" inputMode="decimal" disabled={!isAdmin} value={t.pct} onChange={e => setTier(i, { pct: e.target.value })} placeholder="%" /> <span className="text-sm" style={{ color: 'var(--text-muted)' }}>%</span></div>
                  {isAdmin && i > 0 ? <button onClick={() => rmTier(i)} className="p-1 text-gray-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button> : <span />}
                </div>
              ))}
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Progressiv: jede Stufe gilt nur für den Bereich oberhalb ihrer Schwelle (wie Steuerstufen){tierOnTickets ? ' – Schwellen in Ticketzahl' : ''}. {f.deal_type === 'plus' ? 'Fixgage und Beteiligung werden addiert.' : 'Es gilt der höhere Wert aus Fixgage und Beteiligung („vs.").'}</p>
          </div>
        )}

        {/* Zahlungen */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          {In('Anzahlung (netto)', 'deposit')}
          <div><label className="form-label">Anzahlung fällig bis</label><input type="date" className="form-input" disabled={!isAdmin} value={f.deposit_due ?? ''} onChange={e => set({ deposit_due: e.target.value })} /></div>
          <div><label className="form-label">Restzahlung fällig bis</label><input type="date" className="form-input" disabled={!isAdmin} value={f.balance_due ?? ''} onChange={e => set({ balance_due: e.target.value })} /></div>
        </div>
        <div className="mt-3"><label className="form-label">Bankverbindung (Artist)</label><textarea className="form-input" rows={2} disabled={!isAdmin} value={f.bank_details ?? ''} onChange={e => set({ bank_details: e.target.value })} placeholder="Kontoinhaber, IBAN, BIC" /></div>
      </fieldset>

      {/* Eintrittspreise / Vorverkauf (§ 5.1) – Szenario je Preiskategorie (wie FKP) */}
      <fieldset className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
        <legend className="text-xs font-semibold px-1 inline-flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>EINTRITTSPREISE / VORVERKAUF (§ 5.1)
          <HelpTip text="Vereinbartes Vorverkaufs-Szenario (vor der Show), je Preiskategorie. Kapazität = zum Verkauf gestelltes Kontingent dieser Kategorie (kann kleiner sein als die Hallen-Kapazität oben). Holds = gesperrte Tickets, Comps = Freikarten, Kills = aus dem Verkauf genommene Plätze. Verkaufbar = Kapazität − Holds − Comps − Kills; Einnahme = Verkaufbar × VVK-Grundpreis. Diese Kategorien stehen in der Abrechnung je Vertriebskanal zur Auswahl und bilden die Preisstruktur im Vertrag." />
        </legend>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Preiskategorien / Vorverkauf-Szenario</span>
          {isAdmin && <button onClick={addCat} className="btn btn-ghost inline-flex items-center gap-1 text-sm"><PlusIcon className="w-4 h-4" />Kategorie</button>}
        </div>
        {cats.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Noch keine Preiskategorie. Mit „Kategorie" die Preisklassen der Show anlegen (z.B. Cat. 01, VIP, Steh-/Sitzplatz) – je mit Kontingent und Preis.</p>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 720 }}>
              <div className="grid gap-1.5 text-[11px] px-1 mb-1" style={{ gridTemplateColumns: 'minmax(96px,1.1fr) 72px 56px 56px 56px 72px 84px 84px 96px 26px', color: 'var(--text-muted)' }}>
                <span>Kategorie</span><span className="text-right">Kapazität</span><span className="text-right">Holds</span><span className="text-right">Comps</span><span className="text-right">Kills</span><span className="text-right">Verkaufbar</span><span className="text-right">Grundpreis</span><span className="text-right">AK-Preis</span><span className="text-right">Einnahme</span><span />
              </div>
              {cats.map((c, i) => (
                <div key={i} className="grid gap-1.5 items-center mb-1" style={{ gridTemplateColumns: 'minmax(96px,1.1fr) 72px 56px 56px 56px 72px 84px 84px 96px 26px' }}>
                  <input className="form-input" disabled={!isAdmin} placeholder="z.B. Cat. 01" value={c.name} onChange={e => setCat(i, { name: e.target.value })} />
                  <NumInput kind="int" align="right" disabled={!isAdmin} placeholder="0" value={c.cap} onChange={v => setCat(i, { cap: v })} />
                  <NumInput kind="int" align="right" disabled={!isAdmin} placeholder="0" value={c.holds} onChange={v => setCat(i, { holds: v })} title="Holds = zurückgehaltene Tickets (Produktion, VIP, Sponsoren …)" />
                  <NumInput kind="int" align="right" disabled={!isAdmin} placeholder="0" value={c.comps} onChange={v => setCat(i, { comps: v })} title="Comps = Freikarten (Gästeliste, Presse, Crew …)" />
                  <NumInput kind="int" align="right" disabled={!isAdmin} placeholder="0" value={c.kills} onChange={v => setCat(i, { kills: v })} title="Kills = dauerhaft gesperrte Plätze (Sicht, Bühne, Notausgänge …)" />
                  <input className="form-input text-right" readOnly value={intDE(catVerk(c))} style={{ background: 'var(--hover)', color: 'var(--text-muted)' }} title="Kapazität − Holds − Comps − Kills" />
                  <NumInput kind="money" align="right" disabled={!isAdmin} placeholder="€" value={c.price} onChange={v => setCat(i, { price: v })} title="VVK-Grundpreis (Face Value) dieser Kategorie" />
                  <NumInput kind="money" align="right" disabled={!isAdmin} placeholder="€" value={c.akprice} onChange={v => setCat(i, { akprice: v })} title="Abendkasse-Preis dieser Kategorie (optional)" />
                  <input className="form-input text-right" readOnly value={amtDE(catEinnahme(c))} style={{ background: 'var(--hover)', color: 'var(--text-muted)' }} title="Verkaufbar × Grundpreis" />
                  {isAdmin ? <button onClick={() => rmCat(i)} className="p-1 text-gray-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button> : <span />}
                </div>
              ))}
              {/* Gesamt-Zeile */}
              <div className="grid gap-1.5 items-center px-1 pt-1 border-t text-sm font-semibold" style={{ gridTemplateColumns: 'minmax(96px,1.1fr) 72px 56px 56px 56px 72px 84px 84px 96px 26px', borderColor: 'var(--border)', color: 'var(--text)' }}>
                <span>Gesamt</span>
                <span className="text-right">{intDE(cats.reduce((a, c) => a + nnum(c.cap), 0))}</span>
                <span className="text-right">{intDE(cats.reduce((a, c) => a + nnum(c.holds), 0))}</span>
                <span className="text-right">{intDE(cats.reduce((a, c) => a + nnum(c.comps), 0))}</span>
                <span className="text-right">{intDE(cats.reduce((a, c) => a + nnum(c.kills), 0))}</span>
                <span className="text-right">{intDE(cats.reduce((a, c) => a + catVerk(c), 0))}</span>
                <span /><span />
                <span className="text-right">{amtDE(cats.reduce((a, c) => a + catEinnahme(c), 0))} €</span>
                <span />
              </div>
            </div>
          </div>
        )}

      </fieldset>

      {/* Vertriebskanäle, Refundierung & Buyouts (Vertrag · § 4) – Definitionen, die VOR dem Vertrag
          stehen, weil sie in ihn eingehen. Jeder Händler/Shop mit eigener Refundierung (Gebühr/Ticket).
          Die konkreten Verkaufszahlen je Kanal kommen erst nach der Show in der Abrechnung. */}
      <fieldset className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
        <legend className="text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }}>VERTRIEBSKANÄLE · REFUNDIERUNG · BUYOUTS (§ 4)</legend>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium inline-flex items-center gap-1" style={{ color: 'var(--text)' }}>Vertriebskanäle / Shops – Refundierung je Händler
            <HelpTip text="Welche Ticketsysteme/Shops verkaufen und welche Refundierungs-Gebühr je Ticket der Veranstalter dafür erstattet. Je Händler eigene Gebühr; bleibt sie leer, gilt die Standard-Gebühr unten. In der Abrechnung erbt jeder Kanal die Gebühr seines Händlers (pro Zeile noch übersteuerbar). Diese Definition steht im Vertrag (§ 4 Refundierung, § 5.1 Preisstruktur)." /></span>
          {isAdmin && <button onClick={addShop} className="btn btn-ghost inline-flex items-center gap-1 text-sm"><PlusIcon className="w-4 h-4" />Händler</button>}
        </div>
        {shops.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Keine Vertriebskanäle. Mit „Händler" die verkaufenden Systeme anlegen (z.B. Eigener Shop, Eventim) – je mit Refundierungs-Gebühr.</p>
        ) : (
          <div className="space-y-1.5">
            <div className="grid gap-1.5 items-center text-[11px] font-medium" style={{ gridTemplateColumns: 'minmax(0,1fr) 150px 28px', color: 'var(--text-subtle)' }}>
              <span>Händler / Shop</span><span className="text-right">Refundierung €/Ticket</span><span />
            </div>
            {shops.map((s, i) => (
              <div key={i} className="grid gap-1.5 items-center" style={{ gridTemplateColumns: 'minmax(0,1fr) 150px 28px' }}>
                <input className="form-input" disabled={!isAdmin} placeholder="z.B. Eventim" value={s.name} onChange={e => setShop(i, { name: e.target.value })} />
                <input className="form-input text-right" inputMode="decimal" disabled={!isAdmin} placeholder={f.fee_per_ticket ? `${f.fee_per_ticket} (Std.)` : 'Standard'} value={s.fee} onChange={e => setShop(i, { fee: e.target.value })} title="Refundierungs-Gebühr je Ticket nur für diesen Händler · leer = Standard-Gebühr unten" />
                {isAdmin ? <button onClick={() => rmShop(i)} className="p-1 text-gray-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button> : <span />}
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          {In('Standard-Gebühr / Ticket', 'fee_per_ticket', 'z.B. 3,38')}
          {In('USt Gebühr %', 'fee_vat', '', undefined, 'raw')}
          {In('Band-Anteil Gebühr %', 'fee_band_split_pct', 'z.B. 50', undefined, 'raw')}
        </div>

        {/* Nebenkosten / Buyouts (§ 4) */}
        <div className="flex items-center justify-between mt-4 mb-1"><span className="text-sm font-medium inline-flex items-center gap-1" style={{ color: 'var(--text)' }}>Nebenkosten / Buyouts<HelpTip text="Vom Veranstalter zu erstattende Leistungen, die Artist/Agentur selbst stellt (z.B. Nightliner-Buyout). Erscheinen im Vertrag als Buyouts in § 4 und fließen in die Abrechnung (Rechnung an den Veranstalter) ein." /></span>{isAdmin && <button onClick={addCost} className="btn btn-ghost" style={{ padding: '4px 10px' }}><PlusIcon className="w-4 h-4" />Position</button>}</div>
        {costs.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Keine Buyouts. Mit „Position" vom Veranstalter zu erstattende Leistungen anlegen (z.B. Nightliner-Buyout).</p>
        ) : (
          <div className="space-y-1.5">
            {costs.map((c, i) => (
              <div key={i} className="grid gap-1.5 items-center" style={{ gridTemplateColumns: 'minmax(0,1fr) 110px 70px 28px' }}>
                <input className="form-input" disabled={!isAdmin} placeholder="z.B. Nightliner Buyout" value={c.label ?? ''} onChange={e => setCo(i, { label: e.target.value })} />
                <NumInput kind="money" align="right" disabled={!isAdmin} placeholder="netto €" value={c.net ?? ''} onChange={v => setCo(i, { net: v })} />
                <input className="form-input text-right" inputMode="decimal" disabled={!isAdmin} placeholder="USt %" value={c.vat ?? ''} onChange={e => setCo(i, { vat: e.target.value })} />
                {isAdmin ? <button onClick={() => rmCo(i)} className="p-1 text-gray-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button> : <span />}
              </div>
            ))}
          </div>
        )}
      </fieldset>

      {/* Vertrag */}
      <fieldset className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
        <legend className="text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }}>VERTRAG</legend>
        {clauses.filter(c => !c.archived_at).length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Noch keine Bausteine – unter Booking → Bausteine anlegen (oder „FKP-Standard laden").</p>
        ) : (
          <>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Häkchen = Baustein im Vertrag enthalten. Mit <strong>Bearbeiten</strong> passt du den Text nur für <strong>diesen Vertrag</strong> an (die Bibliothek bleibt unverändert). Ohne Anpassung gilt immer der aktuelle Stand aus <strong>Booking → Bausteine</strong>. Variable Deal-Werte werden automatisch eingesetzt.</p>
            <div className="space-y-0.5 border rounded-lg p-2" style={{ borderColor: 'var(--border)', maxHeight: 280, overflowY: 'auto' }}>
              {clauses.filter(c => !c.archived_at).map((c, i) => {
                const ov = clauseOv[c.id]
                const included = ov ? ov.included : true
                const override = ov?.body ?? ''
                const edited = !!override.trim()
                const isEditing = editingClause === c.id
                return (
                  <div key={c.id} className="px-1 py-0.5 text-sm" style={{ color: 'var(--text)' }}>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" disabled={!isAdmin} checked={included}
                        onChange={e => setClauseOv(p => ({ ...p, [c.id]: { included: e.target.checked, body: p[c.id]?.body ?? '' } }))} />
                      <span style={{ color: 'var(--text-subtle)', minWidth: 28 }}>§ {i + 1}</span>
                      <span style={{ opacity: included ? 1 : 0.45, textDecoration: included ? 'none' : 'line-through' }}>{c.title}</span>
                      {edited && <span className="text-xs" style={{ color: 'var(--accent)' }}>• angepasst</span>}
                      {isAdmin && included && (
                        <button type="button" onClick={() => setEditingClause(isEditing ? null : c.id)} className="btn btn-ghost ml-auto" style={{ padding: '2px 8px' }}>
                          {isEditing ? 'Fertig' : 'Bearbeiten'}
                        </button>
                      )}
                    </div>
                    {isEditing && (
                      <div className="mt-1 pl-6">
                        <textarea className="form-input" rows={6} disabled={!isAdmin}
                          value={override || (c.latest_body ?? '')}
                          onChange={e => setClauseOv(p => ({ ...p, [c.id]: { included: p[c.id]?.included ?? true, body: e.target.value } }))}
                          placeholder="Text dieses Bausteins für diesen Vertrag …" />
                        <div className="flex items-center gap-3 mt-1">
                          {edited && (
                            <button type="button" onClick={() => setClauseOv(p => ({ ...p, [c.id]: { included: p[c.id]?.included ?? true, body: '' } }))} className="text-xs" style={{ color: 'var(--danger)' }}>
                              Auf Bibliothekstext zurücksetzen
                            </button>
                          )}
                          <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Variable Werte (Deal, Preise …) werden im PDF ergänzt.</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
        <div className="mt-3">
          <label className="form-label">Individualvereinbarungen (haben Vorrang)</label>
          <textarea className="form-input" rows={3} disabled={!isAdmin} value={f.individual_terms ?? ''} onChange={e => set({ individual_terms: e.target.value })} placeholder="Abweichungen/Zusätze, die mit der Gegenpartei vereinbart wurden – z. B. handschriftliche Änderungen aus der Verhandlung." />
        </div>
        <button onClick={() => openBookingContractPdf(booking.id)} className="btn btn-ghost mt-3"><DocumentArrowDownIcon className="w-4 h-4" />Vertrag-PDF</button>
      </fieldset>

      {/* ── Bereich 2: Abrechnung (Zahlen nach der Show) ── */}
      <div className="flex items-center gap-3 pt-3">
        <span className="inline-flex items-center justify-center rounded-full text-xs font-bold" style={{ width: 24, height: 24, background: 'var(--primary)', color: '#fff' }}>2</span>
        <div>
          <div className="text-base font-bold leading-tight" style={{ color: 'var(--text)' }}>Abrechnung</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Zahlen nach der Show – Verkauf je Kanal, Verrechnungen, Ergebnis.</div>
        </div>
      </div>

      {/* Abrechnung */}
      <fieldset className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
        <legend className="text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }}>TICKETVERKAUF & ERGEBNIS</legend>

        <div className="flex items-center justify-between mb-1"><span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Ticketing – Vertriebskanäle</span>{isAdmin && <button onClick={addChannel} className="btn btn-ghost" style={{ padding: '4px 10px' }}><PlusIcon className="w-4 h-4" />Kanal</button>}</div>
        {channels.length === 0 ? <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>Kanäle hinzufügen (Eventim, Abendkasse, Eigener Shop …).</p> : (
          <div className="space-y-1.5 mb-2">
            <div className="grid gap-1.5 items-center text-[11px] font-medium" style={{ gridTemplateColumns: '2fr 1fr 80px 90px 50px 74px 92px 26px', color: 'var(--text-subtle)' }}>
              <span>Händler</span><span>Kategorie</span><span>Art</span><span>Geld bei</span><span className="text-right">Stk</span><span className="text-right">Preis €</span><span className="text-right">= Brutto €</span><span />
            </div>
            {channels.map((s, i) => {
              const hasPrice = (s.price ?? '') !== ''
              const boxoffice = (s.art ?? 'vvk') === 'boxoffice'
              // Auswahllisten aus den oben definierten Shops/Kategorien; ein evtl. vorhandener
              // (Alt-)Wert, der dort nicht (mehr) steht, bleibt als Option erhalten, damit nichts verloren geht.
              const shopNames = shops.map(sh => sh.name.trim()).filter((v, k, a) => v && a.indexOf(v) === k)
              const shopOpts = s.vendor && !shopNames.includes(s.vendor) ? [s.vendor, ...shopNames] : shopNames
              // Von diesem Händler geerbte Refundierung (Platzhalter, wenn chan_fee leer).
              const shopFee = (shops.find(sh => sh.name.trim() === (s.vendor || '').trim())?.fee || '').trim()
              const catNames = cats.map(c => c.name).filter((v, k, a) => v && a.indexOf(v) === k)
              const catOpts = s.category && !catNames.includes(s.category) ? [s.category, ...catNames] : catNames
              return (
              <div key={i} className="space-y-1">
                <div className="grid gap-1.5 items-center" style={{ gridTemplateColumns: '2fr 1fr 80px 90px 50px 74px 92px 26px' }}>
                  <select className="form-select" disabled={!isAdmin} value={s.vendor ?? ''} onChange={e => setCh(i, { vendor: e.target.value })} title="Ticketsystem / Shop – aus den oben definierten Shops">
                    <option value="">— Händler —</option>
                    {shopOpts.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <select className="form-select" disabled={!isAdmin} value={s.category ?? ''} title="Preiskategorie – aus den oben definierten Kategorien" onChange={e => {
                    const name = e.target.value
                    const m = cats.find(c => c.name && c.name === name)
                    const patch: Partial<BookingTicketSale> = { category: name }
                    // Preis aus der Kategorie vorbefüllen, wenn noch leer (VVK-Grundpreis, bzw. AK bei Abendkasse).
                    const catPrice = m ? ((s.art === 'boxoffice' && m.akprice) ? m.akprice : m.price) : ''
                    if (catPrice && !(s.price ?? '').trim()) { patch.price = catPrice; patch.revenue = (nnum(s.tickets) * nnum(catPrice)).toFixed(2) }
                    setCh(i, patch)
                  }}>
                    <option value="">— Kategorie —</option>
                    {catOpts.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <select className="form-select" disabled={!isAdmin} value={s.art ?? 'vvk'} onChange={e => setCh(i, { art: e.target.value })}>{ART.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
                  <select className="form-select" disabled={!isAdmin} value={s.money_with ?? 'promoter'} onChange={e => setCh(i, { money_with: e.target.value })} title="Geld liegt bei">{MONEY.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
                  <NumInput kind="int" align="right" disabled={!isAdmin} placeholder="Stk" value={s.tickets ?? ''} onChange={v => setCh(i, { tickets: v })} />
                  <NumInput kind="money" align="right" disabled={!isAdmin} placeholder="Preis" value={s.price ?? ''} onChange={v => setCh(i, { price: v })} title="Ticketpreis brutto je Stück" />
                  <NumInput kind="money" align="right" disabled={!isAdmin || hasPrice} readOnly={hasPrice} placeholder="Brutto €" value={s.revenue ?? ''} onChange={v => setCh(i, { revenue: v })} title={hasPrice ? 'Berechnet: Stück × Preis' : 'Gesamtbrutto des Kanals'} style={hasPrice ? { background: 'var(--hover)', color: 'var(--text-muted)' } : undefined} />
                  {isAdmin ? <button onClick={() => rmCh(i)} className="p-1 text-gray-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button> : <span />}
                </div>
                <div className="flex items-center gap-1.5 pl-1 text-[11px] flex-wrap" style={{ color: 'var(--text-subtle)' }}>
                  <span style={{ minWidth: 64 }}>Rabattstufe:</span>
                  <input className="form-input" style={{ height: 26, width: 150 }} disabled={!isAdmin}
                    placeholder="z.B. public sale" value={s.rabattstufe ?? ''} onChange={e => setCh(i, { rabattstufe: e.target.value })}
                    title="Verkaufs-/Preisart innerhalb Kanal×Kategorie (public sale, Presale, Rollstuhl, Bandshop, Box Office …). Erscheint in der Konzertabrechnung als Unterzeile; mehrere Zeilen mit gleichem Händler+Kategorie werden gruppiert." />
                  <span style={{ minWidth: 48, marginLeft: 8 }}>Refund.:</span>
                  <input className="form-input text-right" style={{ height: 26, width: 78 }} inputMode="decimal" disabled={!isAdmin}
                    placeholder={boxoffice ? '0' : (shopFee ? `${shopFee} (Händler)` : (f.fee_per_ticket ? `${f.fee_per_ticket} (Std.)` : 'Standard'))}
                    value={s.chan_fee ?? ''} onChange={e => setCh(i, { chan_fee: e.target.value })}
                    title="Gebühr/Ticket nur für diesen Kanal · leer = Händler-/Standard-Gebühr, Abendkasse = 0" />
                  <span>€/Tkt</span>
                </div>
              </div>
              )
            })}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          {In('USt Tickets %', 'ticket_vat', '', undefined, 'raw')}
          {In('USt Künstleranteil %', 'artist_vat', '', undefined, 'raw')}
          {In('Ticketing-Payout (brutto)', 'ticketing_payout_gross', 'bereits an Band')}
          <div className="flex items-end"><label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            <input type="checkbox" disabled={!isAdmin} checked={deductOwn} onChange={e => set({ deduct_own_shop: e.target.checked ? '1' : '' })} className="accent-blue-600" />
            Eigener Shop verrechnen
          </label></div>
        </div>

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
        <button onClick={onSettlementPdf} disabled={pdfBusy} className="btn btn-ghost mt-3"><DocumentArrowDownIcon className="w-4 h-4" />{pdfBusy ? 'Erzeuge…' : 'Abrechnung-PDF'}</button>
      </fieldset>

      {/* ── Bereich 3: Rechnung (Rechnungssteller + Rechnungen erstellen) ── */}
      <div className="flex items-center gap-3 pt-3">
        <span className="inline-flex items-center justify-center rounded-full text-xs font-bold" style={{ width: 24, height: 24, background: 'var(--primary)', color: '#fff' }}>3</span>
        <div>
          <div className="text-base font-bold leading-tight" style={{ color: 'var(--text)' }}>Rechnung</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Rechnungssteller festlegen und Anzahlungs-/Schlussrechnung erstellen.</div>
        </div>
      </div>

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
        {isAdmin && (<>
          <div className="flex gap-2 flex-wrap mb-1">
            <button onClick={() => previewInv('deposit')} disabled={invBusy || nnum(f.deposit) <= 0} className="btn btn-ghost" title="Vorschau als PDF – ohne zu speichern"><DocumentArrowDownIcon className="w-4 h-4" />Anzahlung – Vorschau</button>
            <button onClick={() => createInv('deposit')} disabled={invBusy || nnum(f.deposit) <= 0} className="btn btn-ghost" title={nnum(f.deposit) <= 0 ? 'Keine Anzahlung hinterlegt' : 'Rechnung endgültig erstellen'}><PlusIcon className="w-4 h-4" />Anzahlungsrechnung</button>
            <button onClick={() => previewInv('final')} disabled={invBusy} className="btn btn-ghost" title="Vorschau als PDF – ohne zu speichern"><DocumentArrowDownIcon className="w-4 h-4" />Schluss – Vorschau</button>
            <button onClick={() => createInv('final')} disabled={invBusy} className="btn btn-primary" title="Rechnung endgültig erstellen"><PlusIcon className="w-4 h-4" />Schlussrechnung</button>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>„Vorschau" erzeugt ein Entwurfs-PDF (Wasserzeichen, keine Nummer) ohne zu speichern. „…rechnung" legt die Rechnung endgültig an.</p>
        </>)}
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
          <span className="text-xs" style={{ color: autoState === 'error' ? 'var(--danger)' : 'var(--text-muted)' }}>
            {autoState === 'saving' || autoState === 'pending' ? 'Speichert automatisch…'
              : autoState === 'saved' ? '✓ Automatisch gespeichert'
              : autoState === 'error' ? '⚠ Speichern fehlgeschlagen'
              : 'Änderungen werden automatisch gespeichert'}
          </span>
          <button onClick={async () => { if (!confirm('Booking für dieses Event löschen?')) return; await deleteBookingContract(booking.id); onChanged() }} className="btn btn-ghost text-red-600 hover:bg-red-50 ml-auto"><TrashIcon className="w-4 h-4" />Booking löschen</button>
        </div>
      )}

      {showPicker && (
        <PartnerPickerModal
          existingPartnerIds={parties.map(p => p.partner_id).filter((x): x is number => x != null)}
          onSelect={onPickPartner}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}
