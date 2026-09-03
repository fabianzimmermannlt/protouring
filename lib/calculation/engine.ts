// Tour-/Festival-Kalkulation – Rechenkern (reine Funktionen).
// Verbindlich: docs/BERECHNUNGEN.md (Regeln 1–6). Es wird NIRGENDS in
// Zwischenschritten gerundet; Rundung passiert nur zur Anzeige (siehe money.ts).
// Alle Beträge über decimal.js, niemals number. Siehe DECISIONS ADR-105.

import Decimal from 'decimal.js'
import type {
  CalcDataset, CalcEntry, CalcProject, CalcShow, DealType, Money, OverviewOptions,
} from './types'

// Genug Präzision für ungerundete Zwischenwerte.
Decimal.set({ precision: 40 })

/** Rohwert → Decimal. NULL/leer = 0. Über String, um Float-Artefakte zu meiden. */
export function D(v: Money | Decimal): Decimal {
  if (v == null || v === '') return new Decimal(0)
  if (v instanceof Decimal) return v
  return new Decimal(typeof v === 'number' ? String(v) : v)
}

// ── Regel 1 – Betrag einer Buchung ───────────────────────────────────────────
// Fahrzeugrechnung greift, sobald distance_km > 0 ODER rental_price > 0.
export function entryAmount(entry: CalcEntry, project: CalcProject): Decimal {
  // Hotel: Zimmer × Nächte × €/Nacht.
  if (entry.kind === 'hotel') return D(entry.quantity).times(D(entry.nights)).times(D(entry.unit_price))
  // Fahrzeug: Miete + Mehr-km × Preis (Sprit separat als kind='fuel').
  if (entry.kind === 'vehicle') {
    const mehrKm = Decimal.max(0, D(entry.distance_km).minus(D(entry.included_km)))
    return D(entry.rental_price).plus(mehrKm.times(D(entry.price_extra_km)))
  }
  // Sprit: Strecke/100 × Verbrauch (L/100 km) × Preis (€/L).
  if (entry.kind === 'fuel') return D(entry.distance_km).div(100).times(D(entry.quantity)).times(D(entry.unit_price))
  // Reisekosten: km × €/km PLUS optionaler Fixpreis (z.B. Zugticket). Beide Teile optional.
  if (entry.kind === 'travel') return D(entry.quantity).times(D(entry.unit_price)).plus(D(entry.amount))
  // Direktbetrag hat Vorrang (Tabellen-Eingabe); sonst Menge×Preis / Fahrzeug.
  if (entry.amount != null && entry.amount !== '') return D(entry.amount)
  const dist = D(entry.distance_km)
  const rental = D(entry.rental_price)
  if (dist.gt(0) || rental.gt(0)) {
    const included = D(entry.included_km)
    const extra = D(entry.price_extra_km)
    const mehrKm = Decimal.max(0, dist.minus(included))
    const sprit = dist.div(100).times(D(project.fuel_consumption)).times(D(project.fuel_price))
    return rental.plus(mehrKm.times(extra)).plus(sprit)
  }
  return D(entry.quantity).times(D(entry.unit_price))
}

// ── Regel 2 – Gage netto einer Show ──────────────────────────────────────────
// deal_type steuert die Kombination aus Garantie und Beteiligung.
export function showGage(show: CalcShow, project: CalcProject, scenarioFactor?: Money | Decimal, useVVK?: boolean): Decimal {
  const factor = scenarioFactor != null ? D(scenarioFactor) : D(project.scenario_factor)
  const commission = D(show.commission)
  const netFactor = new Decimal(1).minus(commission)

  const guaranteeNet = D(show.guarantee).times(netFactor)
  const share = D(show.deal_share)
  // Besucherzahl: echter VVK-Stand (wenn aktiviert & gesetzt) ODER geplante Auslastung (Kapazität × Szenario-%)
  const attendance = (useVVK && show.vvk != null && String(show.vvk) !== '') ? D(show.vvk) : D(show.capacity).times(factor)
  // Überschuss = Besucher × Ticketpreis − Break Even
  const ueberschuss = attendance.times(D(show.ticket_price)).minus(D(show.break_even))

  const dealType: DealType = show.deal_type ?? 'vs'
  switch (dealType) {
    case 'guarantee':
      return guaranteeNet
    case 'vs':
      // Garantie ODER Deal – das Höhere (heutige Paket-Regel 2)
      return Decimal.max(guaranteeNet, ueberschuss.times(share).times(netFactor))
    case 'plus':
      // Garantie PLUS Beteiligung obendrauf (Überschuss nie negativ anrechnen)
      return D(show.guarantee).plus(Decimal.max(0, ueberschuss).times(share)).times(netFactor)
    case 'door':
      // Reine Beteiligung, keine Garantie
      return Decimal.max(0, ueberschuss).times(share).times(netFactor)
  }
}

// Gage-Aufschlüsselung: Fixgage (Garantie) + Deal (Beteiligung) = Bruttogage,
// dann Provisionsabzug → Nettogage. fix + deal ergibt immer gross; bei „vs" zählt
// die höhere Komponente (die andere = 0). net entspricht showGage() (41 Tests).
export function showGageBreakdown(
  show: CalcShow, project: CalcProject, scenarioFactor?: Money | Decimal, useVVK?: boolean
): { gross: Decimal; fix: Decimal; deal: Decimal; provision: Decimal; net: Decimal } {
  const factor = scenarioFactor != null ? D(scenarioFactor) : D(project.scenario_factor)
  const commission = D(show.commission)
  const netFactor = new Decimal(1).minus(commission)
  const share = D(show.deal_share)
  const guarantee = D(show.guarantee)
  const attendance = (useVVK && show.vvk != null && String(show.vvk) !== '') ? D(show.vvk) : D(show.capacity).times(factor)
  const ueberschuss = attendance.times(D(show.ticket_price)).minus(D(show.break_even))
  const dealType: DealType = show.deal_type ?? 'vs'
  let fix: Decimal, deal: Decimal
  switch (dealType) {
    case 'guarantee':
      fix = guarantee; deal = new Decimal(0); break
    case 'vs': {
      // Garantie ODER Deal – die höhere Komponente zählt, die andere = 0.
      const dealAmt = ueberschuss.times(share)
      if (guarantee.gte(dealAmt)) { fix = guarantee; deal = new Decimal(0) }
      else { fix = new Decimal(0); deal = dealAmt }
      break
    }
    case 'plus':
      fix = guarantee; deal = Decimal.max(0, ueberschuss).times(share); break
    case 'door':
      fix = new Decimal(0); deal = Decimal.max(0, ueberschuss).times(share); break
    default:
      fix = guarantee; deal = new Decimal(0)
  }
  const gross = fix.plus(deal)
  const net = gross.times(netFactor)
  return { gross, fix, deal, provision: gross.minus(net), net }
}

// ── Break/Deal-Schwelle in Tickets ───────────────────────────────────────────
// Ab wie vielen verkauften Tickets deckt der Veranstalter den Break-Even (Über-
// schuss = 0)? Und – nur bei „vs" – ab wann schlägt der Deal die Garantie?
// Herleitung (netFactor kürzt sich): Deal ≥ Garantie ⇔
//   deal_share × (Besucher × Ticketpreis − Break-Even) ≥ Garantie
//   ⇔ Besucher ≥ (Break-Even + Garantie/deal_share) / Ticketpreis
// Ungerundet gerechnet, erst zur Anzeige auf ganze Tickets aufgerundet.
export type DealTicketThresholds = {
  dealType: DealType
  applicable: boolean          // deal-basierte Show mit brauchbaren Eingaben
  breakTickets: number | null  // Tickets bis Überschuss = 0 (Kosten gedeckt)
  dealTickets: number | null   // nur „vs": Tickets, ab denen Deal ≥ Garantie
  capacity: number | null
  vvk: number | null
  note: 'ok' | 'not-deal' | 'no-ticketprice' | 'no-share'
}

export function dealTicketThresholds(input: {
  dealType: DealType
  guarantee: Money
  deal_share: Money           // Ratio (0.7 = 70 %)
  break_even: Money
  ticket_price: Money
  capacity?: number | null
  vvk?: number | null
}): DealTicketThresholds {
  const dealType = input.dealType ?? 'vs'
  const capacity = input.capacity ?? null
  const vvk = input.vvk ?? null
  const base = { dealType, capacity, vvk }
  if (dealType === 'guarantee') {
    return { ...base, applicable: false, breakTickets: null, dealTickets: null, note: 'not-deal' }
  }
  const price = D(input.ticket_price)
  if (price.lte(0)) {
    return { ...base, applicable: false, breakTickets: null, dealTickets: null, note: 'no-ticketprice' }
  }
  const breakEven = D(input.break_even)
  const breakTickets = Math.max(0, Math.ceil(breakEven.div(price).toNumber()))
  if (dealType !== 'vs') {
    // plus / door: kein „schlägt Garantie" – nur der Break-Even ist relevant.
    return { ...base, applicable: true, breakTickets, dealTickets: null, note: 'ok' }
  }
  const share = D(input.deal_share)
  if (share.lte(0)) {
    return { ...base, applicable: true, breakTickets, dealTickets: null, note: 'no-share' }
  }
  const dealTickets = Math.max(0, Math.ceil(breakEven.plus(D(input.guarantee).div(share)).div(price).toNumber()))
  return { ...base, applicable: true, breakTickets, dealTickets, note: 'ok' }
}

// ── Regel 3 – Variantenfilter ────────────────────────────────────────────────
export function variantMatches(entry: CalcEntry, variantId: string | null | undefined): boolean {
  return entry.variant_id == null || entry.variant_id === variantId
}

// ── Ergebnisstrukturen ───────────────────────────────────────────────────────

export interface ShowResult {
  showId: string
  legacyKey?: string | null
  city?: string | null
  gageNet: Decimal
  gageGross: Decimal      // Bruttogage (vor Provision) = fix + deal
  gageFix: Decimal        // Fixgage (Garantie-Anteil)
  gageDeal: Decimal       // Deal-/Beteiligungs-Anteil
  gageProvision: Decimal  // Provisionsbetrag (brutto − netto)
  einnahmen: Decimal      // gageNet + income-Bereiche
  ausgaben: Decimal       // expense-Bereiche
  ergebnis: Decimal
  /** category_id → Summe dieser Show */
  categoryAmount: Map<string, Decimal>
  /** position_id → Betrag dieser Show (inkl. anteiliger Fixkosten) */
  positionAmount: Map<string, Decimal>
}

export interface CategoryResult {
  categoryId: string
  name: string
  kind: 'income' | 'expense'
  total: Decimal
}

export interface OverviewResult {
  variantId: string | null
  activeShowCount: number
  shows: ShowResult[]
  categories: CategoryResult[]
  gageTotal: Decimal
  sumEinnahmen: Decimal
  sumAusgaben: Decimal
  ergebnis: Decimal
  jeBandmitglied: Decimal
}

// ── Regeln 4–5 – Fixkostenumlage + Aggregation ───────────────────────────────
export function buildOverview(data: CalcDataset, opts: OverviewOptions = {}): OverviewResult {
  const { project } = data
  const variantId = opts.variantId !== undefined ? opts.variantId : (project.default_variant_id ?? null)
  const scenarioFactor = opts.scenarioFactor != null ? D(opts.scenarioFactor) : D(project.scenario_factor)
  const memberCount = opts.memberCount != null ? opts.memberCount : project.member_count
  const useVVK = opts.useVVK === true

  const activeShows = data.shows
    .filter(s => s.is_active)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
  const nActive = activeShows.length

  const positionToCategory = new Map<string, string>()
  for (const p of data.positions) positionToCategory.set(p.id, p.category_id)
  const categoryKind = new Map<string, 'income' | 'expense'>()
  for (const c of data.categories) categoryKind.set(c.id, c.kind)

  // Variante je Show: variantByShow[showId] überschreibt die globale variantId.
  const variantByShow = opts.variantByShow
  const variantForShow = (showId: string): string | null =>
    variantByShow && Object.prototype.hasOwnProperty.call(variantByShow, showId)
      ? variantByShow[showId] : variantId

  // Regel 4 – Übergeordnete/Fixkosten (show_id NULL): Betrag je Position auf die
  // zutreffenden aktiven Shows umgelegt. Fixkosten sind projektweit → globale
  // variantId (nicht per Show). Ein Posten kann von einzelnen Shows ausgenommen
  // sein (overheadExclude) → Umlage nur auf die verbleibenden Shows.
  const excludeByPosition = new Map<string, Set<string>>()
  ;(data.overheadExclude ?? []).forEach(ex => {
    let s = excludeByPosition.get(ex.position_id)
    if (!s) { s = new Set(); excludeByPosition.set(ex.position_id, s) }
    s.add(ex.show_id)
  })
  const fixedSumByPosition = new Map<string, Decimal>()
  for (const e of data.entries) {
    if (e.show_id != null) continue
    if (!variantMatches(e, variantId)) continue
    const prev = fixedSumByPosition.get(e.position_id) ?? new Decimal(0)
    fixedSumByPosition.set(e.position_id, prev.plus(entryAmount(e, project)))
  }
  // Anteil auf DIESE Kalkulation (allocation_pct, Default 100 %) auf den Posten anwenden.
  const pctByPosition = new Map<string, Decimal>()
  for (const p of data.positions) {
    pctByPosition.set(p.id, (p.allocation_pct == null || p.allocation_pct === '') ? new Decimal(100) : D(p.allocation_pct))
  }
  fixedSumByPosition.forEach((sum, pos) => {
    fixedSumByPosition.set(pos, sum.times(pctByPosition.get(pos) ?? new Decimal(100)).div(100))
  })
  // Je Posten: Menge der zutreffenden Shows + Anteil = Summe ÷ Anzahl zutreffender Shows.
  const fixedIncludedByPosition = new Map<string, Set<string>>()
  const fixedShareByPosition = new Map<string, Decimal>()
  fixedSumByPosition.forEach((sum, pos) => {
    const excl = excludeByPosition.get(pos)
    const ids = new Set<string>()
    activeShows.forEach(s => { if (!(excl && excl.has(s.id))) ids.add(s.id) })
    fixedIncludedByPosition.set(pos, ids)
    if (ids.size > 0) fixedShareByPosition.set(pos, sum.div(ids.size))
  })

  // Weggehakte Zeilen: (show, position, variant) → wird für diese Variante NICHT berechnet.
  const rowExcluded = new Set<string>()
  ;(data.rowExclude ?? []).forEach(rx => rowExcluded.add(`${rx.show_id}|${rx.position_id}|${rx.variant_id}`))

  // Variable Buchungen je (show, position) – Variantenfilter pro Show (Regel 3).
  const variableByShowPosition = new Map<string, Map<string, Decimal>>()
  for (const e of data.entries) {
    if (e.show_id == null) continue
    const vForShow = variantForShow(e.show_id)
    if (!variantMatches(e, vForShow)) continue
    if (vForShow != null && rowExcluded.has(`${e.show_id}|${e.position_id}|${vForShow}`)) continue  // weggehakt
    let byPos = variableByShowPosition.get(e.show_id)
    if (!byPos) { byPos = new Map(); variableByShowPosition.set(e.show_id, byPos) }
    const prev = byPos.get(e.position_id) ?? new Decimal(0)
    byPos.set(e.position_id, prev.plus(entryAmount(e, project)))
  }

  const categoryTotals = new Map<string, Decimal>()
  const addCategoryTotal = (catId: string, v: Decimal) =>
    categoryTotals.set(catId, (categoryTotals.get(catId) ?? new Decimal(0)).plus(v))

  const showResults: ShowResult[] = []
  let sumEinnahmen = new Decimal(0)
  let sumAusgaben = new Decimal(0)
  let gageTotal = new Decimal(0)

  for (const show of activeShows) {
    const positionAmount = new Map<string, Decimal>()
    const categoryAmount = new Map<string, Decimal>()

    const varByPos = variableByShowPosition.get(show.id)
    // Alle bebuchten Positionen dieser Show (variabel) + alle mit Fixkostenanteil
    const positionIds = new Set<string>()
    if (varByPos) varByPos.forEach((_amt, posId) => positionIds.add(posId))
    fixedShareByPosition.forEach((_amt, posId) => {
      const inc = fixedIncludedByPosition.get(posId)
      if (inc && inc.has(show.id)) positionIds.add(posId)
    })
    positionIds.forEach(posId => {
      const variable = varByPos?.get(posId) ?? new Decimal(0)
      const inc = fixedIncludedByPosition.get(posId)
      const fixed = (inc && inc.has(show.id)) ? (fixedShareByPosition.get(posId) ?? new Decimal(0)) : new Decimal(0)
      const amount = variable.plus(fixed)
      positionAmount.set(posId, amount)
      const catId = positionToCategory.get(posId)
      if (!catId) return
      categoryAmount.set(catId, (categoryAmount.get(catId) ?? new Decimal(0)).plus(amount))
    })

    let einnahmenBereiche = new Decimal(0)
    let ausgabenBereiche = new Decimal(0)
    categoryAmount.forEach((amt, catId) => {
      addCategoryTotal(catId, amt)
      if (categoryKind.get(catId) === 'income') einnahmenBereiche = einnahmenBereiche.plus(amt)
      else ausgabenBereiche = ausgabenBereiche.plus(amt)
    })

    const gageNet = showGage(show, project, scenarioFactor, useVVK)
    const gageBd = showGageBreakdown(show, project, scenarioFactor, useVVK)  // Brutto + Provision (net identisch zu gageNet)
    const einnahmen = gageNet.plus(einnahmenBereiche)
    const ausgaben = ausgabenBereiche
    const ergebnis = einnahmen.minus(ausgaben)

    gageTotal = gageTotal.plus(gageNet)
    sumEinnahmen = sumEinnahmen.plus(einnahmen)
    sumAusgaben = sumAusgaben.plus(ausgaben)

    showResults.push({
      showId: show.id, legacyKey: show.legacy_key, city: show.city,
      gageNet, gageGross: gageBd.gross, gageFix: gageBd.fix, gageDeal: gageBd.deal, gageProvision: gageBd.provision,
      einnahmen, ausgaben, ergebnis, categoryAmount, positionAmount,
    })
  }

  const categories: CategoryResult[] = data.categories
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(c => ({
      categoryId: c.id, name: c.name, kind: c.kind,
      total: categoryTotals.get(c.id) ?? new Decimal(0),
    }))

  const ergebnis = sumEinnahmen.minus(sumAusgaben)
  const jeBandmitglied = memberCount > 0 ? ergebnis.div(memberCount) : new Decimal(0)

  return {
    variantId, activeShowCount: nActive, shows: showResults, categories,
    gageTotal, sumEinnahmen, sumAusgaben, ergebnis, jeBandmitglied,
  }
}

// ── Regel 6 – Prozentanteile ─────────────────────────────────────────────────
// Einnahmenzeilen ÷ SUMME EINNAHMEN, Ausgabenzeilen ÷ SUMME AUSGABEN.
// Bezug 0 → null (keine Anzeige, keine Division durch null).
export function percentOf(value: Decimal, basis: Decimal): Decimal | null {
  if (basis.isZero()) return null
  return value.div(basis).times(100)
}
