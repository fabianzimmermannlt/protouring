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
  /** Tatsächlicher VVK-Stand (verkaufte Tickets) – Alternative zu Kapazität×Szenario. */
  vvk?: number | null
  ticket_price?: Money
  guarantee: Money
  deal_share: Money         // Anteil am Überschuss, 0.7 = 70 %
  break_even: Money
  commission: Money         // Provision Booking-Agentur
  deal_type?: DealType      // Default 'vs' (= heutige Paket-Regel 2)
  is_active: boolean
  note?: string | null
  /** Show gesperrt/abgerechnet (Snapshot eingefroren). */
  locked?: boolean
  locked_at?: string | null
  /** Eingefrorene Abrechnung (JSON-String) – nur bei gesperrten Shows. */
  snapshot?: string | null
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
  /** Freie Spezifikation, um mehrere gleiche Funktionen zu unterscheiden. */
  spec?: string | null
  /** Name (z.B. Person), separat ein-/ausblendbar. */
  person?: string | null
  /** Übergeordneter Kostenposten (Umlage auf mehrere Shows) statt normaler Show-Position. */
  is_overhead?: boolean
  /** Positionstyp: 'standard' (freier Betrag), 'hotel' (Zimmer×Nächte×€/Nacht) oder 'vehicle' (Miete+Mehr-km). */
  pos_type?: string
  /** Nur übergeordnete Posten: Anteil (Prozent), der auf DIESE Kalkulation entfällt. Default 100. */
  allocation_pct?: Money
  /** Fahrzeug-Snapshot (Erfahrungswerte zum Vorbefüllen der Fahrzeugzeile). */
  veh_rental?: Money; veh_included?: Money; veh_extra?: Money; veh_consumption?: Money; veh_price?: Money
  sort_order: number
}

/** Ausnahme: übergeordneter Posten gilt NICHT für diese Show (Default: alle aktiven Shows). */
export interface CalcOverheadExclude {
  position_id: string
  show_id: string
}

/** Weggehakt: diese Zeile (Position) wird in dieser Show + Variante NICHT berechnet.
 * Der eingetragene Wert bleibt erhalten – nur die Summenbildung überspringt sie. */
export interface CalcRowExclude {
  show_id: string
  position_id: string
  variant_id: string
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
  /** Hotel: Anzahl Übernachtungen (Betrag = quantity[Zimmer] × nights × unit_price[€/Nacht]). */
  nights?: Money
  /** Direktbetrag – überschreibt Menge×Preis/Fahrzeug (Tabellen-Eingabe). */
  amount?: Money
  /** 'base' = normaler Positionsbetrag, 'travel' = Reisekosten (km×Preis), 'hotel' = Zimmer×Nächte×€/Nacht. */
  kind?: string
  /** @deprecated Ist liegt jetzt pro Position/Show in CalcActual (nicht pro Variante). */
  ist_amount?: Money
  note?: string | null
}

/** Ist-Wert (echte Rechnung) pro Position je Show – Basis für Soll/Ist + Abrechnung. */
export interface CalcActual {
  id?: string
  show_id: string
  position_id: string
  amount?: Money
  /** Ist-Reisekosten: km × €/km (real gefahren), addiert sich zum Ist-Grundbetrag. */
  travel_km?: Money
  travel_rate?: Money
  /** Ist-Reisekosten: optionaler Fixpreis (z.B. Zugticket), addiert sich. */
  travel_fix?: Money
  /** Ist-Spritkosten (Fahrzeuge): fixer Betrag, addiert sich zum Ist. */
  fuel_amount?: Money
  /** Pro Show: Spezifikation + Name/Person (bzw. Fahrzeug-Info). */
  spec?: string | null
  person?: string | null
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
  /** Ist-Werte pro Position/Show (optional; leer bei Alt-Daten). */
  actuals?: CalcActual[]
  /** Show-Ausnahmen für übergeordnete Posten (optional; leer = jeder Posten gilt für alle aktiven Shows). */
  overheadExclude?: CalcOverheadExclude[]
  /** Weggehakte Zeilen (show_id, position_id, variant_id) – werden nicht berechnet. */
  rowExclude?: CalcRowExclude[]
  /** Gemerkte Formeln je Betragsfeld (optional). Nur zur Wiederanzeige/Bearbeitung; der Wert selbst liegt in entries/actuals. */
  formulas?: CalcFormula[]
  /** Unterzeilen übergeordneter Sammelposten (optional). Postensumme = Σ dieser Zeilen. */
  overheadLines?: CalcOverheadLine[]
}

/** Eine Unterzeile eines übergeordneten Sammelpostens (z.B. einzelne Rechnung). */
export interface CalcOverheadLine {
  id: string
  position_id: string
  label?: string | null
  amount?: Money | null
  ist_amount?: Money | null
  sort_order: number
}

/** Eine gemerkte Formel-Eingabe eines Betragsfeldes (z.B. "=236+44" → "280"). */
export interface CalcFormula {
  fkey: string
  formula: string
  result: string
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
  /** Deal mit echtem VVK-Stand rechnen statt Kapazität×Szenario. */
  useVVK?: boolean
}
