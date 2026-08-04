// Tour-/Festival-Kalkulation – DB-Schema, Seed-Import, Laden.
// Wird vom Server (server/index.js) UND vom Vitest-DB-Test genutzt (eine Quelle).
//
// Geld/Verhältnisse werden als TEXT-Dezimalstrings gespeichert (exakt, kein float).
// Der Rechenkern (lib/calculation/engine) parst sie via decimal.js. Aggregation
// läuft in JS mit decimal.js, nicht in SQL. Siehe DECISIONS ADR-105.

const { randomUUID } = require('crypto')

const SCHEMA = `
CREATE TABLE IF NOT EXISTS calc_projects (
  id TEXT PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  year INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  fuel_consumption TEXT NOT NULL DEFAULT '15',
  fuel_price TEXT NOT NULL DEFAULT '2.600',
  scenario_factor TEXT NOT NULL DEFAULT '1',
  member_count INTEGER NOT NULL DEFAULT 1,
  default_variant_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS calc_variants (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES calc_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS calc_shows (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES calc_projects(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  show_date TEXT,
  city TEXT,
  venue TEXT,
  capacity INTEGER,
  vvk INTEGER,
  ticket_price TEXT,
  guarantee TEXT NOT NULL DEFAULT '0',
  deal_share TEXT NOT NULL DEFAULT '0',
  break_even TEXT NOT NULL DEFAULT '0',
  commission TEXT NOT NULL DEFAULT '0',
  deal_type TEXT NOT NULL DEFAULT 'vs',
  is_active INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  locked INTEGER NOT NULL DEFAULT 0,   -- Show gesperrt/abgerechnet
  locked_at TEXT,
  snapshot TEXT                        -- eingefrorene Abrechnung (self-contained JSON)
);
CREATE TABLE IF NOT EXISTS calc_categories (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES calc_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS calc_positions (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES calc_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  spec TEXT,
  person TEXT,
  is_overhead INTEGER NOT NULL DEFAULT 0,
  pos_type TEXT NOT NULL DEFAULT 'standard',   -- 'standard' | 'hotel' | 'vehicle'
  allocation_pct TEXT NOT NULL DEFAULT '100',  -- Anteil übergeordneter Kosten auf DIESE Kalkulation (Prozent)
  -- Fahrzeug-Snapshot (Erfahrungswerte zum Vorbefüllen der Fahrzeugzeile)
  veh_rental TEXT, veh_included TEXT, veh_extra TEXT, veh_consumption TEXT, veh_price TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
-- Übergeordnete Kosten: von welchen Shows ist ein Posten ausgenommen (Default: alle aktiven)
CREATE TABLE IF NOT EXISTS calc_overhead_exclude (
  position_id TEXT NOT NULL REFERENCES calc_positions(id) ON DELETE CASCADE,
  show_id TEXT NOT NULL REFERENCES calc_shows(id) ON DELETE CASCADE,
  PRIMARY KEY (position_id, show_id)
);
CREATE TABLE IF NOT EXISTS calc_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES calc_projects(id) ON DELETE CASCADE,
  show_id TEXT REFERENCES calc_shows(id) ON DELETE CASCADE,
  position_id TEXT NOT NULL REFERENCES calc_positions(id) ON DELETE RESTRICT,
  variant_id TEXT REFERENCES calc_variants(id) ON DELETE CASCADE,
  quantity TEXT,
  unit_price TEXT,
  distance_km TEXT,
  rental_price TEXT,
  included_km TEXT,
  price_extra_km TEXT,
  nights TEXT,
  amount TEXT,
  kind TEXT DEFAULT 'base',
  ist_amount TEXT,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS calc_actuals (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL REFERENCES calc_shows(id) ON DELETE CASCADE,
  position_id TEXT NOT NULL REFERENCES calc_positions(id) ON DELETE CASCADE,
  amount TEXT,
  travel_km TEXT,
  travel_rate TEXT,
  travel_fix TEXT,
  spec TEXT,        -- Spezifikation pro Show
  person TEXT,      -- Name/Person bzw. Fahrzeug-Info pro Show
  fuel_amount TEXT, -- Ist-Spritkosten (Fahrzeuge), fixer Betrag pro Show
  note TEXT,
  UNIQUE (show_id, position_id)
);
CREATE INDEX IF NOT EXISTS calc_entries_project_idx ON calc_entries (project_id);
CREATE INDEX IF NOT EXISTS calc_entries_show_idx ON calc_entries (show_id);
CREATE INDEX IF NOT EXISTS calc_projects_tenant_idx ON calc_projects (tenant_id);
CREATE INDEX IF NOT EXISTS calc_actuals_show_idx ON calc_actuals (show_id);
`

/** number|null → TEXT-Dezimalstring|null (kein float-Zwischenschritt für Anzeige). */
function s(v) { return v == null ? null : String(v) }

/**
 * Seed-JSON → einspielbare Zeilen mit FRISCHEN UUIDs (damit mehrere Tenants
 * denselben Seed importieren können, ohne PK-Kollision). FK-Referenzen werden
 * über Maps umgeschrieben. project bekommt tenant_id.
 */
function buildImportRows(seed, tenantId) {
  const pid = randomUUID()
  const vmap = {}, smap = {}, cmap = {}, pmap = {}
  seed.variants.forEach(v => { vmap[v.id] = randomUUID() })
  seed.shows.forEach(x => { smap[x.id] = randomUUID() })
  seed.categories.forEach(c => { cmap[c.id] = randomUUID() })
  seed.positions.forEach(p => { pmap[p.id] = randomUUID() })

  const project = {
    id: pid, tenant_id: tenantId, name: seed.project.name, year: seed.project.year ?? null,
    currency: seed.project.currency || 'EUR',
    fuel_consumption: s(seed.project.fuel_consumption) ?? '15',
    fuel_price: s(seed.project.fuel_price) ?? '2.600',
    scenario_factor: s(seed.project.scenario_factor) ?? '1',
    member_count: seed.project.member_count ?? 1,
    default_variant_id: seed.project.default_variant_id ? vmap[seed.project.default_variant_id] : null,
  }
  // Generische Namen „Variante 1/2/…" (nach sort_order); IDs bleiben gemappt.
  const variants = seed.variants
    .slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((v, i) => ({ id: vmap[v.id], project_id: pid, name: `Variante ${i + 1}`, sort_order: v.sort_order ?? (i + 1) }))
  const shows = seed.shows.map(x => ({
    id: smap[x.id], project_id: pid, sort_order: x.sort_order ?? 0,
    show_date: x.show_date ?? null, city: x.city ?? null, venue: x.venue ?? null,
    capacity: x.capacity ?? null, vvk: x.vvk ?? null, ticket_price: s(x.ticket_price),
    guarantee: s(x.guarantee) ?? '0', deal_share: s(x.deal_share) ?? '0',
    break_even: s(x.break_even) ?? '0', commission: s(x.commission) ?? '0',
    deal_type: x.deal_type || 'vs', is_active: x.is_active === false ? 0 : 1, note: x.note ?? null,
  }))
  const categories = seed.categories.map(c => ({ id: cmap[c.id], project_id: pid, name: c.name, kind: c.kind, sort_order: c.sort_order ?? 0 }))
  const positions = seed.positions.map(p => ({ id: pmap[p.id], category_id: cmap[p.category_id], name: p.name, spec: null, sort_order: p.sort_order ?? 0 }))
  const entries = seed.entries.map(e => ({
    id: randomUUID(), project_id: pid,
    show_id: e.show_id ? smap[e.show_id] : null,
    position_id: pmap[e.position_id],
    variant_id: e.variant_id ? vmap[e.variant_id] : null,
    quantity: s(e.quantity), unit_price: s(e.unit_price),
    distance_km: s(e.distance_km), rental_price: s(e.rental_price),
    included_km: s(e.included_km), price_extra_km: s(e.price_extra_km),
    amount: s(e.amount), kind: 'base', ist_amount: s(e.ist_amount), note: e.note ?? null,
  }))
  return { project, variants, shows, categories, positions, entries }
}

/** Zeilen in die DB schreiben (sequentiell, für Import ausreichend). */
async function insertRows(db, r) {
  const p = r.project
  await db.run(
    `INSERT INTO calc_projects (id,tenant_id,name,year,currency,fuel_consumption,fuel_price,scenario_factor,member_count,default_variant_id)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [p.id, p.tenant_id, p.name, p.year, p.currency, p.fuel_consumption, p.fuel_price, p.scenario_factor, p.member_count, p.default_variant_id])
  for (const v of r.variants)
    await db.run(`INSERT INTO calc_variants (id,project_id,name,sort_order) VALUES (?,?,?,?)`, [v.id, v.project_id, v.name, v.sort_order])
  for (const x of r.shows)
    await db.run(
      `INSERT INTO calc_shows (id,project_id,sort_order,show_date,city,venue,capacity,vvk,ticket_price,guarantee,deal_share,break_even,commission,deal_type,is_active,note)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [x.id, x.project_id, x.sort_order, x.show_date, x.city, x.venue, x.capacity, x.vvk ?? null, x.ticket_price, x.guarantee, x.deal_share, x.break_even, x.commission, x.deal_type, x.is_active, x.note])
  for (const c of r.categories)
    await db.run(`INSERT INTO calc_categories (id,project_id,name,kind,sort_order) VALUES (?,?,?,?,?)`, [c.id, c.project_id, c.name, c.kind, c.sort_order])
  for (const p2 of r.positions)
    await db.run(`INSERT INTO calc_positions (id,category_id,name,spec,sort_order) VALUES (?,?,?,?,?)`, [p2.id, p2.category_id, p2.name, p2.spec ?? null, p2.sort_order])
  for (const e of r.entries)
    await db.run(
      `INSERT INTO calc_entries (id,project_id,show_id,position_id,variant_id,quantity,unit_price,distance_km,rental_price,included_km,price_extra_km,amount,kind,ist_amount,note)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [e.id, e.project_id, e.show_id, e.position_id, e.variant_id, e.quantity, e.unit_price, e.distance_km, e.rental_price, e.included_km, e.price_extra_km, e.amount, e.kind || 'base', e.ist_amount, e.note])
}

/** Roh-Zeilen → CalcDataset-Form (is_active als Boolean). Pur, ohne DB (für Tests). */
function rowsToDataset(rows) {
  return {
    project: rows.project,
    variants: rows.variants,
    shows: rows.shows.map(x => ({ ...x, is_active: x.is_active === 1 || x.is_active === true, locked: x.locked === 1 || x.locked === true })),
    categories: rows.categories,
    positions: rows.positions.map(x => ({ ...x, is_overhead: x.is_overhead === 1 || x.is_overhead === true })),
    entries: rows.entries,
    actuals: rows.actuals || [],
    overheadExclude: rows.overheadExclude || [],
  }
}

/** Vollständigen Datensatz eines Projekts laden (für den Rechenkern). */
async function loadDataset(db, projectId) {
  const project = await db.get(`SELECT * FROM calc_projects WHERE id=?`, [projectId])
  if (!project) return null
  const variants = await db.all(`SELECT * FROM calc_variants WHERE project_id=? ORDER BY sort_order`, [projectId])
  const shows = await db.all(`SELECT * FROM calc_shows WHERE project_id=? ORDER BY sort_order`, [projectId])
  const categories = await db.all(`SELECT * FROM calc_categories WHERE project_id=? ORDER BY sort_order`, [projectId])
  const positions = await db.all(
    `SELECT p.* FROM calc_positions p JOIN calc_categories c ON c.id=p.category_id WHERE c.project_id=? ORDER BY p.sort_order`, [projectId])
  const entries = await db.all(`SELECT * FROM calc_entries WHERE project_id=?`, [projectId])
  const actuals = await db.all(
    `SELECT a.* FROM calc_actuals a JOIN calc_shows s ON s.id = a.show_id WHERE s.project_id=?`, [projectId])
  const overheadExclude = await db.all(
    `SELECT oe.position_id, oe.show_id FROM calc_overhead_exclude oe
       JOIN calc_positions p ON p.id = oe.position_id
       JOIN calc_categories c ON c.id = p.category_id WHERE c.project_id=?`, [projectId])
  return rowsToDataset({ project, variants, shows, categories, positions, entries, actuals, overheadExclude })
}

/** Projektliste eines Tenants (Kurzform). */
async function listProjects(db, tenantId) {
  return db.all(`SELECT id, name, year, currency FROM calc_projects WHERE tenant_id=? ORDER BY created_at DESC, name`, [tenantId])
}

// Standard-Bereiche für ein neues (leeres) Projekt.
const DEFAULT_CATEGORIES = [
  { name: 'BUYOUTS & SPONSORING', kind: 'income' },
  { name: 'TOURSUPPORT', kind: 'expense' },
  { name: 'PERSONAL', kind: 'expense' },
  { name: 'TRANSPORT & LOGISTIK', kind: 'expense' },
  { name: 'UNTERKUNFT & VERPFLEGUNG', kind: 'expense' },
  { name: 'TECHNIK & PRODUKTION', kind: 'expense' },
  { name: 'SONSTIGE KOSTEN', kind: 'expense' },
  { name: 'ANSCHAFFUNGEN', kind: 'expense' },
]

module.exports = { SCHEMA, buildImportRows, insertRows, rowsToDataset, loadDataset, listProjects, DEFAULT_CATEGORIES }
