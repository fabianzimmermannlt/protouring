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
export function showGage(show: CalcShow, project: CalcProject, scenarioFactor?: Money | Decimal): Decimal {
  const factor = scenarioFactor != null ? D(scenarioFactor) : D(project.scenario_factor)
  const commission = D(show.commission)
  const netFactor = new Decimal(1).minus(commission)

  const guaranteeNet = D(show.guarantee).times(netFactor)
  const share = D(show.deal_share)
  // Überschuss = Kapazität × Ticketpreis × Auslastung − Break Even
  const ueberschuss = D(show.capacity).times(D(show.ticket_price)).times(factor).minus(D(show.break_even))

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

  // Regel 4 – Fixkosten (show_id NULL): Betrag je Position / Anzahl aktiver Shows.
  // Fixkosten sind projektweit → globale variantId (nicht per Show).
  const fixedShareByPosition = new Map<string, Decimal>()
  if (nActive > 0) {
    for (const e of data.entries) {
      if (e.show_id != null) continue
      if (!variantMatches(e, variantId)) continue
      const amt = entryAmount(e, project)
      const prev = fixedShareByPosition.get(e.position_id) ?? new Decimal(0)
      fixedShareByPosition.set(e.position_id, prev.plus(amt))
    }
    fixedShareByPosition.forEach((sum, pos) => {
      fixedShareByPosition.set(pos, sum.div(nActive))
    })
  }

  // Variable Buchungen je (show, position) – Variantenfilter pro Show (Regel 3).
  const variableByShowPosition = new Map<string, Map<string, Decimal>>()
  for (const e of data.entries) {
    if (e.show_id == null) continue
    if (!variantMatches(e, variantForShow(e.show_id))) continue
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
    fixedShareByPosition.forEach((_amt, posId) => positionIds.add(posId))
    positionIds.forEach(posId => {
      const variable = varByPos?.get(posId) ?? new Decimal(0)
      const fixed = fixedShareByPosition.get(posId) ?? new Decimal(0)
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

    const gageNet = showGage(show, project, scenarioFactor)
    const einnahmen = gageNet.plus(einnahmenBereiche)
    const ausgaben = ausgabenBereiche
    const ergebnis = einnahmen.minus(ausgaben)

    gageTotal = gageTotal.plus(gageNet)
    sumEinnahmen = sumEinnahmen.plus(einnahmen)
    sumAusgaben = sumAusgaben.plus(ausgaben)

    showResults.push({
      showId: show.id, legacyKey: show.legacy_key, city: show.city,
      gageNet, einnahmen, ausgaben, ergebnis, categoryAmount, positionAmount,
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
