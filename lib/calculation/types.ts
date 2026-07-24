// Tour-/Festival-Kalkulation – Datentypen für den Rechenkern.
// Spiegeln db/schema.sql (siehe lib/calculation/spec/). Geld als string|number
// im Rohzustand; im Rechenkern (engine.ts) wird ausschließlich mit decimal.js
// gerechnet – niemals mit number. Siehe DECISIONS ADR-105.

export type Money = number | string | null | undefined

/** Deal-Typ pro Show. Erweiterung ggü. dem Paket (nur 'vs' spezifiziert). */
export type DealType = 'guarantee' | 'vs' | 'plus' | 'door'

export interface CalcProject {
  id: string
  name: string
  year?: number | null
  currency?: string
  fuel_consumption: Money   // Liter / 100 km
  fuel_price: Money         // Währung / Liter
  scenario_factor: Money    // Auslastung bei Deal-Shows, 1 = 100 %
  member_count: number
  default_variant_id?: string | null
}

export interface CalcVariant {
  id: string
  name: string
  sort_order: number
}

export interface CalcShow {
  id: string
  sort_order: number
  show_date?: string | null
  city?: string | null
  venue?: string | null
  // Deal-Parameter
  capacity?: number | null
  ticket_price?: Money
  guarantee: Money
  deal_share: Money         // Anteil am Überschuss, 0.7 = 70 %
  break_even: Money
  commission: Money         // Provision Booking-Agentur
  deal_type?: DealType      // Default 'vs' (= heutige Paket-Regel 2)
  is_active: boolean
  note?: string | null
  /** nur in den Migrationsdaten: S01…S09 */
  legacy_key?: string | null
}

export type CategoryKind = 'income' | 'expense'

export interface CalcCategory {
  id: string
  name: string
  kind: CategoryKind
  sort_order: number
}

export interface CalcPosition {
  id: string
  category_id: string
  name: string
  sort_order: number
}

export interface CalcEntry {
  id: string
  show_id?: string | null      // NULL = Fixkosten
  position_id: string
  variant_id?: string | null   // NULL = gilt in allen Varianten
  // Variante A: Mengenrechnung
  quantity?: Money
  unit_price?: Money
  // Variante B: Fahrzeugrechnung
  distance_km?: Money
  rental_price?: Money
  included_km?: Money
  price_extra_km?: Money
  /** Ist-Wert (echte Rechnung). Soll = quantity/Fahrzeugformel. Orthogonal zur Variante. */
  ist_amount?: Money
  note?: string | null
}

/** Ein vollständiger Kalkulations-Datensatz (ein Projekt). */
export interface CalcDataset {
  project: CalcProject
  variants: CalcVariant[]
  shows: CalcShow[]
  categories: CalcCategory[]
  positions: CalcPosition[]
  entries: CalcEntry[]
}

export interface OverviewOptions {
  /**
   * Global gewählte Variante (gilt für alle Shows, sofern nicht per variantByShow
   * überschrieben, und immer für Fixkosten). Default: project.default_variant_id.
   */
  variantId?: string | null
  /**
   * Variante pro Show (showId → variantId). Überschreibt variantId für die
   * genannten Shows. So kann jede Show z.B. „mit NL" oder „ohne NL" sein.
   * Nicht genannte Shows nutzen variantId.
   */
  variantByShow?: Record<string, string | null>
  /** Überschreibt project.scenario_factor. */
  scenarioFactor?: Money
  /** Überschreibt project.member_count. */
  memberCount?: number
}
