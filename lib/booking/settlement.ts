// Abrechnungs-Rechenkern für das Booking-Add-on (reine Funktion, unit-testbar).
// Abgeleitet aus echten Konzertabrechnungen (KA): Ticketing (Kanäle, gemischte USt),
// Ticket-Systemgebühr („Refundierung") mit Band-Split, Deal (Garantie „vs" %, Basis
// Brutto-Ticketnetto oder Nettogewinn, optional 2. Schwelle), Nebenkosten (eigene USt),
// sowie Verrechnung von Ticketing-Payout und bereits bei der Band liegenden Shop-Einnahmen.

export interface SettlementChannel {
  name?: string | null
  art?: string | null          // 'vvk' | 'boxoffice' | 'ownshop'
  money_with?: string | null   // 'promoter' | 'band'
  tickets?: string | null
  revenue?: string | null      // Bruttoeinnahme dieses Kanals (inkl. Ticket-USt)
  chan_fee?: string | null       // Gebühr/Ticket NUR für diesen Kanal (leer = global; Abendkasse = 0)
  chan_fee_split?: string | null // Band-Anteil % an der Gebühr NUR für diesen Kanal (leer = global)
}
export interface SettlementCost {
  label?: string | null
  net?: string | null
  vat?: string | null          // eigener USt-Satz (z.B. 19)
}
export interface SettlementInput {
  channels: SettlementChannel[]
  costs: SettlementCost[]
  ticketVat?: string | null         // USt auf Tickets (z.B. 7)
  feePerTicket?: string | null      // Ticket-Systemgebühr je Ticket (brutto), „Refundierung"
  feeVat?: string | null            // USt auf die Gebühr (z.B. 7)
  feeBandSplitPct?: string | null   // Anteil der Band an der Gebühr (netto), z.B. 50
  artistVat?: string | null         // USt auf den Künstleranteil (z.B. 7)
  dealBase?: string | null          // 'gross' (Netto-Ticketumsatz) | 'netprofit' (nach Kosten)
  promoterCosts?: string | null     // Veranstalterkosten (nur bei 'netprofit')
  guarantee?: string | null         // Produktionskostengarantie
  // Beliebig viele Deal-Stufen (progressiv): je Stufe gilt pct ab der Nettoeinnahme `from`.
  // Erste Stufe sollte from=0 haben. Beispiel: [{from:0,pct:50},{from:44859.81,pct:55}].
  tiers?: { from?: string | number | null; pct?: string | number | null }[]
  // Rückwärtskompatibel (2 Stufen) – wird genutzt, falls tiers leer ist.
  pct1?: string | null
  threshold2?: string | null
  pct2?: string | null
  ticketingPayoutGross?: string | null  // bereits vom Ticketanbieter an die Band ausgezahlt (brutto)
  deductOwnShop?: boolean           // Einnahmen aus eigenem Shop (money_with='band') verrechnen
  depositNet?: string | null        // bereits berechnete Anzahlung (netto)
  depositVat?: string | null        // USt-Satz der Anzahlung (für die Abzugsdarstellung)
}

export interface SettlementResult {
  totalTickets: number
  ticketGross: number; ticketVatAmt: number; ticketNet: number
  feeTotalGross: number; feeVatAmt: number; feeNet: number; bandFeeShareNet: number
  dealBaseAmt: number; dealShareNet: number; artistShareNet: number
  costsNet: number; costsVat: number
  rechnungNet: number; rechnungVat: number; rechnungGross: number
  ownShopGross: number; ticketingPayout: number
  depositGross: number
  payableGross: number   // offener Betrag an die Band nach allen Verrechnungen
}

const n = (v: unknown) => { const x = Number(String(v ?? '').replace(',', '.')); return isFinite(x) ? x : 0 }

export function computeSettlement(inp: SettlementInput): SettlementResult {
  const ticketVat = n(inp.ticketVat), feeVat = n(inp.feeVat), artistVat = n(inp.artistVat)
  const channels = inp.channels || [], costs = inp.costs || []

  const totalTickets = channels.reduce((a, c) => a + n(c.tickets), 0)
  const ticketGross = channels.reduce((a, c) => a + n(c.revenue), 0)
  const ticketNet = ticketGross / (1 + ticketVat / 100)
  const ticketVatAmt = ticketGross - ticketNet

  // Ticket-Systemgebühr („Refundierung") PRO Kanal: Gebühr/Ticket × Anzahl.
  // Default = globale feePerTicket; Abendkasse (art='boxoffice') hat keine Systemgebühr (0),
  // sofern nicht am Kanal ausdrücklich gesetzt. Band-Split ebenfalls je Kanal (Default global).
  const globalFee = n(inp.feePerTicket), globalSplit = n(inp.feeBandSplitPct)
  let feeTotalGross = 0, bandFeeShareGross = 0
  for (const c of channels) {
    const hasOwnFee = c.chan_fee != null && String(c.chan_fee) !== ''
    const fee = hasOwnFee ? n(c.chan_fee) : (c.art === 'boxoffice' ? 0 : globalFee)
    const lineGross = n(c.tickets) * fee
    feeTotalGross += lineGross
    const split = (c.chan_fee_split != null && String(c.chan_fee_split) !== '') ? n(c.chan_fee_split) : globalSplit
    bandFeeShareGross += lineGross * split / 100
  }
  const feeNet = feeTotalGross / (1 + feeVat / 100)
  const feeVatAmt = feeTotalGross - feeNet
  const bandFeeShareNet = bandFeeShareGross / (1 + feeVat / 100)

  const dealBaseAmt = inp.dealBase === 'netprofit' ? (ticketNet - n(inp.promoterCosts)) : ticketNet
  // Stufen bestimmen: entweder aus tiers oder (Fallback) aus pct1/threshold2/pct2.
  let tiers = (inp.tiers || []).map(t => ({ from: n(t.from), pct: n(t.pct) })).filter(t => t.pct !== 0 || t.from === 0)
  if (!tiers.length) {
    tiers = [{ from: 0, pct: n(inp.pct1) }]
    if (n(inp.threshold2) > 0 && n(inp.pct2) > 0) tiers.push({ from: n(inp.threshold2), pct: n(inp.pct2) })
  }
  tiers.sort((a, b) => a.from - b.from)
  // Progressiv/marginal: Anteil je Stufe auf den Betrag zwischen from[i] und from[i+1].
  let share = 0
  for (let i = 0; i < tiers.length; i++) {
    const lower = tiers[i].from
    const upper = i + 1 < tiers.length ? tiers[i + 1].from : Infinity
    if (dealBaseAmt > lower) share += (Math.min(dealBaseAmt, upper) - lower) * tiers[i].pct / 100
  }
  const dealShareNet = Math.max(n(inp.guarantee), share)   // „vs" – das Höhere gewinnt
  const artistShareNet = dealShareNet + bandFeeShareNet

  const costsNet = costs.reduce((a, c) => a + n(c.net), 0)
  const costsVat = costs.reduce((a, c) => a + n(c.net) * n(c.vat) / 100, 0)

  const rechnungNet = artistShareNet + costsNet
  const rechnungVat = artistShareNet * artistVat / 100 + costsVat
  const rechnungGross = rechnungNet + rechnungVat

  const ownShopGross = inp.deductOwnShop ? channels.filter(c => c.money_with === 'band').reduce((a, c) => a + n(c.revenue), 0) : 0
  const ticketingPayout = n(inp.ticketingPayoutGross)
  const depositGross = n(inp.depositNet) * (1 + n(inp.depositVat) / 100)
  const payableGross = rechnungGross - ticketingPayout - ownShopGross - depositGross

  return {
    totalTickets, ticketGross, ticketVatAmt, ticketNet,
    feeTotalGross, feeVatAmt, feeNet, bandFeeShareNet,
    dealBaseAmt, dealShareNet, artistShareNet,
    costsNet, costsVat,
    rechnungNet, rechnungVat, rechnungGross,
    ownShopGross, ticketingPayout, depositGross, payableGross,
  }
}
