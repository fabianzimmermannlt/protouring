-- Tour-/Festivalkalkulation – PostgreSQL 16
-- Geldbeträge durchgängig numeric. Niemals float, niemals in JS aggregieren.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------- Stammdaten

CREATE TABLE bands (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Ein Projekt = eine Kalkulation: eine Festivalsaison oder eine Tournee.
CREATE TABLE projects (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id            uuid NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  name               text NOT NULL,
  year               int,
  currency           char(3) NOT NULL DEFAULT 'EUR',
  -- Rechenparameter, gelten für das ganze Projekt
  fuel_consumption   numeric(6,2)  NOT NULL DEFAULT 15,    -- Liter / 100 km
  fuel_price         numeric(8,3)  NOT NULL DEFAULT 2.600, -- Währung / Liter
  scenario_factor    numeric(6,4)  NOT NULL DEFAULT 1,     -- Auslastung bei Deal-Shows, 1 = 100 %
  member_count       int NOT NULL DEFAULT 1,               -- für "Ergebnis je Bandmitglied"
  default_variant_id uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Varianten einer Kalkulation, z. B. "mit NL" / "ohne NL" (Nightliner).
CREATE TABLE variants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 0,
  UNIQUE (project_id, name)
);

ALTER TABLE projects
  ADD CONSTRAINT projects_default_variant_fk
  FOREIGN KEY (default_variant_id) REFERENCES variants(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------- Shows

CREATE TABLE shows (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sort_order   int  NOT NULL,          -- Anzeigereihenfolge, unabhängig vom Datum
  show_date    date,
  city         text,
  venue        text,                   -- Festival- oder Venue-Name
  -- Deal-Parameter
  capacity     int,
  ticket_price numeric(10,2),
  guarantee    numeric(14,4) NOT NULL DEFAULT 0,
  deal_share   numeric(6,4)  NOT NULL DEFAULT 0,  -- Anteil am Überschuss, 0.7 = 70 %
  break_even   numeric(14,4) NOT NULL DEFAULT 0,
  commission   numeric(6,4)  NOT NULL DEFAULT 0,  -- Provision Booking-Agentur
  is_active    boolean NOT NULL DEFAULT true,     -- false = Show fällt aus, Daten bleiben erhalten
  note         text
);
CREATE INDEX shows_project_idx ON shows (project_id, sort_order);

-- ---------------------------------------------------------------- Katalog

CREATE TABLE categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('income','expense')),
  sort_order  int  NOT NULL DEFAULT 0,
  UNIQUE (project_id, name)
);

CREATE TABLE positions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 0,
  UNIQUE (category_id, name)
);

-- ---------------------------------------------------------------- Buchungen

-- Eine Zeile = ein Kostenpunkt oder Erlös einer Show.
-- show_id IS NULL  => Fixkosten, werden gleichmäßig auf alle aktiven Shows umgelegt.
-- variant_id IS NULL => gilt in allen Varianten.
CREATE TABLE entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  show_id        uuid REFERENCES shows(id) ON DELETE CASCADE,
  position_id    uuid NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
  variant_id     uuid REFERENCES variants(id) ON DELETE CASCADE,
  -- Variante A: einfache Mengenrechnung
  quantity       numeric(12,3),
  unit_price     numeric(14,4),
  -- Variante B: Fahrzeugrechnung (greift, sobald distance_km oder rental_price gesetzt ist)
  distance_km    numeric(10,2),
  rental_price   numeric(14,4),
  included_km    numeric(10,2),
  price_extra_km numeric(10,4),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX entries_project_idx  ON entries (project_id);
CREATE INDEX entries_show_idx     ON entries (show_id);
CREATE INDEX entries_position_idx ON entries (position_id);

-- ---------------------------------------------------------------- Views

-- Betrag je Buchung. Siehe docs/BERECHNUNGEN.md, Regel 1.
CREATE VIEW entry_amounts AS
SELECT
  e.*,
  CASE
    WHEN COALESCE(e.distance_km,0) > 0 OR COALESCE(e.rental_price,0) > 0 THEN
        COALESCE(e.rental_price,0)
      + GREATEST(0, COALESCE(e.distance_km,0) - COALESCE(e.included_km,0)) * COALESCE(e.price_extra_km,0)
      + COALESCE(e.distance_km,0) / 100 * p.fuel_consumption * p.fuel_price
    ELSE
      COALESCE(e.quantity,0) * COALESCE(e.unit_price,0)
  END AS amount
FROM entries e
JOIN projects p ON p.id = e.project_id;

-- Gage netto je Show. Siehe docs/BERECHNUNGEN.md, Regel 2.
CREATE VIEW show_gage AS
SELECT
  s.id AS show_id,
  s.project_id,
  GREATEST(
    s.guarantee * (1 - s.commission),
    ((COALESCE(s.capacity,0) * COALESCE(s.ticket_price,0) * p.scenario_factor - s.break_even)
      * s.deal_share) * (1 - s.commission)
  ) AS gage_net
FROM shows s
JOIN projects p ON p.id = s.project_id;
