/**
 * ProTouring Server – Consolidated
 *
 * DB:      SQLite (local dev) → .env für Production-DB Wechsel
 * Auth:    JWT (7d) via Authorization: Bearer <token>
 * Tenant:  X-Tenant-Slug Header für alle tenant-spezifischen Routen
 * Port:    3002
 */

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// ============================================
// FUNCTION CATALOG (vordefiniert, unveränderlich)
// ============================================

const FUNCTION_CATALOG = [
  {
    group: 'Talente & Akteure',
    functions: [
      'Artist', 'Band', 'Orchester', 'Musikalische Leitung', 'Dance Artist',
      'Speaker', 'Foley', 'Vorprogramm', 'Feature Act',
    ],
  },
  {
    group: 'Management',
    functions: [
      'Booking', 'Künstlermanagement', 'Künstlerassistenz', 'Künstlerbetreuung',
      'Tourmanagement', 'TM Assistenz', 'Tourbegleitung',
      'Regie', 'Regieassistenz', 'Castmanagement',
      'Pressemanagement', 'Projektkoordination', 'Produktionsmanagement', 'Hospitality',
    ],
  },
  {
    group: 'Technik',
    functions: [
      'Ableton Operator', 'Audiorecording', 'Backline', 'Bühnenbau', 'Deko',
      'Followspot', 'Frequenzmanagement', 'Kamera', 'Kinetiksystemtechnik', 'Kinetikoperator',
      'LED Technik', 'Lichtsystemtechnik', 'Lichtdesign', 'Lichttechnik', 'Lightoperating',
      'Netzwerktechnik', 'Produktionsleitung', 'Projektleitung', 'Pyrotechnik',
      'Rigging', 'Setbau', 'Sound Operating', 'Sound Operating FOH', 'Sound Operating Monitor',
      'Sounddesign', 'Spezialeffekte', 'Stagehand', 'Stagemanagement',
      'Technische Leitung', 'Tonassistenz', 'Tonsystemtechnik', 'Tontechnik',
      'Veranstaltungstechnik', 'Videotechnik', 'Videooperating',
      'Bühnenmeister', 'Örtl. Technische Leitung',
    ],
  },
  {
    group: 'Driver',
    functions: [
      'Artist Driver', 'Nightliner Driver', 'Truck Driver', 'Van Driver',
    ],
  },
  {
    group: 'Sonstige',
    functions: [
      'Assistenz örtlich', 'Autor*in', 'Awareness', 'Backoffice', 'Buchhaltung',
      'Catering', 'Choreografie', 'Creative Director', 'Fotografie',
      'Garderobenhilfe', 'Gast', 'Helfer', 'Label Rep',
      'Make-up Artist', 'Merchandise', 'Näher*in', 'Physiotherapie',
      'Presse', 'Sicherheit', 'Show Design', 'Social Media',
      'Special Guest', 'Stylist*in', 'Videografie', 'VIP',
    ],
  },
];

const JWT_SECRET = process.env.JWT_SECRET || 'protouring_dev_secret_change_in_production';

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({
  origin: [
    'http://localhost:3001',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================
// FILE UPLOAD SETUP
// ============================================

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer für neue /api/files Endpoints (entity-basiert)
const fileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tenantId = req.tenant ? String(req.tenant.id) : 'default';
    const entityType = req.params.entityType || 'general';
    const entityId = req.params.entityId || 'default';
    const uploadPath = path.join(__dirname, 'uploads', tenantId, entityType, entityId);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniquePrefix = Date.now() + '_' + Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname);
    cb(null, `${uniquePrefix}${ext}`);
  }
});

const fileUpload = multer({
  storage: fileStorage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max (pro Datei-Limit wird im Endpoint geprüft)
});

// Legacy Multer für alte /api/uploads Endpoints (wird noch benötigt bis Migration abgeschlossen)
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const category = req.params.category || 'general';
    const userId = req.user ? String(req.user.id) : (req.params.userId || 'default');
    const uploadPath = path.join(__dirname, 'uploads', category, userId);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniquePrefix = Date.now();
    cb(null, `${uniquePrefix}_${file.originalname}`);
  }
});

const upload = multer({
  storage: multerStorage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ============================================
// DATABASE SETUP
// ============================================

let db;

async function initDatabase() {
  db = await open({
    filename: path.join(__dirname, 'protouring.db'),
    driver: sqlite3.Database
  });

  await db.run('PRAGMA foreign_keys = ON');

  // --- Core tables (from existing schema) ---
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS subscription_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      monthly_price REAL,
      yearly_price REAL,
      features TEXT,
      max_users INTEGER DEFAULT 10,
      max_storage_mb INTEGER DEFAULT 1024,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS add_ons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL,
      billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly', 'once')),
      features TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      description TEXT,
      logo_url TEXT,
      website TEXT,
      social_links TEXT,
      status TEXT DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      trial_ends_at DATETIME,
      billing_cycle TEXT DEFAULT 'yearly' CHECK (billing_cycle IN ('monthly', 'yearly'))
    );

    CREATE TABLE IF NOT EXISTS tenant_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      plan_id INTEGER NOT NULL,
      status TEXT DEFAULT 'trial' CHECK (status IN ('active', 'cancelled', 'expired', 'trial')),
      current_period_start DATETIME,
      current_period_end DATETIME,
      cancelled_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
    );

    CREATE TABLE IF NOT EXISTS user_tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      tenant_id INTEGER NOT NULL,
      role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
      permissions TEXT,
      invited_by INTEGER,
      invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      joined_at DATETIME,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'removed')),
      last_login_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      UNIQUE(user_id, tenant_id)
    );

  `);

  // --- Tour data tables ---
  await db.exec(`
    CREATE TABLE IF NOT EXISTS venues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      street TEXT,
      postal_code TEXT,
      city TEXT,
      state TEXT,
      country TEXT,
      website TEXT,
      arrival TEXT,
      arrival_street TEXT,
      arrival_postal_code TEXT,
      arrival_city TEXT,
      capacity TEXT,
      capacity_seated TEXT,
      stage_dimensions TEXT,
      clearance_height TEXT,
      merchandise_fee TEXT,
      merchandise_stand TEXT,
      wardrobe TEXT,
      showers TEXT,
      wifi TEXT,
      parking TEXT,
      nightliner_parking TEXT,
      loading_path TEXT,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_venues_tenant ON venues(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_venues_city ON venues(city);
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      function1 TEXT,
      function2 TEXT,
      function3 TEXT,
      specification TEXT,
      access_rights TEXT,
      email TEXT,
      phone TEXT,
      mobile TEXT,
      address TEXT,
      postal_code TEXT,
      residence TEXT,
      tax_id TEXT,
      website TEXT,
      birth_date TEXT,
      gender TEXT,
      pronouns TEXT,
      birth_place TEXT,
      nationality TEXT,
      id_number TEXT,
      social_security TEXT,
      diet TEXT,
      gluten_free INTEGER DEFAULT 0,
      lactose_free INTEGER DEFAULT 0,
      allergies TEXT,
      emergency_contact TEXT,
      emergency_phone TEXT,
      shirt_size TEXT,
      hoodie_size TEXT,
      pants_size TEXT,
      shoe_size TEXT,
      languages TEXT,
      drivers_license TEXT,
      railcard TEXT,
      frequent_flyer TEXT,
      bank_account TEXT,
      bank_iban TEXT,
      bank_bic TEXT,
      tax_number TEXT,
      vat_id TEXT,
      crew_tool_active INTEGER DEFAULT 1,
      hourly_rate REAL,
      daily_rate REAL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id);

    CREATE TABLE IF NOT EXISTS hotels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      street TEXT,
      postal_code TEXT,
      city TEXT,
      state TEXT,
      country TEXT,
      email TEXT,
      phone TEXT,
      website TEXT,
      reception TEXT,
      check_in TEXT,
      check_out TEXT,
      early_check_in TEXT,
      late_check_out TEXT,
      breakfast TEXT,
      breakfast_weekend TEXT,
      additional_info TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_hotels_tenant ON hotels(tenant_id);

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      designation TEXT NOT NULL,
      vehicle_type TEXT,
      driver TEXT,
      license_plate TEXT,
      dimensions TEXT,
      power_connection TEXT,
      has_trailer INTEGER DEFAULT 0,
      trailer_dimensions TEXT,
      trailer_license_plate TEXT,
      seats TEXT,
      sleeping_places TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_vehicles_tenant ON vehicles(tenant_id);

    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      type TEXT,
      company_name TEXT NOT NULL,
      street TEXT,
      postal_code TEXT,
      city TEXT,
      state TEXT,
      country TEXT,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      tax_id TEXT,
      billing_address TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_partners_tenant ON partners(tenant_id);
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS termine (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      city TEXT,
      venue_id INTEGER,
      partner_id INTEGER,
      announcement TEXT,
      capacity INTEGER,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL,
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_termine_tenant ON termine(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_termine_date ON termine(date);

    CREATE TABLE IF NOT EXISTS termin_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      termin_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT CHECK (status IN ('available', 'maybe', 'unavailable')) DEFAULT NULL,
      comment TEXT,
      booked_status TEXT CHECK (booked_status IN ('confirmed', 'rejected')) DEFAULT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (termin_id) REFERENCES termine(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(termin_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_availability_termin ON termin_availability(termin_id);
    CREATE INDEX IF NOT EXISTS idx_availability_user ON termin_availability(user_id);

    CREATE TABLE IF NOT EXISTS termin_travel_party (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      termin_id INTEGER NOT NULL,
      tenant_id INTEGER NOT NULL,
      contact_id INTEGER NOT NULL,
      role1 TEXT NOT NULL DEFAULT '',
      role2 TEXT NOT NULL DEFAULT '',
      role3 TEXT NOT NULL DEFAULT '',
      specification TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (termin_id) REFERENCES termine(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
      UNIQUE(termin_id, contact_id)
    );
    CREATE INDEX IF NOT EXISTS idx_travel_party_termin ON termin_travel_party(termin_id);
    CREATE INDEX IF NOT EXISTS idx_travel_party_contact ON termin_travel_party(contact_id);

    CREATE TABLE IF NOT EXISTS termin_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      termin_id INTEGER NOT NULL,
      tenant_id INTEGER NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      first_name TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (termin_id) REFERENCES termine(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_contacts_termin ON termin_contacts(termin_id);

    CREATE TABLE IF NOT EXISTS termin_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      termin_id INTEGER NOT NULL,
      tenant_id INTEGER NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      not_final BOOLEAN NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (termin_id) REFERENCES termine(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_schedules_termin ON termin_schedules(termin_id);
    CREATE TABLE IF NOT EXISTS boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      title TEXT DEFAULT '',
      content TEXT DEFAULT '',
      not_final BOOLEAN DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_boards_entity ON boards(tenant_id, entity_type, entity_id);
    CREATE TABLE IF NOT EXISTS tenant_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, key)
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      entity_type TEXT NOT NULL DEFAULT 'desk',
      entity_id TEXT NOT NULL DEFAULT 'general',
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_name TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_chat_entity ON chat_messages(tenant_id, entity_type, entity_id, created_at);
  `);

  // Migration: files-Tabelle auf neues Schema (entity_type/entity_id) migrieren
  // Alte Tabelle hatte: category, user_id, filename, file_path - kein entity_type
  const filesColumns = await db.all("PRAGMA table_info(files)");
  const hasEntityType = filesColumns.some(c => c.name === 'entity_type');
  if (filesColumns.length === 0) {
    // Tabelle existiert nicht → neu anlegen
    await db.exec(`
      CREATE TABLE files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
        size INTEGER NOT NULL DEFAULT 0,
        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_files_entity ON files(tenant_id, entity_type, entity_id, category);
    `);
    console.log('✅ files-Tabelle (neu) angelegt');
  } else if (!hasEntityType) {
    // Alte Tabelle → droppen und neu anlegen (nur Metadaten, Dateien werden neu hochgeladen)
    await db.exec(`
      DROP TABLE files;
      CREATE TABLE files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
        size INTEGER NOT NULL DEFAULT 0,
        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_files_entity ON files(tenant_id, entity_type, entity_id, category);
    `);
    console.log('✅ files-Tabelle auf neues Schema migriert');
  }

  // Seed subscription plans if empty
  const planCount = await db.get('SELECT COUNT(*) as count FROM subscription_plans');
  if (planCount.count === 0) {
    await db.exec(`
      INSERT INTO subscription_plans (name, description, monthly_price, yearly_price, features, max_users, max_storage_mb) VALUES
      ('Starter', 'Für Solo-Artists und kleine Bands', 0, 0, '["core_features","5gb_storage","email_support"]', 5, 5120),
      ('Professional', 'Für wachsende Artists und Bands', 0, 790.00, '["all_features","50gb_storage","priority_support"]', 20, 51200),
      ('Enterprise', 'Für etablierte Artists und Labels', 0, 1990.00, '["unlimited_features","unlimited_storage","dedicated_support"]', -1, -1);

      INSERT INTO add_ons (name, description, price, billing_cycle, features) VALUES
      ('Equipment & Cases', 'Equipmentlisten mit Case-Maßen und Gewichten, Carnet ATA Export', 199.00, 'yearly', '["equipment_lists","case_management","carnet_ata_export"]'),
      ('Truck Loading Planner', 'Beladungsplanung mit 2D/3D-Visualisierung, Ladereihenfolge, Label-Druck', 299.00, 'yearly', '["loading_planner","2d_visualization","3d_visualization","label_print","loading_order"]');
    `);
  }

  // Neue Spalten für termine (idempotent – schlägt still fehl wenn schon vorhanden)
  for (const sql of [
    // termine
    `ALTER TABLE termine ADD COLUMN art TEXT`,
    `ALTER TABLE termine ADD COLUMN art_sub TEXT`,
    `ALTER TABLE termine ADD COLUMN status_booking TEXT DEFAULT 'Idee'`,
    `ALTER TABLE termine ADD COLUMN status_public TEXT DEFAULT 'nicht öffentlich'`,
    `ALTER TABLE termine ADD COLUMN show_title_as_header INTEGER DEFAULT 0`,
    // termin_schedules
    `ALTER TABLE termin_schedules ADD COLUMN not_final BOOLEAN NOT NULL DEFAULT 0`,
    // contacts: user_id FK + fehlende Profilfelder
    `ALTER TABLE contacts ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`,
    `ALTER TABLE contacts ADD COLUMN hotel_info TEXT`,
    `ALTER TABLE contacts ADD COLUMN hotel_alias TEXT`,
    // users: globale Profilfelder
    `ALTER TABLE users ADD COLUMN mobile TEXT`,
    `ALTER TABLE users ADD COLUMN address TEXT`,
    `ALTER TABLE users ADD COLUMN postal_code TEXT`,
    `ALTER TABLE users ADD COLUMN residence TEXT`,
    `ALTER TABLE users ADD COLUMN birth_date TEXT`,
    `ALTER TABLE users ADD COLUMN gender TEXT`,
    `ALTER TABLE users ADD COLUMN pronouns TEXT`,
    `ALTER TABLE users ADD COLUMN birth_place TEXT`,
    `ALTER TABLE users ADD COLUMN nationality TEXT`,
    `ALTER TABLE users ADD COLUMN id_number TEXT`,
    `ALTER TABLE users ADD COLUMN tax_id TEXT`,
    `ALTER TABLE users ADD COLUMN social_security TEXT`,
    `ALTER TABLE users ADD COLUMN tax_number TEXT`,
    `ALTER TABLE users ADD COLUMN vat_id TEXT`,
    `ALTER TABLE users ADD COLUMN diet TEXT`,
    `ALTER TABLE users ADD COLUMN gluten_free INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN lactose_free INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN allergies TEXT`,
    `ALTER TABLE users ADD COLUMN special_notes TEXT`,
    `ALTER TABLE users ADD COLUMN emergency_contact TEXT`,
    `ALTER TABLE users ADD COLUMN emergency_phone TEXT`,
    `ALTER TABLE users ADD COLUMN shirt_size TEXT`,
    `ALTER TABLE users ADD COLUMN hoodie_size TEXT`,
    `ALTER TABLE users ADD COLUMN pants_size TEXT`,
    `ALTER TABLE users ADD COLUMN shoe_size TEXT`,
    `ALTER TABLE users ADD COLUMN hotel_info TEXT`,
    `ALTER TABLE users ADD COLUMN hotel_alias TEXT`,
    `ALTER TABLE users ADD COLUMN languages TEXT`,
    `ALTER TABLE users ADD COLUMN drivers_license TEXT`,
    `ALTER TABLE users ADD COLUMN railcard TEXT`,
    `ALTER TABLE users ADD COLUMN frequent_flyer TEXT`,
    `ALTER TABLE users ADD COLUMN bank_account TEXT`,
    `ALTER TABLE users ADD COLUMN bank_iban TEXT`,
    `ALTER TABLE users ADD COLUMN bank_bic TEXT`,
    `ALTER TABLE users ADD COLUMN website TEXT`,
    // termin_contacts: Vorname + Bemerkung
    `ALTER TABLE termin_contacts ADD COLUMN first_name TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE termin_contacts ADD COLUMN notes TEXT NOT NULL DEFAULT ''`,
    // tenants: Artist-Einstellungen
    `ALTER TABLE tenants ADD COLUMN display_name TEXT DEFAULT ''`,
    `ALTER TABLE tenants ADD COLUMN short_code TEXT DEFAULT ''`,
    `ALTER TABLE tenants ADD COLUMN homebase TEXT DEFAULT ''`,
    `ALTER TABLE tenants ADD COLUMN genre TEXT DEFAULT ''`,
    // tenants: Rechnungsanschrift
    `ALTER TABLE tenants ADD COLUMN billing_company TEXT DEFAULT ''`,
    `ALTER TABLE tenants ADD COLUMN billing_first_name TEXT DEFAULT ''`,
    `ALTER TABLE tenants ADD COLUMN billing_last_name TEXT DEFAULT ''`,
    `ALTER TABLE tenants ADD COLUMN billing_address TEXT DEFAULT ''`,
    `ALTER TABLE tenants ADD COLUMN billing_postal_code TEXT DEFAULT ''`,
    `ALTER TABLE tenants ADD COLUMN billing_city TEXT DEFAULT ''`,
    `ALTER TABLE tenants ADD COLUMN billing_phone TEXT DEFAULT ''`,
    `ALTER TABLE tenants ADD COLUMN billing_tax_id TEXT DEFAULT ''`,
    `ALTER TABLE tenants ADD COLUMN billing_email TEXT DEFAULT ''`,
    // users: Format-Einstellungen (user-global)
    `ALTER TABLE users ADD COLUMN format_language TEXT DEFAULT 'de-DE'`,
    `ALTER TABLE users ADD COLUMN format_timezone TEXT DEFAULT 'Europe/Berlin'`,
    `ALTER TABLE users ADD COLUMN format_currency TEXT DEFAULT 'EUR'`,
    // Superadmin
    `ALTER TABLE users ADD COLUMN is_superadmin INTEGER DEFAULT 0`,
    // Feedback: Bemerkung des Superadmins
    `ALTER TABLE feedback_items ADD COLUMN bemerkung TEXT`,
  ]) { try { await db.run(sql) } catch { /* already exists */ } }

  // Superadmin-Account sicherstellen (admin@protouring.de)
  const superadmin = await db.get(`SELECT id FROM users WHERE email = 'admin@protouring.de'`)
  if (!superadmin) {
    const hash = await bcrypt.hash('ProTouring2026!', 10)
    await db.run(
      `INSERT INTO users (email, password_hash, first_name, last_name, is_superadmin) VALUES (?, ?, 'ProTouring', 'Admin', 1)`,
      ['admin@protouring.de', hash]
    )
    console.log('✅ Superadmin admin@protouring.de angelegt')
  } else {
    await db.run(`UPDATE users SET is_superadmin = 1 WHERE email = 'admin@protouring.de'`)
  }

  // Bestehende Kontakte ohne crew_tool_active auf 1 setzen (rückwirkend)
  await db.run(`UPDATE contacts SET crew_tool_active = 1 WHERE crew_tool_active IS NULL`)

  // Travel legs (Anreise / Rückreise)
  await db.run(`
    CREATE TABLE IF NOT EXISTS termin_travel_legs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      termin_id INTEGER NOT NULL,
      tenant_id INTEGER NOT NULL,
      leg_type TEXT NOT NULL DEFAULT 'arrival',
      transport_type TEXT NOT NULL DEFAULT 'vehicle',
      vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
      train_number TEXT DEFAULT '',
      train_booking_code TEXT DEFAULT '',
      train_platform TEXT DEFAULT '',
      train_from TEXT DEFAULT '',
      train_to TEXT DEFAULT '',
      flight_number TEXT DEFAULT '',
      flight_booking_code TEXT DEFAULT '',
      flight_terminal TEXT DEFAULT '',
      flight_airport_from TEXT DEFAULT '',
      flight_airport_to TEXT DEFAULT '',
      other_transport TEXT DEFAULT '',
      from_location TEXT DEFAULT '',
      to_location TEXT DEFAULT '',
      distance_km REAL,
      travel_time_minutes INTEGER,
      departure_date TEXT DEFAULT '',
      departure_time TEXT DEFAULT '',
      arrival_date TEXT DEFAULT '',
      arrival_time TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      visibility_restricted INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_travel_legs_termin ON termin_travel_legs(termin_id)`)

  await db.run(`
    CREATE TABLE IF NOT EXISTS termin_travel_leg_persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leg_id INTEGER NOT NULL REFERENCES termin_travel_legs(id) ON DELETE CASCADE,
      travel_party_member_id INTEGER NOT NULL REFERENCES termin_travel_party(id) ON DELETE CASCADE,
      tenant_id INTEGER NOT NULL,
      UNIQUE(leg_id, travel_party_member_id)
    )
  `)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_leg_persons_leg ON termin_travel_leg_persons(leg_id)`)

  // Hotel stays: ein Eintrag pro Hotel pro Termin (Parent)
  await db.run(`
    CREATE TABLE IF NOT EXISTS termin_hotel_stays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      termin_id INTEGER NOT NULL,
      tenant_id INTEGER NOT NULL,
      hotel_id INTEGER REFERENCES hotels(id) ON DELETE SET NULL,
      check_in_date TEXT DEFAULT '',
      check_out_date TEXT DEFAULT '',
      booking_code TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      visibility_restricted INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_hotel_stays_termin ON termin_hotel_stays(termin_id)`)

  // Hotel rooms: Zimmer innerhalb eines Stays (Child)
  await db.run(`
    CREATE TABLE IF NOT EXISTS termin_hotel_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stay_id INTEGER NOT NULL REFERENCES termin_hotel_stays(id) ON DELETE CASCADE,
      tenant_id INTEGER NOT NULL,
      room_type TEXT NOT NULL DEFAULT 'einzelzimmer',
      room_label TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_hotel_rooms_stay ON termin_hotel_rooms(stay_id)`)

  // Personen pro Zimmer
  await db.run(`
    CREATE TABLE IF NOT EXISTS termin_hotel_room_persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL REFERENCES termin_hotel_rooms(id) ON DELETE CASCADE,
      travel_party_member_id INTEGER NOT NULL REFERENCES termin_travel_party(id) ON DELETE CASCADE,
      tenant_id INTEGER NOT NULL,
      UNIQUE(room_id, travel_party_member_id)
    )
  `)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_room_persons_room ON termin_hotel_room_persons(room_id)`)

  // contact_type: 'crew' (default) oder 'guest'
  try { await db.run(`ALTER TABLE contacts ADD COLUMN contact_type TEXT NOT NULL DEFAULT 'crew'`) } catch {}
  await db.run(`UPDATE contacts SET contact_type = 'crew' WHERE contact_type IS NULL`)

  // invite_pending: Kontakt wurde eingeladen aber hat noch nicht angenommen
  try { await db.run(`ALTER TABLE contacts ADD COLUMN invite_pending INTEGER NOT NULL DEFAULT 0`) } catch {}

  // Tabelle für deaktivierte Funktionen pro Tenant
  await db.run(`
    CREATE TABLE IF NOT EXISTS tenant_disabled_functions (
      tenant_id INTEGER NOT NULL,
      function_name TEXT NOT NULL,
      PRIMARY KEY (tenant_id, function_name),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    )
  `)

  await db.run(`
    CREATE TABLE IF NOT EXISTS termin_todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      termin_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'medium',
      assigned_contact_id INTEGER,
      deadline TEXT,
      created_by_user_id INTEGER,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (termin_id) REFERENCES termine(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_contact_id) REFERENCES contacts(id) ON DELETE SET NULL
    )
  `)

  // Catering
  await db.run(`
    CREATE TABLE IF NOT EXISTS termin_catering (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      termin_id INTEGER NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'none',
      buyout_amount REAL,
      notes TEXT,
      contact_name TEXT,
      contact_phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (termin_id) REFERENCES termine(id) ON DELETE CASCADE
    )
  `)

  await db.run(`
    CREATE TABLE IF NOT EXISTS termin_catering_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      termin_id INTEGER NOT NULL,
      contact_id INTEGER,
      contact_name TEXT,
      order_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (termin_id) REFERENCES termine(id) ON DELETE CASCADE
    )
  `)

  // Buchungs-Absagen (explizit abgesagt, persistent)
  await db.run(`
    CREATE TABLE IF NOT EXISTS termin_booking_rejections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      termin_id INTEGER NOT NULL REFERENCES termine(id) ON DELETE CASCADE,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(termin_id, contact_id, tenant_id)
    )
  `)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_booking_rej_termin ON termin_booking_rejections(termin_id)`)

  // invite_tokens
  await db.run(`
    CREATE TABLE IF NOT EXISTS invite_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'crew',
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      invited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    )
  `)

  await db.run(`
    CREATE TABLE IF NOT EXISTS feedback_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_name TEXT NOT NULL,
      tenant_name TEXT,
      topic TEXT NOT NULL,
      description TEXT,
      private INTEGER DEFAULT 0,
      status TEXT DEFAULT 'open',
      bemerkung TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Rollen-Migration: user_tenants CHECK-Constraint auf neue Rollen aktualisieren
  const utSchema = await db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='user_tenants'")
  if (utSchema && utSchema.sql && utSchema.sql.includes("'owner'")) {
    console.log('🔄 Migriere user_tenants Rollen...')
    await db.run('PRAGMA foreign_keys = OFF')
    await db.run('BEGIN TRANSACTION')
    try {
      await db.run(`CREATE TABLE user_tenants_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        tenant_id INTEGER NOT NULL,
        role TEXT DEFAULT 'crew' CHECK (role IN ('admin','agency','tourmanagement','artist','crew_plus','crew','guest')),
        permissions TEXT,
        invited_by INTEGER,
        invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        joined_at DATETIME,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','inactive','removed')),
        last_login_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        UNIQUE(user_id, tenant_id)
      )`)
      await db.run(`INSERT INTO user_tenants_new
        SELECT id, user_id, tenant_id,
          CASE role
            WHEN 'owner'   THEN 'admin'
            WHEN 'manager' THEN 'tourmanagement'
            WHEN 'member'  THEN 'crew'
            WHEN 'viewer'  THEN 'guest'
            ELSE role
          END,
          permissions, invited_by, invited_at, joined_at, status, last_login_at
        FROM user_tenants`)
      await db.run('DROP TABLE user_tenants')
      await db.run('ALTER TABLE user_tenants_new RENAME TO user_tenants')
      await db.run('COMMIT')
      console.log('✅ user_tenants Rollen migriert')
    } catch (err) {
      await db.run('ROLLBACK')
      throw err
    } finally {
      await db.run('PRAGMA foreign_keys = ON')
    }
  }

  // Kontakte per E-Mail mit User verknüpfen (falls user_id noch nicht gesetzt)
  // Läuft bei jedem Server-Start – ist idempotent
  const linked = await db.run(`
    UPDATE contacts
    SET user_id = (SELECT id FROM users WHERE users.email = contacts.email)
    WHERE user_id IS NULL
      AND email IS NOT NULL
      AND email != ''
      AND EXISTS (SELECT 1 FROM users WHERE users.email = contacts.email)
  `);
  if (linked.changes > 0) {
    console.log(`🔗 ${linked.changes} Kontakt(e) per E-Mail mit User verknüpft`);
  }

  // Globale Profilfelder aus contacts → users synchronisieren (einmalige Migration)
  // Kopiert Felder aus dem aktuellsten Kontakt-Eintrag eines Users in die users-Tabelle,
  // wenn das Feld in users noch leer ist. Idempotent.
  const globalFields = [
    'phone', 'mobile', 'address', 'postal_code', 'residence', 'tax_id', 'website',
    'birth_date', 'gender', 'pronouns', 'birth_place', 'nationality',
    'id_number', 'social_security', 'diet', 'gluten_free', 'lactose_free',
    'allergies', 'emergency_contact', 'emergency_phone',
    'shirt_size', 'hoodie_size', 'pants_size', 'shoe_size',
    'languages', 'drivers_license', 'railcard', 'frequent_flyer',
    'bank_account', 'bank_iban', 'bank_bic', 'tax_number', 'vat_id',
  ];
  for (const field of globalFields) {
    await db.run(`
      UPDATE users
      SET ${field} = (
        SELECT c.${field} FROM contacts c
        WHERE c.user_id = users.id
          AND c.${field} IS NOT NULL AND c.${field} != ''
        ORDER BY c.updated_at DESC
        LIMIT 1
      )
      WHERE (${field} IS NULL OR ${field} = '')
        AND EXISTS (
          SELECT 1 FROM contacts c
          WHERE c.user_id = users.id
            AND c.${field} IS NOT NULL AND c.${field} != ''
        )
    `);
  }
  // first_name / last_name separat (kommen von contacts)
  await db.run(`
    UPDATE users SET first_name = (
      SELECT c.first_name FROM contacts c WHERE c.user_id = users.id AND c.first_name != '' ORDER BY c.updated_at DESC LIMIT 1
    ) WHERE (first_name IS NULL OR first_name = '')
      AND EXISTS (SELECT 1 FROM contacts c WHERE c.user_id = users.id AND c.first_name != '')
  `);
  await db.run(`
    UPDATE users SET last_name = (
      SELECT c.last_name FROM contacts c WHERE c.user_id = users.id AND c.last_name != '' ORDER BY c.updated_at DESC LIMIT 1
    ) WHERE (last_name IS NULL OR last_name = '')
      AND EXISTS (SELECT 1 FROM contacts c WHERE c.user_id = users.id AND c.last_name != '')
  `);
  // special_notes aus contacts.notes (Besonderheiten)
  await db.run(`
    UPDATE users SET special_notes = (
      SELECT c.notes FROM contacts c WHERE c.user_id = users.id AND c.notes IS NOT NULL AND c.notes != '' ORDER BY c.updated_at DESC LIMIT 1
    ) WHERE (special_notes IS NULL OR special_notes = '')
      AND EXISTS (SELECT 1 FROM contacts c WHERE c.user_id = users.id AND c.notes IS NOT NULL AND c.notes != '')
  `);
  console.log('🔄 Globale Profilfelder contacts → users synchronisiert');

  // Gästelisten
  await db.run(`
    CREATE TABLE IF NOT EXISTS guest_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      termin_id INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT 'Gästeliste',
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked')),
      settings TEXT NOT NULL DEFAULT '{}',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (termin_id) REFERENCES termine(id) ON DELETE CASCADE
    )
  `)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_guest_lists_termin ON guest_lists(termin_id)`)

  await db.run(`
    CREATE TABLE IF NOT EXISTS guest_list_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guest_list_id INTEGER NOT NULL,
      tenant_id INTEGER NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      company TEXT,
      invited_by_text TEXT,
      invited_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      email TEXT,
      passes TEXT NOT NULL DEFAULT '{}',
      is_wish INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
      notes TEXT,
      created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (guest_list_id) REFERENCES guest_lists(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    )
  `)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_guest_list_entries_list ON guest_list_entries(guest_list_id)`)

  console.log('✅ Database initialized');
}

// ============================================
// AUTH MIDDLEWARE
// ============================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Tenant middleware – reads X-Tenant-Slug header, verifies user has access
const requireTenant = async (req, res, next) => {
  const tenantSlug = req.headers['x-tenant-slug'];
  if (!tenantSlug) {
    return res.status(400).json({ error: 'X-Tenant-Slug header required' });
  }

  try {
    // Superadmin: Zugriff auf jeden Tenant ohne Membership-Eintrag
    if (req.user.isSuperadmin) {
      const tenant = await db.get(`SELECT id, name, slug, status FROM tenants WHERE slug = ?`, [tenantSlug]);
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
      req.tenant = { ...tenant, role: 'admin', memberStatus: 'active' };
      return next();
    }

    // Erst ohne Status-Filter prüfen ob der User überhaupt zu diesem Tenant gehört
    const membership = await db.get(`
      SELECT t.id, t.name, t.slug, t.status, ut.role, ut.status AS memberStatus
      FROM tenants t
      JOIN user_tenants ut ON t.id = ut.tenant_id
      WHERE t.slug = ? AND ut.user_id = ? AND ut.status IN ('active', 'inactive')
    `, [tenantSlug, req.user.id]);

    if (!membership) {
      return res.status(403).json({ error: 'No access to this tenant' });
    }

    if (membership.memberStatus === 'inactive') {
      return res.status(403).json({ error: 'Account deactivated', deactivated: true, tenantName: membership.name });
    }

    req.tenant = membership;
    next();
  } catch (err) {
    console.error('Tenant middleware error:', err);
    res.status(500).json({ error: 'Failed to resolve tenant' });
  }
};

// Schreibrechte: admin, agency, tourmanagement
const requireEditor = (req, res, next) => {
  if (!['admin', 'agency', 'tourmanagement'].includes(req.tenant.role)) {
    return res.status(403).json({ error: 'Keine Schreibberechtigung' })
  }
  next()
}

// ============================================
// HELPERS
// ============================================

const generateSlug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();

const generateUniqueSlug = async (name) => {
  let slug = generateSlug(name);
  let uniqueSlug = slug;
  let counter = 1;
  while (true) {
    const row = await db.get('SELECT id FROM tenants WHERE slug = ?', [uniqueSlug]);
    if (!row) break;
    uniqueSlug = `${slug}-${counter++}`;
  }
  return uniqueSlug;
};

// ============================================
// ROUTES: AUTH
// ============================================

// Register new tenant + owner user
app.post('/api/tenants/register', async (req, res) => {
  const { tenantName, tenantEmail, userFirstName, userLastName, userEmail, password, planId = 1 } = req.body;

  if (!tenantName || !tenantEmail || !userFirstName || !userLastName || !userEmail || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    await db.run('BEGIN TRANSACTION');

    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [userEmail]);
    if (existingUser) { await db.run('ROLLBACK'); return res.status(400).json({ error: 'Email already registered' }); }

    const existingTenant = await db.get('SELECT id FROM tenants WHERE email = ?', [tenantEmail]);
    if (existingTenant) { await db.run('ROLLBACK'); return res.status(400).json({ error: 'Tenant email already exists' }); }

    const slug = await generateUniqueSlug(tenantName);
    const passwordHash = await bcrypt.hash(password, 10);

    const userResult = await db.run(
      'INSERT INTO users (email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?)',
      [userEmail, passwordHash, userFirstName, userLastName]
    );
    const userId = userResult.lastID;

    const tenantResult = await db.run(
      'INSERT INTO tenants (name, slug, email, trial_ends_at) VALUES (?, ?, ?, datetime("now", "+14 days"))',
      [tenantName, slug, tenantEmail]
    );
    const tenantId = tenantResult.lastID;

    await db.run(
      'INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end) VALUES (?, ?, "trial", datetime("now"), datetime("now", "+14 days"))',
      [tenantId, planId]
    );

    await db.run(
      'INSERT INTO user_tenants (user_id, tenant_id, role, status, joined_at) VALUES (?, ?, "admin", "active", datetime("now"))',
      [userId, tenantId]
    );

    const token = jwt.sign({ id: userId, email: userEmail }, JWT_SECRET, { expiresIn: '7d' });

    await db.run('COMMIT');

    res.json({
      token,
      user: { id: userId, email: userEmail, firstName: userFirstName, lastName: userLastName },
      tenant: { id: tenantId, name: tenantName, slug, email: tenantEmail, status: 'trial' }
    });
  } catch (error) {
    await db.run('ROLLBACK');
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Passwort ändern (eingeloggt)
app.put('/api/auth/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Felder fehlen' })
  if (newPassword.length < 6) return res.status(400).json({ error: 'Neues Passwort min. 6 Zeichen' })
  try {
    const user = await db.get('SELECT password_hash FROM users WHERE id=?', [req.user.id])
    if (!user) return res.status(404).json({ error: 'User nicht gefunden' })
    const valid = await bcrypt.compare(currentPassword, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Aktuelles Passwort falsch' })
    const hash = await bcrypt.hash(newPassword, 10)
    await db.run('UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [hash, req.user.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password, tenantSlug } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const user = await db.get(
      'SELECT id, email, password_hash, first_name, last_name, is_superadmin FROM users WHERE email = ?',
      [email]
    );
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    let tenants;
    if (user.is_superadmin) {
      // Superadmin sieht alle Tenants mit virtueller Admin-Rolle
      tenants = await db.all(`SELECT id, name, slug, status, 'admin' as role FROM tenants ORDER BY name`);
    } else {
      const tenantQuery = tenantSlug
        ? `SELECT t.id, t.name, t.slug, t.status, ut.role FROM user_tenants ut
           JOIN tenants t ON ut.tenant_id = t.id
           WHERE ut.user_id = ? AND t.slug = ? AND ut.status = 'active'`
        : `SELECT t.id, t.name, t.slug, t.status, ut.role FROM user_tenants ut
           JOIN tenants t ON ut.tenant_id = t.id
           WHERE ut.user_id = ? AND ut.status = 'active'`;

      tenants = tenantSlug
        ? await db.all(tenantQuery, [user.id, tenantSlug])
        : await db.all(tenantQuery, [user.id]);

      if (tenants.length === 0) return res.status(401).json({ error: 'No active tenant access' });

      // Update last_login_at
      await db.run('UPDATE user_tenants SET last_login_at = datetime("now") WHERE user_id = ?', [user.id]);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, isSuperadmin: !!user.is_superadmin },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, isSuperadmin: !!user.is_superadmin },
      tenants,
      currentTenant: tenants[0]
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================================
// ROUTES: ADMIN USER MANAGEMENT
// ============================================

// Alle User im Tenant auflisten (Admin)
app.get('/api/admin/users', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT u.id, u.email, u.first_name, u.last_name, ut.role, ut.status, ut.last_login_at
      FROM user_tenants ut
      JOIN users u ON ut.user_id = u.id
      WHERE ut.tenant_id = ?
      ORDER BY ut.role, u.last_name, u.first_name
    `, [req.tenant.id]);
    res.json({ users: rows.map(r => ({
      id: r.id, email: r.email,
      firstName: r.first_name, lastName: r.last_name,
      role: r.role, status: r.status, lastLoginAt: r.last_login_at,
    })) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Neuen User anlegen + zum Tenant hinzufügen (Admin)
app.post('/api/admin/users', authenticateToken, requireTenant, async (req, res) => {
  const { email, password, firstName, lastName, role = 'member', contactId } = req.body;
  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'email, password, firstName und lastName sind erforderlich' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });
  }
  try {
    await db.run('BEGIN TRANSACTION');

    // Prüfen ob E-Mail schon vergeben
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      // User existiert bereits — nur zum Tenant hinzufügen wenn noch nicht Mitglied
      const alreadyMember = await db.get(
        'SELECT id FROM user_tenants WHERE user_id = ? AND tenant_id = ?',
        [existing.id, req.tenant.id]
      );
      if (alreadyMember) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'User ist bereits Mitglied dieses Tenants' });
      }
      await db.run(
        'INSERT INTO user_tenants (user_id, tenant_id, role, status, joined_at) VALUES (?, ?, ?, "active", datetime("now"))',
        [existing.id, req.tenant.id, role]
      );
      if (contactId) {
        await db.run('UPDATE contacts SET user_id = ? WHERE id = ? AND tenant_id = ?', [existing.id, contactId, req.tenant.id]);
      }
      await db.run('COMMIT');
      return res.json({ userId: existing.id, message: 'Bestehender User zum Tenant hinzugefügt' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO users (email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?)',
      [email, passwordHash, firstName, lastName]
    );
    const userId = result.lastID;

    await db.run(
      'INSERT INTO user_tenants (user_id, tenant_id, role, status, joined_at) VALUES (?, ?, ?, "active", datetime("now"))',
      [userId, req.tenant.id, role]
    );

    if (contactId) {
      await db.run('UPDATE contacts SET user_id = ? WHERE id = ? AND tenant_id = ?', [userId, contactId, req.tenant.id]);
    }

    await db.run('COMMIT');
    res.status(201).json({ userId, message: 'User erfolgreich angelegt' });
  } catch (e) {
    await db.run('ROLLBACK');
    console.error('Create user error:', e);
    res.status(500).json({ error: 'Fehler beim Anlegen des Users' });
  }
});

// Passwort eines Users zurücksetzen (Admin)
app.put('/api/admin/users/:userId/password', authenticateToken, requireTenant, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });
  }
  try {
    // Prüfen ob der User zum Tenant gehört
    const member = await db.get(
      'SELECT u.id FROM users u JOIN user_tenants ut ON u.id = ut.user_id WHERE u.id = ? AND ut.tenant_id = ?',
      [req.params.userId, req.tenant.id]
    );
    if (!member) return res.status(404).json({ error: 'User nicht gefunden' });

    const hash = await bcrypt.hash(password, 10);
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.params.userId]);
    res.json({ message: 'Passwort zurückgesetzt' });
  } catch (e) {
    res.status(500).json({ error: 'Fehler beim Zurücksetzen des Passworts' });
  }
});

// ============================================
// ROUTES: MY PROFILE (/api/me)
// ============================================

app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    delete user.password_hash;
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

app.put('/api/me', authenticateToken, async (req, res) => {
  try {
    const {
      first_name, last_name, phone, mobile, address, postal_code, residence,
      birth_date, gender, pronouns, birth_place, nationality, id_number,
      tax_id, social_security, tax_number, vat_id,
      diet, gluten_free, lactose_free, allergies, special_notes,
      emergency_contact, emergency_phone,
      shirt_size, hoodie_size, pants_size, shoe_size,
      hotel_info, hotel_alias,
      languages, drivers_license, railcard, frequent_flyer,
      bank_account, bank_iban, bank_bic, website,
    } = req.body;

    await db.run(`
      UPDATE users SET
        first_name=?, last_name=?, phone=?, mobile=?, address=?, postal_code=?, residence=?,
        birth_date=?, gender=?, pronouns=?, birth_place=?, nationality=?, id_number=?,
        tax_id=?, social_security=?, tax_number=?, vat_id=?,
        diet=?, gluten_free=?, lactose_free=?, allergies=?, special_notes=?,
        emergency_contact=?, emergency_phone=?,
        shirt_size=?, hoodie_size=?, pants_size=?, shoe_size=?,
        hotel_info=?, hotel_alias=?,
        languages=?, drivers_license=?, railcard=?, frequent_flyer=?,
        bank_account=?, bank_iban=?, bank_bic=?, website=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?`,
      [
        first_name, last_name, phone, mobile, address, postal_code, residence,
        birth_date, gender, pronouns, birth_place, nationality, id_number,
        tax_id, social_security, tax_number, vat_id,
        diet, gluten_free ? 1 : 0, lactose_free ? 1 : 0, allergies, special_notes,
        emergency_contact, emergency_phone,
        shirt_size, hoodie_size, pants_size, shoe_size,
        hotel_info, hotel_alias,
        languages, drivers_license, railcard, frequent_flyer,
        bank_account, bank_iban, bank_bic, website,
        req.user.id,
      ]
    );

    const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    delete updated.password_hash;
    res.json({ user: updated });
  } catch (err) {
    console.error('PUT /api/me error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Eigenes Passwort ändern
app.put('/api/me/password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword und newPassword erforderlich' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Neues Passwort muss mindestens 6 Zeichen lang sein' });
  }
  try {
    const user = await db.get('SELECT id, password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User nicht gefunden' });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ message: 'Passwort erfolgreich geändert' });
  } catch (e) {
    res.status(500).json({ error: 'Fehler beim Ändern des Passworts' });
  }
});

// ============================================
// ROUTES: MY CONTACT (/api/me/contact)
// Findet oder erstellt den eigenen Kontakt-Eintrag im aktuellen Tenant.
// Autoverkn. per E-Mail wenn noch kein user_id gesetzt.
// ============================================

app.get('/api/me/contact', authenticateToken, requireTenant, async (req, res) => {
  try {
    // 1. Direkt per user_id suchen
    let contact = await db.get(
      'SELECT * FROM contacts WHERE user_id = ? AND tenant_id = ?',
      [req.user.id, req.tenant.id]
    );

    // 2. Per E-Mail verknüpfen (bestehender Eintrag ohne user_id)
    if (!contact) {
      const byEmail = await db.get(
        'SELECT * FROM contacts WHERE email = ? AND tenant_id = ? AND (user_id IS NULL)',
        [req.user.email, req.tenant.id]
      );
      if (byEmail) {
        await db.run('UPDATE contacts SET user_id = ? WHERE id = ?', [req.user.id, byEmail.id]);
        contact = { ...byEmail, user_id: req.user.id };
      }
    }

    // 3. Neu anlegen wenn gar nichts gefunden — alle globalen Felder aus users kopieren
    if (!contact) {
      const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
      // Tenant-spezifische Defaults aus einem anderen Tenant des Users holen (function1/2/3, hotel_info, hotel_alias)
      const otherContact = await db.get(
        'SELECT * FROM contacts WHERE user_id = ? AND tenant_id != ? ORDER BY updated_at DESC LIMIT 1',
        [req.user.id, req.tenant.id]
      );
      const result = await db.run(
        `INSERT INTO contacts (
          tenant_id, user_id, first_name, last_name, email, phone, mobile,
          address, postal_code, residence, tax_id, website,
          birth_date, gender, pronouns, birth_place, nationality,
          id_number, social_security, diet, gluten_free, lactose_free,
          allergies, emergency_contact, emergency_phone,
          shirt_size, hoodie_size, pants_size, shoe_size,
          languages, drivers_license, railcard, frequent_flyer,
          bank_account, bank_iban, bank_bic, tax_number, vat_id,
          notes, function1, function2, function3, hotel_info, hotel_alias
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.tenant.id, req.user.id, user.first_name || '', user.last_name || '', user.email || '', user.phone || '', user.mobile || '',
          user.address || '', user.postal_code || '', user.residence || '', user.tax_id || '', user.website || '',
          user.birth_date || '', user.gender || '', user.pronouns || '', user.birth_place || '', user.nationality || '',
          user.id_number || '', user.social_security || '', user.diet || '', user.gluten_free || 0, user.lactose_free || 0,
          user.allergies || '', user.emergency_contact || '', user.emergency_phone || '',
          user.shirt_size || '', user.hoodie_size || '', user.pants_size || '', user.shoe_size || '',
          user.languages || '', user.drivers_license || '', user.railcard || '', user.frequent_flyer || '',
          user.bank_account || '', user.bank_iban || '', user.bank_bic || '', user.tax_number || '', user.vat_id || '',
          user.special_notes || '',
          otherContact?.function1 || '', otherContact?.function2 || '', otherContact?.function3 || '',
          otherContact?.hotel_info || '', otherContact?.hotel_alias || '',
        ]
      );
      contact = await db.get('SELECT * FROM contacts WHERE id = ?', [result.lastID]);
    }

    res.json({ contact: contactFromRow(contact) });
  } catch (err) {
    console.error('GET /api/me/contact error:', err);
    res.status(500).json({ error: 'Failed to load contact' });
  }
});

app.put('/api/me/contact', authenticateToken, requireTenant, async (req, res) => {
  try {
    // Erst sicherstellen dass ein Eintrag existiert (gleiche Logik wie GET)
    let contact = await db.get(
      'SELECT * FROM contacts WHERE user_id = ? AND tenant_id = ?',
      [req.user.id, req.tenant.id]
    );
    if (!contact) {
      const byEmail = await db.get(
        'SELECT * FROM contacts WHERE email = ? AND tenant_id = ? AND (user_id IS NULL)',
        [req.user.email, req.tenant.id]
      );
      if (byEmail) {
        await db.run('UPDATE contacts SET user_id = ? WHERE id = ?', [req.user.id, byEmail.id]);
        contact = { ...byEmail, user_id: req.user.id };
      }
    }
    if (!contact) {
      const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
      const otherContact = await db.get(
        'SELECT * FROM contacts WHERE user_id = ? AND tenant_id != ? ORDER BY updated_at DESC LIMIT 1',
        [req.user.id, req.tenant.id]
      );
      const result = await db.run(
        `INSERT INTO contacts (
          tenant_id, user_id, first_name, last_name, email, phone, mobile,
          address, postal_code, residence, tax_id, website,
          birth_date, gender, pronouns, birth_place, nationality,
          id_number, social_security, diet, gluten_free, lactose_free,
          allergies, emergency_contact, emergency_phone,
          shirt_size, hoodie_size, pants_size, shoe_size,
          languages, drivers_license, railcard, frequent_flyer,
          bank_account, bank_iban, bank_bic, tax_number, vat_id,
          notes, function1, function2, function3, hotel_info, hotel_alias
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.tenant.id, req.user.id, user.first_name || '', user.last_name || '', user.email || '', user.phone || '', user.mobile || '',
          user.address || '', user.postal_code || '', user.residence || '', user.tax_id || '', user.website || '',
          user.birth_date || '', user.gender || '', user.pronouns || '', user.birth_place || '', user.nationality || '',
          user.id_number || '', user.social_security || '', user.diet || '', user.gluten_free || 0, user.lactose_free || 0,
          user.allergies || '', user.emergency_contact || '', user.emergency_phone || '',
          user.shirt_size || '', user.hoodie_size || '', user.pants_size || '', user.shoe_size || '',
          user.languages || '', user.drivers_license || '', user.railcard || '', user.frequent_flyer || '',
          user.bank_account || '', user.bank_iban || '', user.bank_bic || '', user.tax_number || '', user.vat_id || '',
          user.special_notes || '',
          otherContact?.function1 || '', otherContact?.function2 || '', otherContact?.function3 || '',
          otherContact?.hotel_info || '', otherContact?.hotel_alias || '',
        ]
      );
      contact = await db.get('SELECT * FROM contacts WHERE id = ?', [result.lastID]);
    }

    const b = req.body;
    // req.body kommt als camelCase von updateMyContact() in api-client.ts

    // 1. Globale Felder in users-Tabelle schreiben
    await db.run(`
      UPDATE users SET
        first_name=?, last_name=?, phone=?, mobile=?,
        address=?, postal_code=?, residence=?, tax_id=?, website=?,
        birth_date=?, gender=?, pronouns=?, birth_place=?, nationality=?,
        id_number=?, social_security=?, diet=?, gluten_free=?, lactose_free=?,
        allergies=?, emergency_contact=?, emergency_phone=?,
        shirt_size=?, hoodie_size=?, pants_size=?, shoe_size=?,
        languages=?, drivers_license=?, railcard=?, frequent_flyer=?,
        bank_account=?, bank_iban=?, bank_bic=?, tax_number=?, vat_id=?
      WHERE id = ?`,
      [
        b.firstName, b.lastName, b.phone, b.mobile,
        b.address, b.postalCode, b.residence, b.taxId, b.website,
        b.birthDate, b.gender, b.pronouns, b.birthPlace, b.nationality,
        b.idNumber, b.socialSecurity, b.diet, b.glutenFree ? 1 : 0, b.lactoseFree ? 1 : 0,
        b.allergies, b.emergencyContact, b.emergencyPhone,
        b.shirtSize, b.hoodieSize, b.pantsSize, b.shoeSize,
        b.languages, b.driversLicense, b.railcard, b.frequentFlyer,
        b.bankAccount, b.bankIban, b.bankBic, b.taxNumber, b.vatId,
        req.user.id,
      ]
    );

    // 2. Tenant-spezifische Felder in contacts schreiben
    await db.run(`
      UPDATE contacts SET
        first_name=?, last_name=?, function1=?, function2=?, function3=?,
        specification=?, access_rights=?, email=?, phone=?, mobile=?,
        address=?, postal_code=?, residence=?, tax_id=?, website=?,
        birth_date=?, gender=?, pronouns=?, birth_place=?, nationality=?,
        id_number=?, social_security=?, diet=?, gluten_free=?, lactose_free=?,
        allergies=?, emergency_contact=?, emergency_phone=?,
        shirt_size=?, hoodie_size=?, pants_size=?, shoe_size=?,
        hotel_info=?, hotel_alias=?, languages=?, drivers_license=?,
        railcard=?, frequent_flyer=?, bank_account=?, bank_iban=?, bank_bic=?,
        tax_number=?, vat_id=?, crew_tool_active=?,
        hourly_rate=?, daily_rate=?, notes=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?`,
      [
        b.firstName, b.lastName, b.function1, b.function2, b.function3,
        b.specification, b.accessRights, b.email, b.phone, b.mobile,
        b.address, b.postalCode, b.residence, b.taxId, b.website,
        b.birthDate, b.gender, b.pronouns, b.birthPlace, b.nationality,
        b.idNumber, b.socialSecurity, b.diet, b.glutenFree ? 1 : 0, b.lactoseFree ? 1 : 0,
        b.allergies, b.emergencyContact, b.emergencyPhone,
        b.shirtSize, b.hoodieSize, b.pantsSize, b.shoeSize,
        b.hotelInfo, b.hotelAlias, b.languages, b.driversLicense,
        b.railcard, b.frequentFlyer, b.bankAccount, b.bankIban, b.bankBic,
        b.taxNumber, b.vatId, b.crewToolActive ? 1 : 0,
        b.hourlyRate || null, b.dailyRate || null, b.notes,
        contact.id, req.tenant.id,
      ]
    );

    const updated = await db.get('SELECT * FROM contacts WHERE id = ?', [contact.id]);
    res.json({ contact: contactFromRow(updated) });
  } catch (err) {
    console.error('PUT /api/me/contact error:', err);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// ============================================
// ROUTES: TENANT INFO
// ============================================

app.get('/api/tenants/:slug', authenticateToken, async (req, res) => {
  try {
    const tenant = await db.get(`
      SELECT t.*, ut.role
      FROM tenants t JOIN user_tenants ut ON t.id = ut.tenant_id
      WHERE t.slug = ? AND ut.user_id = ? AND ut.status = 'active'
    `, [req.params.slug, req.user.id]);

    if (!tenant) return res.status(404).json({ error: 'Tenant not found or access denied' });

    const subscription = await db.get(`
      SELECT ts.*, sp.name as plan_name, sp.features, sp.max_users, sp.max_storage_mb
      FROM tenant_subscriptions ts JOIN subscription_plans sp ON ts.plan_id = sp.id
      WHERE ts.tenant_id = ? AND ts.status IN ('active', 'trial')
      ORDER BY ts.created_at DESC LIMIT 1
    `, [tenant.id]);

    res.json({ tenant, subscription: subscription || null });
  } catch (error) {
    console.error('Get tenant error:', error);
    res.status(500).json({ error: 'Failed to get tenant info' });
  }
});

app.get('/api/users/tenants', authenticateToken, async (req, res) => {
  try {
    const tenants = await db.all(`
      SELECT t.id, t.name, t.slug, t.status, ut.role, ut.last_login_at
      FROM user_tenants ut JOIN tenants t ON ut.tenant_id = t.id
      WHERE ut.user_id = ? AND ut.status = 'active'
      ORDER BY ut.last_login_at DESC
    `, [req.user.id]);
    res.json({ tenants });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tenants' });
  }
});

// ============================================
// ROUTES: SUBSCRIPTION PLANS & ADD-ONS
// ============================================

app.get('/api/subscription-plans', async (req, res) => {
  try {
    const plans = await db.all('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY yearly_price ASC');
    res.json({ plans });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get plans' });
  }
});

app.get('/api/add-ons', async (req, res) => {
  try {
    const addOns = await db.all('SELECT * FROM add_ons WHERE is_active = 1 ORDER BY price ASC');
    res.json({ addOns });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get add-ons' });
  }
});

// ============================================
// ROUTES: VENUES (tenant-isolated)
// ============================================

// Hilfsfunktion: DB-Row → Frontend-Objekt (snake_case → camelCase)
const venueFromRow = (row) => ({
  id: String(row.id),
  name: row.name || '',
  street: row.street || '',
  postalCode: row.postal_code || '',
  city: row.city || '',
  state: row.state || '',
  country: row.country || '',
  website: row.website || '',
  arrival: row.arrival || '',
  arrivalStreet: row.arrival_street || '',
  arrivalPostalCode: row.arrival_postal_code || '',
  arrivalCity: row.arrival_city || '',
  capacity: row.capacity || '',
  capacitySeated: row.capacity_seated || '',
  stageDimensions: row.stage_dimensions || '',
  clearanceHeight: row.clearance_height || '',
  merchandiseFee: row.merchandise_fee || '',
  merchandiseStand: row.merchandise_stand || '',
  wardrobe: row.wardrobe || '',
  showers: row.showers || '',
  wifi: row.wifi || '',
  parking: row.parking || '',
  nightlinerParking: row.nightliner_parking || '',
  loadingPath: row.loading_path || '',
  notes: row.notes || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// GET all venues for tenant
app.get('/api/venues', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all(
      'SELECT * FROM venues WHERE tenant_id = ? ORDER BY name ASC',
      [req.tenant.id]
    );
    res.json({ venues: rows.map(venueFromRow) });
  } catch (error) {
    console.error('Get venues error:', error);
    res.status(500).json({ error: 'Failed to get venues' });
  }
});

// POST create venue
app.post('/api/venues', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  const v = req.body;
  if (!v.name || !v.name.trim()) return res.status(400).json({ error: 'Venue name is required' });

  try {
    const result = await db.run(`
      INSERT INTO venues (
        tenant_id, name, street, postal_code, city, state, country, website,
        arrival, arrival_street, arrival_postal_code, arrival_city,
        capacity, capacity_seated, stage_dimensions, clearance_height,
        merchandise_fee, merchandise_stand, wardrobe, showers, wifi,
        parking, nightliner_parking, loading_path, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.tenant.id, v.name, v.street, v.postalCode, v.city, v.state, v.country, v.website,
      v.arrival, v.arrivalStreet, v.arrivalPostalCode, v.arrivalCity,
      v.capacity, v.capacitySeated, v.stageDimensions, v.clearanceHeight,
      v.merchandiseFee, v.merchandiseStand, v.wardrobe, v.showers, v.wifi,
      v.parking, v.nightlinerParking, v.loadingPath, v.notes, req.user.id
    ]);

    const row = await db.get('SELECT * FROM venues WHERE id = ?', [result.lastID]);
    res.status(201).json({ venue: venueFromRow(row) });
  } catch (error) {
    console.error('Create venue error:', error);
    res.status(500).json({ error: 'Failed to create venue' });
  }
});

// PUT update venue
app.put('/api/venues/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  const v = req.body;
  const { id } = req.params;

  try {
    // Verify venue belongs to this tenant
    const existing = await db.get(
      'SELECT id FROM venues WHERE id = ? AND tenant_id = ?',
      [id, req.tenant.id]
    );
    if (!existing) return res.status(404).json({ error: 'Venue not found' });

    await db.run(`
      UPDATE venues SET
        name = ?, street = ?, postal_code = ?, city = ?, state = ?, country = ?, website = ?,
        arrival = ?, arrival_street = ?, arrival_postal_code = ?, arrival_city = ?,
        capacity = ?, capacity_seated = ?, stage_dimensions = ?, clearance_height = ?,
        merchandise_fee = ?, merchandise_stand = ?, wardrobe = ?, showers = ?, wifi = ?,
        parking = ?, nightliner_parking = ?, loading_path = ?, notes = ?,
        updated_at = datetime('now')
      WHERE id = ? AND tenant_id = ?
    `, [
      v.name, v.street, v.postalCode, v.city, v.state, v.country, v.website,
      v.arrival, v.arrivalStreet, v.arrivalPostalCode, v.arrivalCity,
      v.capacity, v.capacitySeated, v.stageDimensions, v.clearanceHeight,
      v.merchandiseFee, v.merchandiseStand, v.wardrobe, v.showers, v.wifi,
      v.parking, v.nightlinerParking, v.loadingPath, v.notes,
      id, req.tenant.id
    ]);

    const row = await db.get('SELECT * FROM venues WHERE id = ?', [id]);
    res.json({ venue: venueFromRow(row) });
  } catch (error) {
    console.error('Update venue error:', error);
    res.status(500).json({ error: 'Failed to update venue' });
  }
});

// DELETE venue
app.delete('/api/venues/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const existing = await db.get(
      'SELECT id FROM venues WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.tenant.id]
    );
    if (!existing) return res.status(404).json({ error: 'Venue not found' });

    await db.run('DELETE FROM venues WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    res.json({ message: 'Venue deleted' });
  } catch (error) {
    console.error('Delete venue error:', error);
    res.status(500).json({ error: 'Failed to delete venue' });
  }
});

// ============================================
// ROUTES: CONTACTS
// ============================================

const contactFromRow = (r) => ({
  id: String(r.id), firstName: r.first_name, lastName: r.last_name,
  function1: r.function1 || '', function2: r.function2 || '', function3: r.function3 || '',
  specification: r.specification || '', accessRights: r.access_rights || '',
  email: r.email || '', phone: r.phone || '', mobile: r.mobile || '',
  address: r.address || '', postalCode: r.postal_code || '', residence: r.residence || '',
  taxId: r.tax_id || '', website: r.website || '', birthDate: r.birth_date || '',
  gender: r.gender || '', pronouns: r.pronouns || '', birthPlace: r.birth_place || '',
  nationality: r.nationality || '', idNumber: r.id_number || '', socialSecurity: r.social_security || '',
  diet: r.diet || '', glutenFree: !!r.gluten_free, lactoseFree: !!r.lactose_free,
  allergies: r.allergies || '', emergencyContact: r.emergency_contact || '', emergencyPhone: r.emergency_phone || '',
  shirtSize: r.shirt_size || '', hoodieSize: r.hoodie_size || '', pantsSize: r.pants_size || '',
  shoeSize: r.shoe_size || '', languages: r.languages || '', driversLicense: r.drivers_license || '',
  railcard: r.railcard || '', frequentFlyer: r.frequent_flyer || '',
  bankAccount: r.bank_account || '', bankIban: r.bank_iban || '', bankBic: r.bank_bic || '',
  taxNumber: r.tax_number || '', vatId: r.vat_id || '', crewToolActive: !!r.crew_tool_active,
  hourlyRate: r.hourly_rate || 0, dailyRate: r.daily_rate || 0, notes: r.notes || '',
  hotelInfo: r.hotel_info || '', hotelAlias: r.hotel_alias || '',
  createdAt: r.created_at, updatedAt: r.updated_at,
  userId: r.user_id || null,
  tenantRole: r.tenant_role || null,
  contactType: r.contact_type || 'crew',
  invitePending: !!r.invite_pending,
});

app.get('/api/contacts', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT c.*, ut.role AS tenant_role
      FROM contacts c
      LEFT JOIN user_tenants ut ON ut.user_id = c.user_id AND ut.tenant_id = c.tenant_id AND ut.status = 'active'
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.tenant_id = ? AND (u.is_superadmin IS NULL OR u.is_superadmin = 0)
      ORDER BY c.last_name, c.first_name
    `, [req.tenant.id]);
    res.json({ contacts: rows.map(contactFromRow) });
  } catch (e) { res.status(500).json({ error: 'Failed to get contacts' }); }
});

app.get('/api/contacts/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const row = await db.get(`
      SELECT c.*, ut.role AS tenant_role
      FROM contacts c
      LEFT JOIN user_tenants ut ON ut.user_id = c.user_id AND ut.tenant_id = c.tenant_id AND ut.status = 'active'
      WHERE c.id = ? AND c.tenant_id = ?
    `, [req.params.id, req.tenant.id])
    if (!row) return res.status(404).json({ error: 'Kontakt nicht gefunden' })
    res.json({ contact: contactFromRow(row) })
  } catch (e) { res.status(500).json({ error: 'Failed to get contact' }) }
})

app.post('/api/contacts', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const c = req.body;
    const result = await db.run(`
      INSERT INTO contacts (tenant_id, first_name, last_name, function1, function2, function3,
        specification, access_rights, email, phone, mobile, address, postal_code, residence,
        tax_id, website, birth_date, gender, pronouns, birth_place, nationality, id_number,
        social_security, diet, gluten_free, lactose_free, allergies, emergency_contact,
        emergency_phone, shirt_size, hoodie_size, pants_size, shoe_size, languages,
        drivers_license, railcard, frequent_flyer, bank_account, bank_iban, bank_bic,
        tax_number, vat_id, crew_tool_active, hourly_rate, daily_rate, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [req.tenant.id, c.firstName||'', c.lastName||'', c.function1||'', c.function2||'', c.function3||'',
        c.specification||'', c.accessRights||'', c.email||'', c.phone||'', c.mobile||'',
        c.address||'', c.postalCode||'', c.residence||'', c.taxId||'', c.website||'',
        c.birthDate||'', c.gender||'', c.pronouns||'', c.birthPlace||'', c.nationality||'',
        c.idNumber||'', c.socialSecurity||'', c.diet||'', c.glutenFree?1:0, c.lactoseFree?1:0,
        c.allergies||'', c.emergencyContact||'', c.emergencyPhone||'', c.shirtSize||'',
        c.hoodieSize||'', c.pantsSize||'', c.shoeSize||'', c.languages||'', c.driversLicense||'',
        c.railcard||'', c.frequentFlyer||'', c.bankAccount||'', c.bankIban||'', c.bankBic||'',
        c.taxNumber||'', c.vatId||'', c.crewToolActive!==false?1:0, c.hourlyRate||0, c.dailyRate||0, c.notes||'']);
    const row = await db.get('SELECT * FROM contacts WHERE id = ?', [result.lastID]);
    res.status(201).json({ contact: contactFromRow(row) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to create contact' }); }
});

// Manuellen Kontakt anlegen (contact_type='guest') — kein Login, kein Travel-Party-Eintrag
app.post('/api/contacts/guest', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const {
      firstName = '', lastName = '', phone = '',
      function1 = '', function2 = '', function3 = '',
      specification = '', diet = '', allergies = '',
      glutenFree = false, lactoseFree = false, notes = ''
    } = req.body
    if (!firstName && !lastName) {
      return res.status(400).json({ error: 'Vor- oder Nachname erforderlich' })
    }
    const result = await db.run(
      `INSERT INTO contacts (tenant_id, first_name, last_name, phone,
        function1, function2, function3, specification,
        diet, allergies, gluten_free, lactose_free, notes, contact_type, crew_tool_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'guest', 1)`,
      [req.tenant.id, firstName, lastName, phone,
       function1, function2, function3, specification,
       diet, allergies, glutenFree ? 1 : 0, lactoseFree ? 1 : 0, notes]
    )
    const row = await db.get('SELECT * FROM contacts WHERE id = ?', [result.lastID])
    res.status(201).json({ contact: contactFromRow(row) })
  } catch (e) {
    console.error('POST /api/contacts/guest failed', e)
    res.status(500).json({ error: 'Failed to create guest contact' })
  }
})

app.put('/api/contacts/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { id } = req.params; const c = req.body;
    const existing = await db.get('SELECT id FROM contacts WHERE id = ? AND tenant_id = ?', [id, req.tenant.id]);
    if (!existing) return res.status(404).json({ error: 'Contact not found' });
    await db.run(`
      UPDATE contacts SET first_name=?, last_name=?, function1=?, function2=?, function3=?,
        specification=?, access_rights=?, email=?, phone=?, mobile=?, address=?, postal_code=?,
        residence=?, tax_id=?, website=?, birth_date=?, gender=?, pronouns=?, birth_place=?,
        nationality=?, id_number=?, social_security=?, diet=?, gluten_free=?, lactose_free=?,
        allergies=?, emergency_contact=?, emergency_phone=?, shirt_size=?, hoodie_size=?,
        pants_size=?, shoe_size=?, languages=?, drivers_license=?, railcard=?, frequent_flyer=?,
        bank_account=?, bank_iban=?, bank_bic=?, tax_number=?, vat_id=?, crew_tool_active=?,
        hourly_rate=?, daily_rate=?, notes=?, updated_at=datetime('now')
      WHERE id=? AND tenant_id=?
    `, [c.firstName||'', c.lastName||'', c.function1||'', c.function2||'', c.function3||'',
        c.specification||'', c.accessRights||'', c.email||'', c.phone||'', c.mobile||'',
        c.address||'', c.postalCode||'', c.residence||'', c.taxId||'', c.website||'',
        c.birthDate||'', c.gender||'', c.pronouns||'', c.birthPlace||'', c.nationality||'',
        c.idNumber||'', c.socialSecurity||'', c.diet||'', c.glutenFree?1:0, c.lactoseFree?1:0,
        c.allergies||'', c.emergencyContact||'', c.emergencyPhone||'', c.shirtSize||'',
        c.hoodieSize||'', c.pantsSize||'', c.shoeSize||'', c.languages||'', c.driversLicense||'',
        c.railcard||'', c.frequentFlyer||'', c.bankAccount||'', c.bankIban||'', c.bankBic||'',
        c.taxNumber||'', c.vatId||'', c.crewToolActive!==false?1:0, c.hourlyRate||0, c.dailyRate||0,
        c.notes||'', id, req.tenant.id]);
    const row = await db.get('SELECT * FROM contacts WHERE id = ?', [id]);
    res.json({ contact: contactFromRow(row) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to update contact' }); }
});

app.delete('/api/contacts/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const existing = await db.get('SELECT id FROM contacts WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!existing) return res.status(404).json({ error: 'Contact not found' });
    await db.run('DELETE FROM contacts WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    res.json({ message: 'Contact deleted' });
  } catch (e) { res.status(500).json({ error: 'Failed to delete contact' }); }
});

// ============================================
// ROUTES: HOTELS
// ============================================

const hotelFromRow = (r) => ({
  id: String(r.id), name: r.name, street: r.street||'', postalCode: r.postal_code||'',
  city: r.city||'', state: r.state||'', country: r.country||'', email: r.email||'',
  phone: r.phone||'', website: r.website||'', reception: r.reception||'',
  checkIn: r.check_in||'', checkOut: r.check_out||'', earlyCheckIn: r.early_check_in||'',
  lateCheckOut: r.late_check_out||'', breakfast: r.breakfast||'',
  breakfastWeekend: r.breakfast_weekend||'', additionalInfo: r.additional_info||'',
  createdAt: r.created_at, updatedAt: r.updated_at,
});

app.get('/api/hotels', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM hotels WHERE tenant_id = ? ORDER BY name', [req.tenant.id]);
    res.json({ hotels: rows.map(hotelFromRow) });
  } catch (e) { res.status(500).json({ error: 'Failed to get hotels' }); }
});

app.post('/api/hotels', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const h = req.body;
    const result = await db.run(`
      INSERT INTO hotels (tenant_id, name, street, postal_code, city, state, country, email,
        phone, website, reception, check_in, check_out, early_check_in, late_check_out,
        breakfast, breakfast_weekend, additional_info)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [req.tenant.id, h.name||'', h.street||'', h.postalCode||'', h.city||'', h.state||'',
        h.country||'', h.email||'', h.phone||'', h.website||'', h.reception||'',
        h.checkIn||'', h.checkOut||'', h.earlyCheckIn||'', h.lateCheckOut||'',
        h.breakfast||'', h.breakfastWeekend||'', h.additionalInfo||'']);
    const row = await db.get('SELECT * FROM hotels WHERE id = ?', [result.lastID]);
    res.status(201).json({ hotel: hotelFromRow(row) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to create hotel' }); }
});

app.put('/api/hotels/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { id } = req.params; const h = req.body;
    const existing = await db.get('SELECT id FROM hotels WHERE id = ? AND tenant_id = ?', [id, req.tenant.id]);
    if (!existing) return res.status(404).json({ error: 'Hotel not found' });
    await db.run(`
      UPDATE hotels SET name=?, street=?, postal_code=?, city=?, state=?, country=?, email=?,
        phone=?, website=?, reception=?, check_in=?, check_out=?, early_check_in=?,
        late_check_out=?, breakfast=?, breakfast_weekend=?, additional_info=?, updated_at=datetime('now')
      WHERE id=? AND tenant_id=?
    `, [h.name||'', h.street||'', h.postalCode||'', h.city||'', h.state||'', h.country||'',
        h.email||'', h.phone||'', h.website||'', h.reception||'', h.checkIn||'', h.checkOut||'',
        h.earlyCheckIn||'', h.lateCheckOut||'', h.breakfast||'', h.breakfastWeekend||'',
        h.additionalInfo||'', id, req.tenant.id]);
    const row = await db.get('SELECT * FROM hotels WHERE id = ?', [id]);
    res.json({ hotel: hotelFromRow(row) });
  } catch (e) { res.status(500).json({ error: 'Failed to update hotel' }); }
});

app.delete('/api/hotels/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const existing = await db.get('SELECT id FROM hotels WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!existing) return res.status(404).json({ error: 'Hotel not found' });
    await db.run('DELETE FROM hotels WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    res.json({ message: 'Hotel deleted' });
  } catch (e) { res.status(500).json({ error: 'Failed to delete hotel' }); }
});

// ============================================
// ROUTES: VEHICLES
// ============================================

const vehicleFromRow = (r) => ({
  id: String(r.id), designation: r.designation, vehicleType: r.vehicle_type||'',
  driver: r.driver||'', licensePlate: r.license_plate||'', dimensions: r.dimensions||'',
  powerConnection: r.power_connection||'', hasTrailer: !!r.has_trailer,
  trailerDimensions: r.trailer_dimensions||'', trailerLicensePlate: r.trailer_license_plate||'',
  seats: r.seats||'', sleepingPlaces: r.sleeping_places||'', notes: r.notes||'',
  createdAt: r.created_at, updatedAt: r.updated_at,
});

app.get('/api/vehicles', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM vehicles WHERE tenant_id = ? ORDER BY designation', [req.tenant.id]);
    res.json({ vehicles: rows.map(vehicleFromRow) });
  } catch (e) { res.status(500).json({ error: 'Failed to get vehicles' }); }
});

app.post('/api/vehicles', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const v = req.body;
    const result = await db.run(`
      INSERT INTO vehicles (tenant_id, designation, vehicle_type, driver, license_plate,
        dimensions, power_connection, has_trailer, trailer_dimensions, trailer_license_plate,
        seats, sleeping_places, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [req.tenant.id, v.designation||'', v.vehicleType||'', v.driver||'', v.licensePlate||'',
        v.dimensions||'', v.powerConnection||'', v.hasTrailer?1:0, v.trailerDimensions||'',
        v.trailerLicensePlate||'', v.seats||'', v.sleepingPlaces||'', v.notes||'']);
    const row = await db.get('SELECT * FROM vehicles WHERE id = ?', [result.lastID]);
    res.status(201).json({ vehicle: vehicleFromRow(row) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to create vehicle' }); }
});

app.put('/api/vehicles/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { id } = req.params; const v = req.body;
    const existing = await db.get('SELECT id FROM vehicles WHERE id = ? AND tenant_id = ?', [id, req.tenant.id]);
    if (!existing) return res.status(404).json({ error: 'Vehicle not found' });
    await db.run(`
      UPDATE vehicles SET designation=?, vehicle_type=?, driver=?, license_plate=?, dimensions=?,
        power_connection=?, has_trailer=?, trailer_dimensions=?, trailer_license_plate=?,
        seats=?, sleeping_places=?, notes=?, updated_at=datetime('now')
      WHERE id=? AND tenant_id=?
    `, [v.designation||'', v.vehicleType||'', v.driver||'', v.licensePlate||'', v.dimensions||'',
        v.powerConnection||'', v.hasTrailer?1:0, v.trailerDimensions||'', v.trailerLicensePlate||'',
        v.seats||'', v.sleepingPlaces||'', v.notes||'', id, req.tenant.id]);
    const row = await db.get('SELECT * FROM vehicles WHERE id = ?', [id]);
    res.json({ vehicle: vehicleFromRow(row) });
  } catch (e) { res.status(500).json({ error: 'Failed to update vehicle' }); }
});

app.delete('/api/vehicles/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const existing = await db.get('SELECT id FROM vehicles WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!existing) return res.status(404).json({ error: 'Vehicle not found' });
    await db.run('DELETE FROM vehicles WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    res.json({ message: 'Vehicle deleted' });
  } catch (e) { res.status(500).json({ error: 'Failed to delete vehicle' }); }
});

// ============================================
// ROUTES: PARTNERS
// ============================================

const partnerFromRow = (r) => ({
  id: String(r.id), type: r.type||'', companyName: r.company_name,
  street: r.street||'', postalCode: r.postal_code||'', city: r.city||'',
  state: r.state||'', country: r.country||'', contactPerson: r.contact_person||'',
  email: r.email||'', phone: r.phone||'', taxId: r.tax_id||'',
  billingAddress: r.billing_address||'', notes: r.notes||'',
  createdAt: r.created_at, updatedAt: r.updated_at,
});

app.get('/api/partners', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM partners WHERE tenant_id = ? ORDER BY company_name', [req.tenant.id]);
    res.json({ partners: rows.map(partnerFromRow) });
  } catch (e) { res.status(500).json({ error: 'Failed to get partners' }); }
});

app.post('/api/partners', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const p = req.body;
    const result = await db.run(`
      INSERT INTO partners (tenant_id, type, company_name, street, postal_code, city, state,
        country, contact_person, email, phone, tax_id, billing_address, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [req.tenant.id, p.type||'', p.companyName||'', p.street||'', p.postalCode||'',
        p.city||'', p.state||'', p.country||'', p.contactPerson||'', p.email||'',
        p.phone||'', p.taxId||'', p.billingAddress||'', p.notes||'']);
    const row = await db.get('SELECT * FROM partners WHERE id = ?', [result.lastID]);
    res.status(201).json({ partner: partnerFromRow(row) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to create partner' }); }
});

app.put('/api/partners/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { id } = req.params; const p = req.body;
    const existing = await db.get('SELECT id FROM partners WHERE id = ? AND tenant_id = ?', [id, req.tenant.id]);
    if (!existing) return res.status(404).json({ error: 'Partner not found' });
    await db.run(`
      UPDATE partners SET type=?, company_name=?, street=?, postal_code=?, city=?, state=?,
        country=?, contact_person=?, email=?, phone=?, tax_id=?, billing_address=?, notes=?,
        updated_at=datetime('now')
      WHERE id=? AND tenant_id=?
    `, [p.type||'', p.companyName||'', p.street||'', p.postalCode||'', p.city||'', p.state||'',
        p.country||'', p.contactPerson||'', p.email||'', p.phone||'', p.taxId||'',
        p.billingAddress||'', p.notes||'', id, req.tenant.id]);
    const row = await db.get('SELECT * FROM partners WHERE id = ?', [id]);
    res.json({ partner: partnerFromRow(row) });
  } catch (e) { res.status(500).json({ error: 'Failed to update partner' }); }
});

app.delete('/api/partners/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const existing = await db.get('SELECT id FROM partners WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!existing) return res.status(404).json({ error: 'Partner not found' });
    await db.run('DELETE FROM partners WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    res.json({ message: 'Partner deleted' });
  } catch (e) { res.status(500).json({ error: 'Failed to delete partner' }); }
});

// ============================================
// ROUTES: FILE UPLOAD
// ============================================

// List files (reads filenames from disk + original_name from DB)
// ============================================
// ROUTES: FILES (entity-basiert, mit DB-Tracking)
// ============================================

// Hilfsfunktion: Ist diese Datei für den anfragenden User zugänglich?
// - Shared files (entityId = 'shared'): alle Tenant-User dürfen lesen
// - Private files (entityId = userId): nur der Uploader (uploaded_by = req.user.id)
function canReadFile(file, userId) {
  if (file.entity_id === 'shared') return true;
  if (file.entity_type === 'termin') return true;  // Termin-Dateien: alle Tenant-Mitglieder dürfen lesen
  return String(file.uploaded_by) === String(userId);
}

// Darf der User diese Datei löschen/umbenennen?
// - Shared: jeder Tenant-User darf löschen (später: nur Admin)
// - Private: nur der Uploader
function canWriteFile(file, userId) {
  // Geteilte Dateien (shared entity oder termin) → alle Tenant-Mitglieder dürfen schreiben
  if (file.entity_id === 'shared') return true;
  if (file.entity_type === 'termin') return true;
  // Persönliche Dateien → nur der Uploader
  return String(file.uploaded_by) === String(userId);
}

// SERVE: GET /api/files/download/:fileId  ← muss VOR der List-Route stehen!
app.get('/api/files/download/:fileId', authenticateToken, requireTenant, async (req, res) => {
  try {
    const file = await db.get('SELECT * FROM files WHERE id=? AND tenant_id=?', [req.params.fileId, req.tenant.id]);
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (!canReadFile(file, req.user.id)) return res.status(403).json({ error: 'Access denied' });
    const filePath = path.join(__dirname, 'uploads', String(req.tenant.id), file.entity_type, file.entity_id, file.stored_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on disk' });
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.original_name)}"`);
    res.setHeader('Content-Type', file.mime_type);
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error('GET /api/files/download error:', err);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// LIST: GET /api/files/:entityType/:entityId?category=X
// - category omitted → alle Kategorien zurückgeben
// - entityId==='shared' oder entityType==='termin' → tenant-weit (keine User-Filterung)
app.get('/api/files/:entityType/:entityId', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const category = req.query.category || null; // null = alle

    const isShared = entityId === 'shared' || entityType === 'termin';

    let files;
    if (isShared) {
      if (category) {
        files = await db.all(
          'SELECT * FROM files WHERE tenant_id=? AND entity_type=? AND entity_id=? AND category=? ORDER BY created_at DESC',
          [req.tenant.id, entityType, entityId, category]
        );
      } else {
        files = await db.all(
          'SELECT * FROM files WHERE tenant_id=? AND entity_type=? AND entity_id=? ORDER BY category, created_at DESC',
          [req.tenant.id, entityType, entityId]
        );
      }
    } else {
      if (category) {
        files = await db.all(
          'SELECT * FROM files WHERE tenant_id=? AND entity_type=? AND entity_id=? AND category=? AND uploaded_by=? ORDER BY created_at DESC',
          [req.tenant.id, entityType, entityId, category, req.user.id]
        );
      } else {
        files = await db.all(
          'SELECT * FROM files WHERE tenant_id=? AND entity_type=? AND entity_id=? AND uploaded_by=? ORDER BY category, created_at DESC',
          [req.tenant.id, entityType, entityId, req.user.id]
        );
      }
    }
    res.json({ files: files.map(fileFromRow) });
  } catch (err) {
    console.error('GET /api/files error:', err);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// UPLOAD: POST /api/files/:entityType/:entityId?category=X
app.post('/api/files/:entityType/:entityId', authenticateToken, requireTenant, requireEditor, fileUpload.array('files'), async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const category = req.query.category || 'general';
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const inserted = [];
    for (const file of req.files) {
      const result = await db.run(
        `INSERT INTO files (tenant_id, entity_type, entity_id, category, original_name, stored_name, mime_type, size, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.tenant.id, entityType, entityId, category, file.originalname, file.filename, file.mimetype || 'application/octet-stream', file.size, req.user.id]
      );
      const row = await db.get('SELECT * FROM files WHERE id = ?', [result.lastID]);
      inserted.push(fileFromRow(row));
    }
    res.status(201).json({ files: inserted });
  } catch (err) {
    console.error('POST /api/files error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// DELETE: DELETE /api/files/:fileId
app.delete('/api/files/:fileId', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const file = await db.get('SELECT * FROM files WHERE id=? AND tenant_id=?', [req.params.fileId, req.tenant.id]);
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (!canWriteFile(file, req.user.id)) return res.status(403).json({ error: 'Access denied' });
    const filePath = path.join(__dirname, 'uploads', String(req.tenant.id), file.entity_type, file.entity_id, file.stored_name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await db.run('DELETE FROM files WHERE id = ?', [file.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/files error:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// PATCH /api/files/:fileId  — umbenennen und/oder Kategorie ändern
app.patch('/api/files/:fileId', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { originalName, category } = req.body;
    if (!originalName && !category) return res.status(400).json({ error: 'originalName or category required' });
    const file = await db.get('SELECT * FROM files WHERE id=? AND tenant_id=?', [req.params.fileId, req.tenant.id]);
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (!canWriteFile(file, req.user.id)) return res.status(403).json({ error: 'Access denied' });
    if (originalName) await db.run('UPDATE files SET original_name=? WHERE id=?', [originalName, file.id]);
    if (category)     await db.run('UPDATE files SET category=? WHERE id=?',       [category,     file.id]);
    const updated = await db.get('SELECT * FROM files WHERE id=?', [file.id]);
    res.json({ file: fileFromRow(updated) });
  } catch (err) {
    console.error('PATCH /api/files error:', err);
    res.status(500).json({ error: 'Patch failed' });
  }
});


// ============================================================
// CHAT
// ============================================================

// GET /api/chat/:entityType/:entityId?since=<id>  → Nachrichten laden
app.get('/api/chat/:entityType/:entityId', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const since = parseInt(req.query.since) || 0;
    const messages = await db.all(
      `SELECT * FROM chat_messages
       WHERE tenant_id=? AND entity_type=? AND entity_id=? AND id > ?
       ORDER BY created_at ASC LIMIT 200`,
      [req.tenant.id, entityType, entityId, since]
    );
    res.json({ messages: messages.map(m => ({
      id: m.id,
      userId: m.user_id,
      userName: m.user_name,
      text: m.text,
      createdAt: m.created_at,
    }))});
  } catch (err) {
    console.error('GET /api/chat error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/chat/:entityType/:entityId  → Nachricht senden
app.post('/api/chat/:entityType/:entityId', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text required' });
    // Name immer frisch aus DB holen – JWT kann veraltet sein
    const dbUser = await db.get('SELECT first_name, last_name, email FROM users WHERE id=?', [req.user.id]);
    const userName = (dbUser?.first_name || dbUser?.last_name)
      ? `${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim()
      : (dbUser?.email || req.user.email);
    const result = await db.run(
      `INSERT INTO chat_messages (tenant_id, entity_type, entity_id, user_id, user_name, text)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.tenant.id, entityType, entityId, req.user.id, userName, text.trim()]
    );
    const row = await db.get('SELECT * FROM chat_messages WHERE id=?', [result.lastID]);
    res.status(201).json({ message: {
      id: row.id, userId: row.user_id, userName: row.user_name,
      text: row.text, createdAt: row.created_at,
    }});
  } catch (err) {
    console.error('POST /api/chat error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// PATCH /api/chat/message/:messageId  → Nachricht bearbeiten (Admin oder eigene)
app.patch('/api/chat/message/:messageId', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text required' });
    const msg = await db.get('SELECT * FROM chat_messages WHERE id=? AND tenant_id=?', [req.params.messageId, req.tenant.id]);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    const isAdmin = ['admin', 'tourmanagement'].includes(req.tenant.role);
    const isOwn = msg.user_id === req.user.id;
    if (!isAdmin && !isOwn) return res.status(403).json({ error: 'Forbidden' });
    await db.run('UPDATE chat_messages SET text=? WHERE id=?', [text.trim(), msg.id]);
    const updated = await db.get('SELECT * FROM chat_messages WHERE id=?', [msg.id]);
    res.json({ message: { id: updated.id, userId: updated.user_id, userName: updated.user_name, text: updated.text, createdAt: updated.created_at } });
  } catch (err) {
    console.error('PATCH /api/chat/message error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// DELETE /api/chat/message/:messageId  → einzelne Nachricht löschen (Admin oder eigene)
app.delete('/api/chat/message/:messageId', authenticateToken, requireTenant, async (req, res) => {
  try {
    const msg = await db.get('SELECT * FROM chat_messages WHERE id=? AND tenant_id=?', [req.params.messageId, req.tenant.id]);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    const isAdmin = ['admin', 'tourmanagement'].includes(req.tenant.role);
    const isOwn = msg.user_id === req.user.id;
    if (!isAdmin && !isOwn) return res.status(403).json({ error: 'Forbidden' });
    await db.run('DELETE FROM chat_messages WHERE id=?', [msg.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/chat/message error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// DELETE /api/chat/:entityType/:entityId  → gesamten Chat löschen (nur Admin/Owner)
app.delete('/api/chat/:entityType/:entityId', authenticateToken, requireTenant, async (req, res) => {
  try {
    const role = req.tenant.role;
    if (!['owner', 'admin', 'manager'].includes(role)) return res.status(403).json({ error: 'Forbidden' });
    const { entityType, entityId } = req.params;
    await db.run(
      'DELETE FROM chat_messages WHERE tenant_id=? AND entity_type=? AND entity_id=?',
      [req.tenant.id, entityType, entityId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/chat error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// Helper: DB-Row → camelCase
const fileFromRow = (r) => ({
  id: String(r.id),
  entityType: r.entity_type,
  entityId: r.entity_id,
  category: r.category,
  originalName: r.original_name,
  storedName: r.stored_name,
  mimeType: r.mime_type,
  size: r.size,
  uploadedBy: r.uploaded_by,
  createdAt: r.created_at,
  url: `/api/files/download/${r.id}`,
});

// ============================================
// ============================================
// ROUTES: TENANT SETTINGS
// ============================================

// GET /api/tenant/settings/:key
app.get('/api/tenant/settings/:key', authenticateToken, requireTenant, async (req, res) => {
  try {
    const row = await db.get(
      'SELECT * FROM tenant_settings WHERE tenant_id=? AND key=?',
      [req.tenant.id, req.params.key]
    );
    res.json({ key: req.params.key, value: row?.value ?? null, updatedAt: row?.updated_at ?? null });
  } catch (err) {
    console.error('GET /api/tenant/settings error:', err);
    res.status(500).json({ error: 'Failed to get setting' });
  }
});

// PUT /api/tenant/settings/:key  (nur Admin/Owner)
app.put('/api/tenant/settings/:key', authenticateToken, requireTenant, async (req, res) => {
  try {
    const userTenant = await db.get(
      'SELECT role FROM user_tenants WHERE user_id=? AND tenant_id=?',
      [req.user.id, req.tenant.id]
    );
    if (!userTenant || !['admin'].includes(userTenant.role)) {
      return res.status(403).json({ error: 'Admin required' });
    }
    const { value } = req.body;
    await db.run(
      `INSERT INTO tenant_settings (tenant_id, key, value, updated_by, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(tenant_id, key) DO UPDATE SET value=excluded.value, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP`,
      [req.tenant.id, req.params.key, value ?? '', req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/tenant/settings error:', err);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// ============================================
// ROUTES: UPLOADS (Legacy — wird nach Migration entfernt)
// ============================================

app.get('/api/uploads/list/:category/:userId', authenticateToken, async (req, res) => {
  try {
    const { category } = req.params;
    const userId = String(req.user.id); // Immer eigene User-ID aus JWT, nie aus URL
    const uploadPath = path.join(__dirname, 'uploads', category, userId);

    if (!fs.existsSync(uploadPath)) return res.json({ files: [] });

    const filenames = fs.readdirSync(uploadPath);
    const files = filenames.map(filename => {
      const filePath = path.join(uploadPath, filename);
      const stats = fs.statSync(filePath);
      // original_name: strip the timestamp prefix added during upload
      const originalName = filename.replace(/^\d+_/, '');
      return {
        filename,
        originalname: originalName,
        size: stats.size,
        created: stats.birthtime.toISOString(),
        type: 'application/octet-stream'
      };
    });

    res.json({ files });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Upload files
app.post('/api/uploads/upload/:category/:userId', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const files = req.files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      size: file.size,
      type: file.mimetype || 'application/octet-stream'
    }));
    res.json({ message: 'Files uploaded successfully', files });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Delete file
app.delete('/api/uploads/delete/:category/:userId/:filename', authenticateToken, async (req, res) => {
  try {
    const { category, filename } = req.params;
    const userId = String(req.user.id);
    const filePath = path.join(__dirname, 'uploads', category, userId, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ message: 'File deleted' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Rename file
app.put('/api/uploads/rename/:category/:userId/:oldName', authenticateToken, async (req, res) => {
  try {
    const { category, oldName } = req.params;
    const userId = String(req.user.id);
    const { newName } = req.body;
    const oldPath = path.join(__dirname, 'uploads', category, userId, oldName);
    const newPath = path.join(__dirname, 'uploads', category, userId, newName);
    if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
    res.json({ message: 'File renamed' });
  } catch (error) {
    console.error('Rename error:', error);
    res.status(500).json({ error: 'Rename failed' });
  }
});

// Serve file
app.get('/api/uploads/file/:category/:userId/:filename', (req, res) => {
  const { category, userId, filename } = req.params;
  const filePath = path.join(__dirname, 'uploads', category, userId, filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(path.resolve(filePath));
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// ============================================
// ROUTES: TERMINE
// ============================================

// List all termine for tenant (with venue/partner names + current user's availability)
app.get('/api/termine', authenticateToken, requireTenant, async (req, res) => {
  try {
    const termine = await db.all(`
      SELECT
        t.*,
        v.name as venue_name,
        p.company_name as partner_name,
        ta.status as my_availability,
        ta.comment as my_comment,
        CASE WHEN EXISTS (
          SELECT 1 FROM termin_travel_party ttp
          JOIN contacts c ON ttp.contact_id = c.id
          WHERE ttp.termin_id = t.id AND c.user_id = ? AND c.tenant_id = t.tenant_id
        ) THEN 1 ELSE 0 END as in_travel_party,
        CASE WHEN EXISTS (
          SELECT 1 FROM termin_booking_rejections tbr
          JOIN contacts c ON tbr.contact_id = c.id
          WHERE tbr.termin_id = t.id AND c.user_id = ? AND c.tenant_id = t.tenant_id
        ) THEN 1 ELSE 0 END as is_rejected
      FROM termine t
      LEFT JOIN venues v ON t.venue_id = v.id
      LEFT JOIN partners p ON t.partner_id = p.id
      LEFT JOIN termin_availability ta ON t.id = ta.termin_id AND ta.user_id = ?
      WHERE t.tenant_id = ?
      ORDER BY t.date ASC
    `, [req.user.id, req.user.id, req.user.id, req.tenant.id]);

    // For each termin, also get all availability entries
    const result = await Promise.all(termine.map(async (termin) => {
      const allAvailability = await db.all(`
        SELECT
          ta.*,
          u.first_name, u.last_name, u.email
        FROM termin_availability ta
        JOIN users u ON ta.user_id = u.id
        WHERE ta.termin_id = ?
      `, [termin.id]);
      return { ...termin, availability: allAvailability };
    }));

    res.json({ termine: result });
  } catch (err) {
    console.error('GET termine error:', err);
    res.status(500).json({ error: 'Failed to load termine' });
  }
});

// Get single termin
app.get('/api/termine/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const termin = await db.get(`
      SELECT
        t.*,
        v.name as venue_name,
        p.company_name as partner_name,
        ta.status as my_availability,
        ta.comment as my_comment,
        CASE WHEN EXISTS (
          SELECT 1 FROM termin_travel_party ttp
          JOIN contacts c ON ttp.contact_id = c.id
          WHERE ttp.termin_id = t.id AND c.user_id = ? AND c.tenant_id = t.tenant_id
        ) THEN 1 ELSE 0 END as in_travel_party,
        CASE WHEN EXISTS (
          SELECT 1 FROM termin_booking_rejections tbr
          JOIN contacts c ON tbr.contact_id = c.id
          WHERE tbr.termin_id = t.id AND c.user_id = ? AND c.tenant_id = t.tenant_id
        ) THEN 1 ELSE 0 END as is_rejected
      FROM termine t
      LEFT JOIN venues v ON t.venue_id = v.id
      LEFT JOIN partners p ON t.partner_id = p.id
      LEFT JOIN termin_availability ta ON t.id = ta.termin_id AND ta.user_id = ?
      WHERE t.id = ? AND t.tenant_id = ?
    `, [req.user.id, req.user.id, req.user.id, req.params.id, req.tenant.id]);

    if (!termin) return res.status(404).json({ error: 'Termin not found' });

    const allAvailability = await db.all(`
      SELECT ta.*, u.first_name, u.last_name, u.email
      FROM termin_availability ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.termin_id = ?
    `, [termin.id]);

    res.json({ termin: { ...termin, availability: allAvailability } });
  } catch (err) {
    console.error('GET termin/:id error:', err);
    res.status(500).json({ error: 'Failed to load termin' });
  }
});

// Create termin
app.post('/api/termine', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  const { date, title, city, venue_id, partner_id, announcement, capacity, notes, art, art_sub, status_booking, status_public, show_title_as_header } = req.body;
  if (!date || !title) return res.status(400).json({ error: 'date and title are required' });
  try {
    const result = await db.run(`
      INSERT INTO termine (tenant_id, date, title, city, venue_id, partner_id, announcement, capacity, notes, art, art_sub, status_booking, status_public, show_title_as_header, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.tenant.id, date, title, city || null, venue_id || null, partner_id || null, announcement || null, capacity || null, notes || null, art || null, art_sub || null, status_booking || null, status_public || null, show_title_as_header ? 1 : 0, req.user.id]);

    const termin = await db.get(`
      SELECT t.*, v.name as venue_name, p.company_name as partner_name
      FROM termine t
      LEFT JOIN venues v ON t.venue_id = v.id
      LEFT JOIN partners p ON t.partner_id = p.id
      WHERE t.id = ?
    `, [result.lastID]);
    res.status(201).json({ termin });
  } catch (err) {
    console.error('POST termine error:', err);
    res.status(500).json({ error: 'Failed to create termin' });
  }
});

// Update termin
app.put('/api/termine/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  const { date, title, city, venue_id, partner_id, announcement, capacity, notes, art, art_sub, status_booking, status_public, show_title_as_header } = req.body;
  try {
    const existing = await db.get('SELECT id FROM termine WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!existing) return res.status(404).json({ error: 'Termin not found' });

    await db.run(`
      UPDATE termine SET date=?, title=?, city=?, venue_id=?, partner_id=?, announcement=?, capacity=?, notes=?,
        art=?, art_sub=?, status_booking=?, status_public=?, show_title_as_header=?, updated_at=CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `, [date, title, city || null, venue_id || null, partner_id || null, announcement || null, capacity || null, notes || null,
        art || null, art_sub || null, status_booking || null, status_public || null, show_title_as_header ? 1 : 0,
        req.params.id, req.tenant.id]);

    const termin = await db.get(`
      SELECT t.*, v.name as venue_name, p.company_name as partner_name
      FROM termine t
      LEFT JOIN venues v ON t.venue_id = v.id
      LEFT JOIN partners p ON t.partner_id = p.id
      WHERE t.id = ?
    `, [req.params.id]);
    res.json({ termin });
  } catch (err) {
    console.error('PUT termine error:', err);
    res.status(500).json({ error: 'Failed to update termin' });
  }
});

// Patch termin (partial update, only touches provided fields)
app.patch('/api/termine/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const existing = await db.get('SELECT id FROM termine WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!existing) return res.status(404).json({ error: 'Termin not found' });

    const { show_title_as_header } = req.body;
    await db.run(
      'UPDATE termine SET show_title_as_header=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?',
      [show_title_as_header ? 1 : 0, req.params.id, req.tenant.id]
    );

    const termin = await db.get(`
      SELECT t.*, v.name as venue_name, p.company_name as partner_name
      FROM termine t
      LEFT JOIN venues v ON t.venue_id = v.id
      LEFT JOIN partners p ON t.partner_id = p.id
      WHERE t.id = ?
    `, [req.params.id]);
    res.json({ termin });
  } catch (err) {
    console.error('PATCH termine error:', err);
    res.status(500).json({ error: 'Failed to patch termin' });
  }
});

// Delete termin (admin/owner only)
app.delete('/api/termine/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const role = req.tenant.role;
    if (!['owner', 'admin', 'manager'].includes(role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const existing = await db.get('SELECT id FROM termine WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!existing) return res.status(404).json({ error: 'Termin not found' });
    await db.run('DELETE FROM termine WHERE id = ?', [req.params.id]);
    res.json({ message: 'Termin deleted' });
  } catch (err) {
    console.error('DELETE termine error:', err);
    res.status(500).json({ error: 'Failed to delete termin' });
  }
});

// Set own availability for a termin
app.put('/api/termine/:id/availability', authenticateToken, requireTenant, async (req, res) => {
  const { status, comment } = req.body;
  const validStatuses = ['available', 'maybe', 'unavailable', null];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Use: available, maybe, unavailable, or null' });
  }
  try {
    const termin = await db.get('SELECT id FROM termine WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!termin) return res.status(404).json({ error: 'Termin not found' });

    await db.run(`
      INSERT INTO termin_availability (termin_id, user_id, status, comment, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(termin_id, user_id) DO UPDATE SET
        status = excluded.status,
        comment = excluded.comment,
        updated_at = CURRENT_TIMESTAMP
    `, [req.params.id, req.user.id, status, comment || null]);

    const availability = await db.get('SELECT * FROM termin_availability WHERE termin_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ availability });
  } catch (err) {
    console.error('PUT availability error:', err);
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

// Booking-Endpoints entfernt (ADR-026): Bestätigung = in termin_travel_party
// /api/termine/:id/booking/me → deprecated, antwortet 410 Gone
app.put('/api/termine/:id/booking/me', (req, res) => res.status(410).json({ error: 'Deprecated. Use travel party.' }))
app.put('/api/termine/:id/booking/:userId', (req, res) => res.status(410).json({ error: 'Deprecated. Use travel party.' }))

// ── Booking Rejections (explizite Absagen) ─────────────────────────────────────

// GET: alle abgesagten Kontakte für einen Termin
app.get('/api/termine/:terminId/booking-rejections', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all(
      'SELECT contact_id FROM termin_booking_rejections WHERE termin_id = ? AND tenant_id = ?',
      [req.params.terminId, req.tenant.id]
    )
    res.json({ rejections: rows.map(r => r.contact_id) })
  } catch (err) {
    console.error('GET booking-rejections error:', err)
    res.status(500).json({ error: 'Failed to load rejections' })
  }
})

// POST: Kontakt absagen (fügt Rejection hinzu, entfernt aus Reisegruppe)
app.post('/api/termine/:terminId/booking-rejections/:contactId', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { terminId, contactId } = req.params
    // Aus Reisegruppe entfernen
    await db.run(
      'DELETE FROM termin_travel_party WHERE termin_id = ? AND contact_id = ? AND tenant_id = ?',
      [terminId, contactId, req.tenant.id]
    )
    // Rejection setzen
    await db.run(
      'INSERT OR IGNORE INTO termin_booking_rejections (termin_id, contact_id, tenant_id) VALUES (?, ?, ?)',
      [terminId, contactId, req.tenant.id]
    )
    res.json({ success: true })
  } catch (err) {
    console.error('POST booking-rejection error:', err)
    res.status(500).json({ error: 'Failed to reject booking' })
  }
})

// DELETE: Rejection entfernen (zurück auf null)
app.delete('/api/termine/:terminId/booking-rejections/:contactId', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { terminId, contactId } = req.params
    await db.run(
      'DELETE FROM termin_booking_rejections WHERE termin_id = ? AND contact_id = ? AND tenant_id = ?',
      [terminId, contactId, req.tenant.id]
    )
    res.json({ success: true })
  } catch (err) {
    console.error('DELETE booking-rejection error:', err)
    res.status(500).json({ error: 'Failed to remove rejection' })
  }
})

// ============================================
// TERMIN CONTACTS
// ============================================

app.get('/api/termine/:terminId/contacts', authenticateToken, requireTenant, async (req, res) => {
  try {
    const contacts = await db.all(
      'SELECT * FROM termin_contacts WHERE termin_id = ? AND tenant_id = ? ORDER BY sort_order ASC, id ASC',
      [req.params.terminId, req.tenant.id]
    );
    res.json({ contacts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load contacts' });
  }
});

app.post('/api/termine/:terminId/contacts', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { label = '', first_name = '', name = '', phone = '', email = '', notes = '', sort_order = 0 } = req.body;
    const result = await db.run(
      'INSERT INTO termin_contacts (termin_id, tenant_id, label, first_name, name, phone, email, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.params.terminId, req.tenant.id, label, first_name, name, phone, email, notes, sort_order]
    );
    const contact = await db.get('SELECT * FROM termin_contacts WHERE id = ?', [result.lastID]);
    res.json({ contact });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

app.put('/api/termine/:terminId/contacts/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { label = '', first_name = '', name = '', phone = '', email = '', notes = '', sort_order } = req.body;
    await db.run(
      'UPDATE termin_contacts SET label=?, first_name=?, name=?, phone=?, email=?, notes=?, sort_order=COALESCE(?,sort_order), updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?',
      [label, first_name, name, phone, email, notes, sort_order ?? null, req.params.id, req.tenant.id]
    );
    const contact = await db.get('SELECT * FROM termin_contacts WHERE id = ?', [req.params.id]);
    res.json({ contact });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

app.delete('/api/termine/:terminId/contacts/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    await db.run(
      'DELETE FROM termin_contacts WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.tenant.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// ============================================
// TERMIN TRAVEL PARTY (Reisegruppe)
// ============================================

// GET all members for a termin – enriched with contact data + availability
app.get('/api/termine/:terminId/travel-party', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT
        tp.id, tp.termin_id, tp.tenant_id, tp.contact_id,
        tp.role1, tp.role2, tp.role3, tp.specification, tp.sort_order,
        c.first_name, c.last_name, c.email, c.phone, c.mobile,
        c.postal_code, c.residence,
        c.function1, c.function2, c.function3,
        c.user_id, c.contact_type,
        av.status AS availability_status
      FROM termin_travel_party tp
      JOIN contacts c ON c.id = tp.contact_id
      LEFT JOIN termin_availability av
        ON av.termin_id = tp.termin_id AND av.user_id = c.user_id
      WHERE tp.termin_id = ? AND tp.tenant_id = ?
      ORDER BY tp.sort_order ASC, tp.id ASC
    `, [req.params.terminId, req.tenant.id]);
    res.json({ members: rows });
  } catch (err) {
    console.error('travel-party GET failed', err);
    res.status(500).json({ error: 'Failed to load travel party' });
  }
});

// GET contact picker list – all tenant contacts with availability for this termin
app.get('/api/termine/:terminId/travel-party/picker', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT
        c.id, c.first_name, c.last_name, c.email, c.phone, c.mobile,
        c.postal_code, c.residence,
        c.function1, c.function2, c.function3,
        c.user_id, c.contact_type,
        c.crew_tool_active,
        av.status AS availability_status,
        CASE WHEN tp.id IS NOT NULL THEN 1 ELSE 0 END AS already_added
      FROM contacts c
      LEFT JOIN termin_availability av
        ON av.termin_id = ? AND av.user_id = c.user_id
      LEFT JOIN termin_travel_party tp
        ON tp.termin_id = ? AND tp.contact_id = c.id
      WHERE c.tenant_id = ?
      ORDER BY c.last_name COLLATE NOCASE ASC, c.first_name COLLATE NOCASE ASC
    `, [req.params.terminId, req.params.terminId, req.tenant.id]);
    res.json({ contacts: rows });
  } catch (err) {
    console.error('travel-party picker failed', err);
    res.status(500).json({ error: 'Failed to load picker' });
  }
});

app.post('/api/termine/:terminId/travel-party', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { contact_id, role1 = '', role2 = '', role3 = '', specification = '', sort_order = 0 } = req.body;
    if (!contact_id) return res.status(400).json({ error: 'contact_id required' });
    await db.run(
      `INSERT OR IGNORE INTO termin_travel_party
        (termin_id, tenant_id, contact_id, role1, role2, role3, specification, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.terminId, req.tenant.id, contact_id, role1, role2, role3, specification, sort_order]
    );
    const member = await db.get(`
      SELECT tp.*, c.first_name, c.last_name, c.email, c.phone, c.mobile,
             c.postal_code, c.residence, c.function1, c.function2, c.function3,
             c.user_id, c.contact_type,
             av.status AS availability_status
      FROM termin_travel_party tp
      JOIN contacts c ON c.id = tp.contact_id
      LEFT JOIN termin_availability av ON av.termin_id = tp.termin_id AND av.user_id = c.user_id
      WHERE tp.termin_id = ? AND tp.contact_id = ?
    `, [req.params.terminId, contact_id]);
    res.json({ member });
  } catch (err) {
    console.error('travel-party POST failed', err);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

app.put('/api/termine/:terminId/travel-party/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { role1 = '', role2 = '', role3 = '', specification = '', sort_order } = req.body;
    await db.run(
      `UPDATE termin_travel_party
       SET role1=?, role2=?, role3=?, specification=?,
           sort_order=COALESCE(?,sort_order), updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND tenant_id=?`,
      [role1, role2, role3, specification, sort_order ?? null, req.params.id, req.tenant.id]
    );
    const member = await db.get(`
      SELECT tp.*, c.first_name, c.last_name, c.email, c.phone, c.mobile,
             c.postal_code, c.residence, c.function1, c.function2, c.function3,
             c.user_id, c.contact_type,
             av.status AS availability_status
      FROM termin_travel_party tp
      JOIN contacts c ON c.id = tp.contact_id
      LEFT JOIN termin_availability av ON av.termin_id = tp.termin_id AND av.user_id = c.user_id
      WHERE tp.id = ?
    `, [req.params.id]);
    res.json({ member });
  } catch (err) {
    console.error('travel-party PUT failed', err);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

app.delete('/api/termine/:terminId/travel-party/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    await db.run(
      'DELETE FROM termin_travel_party WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.tenant.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

// DELETE by contact_id (für Crew-Vermittlung: Kontakt aus Reisegruppe entfernen)
app.delete('/api/termine/:terminId/travel-party/by-contact/:contactId', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    await db.run(
      'DELETE FROM termin_travel_party WHERE termin_id = ? AND contact_id = ? AND tenant_id = ?',
      [req.params.terminId, req.params.contactId, req.tenant.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// POST: einzelne Rolle zu einem Reisegruppen-Eintrag hinzufügen (legt Eintrag an falls nicht vorhanden)
app.post('/api/termine/:terminId/travel-party/add-role', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { contact_id, role } = req.body;
    if (!contact_id || !role) return res.status(400).json({ error: 'contact_id and role required' });
    const terminId = req.params.terminId;
    const entry = await db.get(
      'SELECT * FROM termin_travel_party WHERE termin_id = ? AND contact_id = ? AND tenant_id = ?',
      [terminId, contact_id, req.tenant.id]
    );
    if (!entry) {
      await db.run(
        `INSERT INTO termin_travel_party (termin_id, tenant_id, contact_id, role1, role2, role3, specification, sort_order) VALUES (?, ?, ?, ?, '', '', '', 0)`,
        [terminId, req.tenant.id, contact_id, role]
      );
    } else {
      if (entry.role1 === role || entry.role2 === role || entry.role3 === role) {
        return res.json({ success: true }); // bereits vorhanden
      }
      if (!entry.role1)      await db.run('UPDATE termin_travel_party SET role1 = ? WHERE id = ?', [role, entry.id]);
      else if (!entry.role2) await db.run('UPDATE termin_travel_party SET role2 = ? WHERE id = ?', [role, entry.id]);
      else if (!entry.role3) await db.run('UPDATE termin_travel_party SET role3 = ? WHERE id = ?', [role, entry.id]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('travel-party add-role failed', err);
    res.status(500).json({ error: 'Failed to add role' });
  }
});

// DELETE: einzelne Rolle aus Reisegruppen-Eintrag entfernen (löscht Eintrag wenn alle Rollen leer)
app.delete('/api/termine/:terminId/travel-party/by-contact/:contactId/role/:roleName', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { terminId, contactId } = req.params;
    const role = decodeURIComponent(req.params.roleName);
    const entry = await db.get(
      'SELECT * FROM termin_travel_party WHERE termin_id = ? AND contact_id = ? AND tenant_id = ?',
      [terminId, contactId, req.tenant.id]
    );
    if (!entry) return res.json({ success: true });
    const r1 = entry.role1 === role ? '' : (entry.role1 || '');
    const r2 = entry.role2 === role ? '' : (entry.role2 || '');
    const r3 = entry.role3 === role ? '' : (entry.role3 || '');
    if (!r1 && !r2 && !r3) {
      await db.run('DELETE FROM termin_travel_party WHERE id = ?', [entry.id]);
    } else {
      await db.run(
        'UPDATE termin_travel_party SET role1 = ?, role2 = ?, role3 = ? WHERE id = ?',
        [r1, r2, r3, entry.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('travel-party remove-role failed', err);
    res.status(500).json({ error: 'Failed to remove role' });
  }
});

// POST: Gast-Kontakt anlegen + direkt zur Reisegruppe hinzufügen
app.post('/api/termine/:terminId/travel-party/guest', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const {
      first_name = '', last_name = '', phone = '',
      function1 = '', function2 = '', function3 = '',
      specification = '', diet = '', allergies = '',
      gluten_free = 0, lactose_free = 0, notes = ''
    } = req.body
    if (!first_name && !last_name) {
      return res.status(400).json({ error: 'Vor- oder Nachname erforderlich' })
    }
    // Kontakt anlegen
    const contactResult = await db.run(
      `INSERT INTO contacts (tenant_id, first_name, last_name, phone,
        function1, function2, function3, specification,
        diet, allergies, gluten_free, lactose_free, notes, contact_type, crew_tool_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'guest', 1)`,
      [req.tenant.id, first_name, last_name, phone,
       function1, function2, function3, specification,
       diet, allergies, gluten_free ? 1 : 0, lactose_free ? 1 : 0, notes]
    )
    const contactId = contactResult.lastID
    // Direkt zur Reisegruppe hinzufügen
    const tpResult = await db.run(
      `INSERT INTO termin_travel_party (termin_id, tenant_id, contact_id, role1, role2, role3, sort_order)
       VALUES (?, ?, ?, ?, '', '', 0)`,
      [req.params.terminId, req.tenant.id, contactId, function1]
    )
    const member = await db.get(`
      SELECT tp.*, c.first_name, c.last_name, c.email, c.phone, c.mobile,
             c.postal_code, c.residence, c.function1, c.function2, c.function3,
             c.user_id, c.contact_type,
             av.status AS availability_status
      FROM termin_travel_party tp
      JOIN contacts c ON c.id = tp.contact_id
      LEFT JOIN termin_availability av ON av.termin_id = tp.termin_id AND av.user_id = c.user_id
      WHERE tp.id = ?
    `, [tpResult.lastID])
    res.json({ member })
  } catch (err) {
    if (String(err).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Kontakt bereits in der Reisegruppe' })
    }
    console.error('travel-party/guest POST failed', err)
    res.status(500).json({ error: 'Failed to add guest' })
  }
})

// ============================================
// SETTINGS – FUNCTIONS
// ============================================

// GET: gesamter Katalog mit active-Status pro Tenant
app.get('/api/settings/functions', authenticateToken, requireTenant, async (req, res) => {
  try {
    const disabled = await db.all(
      'SELECT function_name FROM tenant_disabled_functions WHERE tenant_id = ?',
      [req.tenant.id]
    )
    const disabledSet = new Set(disabled.map(r => r.function_name))
    const result = FUNCTION_CATALOG.map(group => ({
      group: group.group,
      functions: group.functions.map(name => ({
        name,
        active: !disabledSet.has(name),
      })),
    }))
    res.json({ catalog: result })
  } catch (err) {
    console.error('settings/functions GET failed', err)
    res.status(500).json({ error: 'Failed to load functions' })
  }
})

// PUT: aktive Funktionen setzen (vollständige Liste der aktivierten)
app.put('/api/settings/functions', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { active_functions } = req.body // Array von Namen die AKTIV sind
    if (!Array.isArray(active_functions)) {
      return res.status(400).json({ error: 'active_functions must be an array' })
    }
    const activeSet = new Set(active_functions)
    const allFunctions = FUNCTION_CATALOG.flatMap(g => g.functions)
    const toDisable = allFunctions.filter(name => !activeSet.has(name))

    await db.run('DELETE FROM tenant_disabled_functions WHERE tenant_id = ?', [req.tenant.id])
    for (const name of toDisable) {
      await db.run(
        'INSERT INTO tenant_disabled_functions (tenant_id, function_name) VALUES (?, ?)',
        [req.tenant.id, name]
      )
    }
    res.json({ success: true })
  } catch (err) {
    console.error('settings/functions PUT failed', err)
    res.status(500).json({ error: 'Failed to save functions' })
  }
})

// GET: nur die aktiven Funktionen (für Dropdowns in der App)
app.get('/api/settings/functions/active', authenticateToken, requireTenant, async (req, res) => {
  try {
    const disabled = await db.all(
      'SELECT function_name FROM tenant_disabled_functions WHERE tenant_id = ?',
      [req.tenant.id]
    )
    const disabledSet = new Set(disabled.map(r => r.function_name))
    const active = FUNCTION_CATALOG.flatMap(g =>
      g.functions.filter(name => !disabledSet.has(name)).map(name => ({ name, group: g.group }))
    )
    res.json({ functions: active })
  } catch (err) {
    console.error('settings/functions/active GET failed', err)
    res.status(500).json({ error: 'Failed to load active functions' })
  }
})

// ============================================
// TERMIN TRAVEL LEGS (Anreise / Rückreise)
// ============================================

const LEG_FIELDS = `
  tl.*,
  v.designation AS vehicle_designation,
  v.vehicle_type AS vehicle_vehicle_type,
  v.seats AS vehicle_seats,
  v.sleeping_places AS vehicle_sleeping_places,
  v.has_trailer AS vehicle_has_trailer,
  v.license_plate AS vehicle_license_plate
`

async function getLegWithPersons(db, legId) {
  const leg = await db.get(`
    SELECT ${LEG_FIELDS}
    FROM termin_travel_legs tl
    LEFT JOIN vehicles v ON v.id = tl.vehicle_id
    WHERE tl.id = ?
  `, [legId])
  if (!leg) return null
  const persons = await db.all(`
    SELECT tlp.id, tlp.travel_party_member_id,
           c.first_name, c.last_name, c.contact_type,
           tp.role1
    FROM termin_travel_leg_persons tlp
    JOIN termin_travel_party tp ON tp.id = tlp.travel_party_member_id
    JOIN contacts c ON c.id = tp.contact_id
    WHERE tlp.leg_id = ?
    ORDER BY c.last_name COLLATE NOCASE ASC
  `, [legId])
  return { ...leg, persons }
}

// GET all legs for a termin (by type)
app.get('/api/termine/:terminId/travel-legs', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { leg_type } = req.query
    const rows = await db.all(`
      SELECT ${LEG_FIELDS}
      FROM termin_travel_legs tl
      LEFT JOIN vehicles v ON v.id = tl.vehicle_id
      WHERE tl.termin_id = ? AND tl.tenant_id = ?
        ${leg_type ? `AND tl.leg_type = '${leg_type === 'departure' ? 'departure' : 'arrival'}'` : ''}
      ORDER BY tl.sort_order ASC, tl.id ASC
    `, [req.params.terminId, req.tenant.id])
    // Attach persons to each leg
    const legs = await Promise.all(rows.map(async row => {
      const persons = await db.all(`
        SELECT tlp.id, tlp.travel_party_member_id,
               c.first_name, c.last_name, c.contact_type,
               tp.role1
        FROM termin_travel_leg_persons tlp
        JOIN termin_travel_party tp ON tp.id = tlp.travel_party_member_id
        JOIN contacts c ON c.id = tp.contact_id
        WHERE tlp.leg_id = ?
        ORDER BY c.last_name COLLATE NOCASE ASC
      `, [row.id])
      return { ...row, persons }
    }))
    res.json({ legs })
  } catch (err) {
    console.error('travel-legs GET failed', err)
    res.status(500).json({ error: 'Failed to load travel legs' })
  }
})

// POST create leg
app.post('/api/termine/:terminId/travel-legs', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const b = req.body
    const result = await db.run(`
      INSERT INTO termin_travel_legs
        (termin_id, tenant_id, leg_type, transport_type,
         vehicle_id, train_number, train_booking_code, train_platform, train_from, train_to,
         flight_number, flight_booking_code, flight_terminal, flight_airport_from, flight_airport_to,
         other_transport, from_location, to_location, distance_km, travel_time_minutes,
         departure_date, departure_time, arrival_date, arrival_time,
         notes, visibility_restricted, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      req.params.terminId, req.tenant.id,
      b.leg_type || 'arrival', b.transport_type || 'vehicle',
      b.vehicle_id || null,
      b.train_number || '', b.train_booking_code || '', b.train_platform || '', b.train_from || '', b.train_to || '',
      b.flight_number || '', b.flight_booking_code || '', b.flight_terminal || '', b.flight_airport_from || '', b.flight_airport_to || '',
      b.other_transport || '',
      b.from_location || '', b.to_location || '',
      b.distance_km ?? null, b.travel_time_minutes ?? null,
      b.departure_date || '', b.departure_time || '',
      b.arrival_date || '', b.arrival_time || '',
      b.notes || '', b.visibility_restricted ? 1 : 0,
      b.sort_order ?? 0,
    ])
    const leg = await getLegWithPersons(db, result.lastID)
    res.json({ leg })
  } catch (err) {
    console.error('travel-legs POST failed', err)
    res.status(500).json({ error: 'Failed to create travel leg' })
  }
})

// PUT update leg
app.put('/api/termine/:terminId/travel-legs/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const b = req.body
    await db.run(`
      UPDATE termin_travel_legs SET
        leg_type=?, transport_type=?, vehicle_id=?,
        train_number=?, train_booking_code=?, train_platform=?, train_from=?, train_to=?,
        flight_number=?, flight_booking_code=?, flight_terminal=?, flight_airport_from=?, flight_airport_to=?,
        other_transport=?, from_location=?, to_location=?,
        distance_km=?, travel_time_minutes=?,
        departure_date=?, departure_time=?, arrival_date=?, arrival_time=?,
        notes=?, visibility_restricted=?, sort_order=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND tenant_id=?
    `, [
      b.leg_type || 'arrival', b.transport_type || 'vehicle',
      b.vehicle_id || null,
      b.train_number || '', b.train_booking_code || '', b.train_platform || '', b.train_from || '', b.train_to || '',
      b.flight_number || '', b.flight_booking_code || '', b.flight_terminal || '', b.flight_airport_from || '',
      b.flight_airport_to || '', b.other_transport || '',
      b.from_location || '', b.to_location || '',
      b.distance_km ?? null, b.travel_time_minutes ?? null,
      b.departure_date || '', b.departure_time || '',
      b.arrival_date || '', b.arrival_time || '',
      b.notes || '', b.visibility_restricted ? 1 : 0,
      b.sort_order ?? 0,
      req.params.id, req.tenant.id,
    ])
    const leg = await getLegWithPersons(db, req.params.id)
    res.json({ leg })
  } catch (err) {
    console.error('travel-legs PUT failed', err)
    res.status(500).json({ error: 'Failed to update travel leg' })
  }
})

// DELETE leg
app.delete('/api/termine/:terminId/travel-legs/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    await db.run('DELETE FROM termin_travel_legs WHERE id=? AND tenant_id=?', [req.params.id, req.tenant.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete travel leg' })
  }
})

// PUT persons for a leg (vollständige Liste ersetzen)
app.put('/api/termine/:terminId/travel-legs/:id/persons', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { member_ids } = req.body // Array of travel_party_member ids
    await db.run('DELETE FROM termin_travel_leg_persons WHERE leg_id=?', [req.params.id])
    for (const memberId of (member_ids || [])) {
      try {
        await db.run(
          'INSERT INTO termin_travel_leg_persons (leg_id, travel_party_member_id, tenant_id) VALUES (?,?,?)',
          [req.params.id, memberId, req.tenant.id]
        )
      } catch { /* ignore duplicates */ }
    }
    const leg = await getLegWithPersons(db, req.params.id)
    res.json({ leg })
  } catch (err) {
    console.error('travel-leg-persons PUT failed', err)
    res.status(500).json({ error: 'Failed to update persons' })
  }
})

// ============================================
// TERMIN HOTEL STAYS
// ============================================

async function getStayWithRooms(db, stayId) {
  const stay = await db.get(`
    SELECT hs.*, h.name AS hotel_name, h.city AS hotel_city, h.street AS hotel_street,
           h.postal_code AS hotel_postal_code, h.phone AS hotel_phone, h.email AS hotel_email,
           h.website AS hotel_website, h.check_in AS hotel_check_in, h.check_out AS hotel_check_out
    FROM termin_hotel_stays hs
    LEFT JOIN hotels h ON h.id = hs.hotel_id
    WHERE hs.id = ?
  `, [stayId])
  if (!stay) return null
  const rooms = await db.all(
    'SELECT * FROM termin_hotel_rooms WHERE stay_id = ? ORDER BY id ASC',
    [stayId]
  )
  const roomsWithPersons = await Promise.all(rooms.map(async room => {
    const persons = await db.all(`
      SELECT hrp.id, hrp.travel_party_member_id,
             c.first_name, c.last_name, tp.role1
      FROM termin_hotel_room_persons hrp
      JOIN termin_travel_party tp ON tp.id = hrp.travel_party_member_id
      JOIN contacts c ON c.id = tp.contact_id
      WHERE hrp.room_id = ?
      ORDER BY c.last_name COLLATE NOCASE ASC
    `, [room.id])
    return { ...room, persons }
  }))
  return { ...stay, rooms: roomsWithPersons }
}

// GET all stays for a termin
app.get('/api/termine/:terminId/hotel-stays', authenticateToken, requireTenant, async (req, res) => {
  try {
    const stayRows = await db.all(`
      SELECT hs.*, h.name AS hotel_name, h.city AS hotel_city, h.street AS hotel_street,
             h.postal_code AS hotel_postal_code, h.phone AS hotel_phone, h.email AS hotel_email,
             h.website AS hotel_website, h.check_in AS hotel_check_in, h.check_out AS hotel_check_out
      FROM termin_hotel_stays hs
      LEFT JOIN hotels h ON h.id = hs.hotel_id
      WHERE hs.termin_id = ? AND hs.tenant_id = ?
      ORDER BY hs.sort_order ASC, hs.id ASC
    `, [req.params.terminId, req.tenant.id])
    const stays = await Promise.all(stayRows.map(async stay => {
      const rooms = await db.all(
        'SELECT * FROM termin_hotel_rooms WHERE stay_id = ? ORDER BY id ASC',
        [stay.id]
      )
      const roomsWithPersons = await Promise.all(rooms.map(async room => {
        const persons = await db.all(`
          SELECT hrp.id, hrp.travel_party_member_id,
                 c.first_name, c.last_name, tp.role1
          FROM termin_hotel_room_persons hrp
          JOIN termin_travel_party tp ON tp.id = hrp.travel_party_member_id
          JOIN contacts c ON c.id = tp.contact_id
          WHERE hrp.room_id = ?
          ORDER BY c.last_name COLLATE NOCASE ASC
        `, [room.id])
        return { ...room, persons }
      }))
      return { ...stay, rooms: roomsWithPersons }
    }))
    res.json({ stays })
  } catch (err) {
    console.error('hotel-stays GET failed', err)
    res.status(500).json({ error: 'Failed to load hotel stays' })
  }
})

// POST new stay
app.post('/api/termine/:terminId/hotel-stays', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const {
      hotel_id = null, check_in_date = '', check_out_date = '',
      booking_code = '', notes = '', visibility_restricted = 0, sort_order = 0
    } = req.body
    const result = await db.run(
      `INSERT INTO termin_hotel_stays
        (termin_id, tenant_id, hotel_id, check_in_date, check_out_date,
         booking_code, notes, visibility_restricted, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [req.params.terminId, req.tenant.id, hotel_id, check_in_date, check_out_date,
       booking_code, notes, visibility_restricted ? 1 : 0, sort_order]
    )
    const stay = await getStayWithRooms(db, result.lastID)
    res.json({ stay })
  } catch (err) {
    console.error('hotel-stays POST failed', err)
    res.status(500).json({ error: 'Failed to create hotel stay' })
  }
})

// PUT update stay
app.put('/api/termine/:terminId/hotel-stays/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const {
      hotel_id = null, check_in_date = '', check_out_date = '',
      booking_code = '', notes = '', visibility_restricted = 0, sort_order
    } = req.body
    await db.run(
      `UPDATE termin_hotel_stays SET
        hotel_id=?, check_in_date=?, check_out_date=?,
        booking_code=?, notes=?, visibility_restricted=?,
        sort_order=COALESCE(?,sort_order), updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND tenant_id=?`,
      [hotel_id, check_in_date, check_out_date,
       booking_code, notes, visibility_restricted ? 1 : 0,
       sort_order ?? null, req.params.id, req.tenant.id]
    )
    const stay = await getStayWithRooms(db, req.params.id)
    res.json({ stay })
  } catch (err) {
    console.error('hotel-stays PUT failed', err)
    res.status(500).json({ error: 'Failed to update hotel stay' })
  }
})

// DELETE stay (cascades zu rooms + persons via FK)
app.delete('/api/termine/:terminId/hotel-stays/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    await db.run('DELETE FROM termin_hotel_stays WHERE id=? AND tenant_id=?', [req.params.id, req.tenant.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete hotel stay' })
  }
})

// PUT rooms for a stay – vollständiger Sync (delete + reinsert)
// Body: { rooms: [{ room_type, room_label, member_ids: [] }] }
app.put('/api/termine/:terminId/hotel-stays/:id/rooms', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const stayId = req.params.id
    const { rooms = [] } = req.body
    await db.run('DELETE FROM termin_hotel_rooms WHERE stay_id = ?', [stayId])
    for (const room of rooms) {
      const roomResult = await db.run(
        'INSERT INTO termin_hotel_rooms (stay_id, tenant_id, room_type, room_label) VALUES (?,?,?,?)',
        [stayId, req.tenant.id, room.room_type || 'einzelzimmer', room.room_label || '']
      )
      for (const memberId of (room.member_ids || [])) {
        try {
          await db.run(
            'INSERT INTO termin_hotel_room_persons (room_id, travel_party_member_id, tenant_id) VALUES (?,?,?)',
            [roomResult.lastID, memberId, req.tenant.id]
          )
        } catch { /* ignore duplicates */ }
      }
    }
    const stay = await getStayWithRooms(db, stayId)
    res.json({ stay })
  } catch (err) {
    console.error('hotel-stay-rooms PUT failed', err)
    res.status(500).json({ error: 'Failed to update rooms' })
  }
})

// ============================================
// TERMIN SCHEDULES
// ============================================

app.get('/api/termine/:terminId/schedules', authenticateToken, requireTenant, async (req, res) => {
  try {
    const schedules = await db.all(
      'SELECT * FROM termin_schedules WHERE termin_id = ? AND tenant_id = ? ORDER BY sort_order ASC, id ASC',
      [req.params.terminId, req.tenant.id]
    );
    res.json({ schedules });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load schedules' });
  }
});

app.post('/api/termine/:terminId/schedules', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { title = '', content = '', not_final = 0, sort_order = 0 } = req.body;
    const result = await db.run(
      'INSERT INTO termin_schedules (termin_id, tenant_id, title, content, not_final, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.terminId, req.tenant.id, title, content, not_final ? 1 : 0, sort_order]
    );
    const schedule = await db.get('SELECT * FROM termin_schedules WHERE id = ?', [result.lastID]);
    res.json({ schedule });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

app.put('/api/termine/:terminId/schedules/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { title = '', content = '', not_final = 0, sort_order } = req.body;
    await db.run(
      'UPDATE termin_schedules SET title=?, content=?, not_final=?, sort_order=COALESCE(?,sort_order), updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?',
      [title, content, not_final ? 1 : 0, sort_order ?? null, req.params.id, req.tenant.id]
    );
    const schedule = await db.get('SELECT * FROM termin_schedules WHERE id = ?', [req.params.id]);
    res.json({ schedule });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

app.get('/api/termine/:terminId/schedules/:id/pdf', async (req, res) => {
  try {
    // Auth: Bearer header oder ?token= Query-Parameter (für direktes window.open)
    const authHeader = req.headers['authorization'];
    const tokenStr = (authHeader && authHeader.split(' ')[1]) || req.query.token;
    if (!tokenStr) return res.status(401).json({ error: 'Access token required' });

    let user;
    try {
      user = jwt.verify(tokenStr, JWT_SECRET);
    } catch (e) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Tenant: X-Tenant-Slug Header oder ?tenant= Query-Parameter
    const tenantSlug = req.headers['x-tenant-slug'] || req.query.tenant;
    if (!tenantSlug) return res.status(400).json({ error: 'Tenant required' });

    let tenant;
    if (user.isSuperadmin) {
      tenant = await db.get('SELECT id FROM tenants WHERE slug = ?', [tenantSlug]);
    } else {
      tenant = await db.get(`
        SELECT t.id FROM tenants t
        JOIN user_tenants ut ON t.id = ut.tenant_id
        WHERE t.slug = ? AND ut.user_id = ? AND ut.status = 'active'
      `, [tenantSlug, user.id]);
    }
    if (!tenant) return res.status(403).json({ error: 'No access to this tenant' });

    const schedule = await db.get(
      'SELECT * FROM termin_schedules WHERE id = ? AND tenant_id = ?',
      [req.params.id, tenant.id]
    );
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    const { generateSchedulePdf } = require('./generate_schedule_pdf');
    const pdf = await generateSchedulePdf({
      title:    schedule.title    || '',
      content:  schedule.content  || '',
      notFinal: Boolean(schedule.not_final),
    });

    const safeName = (schedule.title || 'zeitplan').replace(/[^a-zA-Z0-9_\-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.end(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Hotel-Belegung als PDF
app.get('/api/termine/:terminId/hotel-pdf', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const tokenStr = (authHeader && authHeader.split(' ')[1]) || req.query.token;
    if (!tokenStr) return res.status(401).json({ error: 'Access token required' });

    let user;
    try { user = jwt.verify(tokenStr, JWT_SECRET); }
    catch (e) { return res.status(403).json({ error: 'Invalid or expired token' }); }

    const tenantSlug = req.headers['x-tenant-slug'] || req.query.tenant;
    if (!tenantSlug) return res.status(400).json({ error: 'Tenant required' });

    let tenant;
    if (user.isSuperadmin) {
      tenant = await db.get('SELECT id FROM tenants WHERE slug = ?', [tenantSlug]);
    } else {
      tenant = await db.get(`
        SELECT t.id FROM tenants t
        JOIN user_tenants ut ON t.id = ut.tenant_id
        WHERE t.slug = ? AND ut.user_id = ? AND ut.status = 'active'
      `, [tenantSlug, user.id]);
    }
    if (!tenant) return res.status(403).json({ error: 'No access to this tenant' });

    const terminId = req.params.terminId;

    // Termin-Basis-Info
    const termin = await db.get(
      'SELECT date, title, city FROM termine WHERE id = ? AND tenant_id = ?',
      [terminId, tenant.id]
    );
    if (!termin) return res.status(404).json({ error: 'Termin not found' });

    // Hotel-Stays (mit Hotel-Daten via JOIN)
    const stayRows = await db.all(`
      SELECT hs.*, h.name AS hotel_name, h.city AS hotel_city, h.street AS hotel_street,
             h.postal_code AS hotel_postal_code, h.phone AS hotel_phone, h.email AS hotel_email,
             h.website AS hotel_website
      FROM termin_hotel_stays hs
      LEFT JOIN hotels h ON h.id = hs.hotel_id
      WHERE hs.termin_id = ? AND hs.tenant_id = ?
      ORDER BY hs.sort_order ASC, hs.id ASC
    `, [terminId, tenant.id]);

    // Rooms + Persons für jeden Stay
    const stays = await Promise.all(stayRows.map(async stay => {
      const rooms = await db.all(
        'SELECT * FROM termin_hotel_rooms WHERE stay_id = ? ORDER BY id ASC',
        [stay.id]
      );
      const roomsWithPersons = await Promise.all(rooms.map(async room => {
        const persons = await db.all(`
          SELECT c.first_name, c.last_name
          FROM termin_hotel_room_persons hrp
          JOIN termin_travel_party tp ON tp.id = hrp.travel_party_member_id
          JOIN contacts c ON c.id = tp.contact_id
          WHERE hrp.room_id = ?
          ORDER BY c.last_name COLLATE NOCASE ASC
        `, [room.id]);
        return { ...room, persons };
      }));
      return { ...stay, rooms: roomsWithPersons };
    }));

    const { generateHotelPdf } = require('./generate_hotel_pdf');
    const pdf = await generateHotelPdf({ termin, stays });

    const safeName = `hotel_${(termin.city || termin.title || 'belegung').replace(/[^a-zA-Z0-9_\-]/g, '_')}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.end(pdf);
  } catch (err) {
    console.error('hotel-pdf error', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Advance Sheet PDF (aggregiert alle Termin-Daten)
app.get('/api/termine/:terminId/advance-sheet/pdf', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const tokenStr = (authHeader && authHeader.split(' ')[1]) || req.query.token;
    if (!tokenStr) return res.status(401).json({ error: 'Access token required' });

    let user;
    try { user = jwt.verify(tokenStr, JWT_SECRET); }
    catch (e) { return res.status(403).json({ error: 'Invalid or expired token' }); }

    const tenantSlug = req.headers['x-tenant-slug'] || req.query.tenant;
    if (!tenantSlug) return res.status(400).json({ error: 'Tenant required' });

    let tenant;
    if (user.isSuperadmin) {
      tenant = await db.get('SELECT id FROM tenants WHERE slug = ?', [tenantSlug]);
    } else {
      tenant = await db.get(`
        SELECT t.id FROM tenants t
        JOIN user_tenants ut ON t.id = ut.tenant_id
        WHERE t.slug = ? AND ut.user_id = ? AND ut.status = 'active'
      `, [tenantSlug, user.id]);
    }
    if (!tenant) return res.status(403).json({ error: 'No access to this tenant' });

    const terminId = req.params.terminId;
    const sectionsParam = req.query.sections || 'show,venue,partner,contacts,schedules,travel,hotel,travelparty,catering,todos';
    const sections = sectionsParam.split(',').map(s => s.trim());

    // Termin
    const termin = await db.get(
      'SELECT t.*, v.name AS venue_name FROM termine t LEFT JOIN venues v ON v.id = t.venue_id WHERE t.id = ? AND t.tenant_id = ?',
      [terminId, tenant.id]
    );
    if (!termin) return res.status(404).json({ error: 'Termin not found' });

    const data = {};

    // Venue
    if (sections.includes('venue') && termin.venue_id) {
      data.venue = await db.get('SELECT * FROM venues WHERE id = ? AND tenant_id = ?', [termin.venue_id, tenant.id]);
    }

    // Partner
    if (sections.includes('partner') && termin.partner_id) {
      data.partner = await db.get('SELECT * FROM partners WHERE id = ? AND tenant_id = ?', [termin.partner_id, tenant.id]);
    }

    // Lokale Kontakte
    if (sections.includes('contacts')) {
      data.localContacts = await db.all(
        'SELECT * FROM termin_contacts WHERE termin_id = ? AND tenant_id = ? ORDER BY sort_order ASC, id ASC',
        [terminId, tenant.id]
      );
    }

    // Zeitpläne
    if (sections.includes('schedules')) {
      data.schedules = await db.all(
        'SELECT * FROM termin_schedules WHERE termin_id = ? AND tenant_id = ? ORDER BY sort_order ASC, id ASC',
        [terminId, tenant.id]
      );
    }

    // Travel legs
    if (sections.includes('travel')) {
      const legRows = await db.all(`
        SELECT ${LEG_FIELDS}
        FROM termin_travel_legs tl
        LEFT JOIN vehicles v ON v.id = tl.vehicle_id
        WHERE tl.termin_id = ? AND tl.tenant_id = ?
        ORDER BY tl.leg_type ASC, tl.sort_order ASC, tl.id ASC
      `, [terminId, tenant.id]);
      data.legs = await Promise.all(legRows.map(async leg => {
        const persons = await db.all(`
          SELECT tlp.id, c.first_name, c.last_name
          FROM termin_travel_leg_persons tlp
          JOIN termin_travel_party tp ON tp.id = tlp.travel_party_member_id
          JOIN contacts c ON c.id = tp.contact_id
          WHERE tlp.leg_id = ?
          ORDER BY c.last_name COLLATE NOCASE ASC
        `, [leg.id]);
        return { ...leg, persons };
      }));
    }

    // Hotel
    if (sections.includes('hotel')) {
      const stayRows = await db.all(`
        SELECT hs.*, h.name AS hotel_name, h.city AS hotel_city, h.street AS hotel_street,
               h.postal_code AS hotel_postal_code, h.phone AS hotel_phone, h.email AS hotel_email,
               h.website AS hotel_website
        FROM termin_hotel_stays hs
        LEFT JOIN hotels h ON h.id = hs.hotel_id
        WHERE hs.termin_id = ? AND hs.tenant_id = ?
        ORDER BY hs.sort_order ASC, hs.id ASC
      `, [terminId, tenant.id]);
      data.hotelStays = await Promise.all(stayRows.map(async stay => {
        const rooms = await db.all('SELECT * FROM termin_hotel_rooms WHERE stay_id = ? ORDER BY id ASC', [stay.id]);
        const roomsWithPersons = await Promise.all(rooms.map(async room => {
          const persons = await db.all(`
            SELECT c.first_name, c.last_name
            FROM termin_hotel_room_persons hrp
            JOIN termin_travel_party tp ON tp.id = hrp.travel_party_member_id
            JOIN contacts c ON c.id = tp.contact_id
            WHERE hrp.room_id = ?
            ORDER BY c.last_name COLLATE NOCASE ASC
          `, [room.id]);
          return { ...room, persons };
        }));
        return { ...stay, rooms: roomsWithPersons };
      }));
    }

    // Reisegruppe
    if (sections.includes('travelparty')) {
      data.travelParty = await db.all(`
        SELECT tp.*, c.first_name, c.last_name
        FROM termin_travel_party tp
        JOIN contacts c ON c.id = tp.contact_id
        WHERE tp.termin_id = ? AND tp.tenant_id = ?
        ORDER BY c.last_name COLLATE NOCASE ASC, c.first_name COLLATE NOCASE ASC
      `, [terminId, tenant.id]);
    }

    // Catering
    if (sections.includes('catering')) {
      data.catering = await db.get('SELECT * FROM termin_catering WHERE termin_id = ? AND tenant_id = ?', [terminId, tenant.id]);
      if (data.catering) {
        data.cateringOrders = await db.all(
          'SELECT * FROM termin_catering_orders WHERE termin_id = ? AND tenant_id = ? ORDER BY id ASC',
          [terminId, tenant.id]
        );
      }
    }

    // TODOs
    if (sections.includes('todos')) {
      const todoRows = await db.all(`
        SELECT tt.*, c.first_name, c.last_name
        FROM termin_todos tt
        LEFT JOIN contacts c ON c.id = tt.assigned_contact_id
        WHERE tt.termin_id = ? AND tt.tenant_id = ? AND tt.status != 'done'
        ORDER BY CASE tt.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, tt.id ASC
      `, [terminId, tenant.id]);
      data.todos = todoRows.map(t => ({
        ...t,
        assigned_name: t.first_name ? `${t.first_name} ${t.last_name || ''}`.trim() : null,
      }));
    }

    const { generateAdvanceSheetPdf } = require('./generate_advance_sheet');
    const pdf = await generateAdvanceSheetPdf({ termin, sections, data });

    const safeName = `advance_${(termin.city || termin.title || 'sheet').replace(/[^a-zA-Z0-9_\-]/g, '_')}_${(termin.date || '').replace(/-/g, '')}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.end(pdf);
  } catch (err) {
    console.error('advance-sheet-pdf error', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

app.delete('/api/termine/:terminId/schedules/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    await db.run(
      'DELETE FROM termin_schedules WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.tenant.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// ============================================
// BOARDS — generische ContentBoard API
// Wird von ContentBoard.tsx genutzt (Schreibtisch, etc.)
// ============================================

function boardFromRow(r) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    title: r.title,
    content: r.content,
    notFinal: Boolean(r.not_final),
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

app.get('/api/boards/:entityType/:entityId', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all(
      'SELECT * FROM boards WHERE tenant_id=? AND entity_type=? AND entity_id=? ORDER BY sort_order ASC, id ASC',
      [req.tenant.id, req.params.entityType, req.params.entityId]
    );
    res.json({ items: rows.map(boardFromRow) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load board items' });
  }
});

app.post('/api/boards/:entityType/:entityId', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { title = '', content = '', notFinal = false, sortOrder = 0 } = req.body;
    console.log('[boards POST]', req.params, { title, notFinal, sortOrder, tenant: req.tenant?.id });
    const result = await db.run(
      'INSERT INTO boards (tenant_id, entity_type, entity_id, title, content, not_final, sort_order) VALUES (?,?,?,?,?,?,?)',
      [req.tenant.id, req.params.entityType, req.params.entityId, title, content, notFinal ? 1 : 0, sortOrder]
    );
    const row = await db.get('SELECT * FROM boards WHERE id = ?', [result.lastID]);
    console.log('[boards POST] saved id:', result.lastID);
    res.json({ item: boardFromRow(row) });
  } catch (err) {
    console.error('[boards POST] ERROR:', err);
    res.status(500).json({ error: err.message || 'Failed to create board item' });
  }
});

app.put('/api/boards/:entityType/:entityId/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { title = '', content = '', notFinal = false, sortOrder } = req.body;
    await db.run(
      'UPDATE boards SET title=?, content=?, not_final=?, sort_order=COALESCE(?,sort_order), updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?',
      [title, content, notFinal ? 1 : 0, sortOrder ?? null, req.params.id, req.tenant.id]
    );
    const row = await db.get('SELECT * FROM boards WHERE id = ?', [req.params.id]);
    res.json({ item: boardFromRow(row) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update board item' });
  }
});

app.delete('/api/boards/:entityType/:entityId/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    await db.run(
      'DELETE FROM boards WHERE id=? AND tenant_id=?',
      [req.params.id, req.tenant.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete board item' });
  }
});

// ============================================
// TODOS
// ============================================

// GET /api/termine/:terminId/todos
app.get('/api/termine/:terminId/todos', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT t.*,
        c.first_name AS assigned_first_name,
        c.last_name  AS assigned_last_name
      FROM termin_todos t
      LEFT JOIN contacts c ON c.id = t.assigned_contact_id AND c.tenant_id = t.tenant_id
      WHERE t.tenant_id = ? AND t.termin_id = ?
      ORDER BY
        CASE t.status WHEN 'done' THEN 1 ELSE 0 END ASC,
        CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END ASC,
        t.deadline ASC NULLS LAST,
        t.sort_order ASC, t.id ASC
    `, [req.tenant.id, req.params.terminId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/termine/:terminId/todos
app.post('/api/termine/:terminId/todos', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { title, description, status = 'open', priority = 'medium', assignedContactId, deadline } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title required' });
    const result = await db.run(`
      INSERT INTO termin_todos (tenant_id, termin_id, title, description, status, priority, assigned_contact_id, deadline, created_by_user_id)
      VALUES (?,?,?,?,?,?,?,?,?)
    `, [req.tenant.id, req.params.terminId, title.trim(), description || null, status, priority, assignedContactId || null, deadline || null, req.user.id]);
    const row = await db.get(`
      SELECT t.*, c.first_name AS assigned_first_name, c.last_name AS assigned_last_name
      FROM termin_todos t LEFT JOIN contacts c ON c.id = t.assigned_contact_id AND c.tenant_id = t.tenant_id
      WHERE t.id = ?
    `, [result.lastID]);
    res.status(201).json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/termine/:terminId/todos/:id
app.put('/api/termine/:terminId/todos/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { title, description, status, priority, assignedContactId, deadline } = req.body;
    await db.run(`
      UPDATE termin_todos
      SET title=COALESCE(?,title), description=?, status=COALESCE(?,status),
          priority=COALESCE(?,priority), assigned_contact_id=?,
          deadline=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND tenant_id=? AND termin_id=?
    `, [title?.trim() || null, description ?? null, status || null, priority || null,
        assignedContactId ?? null, deadline ?? null,
        req.params.id, req.tenant.id, req.params.terminId]);
    const row = await db.get(`
      SELECT t.*, c.first_name AS assigned_first_name, c.last_name AS assigned_last_name
      FROM termin_todos t LEFT JOIN contacts c ON c.id = t.assigned_contact_id AND c.tenant_id = t.tenant_id
      WHERE t.id = ?
    `, [req.params.id]);
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/termine/:terminId/todos/:id
app.delete('/api/termine/:terminId/todos/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    await db.run('DELETE FROM termin_todos WHERE id=? AND tenant_id=? AND termin_id=?',
      [req.params.id, req.tenant.id, req.params.terminId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/todos — global, alle Todos des Tenants (für Schreibtisch)
app.get('/api/todos', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT t.*,
        c.first_name AS assigned_first_name,
        c.last_name  AS assigned_last_name,
        te.title AS termin_title,
        te.date  AS termin_date,
        te.city  AS termin_city
      FROM termin_todos t
      LEFT JOIN contacts c ON c.id = t.assigned_contact_id AND c.tenant_id = t.tenant_id
      LEFT JOIN termine te ON te.id = t.termin_id
      WHERE t.tenant_id = ?
      ORDER BY
        CASE t.status WHEN 'done' THEN 1 ELSE 0 END ASC,
        CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END ASC,
        t.deadline ASC NULLS LAST,
        t.created_at ASC
    `, [req.tenant.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// CATERING
// ============================================

// GET /api/termine/:terminId/catering
app.get('/api/termine/:terminId/catering', authenticateToken, requireTenant, async (req, res) => {
  try {
    const row = await db.get(
      'SELECT * FROM termin_catering WHERE termin_id=? AND tenant_id=?',
      [req.params.terminId, req.tenant.id]
    );

    // Diät-Daten aus der Reisegruppe – bevorzuge User-Profil wenn vorhanden
    const members = await db.all(`
      SELECT
        tp.id, tp.contact_id, c.first_name, c.last_name,
        COALESCE(u.diet,        c.diet)        AS diet,
        COALESCE(u.gluten_free, c.gluten_free) AS gluten_free,
        COALESCE(u.lactose_free,c.lactose_free)AS lactose_free,
        COALESCE(u.allergies,   c.allergies)   AS allergies,
        COALESCE(u.special_notes, c.notes)     AS special_notes
      FROM termin_travel_party tp
      JOIN contacts c ON c.id = tp.contact_id
      LEFT JOIN users u ON u.id = c.user_id
      WHERE tp.termin_id=? AND tp.tenant_id=?
      ORDER BY tp.sort_order ASC, tp.id ASC
    `, [req.params.terminId, req.tenant.id]);

    res.json({ catering: row || null, members });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/termine/:terminId/catering (upsert)
app.put('/api/termine/:terminId/catering', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { type, buyout_amount, notes, contact_name, contact_phone } = req.body;
    const existing = await db.get(
      'SELECT id FROM termin_catering WHERE termin_id=? AND tenant_id=?',
      [req.params.terminId, req.tenant.id]
    );
    if (existing) {
      await db.run(
        `UPDATE termin_catering SET type=?, buyout_amount=?, notes=?, contact_name=?, contact_phone=?, updated_at=CURRENT_TIMESTAMP
         WHERE termin_id=? AND tenant_id=?`,
        [type, buyout_amount ?? null, notes ?? null, contact_name ?? null, contact_phone ?? null,
         req.params.terminId, req.tenant.id]
      );
    } else {
      await db.run(
        `INSERT INTO termin_catering (tenant_id, termin_id, type, buyout_amount, notes, contact_name, contact_phone)
         VALUES (?,?,?,?,?,?,?)`,
        [req.tenant.id, req.params.terminId, type, buyout_amount ?? null, notes ?? null, contact_name ?? null, contact_phone ?? null]
      );
    }
    const row = await db.get('SELECT * FROM termin_catering WHERE termin_id=? AND tenant_id=?', [req.params.terminId, req.tenant.id]);
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/termine/:terminId/catering/orders
app.get('/api/termine/:terminId/catering/orders', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all(
      'SELECT * FROM termin_catering_orders WHERE termin_id=? AND tenant_id=? ORDER BY id ASC',
      [req.params.terminId, req.tenant.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/termine/:terminId/catering/orders
app.post('/api/termine/:terminId/catering/orders', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { contact_id, contact_name, order_text } = req.body;
    const result = await db.run(
      `INSERT INTO termin_catering_orders (tenant_id, termin_id, contact_id, contact_name, order_text)
       VALUES (?,?,?,?,?)`,
      [req.tenant.id, req.params.terminId, contact_id ?? null, contact_name ?? null, order_text ?? '']
    );
    const row = await db.get('SELECT * FROM termin_catering_orders WHERE id=?', [result.lastID]);
    res.status(201).json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/termine/:terminId/catering/orders/:orderId
app.put('/api/termine/:terminId/catering/orders/:orderId', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { order_text } = req.body;
    await db.run(
      'UPDATE termin_catering_orders SET order_text=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?',
      [order_text, req.params.orderId, req.tenant.id]
    );
    const row = await db.get('SELECT * FROM termin_catering_orders WHERE id=?', [req.params.orderId]);
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/termine/:terminId/catering/orders/:orderId
app.delete('/api/termine/:terminId/catering/orders/:orderId', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    await db.run('DELETE FROM termin_catering_orders WHERE id=? AND tenant_id=?', [req.params.orderId, req.tenant.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// ROUTES: EINLADUNGEN & BENUTZER-VERWALTUNG
// ============================================

const VALID_ROLES = ['admin','agency','tourmanagement','artist','crew_plus','crew','guest']

// Hilfsfunktion: Ist der aktuelle User Admin dieses Tenants?
const requireAdmin = async (req, res, next) => {
  if (!['admin'].includes(req.tenant.role)) {
    return res.status(403).json({ error: 'Admin-Berechtigung erforderlich' })
  }
  next()
}


// POST /api/settings/invite  — Invite-Link erstellen (Admin only)
app.post('/api/settings/invite', authenticateToken, requireTenant, requireAdmin, async (req, res) => {
  try {
    const { email, role = 'crew', contact_id } = req.body
    if (!email) return res.status(400).json({ error: 'E-Mail fehlt' })
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Ungültige Rolle' })

    // Prüfen: ist dieser User schon Mitglied?
    const existing = await db.get(
      `SELECT ut.id FROM user_tenants ut JOIN users u ON u.id=ut.user_id
       WHERE u.email=? AND ut.tenant_id=? AND ut.status='active'`,
      [email, req.tenant.id]
    )
    if (existing) return res.status(409).json({ error: 'User ist bereits Mitglied' })

    // Alten Pending-Token für diese E-Mail + Tenant löschen
    await db.run('DELETE FROM invite_tokens WHERE email=? AND tenant_id=? AND used_at IS NULL', [email, req.tenant.id])

    // Kontakt anlegen falls noch keiner vorhanden (damit er in der Liste erscheint)
    let resolvedContactId = contact_id ?? null
    if (!resolvedContactId) {
      const existingContact = await db.get(
        'SELECT id FROM contacts WHERE email=? AND tenant_id=?', [email, req.tenant.id]
      )
      if (existingContact) {
        resolvedContactId = existingContact.id
        await db.run('UPDATE contacts SET invite_pending=1 WHERE id=?', [resolvedContactId])
      } else {
        const parts = email.split('@')[0].split('.')
        const firstName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : ''
        const lastName  = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : ''
        const newContact = await db.run(
          `INSERT INTO contacts (tenant_id, email, first_name, last_name, contact_type, invite_pending, crew_tool_active)
           VALUES (?, ?, ?, ?, 'crew', 1, 0)`,
          [req.tenant.id, email, firstName, lastName]
        )
        resolvedContactId = newContact.lastID
      }
    }

    const token = crypto.randomBytes(32).toString('hex')
    const result = await db.run(
      `INSERT INTO invite_tokens (tenant_id, token, email, role, contact_id, invited_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+7 days'))`,
      [req.tenant.id, token, email, role, resolvedContactId, req.user.id]
    )
    const invite = await db.get('SELECT * FROM invite_tokens WHERE id=?', [result.lastID])
    res.status(201).json({ ...invite, invite_url: `/invite/${token}` })
  } catch (err) {
    console.error('POST /api/settings/invite error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/invite/:token  — Token validieren (kein Auth nötig)
app.get('/api/invite/:token', async (req, res) => {
  try {
    const row = await db.get(
      `SELECT it.*, t.name AS tenant_name, t.slug AS tenant_slug
       FROM invite_tokens it
       JOIN tenants t ON t.id = it.tenant_id
       WHERE it.token=?`,
      [req.params.token]
    )
    if (!row) return res.status(404).json({ error: 'Einladung nicht gefunden' })
    if (row.used_at) return res.status(410).json({ error: 'Einladung bereits verwendet' })
    if (new Date(row.expires_at) < new Date()) return res.status(410).json({ error: 'Einladung abgelaufen' })

    // Name aus Kontakt oder bestehendem User holen
    const user = await db.get('SELECT id, first_name, last_name FROM users WHERE email=?', [row.email])
    let firstName = user?.first_name ?? ''
    let lastName  = user?.last_name  ?? ''
    if ((!firstName || !lastName) && row.contact_id) {
      const contact = await db.get('SELECT first_name, last_name FROM contacts WHERE id=?', [row.contact_id])
      if (contact) { firstName = contact.first_name; lastName = contact.last_name }
    }
    res.json({
      token: row.token,
      email: row.email,
      role: row.role,
      tenant_name: row.tenant_name,
      tenant_slug: row.tenant_slug,
      expires_at: row.expires_at,
      user_exists: !!user,
      first_name: firstName,
      last_name: lastName,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/invite/:token/accept  — Einladung annehmen
app.post('/api/invite/:token/accept', async (req, res) => {
  try {
    const { password, firstName: bodyFirstName, lastName: bodyLastName } = req.body

    const row = await db.get(
      `SELECT it.*, t.slug AS tenant_slug
       FROM invite_tokens it
       JOIN tenants t ON t.id = it.tenant_id
       WHERE it.token=?`,
      [req.params.token]
    )
    if (!row) return res.status(404).json({ error: 'Einladung nicht gefunden' })
    if (row.used_at) return res.status(410).json({ error: 'Einladung bereits verwendet' })
    if (new Date(row.expires_at) < new Date()) return res.status(410).json({ error: 'Einladung abgelaufen' })

    await db.run('BEGIN TRANSACTION')
    try {
      let userId
      const existingUser = await db.get('SELECT id FROM users WHERE email=?', [row.email])

      if (existingUser) {
        // User existiert bereits — kein Passwort nötig, keine Daten überschreiben
        userId = existingUser.id
      } else {
        // Neuer User — Passwort Pflicht
        if (!password || password.length < 6) {
          await db.run('ROLLBACK')
          return res.status(400).json({ error: 'Passwort min. 6 Zeichen' })
        }
        // Name: aus Body (Formular) bevorzugt, Fallback: verknüpfter Kontakt
        let firstName = (bodyFirstName || '').trim()
        let lastName  = (bodyLastName  || '').trim()
        if ((!firstName || !lastName) && row.contact_id) {
          const contact = await db.get('SELECT first_name, last_name FROM contacts WHERE id=?', [row.contact_id])
          if (contact) {
            if (!firstName) firstName = contact.first_name || ''
            if (!lastName)  lastName  = contact.last_name  || ''
          }
        }
        const hash = await bcrypt.hash(password, 10)
        const newUser = await db.run(
          'INSERT INTO users (email, password_hash, first_name, last_name) VALUES (?,?,?,?)',
          [row.email, hash, firstName, lastName]
        )
        userId = newUser.lastID
      }

      // user_tenants Eintrag anlegen (oder aktivieren wenn pending)
      const existingUT = await db.get(
        'SELECT id, status FROM user_tenants WHERE user_id=? AND tenant_id=?',
        [userId, row.tenant_id]
      )
      if (existingUT) {
        await db.run(
          `UPDATE user_tenants SET role=?, status='active', joined_at=CURRENT_TIMESTAMP WHERE id=?`,
          [row.role, existingUT.id]
        )
      } else {
        await db.run(
          `INSERT INTO user_tenants (user_id, tenant_id, role, status, joined_at) VALUES (?,?,?,'active', CURRENT_TIMESTAMP)`,
          [userId, row.tenant_id, row.role]
        )
      }

      // Wenn contact_id vorhanden: user_id verknüpfen + invite_pending aufheben
      if (row.contact_id) {
        await db.run(
          'UPDATE contacts SET user_id=?, invite_pending=0 WHERE id=?',
          [userId, row.contact_id]
        )
      }

      // Token als verwendet markieren
      await db.run('UPDATE invite_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?', [row.id])

      await db.run('COMMIT')

      const user = await db.get(
        'SELECT id, email, first_name, last_name FROM users WHERE id=?',
        [userId]
      )
      const tenant = await db.get(
        `SELECT t.id, t.name, t.slug, t.status, ut.role
         FROM tenants t JOIN user_tenants ut ON t.id=ut.tenant_id
         WHERE t.id=? AND ut.user_id=?`,
        [row.tenant_id, userId]
      )
      const jwtToken = jwt.sign({ id: userId, email: user.email }, JWT_SECRET, { expiresIn: '7d' })
      res.json({
        token: jwtToken,
        user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name },
        currentTenant: tenant,
      })
    } catch (err) {
      await db.run('ROLLBACK')
      throw err
    }
  } catch (err) {
    console.error('POST /api/invite/:token/accept error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/me/termine — Alle bestätigten Termine des Users über alle Tenants
app.get('/api/me/termine', authenticateToken, async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT DISTINCT
        t.id, t.date, t.title, t.city, t.art, t.status_booking,
        ten.id as tenant_id, ten.name as tenant_name, ten.slug as tenant_slug
      FROM termine t
      JOIN tenants ten ON t.tenant_id = ten.id
      JOIN termin_travel_party ttp ON ttp.termin_id = t.id
      JOIN contacts c ON ttp.contact_id = c.id
      WHERE c.user_id = ?
      ORDER BY t.date ASC
    `, [req.user.id])

    res.json({ termine: rows.map(r => ({
      id: r.id,
      date: r.date,
      title: r.title,
      city: r.city,
      art: r.art,
      statusBooking: r.status_booking,
      tenantId: r.tenant_id,
      tenantName: r.tenant_name,
      tenantSlug: r.tenant_slug,
    }))})
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/me/tenants — Alle Tenants des eingeloggten Users (kein Tenant-Header nötig)
app.get('/api/me/tenants', authenticateToken, async (req, res) => {
  try {
    let rows
    if (req.user.isSuperadmin) {
      // Superadmin sieht alle Tenants mit virtueller Admin-Rolle
      rows = await db.all(`
        SELECT t.id, COALESCE(NULLIF(t.display_name,''), t.name) AS name, t.slug, t.status, t.trial_ends_at, 'admin' AS role
        FROM tenants t
        ORDER BY name
      `)
    } else {
      rows = await db.all(`
        SELECT t.id, COALESCE(NULLIF(t.display_name,''), t.name) AS name, t.slug, t.status, t.trial_ends_at, ut.role
        FROM user_tenants ut
        JOIN tenants t ON ut.tenant_id = t.id
        WHERE ut.user_id = ? AND ut.status = 'active'
        ORDER BY name
      `, [req.user.id])
    }
    res.json({ tenants: rows })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/tenant/settings — Artist-Einstellungen des aktuellen Tenants lesen
app.get('/api/tenant/settings', authenticateToken, requireTenant, async (req, res) => {
  try {
    const row = await db.get(
      'SELECT name, display_name, short_code, homebase, genre, email, phone, website FROM tenants WHERE id = ?',
      [req.tenant.id]
    )
    res.json({ settings: row })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/tenant/settings — Artist-Einstellungen speichern (nur Admin)
app.put('/api/tenant/settings', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) {
    return res.status(403).json({ error: 'Nur Admins dürfen Artist-Einstellungen ändern' })
  }
  try {
    const { displayName = '', shortCode = '', homebase = '', genre = '', email = '', phone = '', website = '' } = req.body
    await db.run(
      `UPDATE tenants SET display_name=?, short_code=?, homebase=?, genre=?, email=?, phone=?, website=?, updated_at=datetime('now') WHERE id=?`,
      [displayName, shortCode, homebase, genre, email, phone, website, req.tenant.id]
    )
    const row = await db.get(
      'SELECT name, display_name, short_code, homebase, genre, email, phone, website FROM tenants WHERE id = ?',
      [req.tenant.id]
    )
    res.json({ settings: row })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/tenant/billing — Rechnungsdaten des aktuellen Tenants
app.get('/api/tenant/billing', authenticateToken, requireTenant, async (req, res) => {
  try {
    const row = await db.get(
      `SELECT billing_company, billing_first_name, billing_last_name, billing_address,
              billing_postal_code, billing_city, billing_phone, billing_tax_id, billing_email
       FROM tenants WHERE id = ?`,
      [req.tenant.id]
    )
    res.json({ billing: row })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/tenant/billing — Rechnungsdaten speichern (nur Admin)
app.put('/api/tenant/billing', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) {
    return res.status(403).json({ error: 'Nur Admins dürfen Billing-Daten ändern' })
  }
  try {
    const { company='', firstName='', lastName='', address='', postalCode='', city='', phone='', taxId='', email='' } = req.body
    await db.run(
      `UPDATE tenants SET billing_company=?, billing_first_name=?, billing_last_name=?,
       billing_address=?, billing_postal_code=?, billing_city=?, billing_phone=?,
       billing_tax_id=?, billing_email=?, updated_at=datetime('now') WHERE id=?`,
      [company, firstName, lastName, address, postalCode, city, phone, taxId, email, req.tenant.id]
    )
    const row = await db.get(
      `SELECT billing_company, billing_first_name, billing_last_name, billing_address,
              billing_postal_code, billing_city, billing_phone, billing_tax_id, billing_email
       FROM tenants WHERE id = ?`,
      [req.tenant.id]
    )
    res.json({ billing: row })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/me/format — Format-Einstellungen des aktuellen Users (user-global)
app.get('/api/me/format', authenticateToken, async (req, res) => {
  try {
    const row = await db.get(
      'SELECT format_language, format_timezone, format_currency FROM users WHERE id = ?',
      [req.user.id]
    )
    res.json({ format: row })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/me/format — Format-Einstellungen speichern
app.put('/api/me/format', authenticateToken, async (req, res) => {
  try {
    const { language='de-DE', timezone='Europe/Berlin', currency='EUR' } = req.body
    await db.run(
      `UPDATE users SET format_language=?, format_timezone=?, format_currency=? WHERE id=?`,
      [language, timezone, currency, req.user.id]
    )
    const row = await db.get(
      'SELECT format_language, format_timezone, format_currency FROM users WHERE id = ?',
      [req.user.id]
    )
    res.json({ format: row })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/tenants — Neuen Tenant anlegen (User wird automatisch Admin)
app.post('/api/tenants', authenticateToken, async (req, res) => {
  const { name, email } = req.body
  if (!name) return res.status(400).json({ error: 'Name erforderlich' })
  try {
    // Slug aus Name generieren
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    // Slug auf Eindeutigkeit prüfen
    let uniqueSlug = slug
    let counter = 1
    while (await db.get('SELECT id FROM tenants WHERE slug = ?', [uniqueSlug])) {
      uniqueSlug = `${slug}-${counter++}`
    }
    const result = await db.run(
      `INSERT INTO tenants (name, slug, email, status, trial_ends_at)
       VALUES (?, ?, ?, 'active', datetime('now', '+14 days'))`,
      [name, uniqueSlug, email || '']
    )
    const tenantId = result.lastID
    await db.run(
      `INSERT INTO user_tenants (user_id, tenant_id, role, status, joined_at)
       VALUES (?, ?, 'admin', 'active', datetime('now'))`,
      [req.user.id, tenantId]
    )
    const tenant = await db.get('SELECT id, name, slug, status, trial_ends_at FROM tenants WHERE id = ?', [tenantId])
    res.json({ tenant: { ...tenant, role: 'admin' } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/settings/my-role  — Eigene aktuelle Rolle aus DB (kein Admin nötig)
app.get('/api/settings/my-role', authenticateToken, requireTenant, async (req, res) => {
  try {
    // Superadmin hat immer Admin-Rolle
    if (req.user.isSuperadmin) return res.json({ role: 'admin' })
    const row = await db.get(
      `SELECT ut.role FROM user_tenants ut
       WHERE ut.user_id = ? AND ut.tenant_id = ? AND ut.status = 'active'`,
      [req.user.id, req.tenant.id]
    )
    if (!row) return res.status(404).json({ error: 'Not found' })
    res.json({ role: row.role })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/settings/users/:userId/contact  — Kontakt für User holen oder anlegen (Admin only)
app.get('/api/settings/users/:userId/contact', authenticateToken, requireTenant, requireAdmin, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.userId)
    const targetUser = await db.get('SELECT * FROM users WHERE id = ?', [targetUserId])
    if (!targetUser) return res.status(404).json({ error: 'User nicht gefunden' })

    // Prüfen ob User zu diesem Tenant gehört
    const membership = await db.get(
      'SELECT id FROM user_tenants WHERE user_id = ? AND tenant_id = ?',
      [targetUserId, req.tenant.id]
    )
    if (!membership) return res.status(403).json({ error: 'User nicht in diesem Tenant' })

    // Kontakt per user_id suchen
    let contact = await db.get(
      'SELECT * FROM contacts WHERE user_id = ? AND tenant_id = ?',
      [targetUserId, req.tenant.id]
    )

    // Per E-Mail verknüpfen
    if (!contact) {
      const byEmail = await db.get(
        'SELECT * FROM contacts WHERE email = ? AND tenant_id = ? AND user_id IS NULL',
        [targetUser.email, req.tenant.id]
      )
      if (byEmail) {
        await db.run('UPDATE contacts SET user_id = ? WHERE id = ?', [targetUserId, byEmail.id])
        contact = { ...byEmail, user_id: targetUserId }
      }
    }

    // Neu anlegen
    if (!contact) {
      const result = await db.run(
        `INSERT INTO contacts (tenant_id, user_id, first_name, last_name, email)
         VALUES (?, ?, ?, ?, ?)`,
        [req.tenant.id, targetUserId, targetUser.first_name || '', targetUser.last_name || '', targetUser.email || '']
      )
      contact = await db.get('SELECT * FROM contacts WHERE id = ?', [result.lastID])
    }

    res.json({ contact: contactFromRow(contact) })
  } catch (err) {
    console.error('GET /api/settings/users/:userId/contact error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/settings/users  — Aktive User + offene Einladungen
app.get('/api/settings/users', authenticateToken, requireTenant, requireAdmin, async (req, res) => {
  try {
    const users = await db.all(
      `SELECT u.id, u.email,
        COALESCE(c.first_name, u.first_name) AS first_name,
        COALESCE(c.last_name,  u.last_name)  AS last_name,
        ut.role, ut.status AS memberStatus, ut.joined_at, ut.last_login_at,
        c.id AS contact_id
       FROM user_tenants ut
       JOIN users u ON u.id = ut.user_id
       LEFT JOIN contacts c ON c.user_id = u.id AND c.tenant_id = ut.tenant_id
       WHERE ut.tenant_id=? AND ut.status IN ('active', 'inactive') AND u.is_superadmin = 0
       ORDER BY ut.joined_at ASC`,
      [req.tenant.id]
    )
    const pending = await db.all(
      `SELECT it.id, it.token, it.email, it.role, it.created_at, it.expires_at, it.invited_by,
              c.first_name AS firstName, c.last_name AS lastName
       FROM invite_tokens it
       LEFT JOIN contacts c ON c.id = it.contact_id
       WHERE it.tenant_id=? AND it.used_at IS NULL AND it.expires_at > datetime('now')
       ORDER BY it.created_at DESC`,
      [req.tenant.id]
    )
    res.json({ users, pending })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/settings/users/:userId/role  — Rolle ändern (Admin only, nicht sich selbst, letzter Admin geschützt)
app.put('/api/settings/users/:userId/role', authenticateToken, requireTenant, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Ungültige Rolle' })
    const targetId = parseInt(req.params.userId)
    if (targetId === req.user.id) return res.status(400).json({ error: 'Eigene Rolle nicht änderbar' })

    // Letzter Admin darf nicht degradiert werden
    if (role !== 'admin') {
      const currentRole = await db.get(
        'SELECT role FROM user_tenants WHERE user_id=? AND tenant_id=?',
        [targetId, req.tenant.id]
      )
      if (currentRole?.role === 'admin') {
        const adminCount = await db.get(
          `SELECT COUNT(*) as count FROM user_tenants
           WHERE tenant_id=? AND role='admin' AND status='active'`,
          [req.tenant.id]
        )
        if (adminCount.count <= 1) {
          return res.status(400).json({ error: 'Letzter Admin kann nicht degradiert werden' })
        }
      }
    }

    await db.run(
      'UPDATE user_tenants SET role=? WHERE user_id=? AND tenant_id=?',
      [role, targetId, req.tenant.id]
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/settings/users/:userId  — User entfernen (Admin only, nicht sich selbst)
app.delete('/api/settings/users/:userId', authenticateToken, requireTenant, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.userId)
    if (targetId === req.user.id) return res.status(400).json({ error: 'Sich selbst nicht entfernbar' })
    await db.run(
      `UPDATE user_tenants SET status='removed' WHERE user_id=? AND tenant_id=?`,
      [targetId, req.tenant.id]
    )
    await db.run(
      `DELETE FROM contacts WHERE user_id=? AND tenant_id=?`,
      [targetId, req.tenant.id]
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/settings/users/:userId/email  — E-Mail eines Users ändern (Admin only)
app.put('/api/settings/users/:userId/email', authenticateToken, requireTenant, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.userId)
    const { email } = req.body
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Ungültige E-Mail' })
    // Prüfen ob E-Mail bereits vergeben
    const existing = await db.get('SELECT id FROM users WHERE email=? AND id!=?', [email.toLowerCase(), targetId])
    if (existing) return res.status(409).json({ error: 'E-Mail bereits vergeben' })
    await db.run('UPDATE users SET email=? WHERE id=?', [email.toLowerCase(), targetId])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/settings/users/:userId/status  — User aktivieren/deaktivieren (Admin only, nicht sich selbst)
app.put('/api/settings/users/:userId/status', authenticateToken, requireTenant, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.userId)
    if (targetId === req.user.id) return res.status(400).json({ error: 'Eigenen Status nicht änderbar' })
    const current = await db.get(
      `SELECT status FROM user_tenants WHERE user_id=? AND tenant_id=?`,
      [targetId, req.tenant.id]
    )
    if (!current) return res.status(404).json({ error: 'User nicht gefunden' })
    const newStatus = current.status === 'active' ? 'inactive' : 'active'
    await db.run(
      `UPDATE user_tenants SET status=? WHERE user_id=? AND tenant_id=?`,
      [newStatus, targetId, req.tenant.id]
    )
    res.json({ ok: true, status: newStatus })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/settings/users/:userId/password  — Passwort eines Users setzen (Admin only, kein altes PW nötig)
app.put('/api/settings/users/:userId/password', authenticateToken, requireTenant, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.userId)
    const { newPassword } = req.body
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Mindestens 6 Zeichen' })
    // Prüfen ob User zum Tenant gehört
    const member = await db.get(
      `SELECT u.id FROM users u JOIN user_tenants ut ON ut.user_id=u.id WHERE u.id=? AND ut.tenant_id=? AND ut.status='active'`,
      [targetId, req.tenant.id]
    )
    if (!member) return res.status(404).json({ error: 'User nicht gefunden' })
    const bcrypt = require('bcryptjs')
    const hash = await bcrypt.hash(newPassword, 10)
    await db.run('UPDATE users SET password_hash=? WHERE id=?', [hash, targetId])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/settings/invites/:tokenId  — Einladung widerrufen
app.delete('/api/settings/invites/:tokenId', authenticateToken, requireTenant, requireAdmin, async (req, res) => {
  try {
    await db.run(
      'DELETE FROM invite_tokens WHERE id=? AND tenant_id=?',
      [req.params.tokenId, req.tenant.id]
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================
// ============================================
// FEEDBACK
// ============================================

// POST /api/feedback — Feedback einreichen (jeder eingeloggte User)
app.post('/api/feedback', authenticateToken, async (req, res) => {
  try {
    const { topic, description, isPrivate } = req.body
    if (!topic?.trim()) return res.status(400).json({ error: 'Thema ist erforderlich' })
    const user = await db.get('SELECT first_name, last_name, email FROM users WHERE id=?', [req.user.id])
    const userName = (user?.first_name || user?.last_name)
      ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
      : (user?.email || 'Unbekannt')
    // Tenant-Name aus aktuellem X-Tenant-Slug Header (optional)
    let tenantName = null
    const tenantSlug = req.headers['x-tenant-slug']
    if (tenantSlug) {
      const tenant = await db.get('SELECT name FROM tenants WHERE slug=?', [tenantSlug])
      tenantName = tenant?.name ?? null
    }
    const result = await db.run(
      `INSERT INTO feedback_items (user_id, user_name, tenant_name, topic, description, private, status)
       VALUES (?, ?, ?, ?, ?, ?, 'open')`,
      [req.user.id, userName, tenantName, topic.trim(), description?.trim() || null, isPrivate ? 1 : 0]
    )
    const item = await db.get('SELECT * FROM feedback_items WHERE id=?', [result.lastID])
    res.status(201).json({ item })
  } catch (err) {
    console.error('POST /api/feedback error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/feedback — Liste holen
// Superadmin: alles; sonstige: eigene + öffentliche
app.get('/api/feedback', authenticateToken, async (req, res) => {
  try {
    let items
    if (req.user.isSuperadmin) {
      items = await db.all('SELECT * FROM feedback_items ORDER BY created_at DESC')
    } else {
      items = await db.all(
        'SELECT * FROM feedback_items WHERE private=0 OR user_id=? ORDER BY created_at DESC',
        [req.user.id]
      )
    }
    res.json({ items })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/feedback/:id/status — Status setzen (Superadmin)
app.put('/api/feedback/:id/status', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isSuperadmin) return res.status(403).json({ error: 'Nur für Entwickler' })
    const { status } = req.body
    if (!['open', 'in_progress', 'done'].includes(status)) return res.status(400).json({ error: 'Ungültiger Status' })
    await db.run('UPDATE feedback_items SET status=? WHERE id=?', [status, req.params.id])
    const item = await db.get('SELECT * FROM feedback_items WHERE id=?', [req.params.id])
    res.json({ item })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/feedback/:id/note — Bemerkung setzen (Superadmin)
app.put('/api/feedback/:id/note', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isSuperadmin) return res.status(403).json({ error: 'Nur für Entwickler' })
    const { bemerkung } = req.body
    await db.run('UPDATE feedback_items SET bemerkung=? WHERE id=?', [bemerkung ?? null, req.params.id])
    const item = await db.get('SELECT * FROM feedback_items WHERE id=?', [req.params.id])
    res.json({ item })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/feedback/:id — Löschen (nur Superadmin)
app.delete('/api/feedback/:id', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isSuperadmin) return res.status(403).json({ error: 'Nur für Entwickler' })
    const item = await db.get('SELECT * FROM feedback_items WHERE id=?', [req.params.id])
    if (!item) return res.status(404).json({ error: 'Nicht gefunden' })
    await db.run('DELETE FROM feedback_items WHERE id=?', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ProTouring Server',
    timestamp: new Date().toISOString(),
    db: 'SQLite'
  });
});

// ============================================
// GÄSTELISTEN
// ============================================

// Hilfsfunktion: Darf diese Rolle direkt hinzufügen (nicht nur wünschen)?
function canAddDirectly(role, listSettings) {
  // Roles 1-3 immer
  if (['admin', 'tourmanagement', 'agency'].includes(role)) return true
  // Rolle 4 (artist): nur wenn in tenant-settings erlaubt
  if (role === 'artist' && listSettings.artist_can_add) return true
  // Rolle 5 (crew_plus): nur wenn in tenant-settings erlaubt
  if (role === 'crew_plus' && listSettings.crew_plus_can_add) return true
  return false
}

// GET /api/termine/:terminId/guest-lists
app.get('/api/termine/:terminId/guest-lists', authenticateToken, requireTenant, async (req, res) => {
  try {
    const lists = await db.all(
      `SELECT gl.*, COUNT(gle.id) as entry_count
       FROM guest_lists gl
       LEFT JOIN guest_list_entries gle ON gle.guest_list_id = gl.id
       WHERE gl.termin_id = ? AND gl.tenant_id = ?
       GROUP BY gl.id
       ORDER BY gl.sort_order ASC, gl.created_at ASC`,
      [req.params.terminId, req.tenant.id]
    )
    res.json({ lists: lists.map(l => ({ ...l, settings: JSON.parse(l.settings || '{}') })) })
  } catch (e) {
    console.error('GET guest-lists failed', e)
    res.status(500).json({ error: 'Failed' })
  }
})

// POST /api/termine/:terminId/guest-lists
app.post('/api/termine/:terminId/guest-lists', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { name = 'Gästeliste', settings = {} } = req.body
    const r = await db.run(
      `INSERT INTO guest_lists (tenant_id, termin_id, name, settings) VALUES (?, ?, ?, ?)`,
      [req.tenant.id, req.params.terminId, name, JSON.stringify(settings)]
    )
    const list = await db.get('SELECT * FROM guest_lists WHERE id = ?', [r.lastID])
    res.json({ list: { ...list, settings: JSON.parse(list.settings || '{}') } })
  } catch (e) {
    console.error('POST guest-lists failed', e)
    res.status(500).json({ error: 'Failed' })
  }
})

// PATCH /api/guest-lists/:id  (name, settings, status=locked/open)
app.patch('/api/guest-lists/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const list = await db.get('SELECT * FROM guest_lists WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id])
    if (!list) return res.status(404).json({ error: 'Not found' })

    const role = req.tenant.role
    const { name, settings, status } = req.body

    // Lock/Unlock: nur Editor
    if (status !== undefined) {
      if (!['admin', 'tourmanagement', 'agency'].includes(role)) return res.status(403).json({ error: 'Keine Berechtigung' })
    }
    // Name/Settings ändern: nur Editor
    if ((name !== undefined || settings !== undefined) && !['admin', 'tourmanagement', 'agency'].includes(role)) {
      return res.status(403).json({ error: 'Keine Berechtigung' })
    }

    const updates = []
    const vals = []
    if (name !== undefined) { updates.push('name = ?'); vals.push(name) }
    if (settings !== undefined) { updates.push('settings = ?'); vals.push(JSON.stringify(settings)) }
    if (status !== undefined) { updates.push('status = ?'); vals.push(status) }
    updates.push('updated_at = CURRENT_TIMESTAMP')
    vals.push(req.params.id, req.tenant.id)

    await db.run(`UPDATE guest_lists SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, vals)
    const updated = await db.get('SELECT * FROM guest_lists WHERE id = ?', [req.params.id])
    res.json({ list: { ...updated, settings: JSON.parse(updated.settings || '{}') } })
  } catch (e) {
    console.error('PATCH guest-lists failed', e)
    res.status(500).json({ error: 'Failed' })
  }
})

// DELETE /api/guest-lists/:id
app.delete('/api/guest-lists/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    await db.run('DELETE FROM guest_lists WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed' })
  }
})

// GET /api/guest-lists/:id/entries
app.get('/api/guest-lists/:id/entries', authenticateToken, requireTenant, async (req, res) => {
  try {
    const list = await db.get('SELECT * FROM guest_lists WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id])
    if (!list) return res.status(404).json({ error: 'Not found' })
    const entries = await db.all(
      `SELECT gle.*, u.first_name as inviter_first_name, u.last_name as inviter_last_name
       FROM guest_list_entries gle
       LEFT JOIN users u ON u.id = gle.invited_by_user_id
       WHERE gle.guest_list_id = ? AND gle.tenant_id = ?
       ORDER BY gle.created_at ASC`,
      [req.params.id, req.tenant.id]
    )
    const listSettings = JSON.parse(list.settings || '{}')
    res.json({
      list: { ...list, settings: listSettings },
      entries: entries.map(e => ({ ...e, passes: JSON.parse(e.passes || '{}') }))
    })
  } catch (e) {
    console.error('GET entries failed', e)
    res.status(500).json({ error: 'Failed' })
  }
})

// POST /api/guest-lists/:id/entries
app.post('/api/guest-lists/:id/entries', authenticateToken, requireTenant, async (req, res) => {
  try {
    const list = await db.get('SELECT * FROM guest_lists WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id])
    if (!list) return res.status(404).json({ error: 'Not found' })
    if (list.status === 'locked') return res.status(403).json({ error: 'Liste ist gesperrt' })

    const role = req.tenant.role
    const listSettings = JSON.parse(list.settings || '{}')

    // Wer darf überhaupt hinzufügen? (alle bis auf 'guest')
    const allowedRoles = ['admin', 'tourmanagement', 'agency', 'artist', 'crew_plus', 'crew', 'guest']
    if (!allowedRoles.includes(role)) return res.status(403).json({ error: 'Keine Berechtigung' })

    const isDirect = canAddDirectly(role, listSettings)
    const is_wish = isDirect ? 0 : 1
    const status = isDirect ? 'approved' : 'pending'

    const { first_name, last_name, company, invited_by_text, invited_by_user_id, email, passes = {}, notes } = req.body
    if (!first_name || !last_name) return res.status(400).json({ error: 'Vor- und Nachname erforderlich' })

    // E-Mail Pflichtfeld prüfen
    if (listSettings.require_email && !email) return res.status(400).json({ error: 'E-Mail ist für diese Liste Pflicht' })

    // Limit pro Einlader prüfen
    if (listSettings.per_inviter_limit && invited_by_user_id) {
      const count = await db.get(
        `SELECT COUNT(*) as cnt FROM guest_list_entries WHERE guest_list_id = ? AND invited_by_user_id = ? AND status != 'rejected'`,
        [req.params.id, invited_by_user_id]
      )
      if (count.cnt >= listSettings.per_inviter_limit) return res.status(400).json({ error: `Limit von ${listSettings.per_inviter_limit} Einladungen erreicht` })
    }

    // Gesamtlimit prüfen
    if (listSettings.total_limit) {
      const total = await db.get(
        `SELECT COALESCE(SUM(json_extract(passes, '$') ), 0) as total FROM guest_list_entries WHERE guest_list_id = ? AND status != 'rejected'`,
        [req.params.id]
      )
      // einfach Einträge zählen wenn kein pass-summing
      const cnt = await db.get(`SELECT COUNT(*) as cnt FROM guest_list_entries WHERE guest_list_id = ? AND status != 'rejected'`, [req.params.id])
      if (cnt.cnt >= listSettings.total_limit) return res.status(400).json({ error: `Gesamtlimit von ${listSettings.total_limit} Einträgen erreicht` })
    }

    const r = await db.run(
      `INSERT INTO guest_list_entries (guest_list_id, tenant_id, first_name, last_name, company, invited_by_text, invited_by_user_id, email, passes, is_wish, status, notes, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, req.tenant.id, first_name, last_name, company || null, invited_by_text || null, invited_by_user_id || null, email || null, JSON.stringify(passes), is_wish, status, notes || null, req.user.id]
    )
    const entry = await db.get('SELECT gle.*, u.first_name as inviter_first_name, u.last_name as inviter_last_name FROM guest_list_entries gle LEFT JOIN users u ON u.id = gle.invited_by_user_id WHERE gle.id = ?', [r.lastID])
    res.json({ entry: { ...entry, passes: JSON.parse(entry.passes || '{}') } })
  } catch (e) {
    console.error('POST entry failed', e)
    res.status(500).json({ error: 'Failed' })
  }
})

// PATCH /api/guest-list-entries/:id
app.patch('/api/guest-list-entries/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const entry = await db.get('SELECT gle.*, gl.status as list_status FROM guest_list_entries gle JOIN guest_lists gl ON gl.id = gle.guest_list_id WHERE gle.id = ? AND gle.tenant_id = ?', [req.params.id, req.tenant.id])
    if (!entry) return res.status(404).json({ error: 'Not found' })
    if (entry.list_status === 'locked') return res.status(403).json({ error: 'Liste ist gesperrt' })

    const role = req.tenant.role
    const { first_name, last_name, company, invited_by_text, invited_by_user_id, email, passes, notes, status } = req.body

    // Status (approve/reject) nur für Editoren
    if (status !== undefined && !['admin', 'tourmanagement', 'agency'].includes(role)) {
      return res.status(403).json({ error: 'Keine Berechtigung für Statusänderung' })
    }

    const updates = []
    const vals = []
    if (first_name !== undefined) { updates.push('first_name = ?'); vals.push(first_name) }
    if (last_name !== undefined) { updates.push('last_name = ?'); vals.push(last_name) }
    if (company !== undefined) { updates.push('company = ?'); vals.push(company) }
    if (invited_by_text !== undefined) { updates.push('invited_by_text = ?'); vals.push(invited_by_text) }
    if (invited_by_user_id !== undefined) { updates.push('invited_by_user_id = ?'); vals.push(invited_by_user_id) }
    if (email !== undefined) { updates.push('email = ?'); vals.push(email) }
    if (passes !== undefined) { updates.push('passes = ?'); vals.push(JSON.stringify(passes)) }
    if (notes !== undefined) { updates.push('notes = ?'); vals.push(notes) }
    if (status !== undefined) { updates.push('status = ?'); vals.push(status) }
    updates.push('updated_at = CURRENT_TIMESTAMP')
    vals.push(req.params.id, req.tenant.id)

    await db.run(`UPDATE guest_list_entries SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, vals)
    const updated = await db.get('SELECT gle.*, u.first_name as inviter_first_name, u.last_name as inviter_last_name FROM guest_list_entries gle LEFT JOIN users u ON u.id = gle.invited_by_user_id WHERE gle.id = ?', [req.params.id])
    res.json({ entry: { ...updated, passes: JSON.parse(updated.passes || '{}') } })
  } catch (e) {
    console.error('PATCH entry failed', e)
    res.status(500).json({ error: 'Failed' })
  }
})

// DELETE /api/guest-list-entries/:id
app.delete('/api/guest-list-entries/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const entry = await db.get('SELECT gle.*, gl.status as list_status FROM guest_list_entries gle JOIN guest_lists gl ON gl.id = gle.guest_list_id WHERE gle.id = ? AND gle.tenant_id = ?', [req.params.id, req.tenant.id])
    if (!entry) return res.status(404).json({ error: 'Not found' })
    if (entry.list_status === 'locked') return res.status(403).json({ error: 'Liste ist gesperrt' })
    await db.run('DELETE FROM guest_list_entries WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed' })
  }
})

// GET /api/guest-lists/:id/export/csv
app.get('/api/guest-lists/:id/export/csv', authenticateToken, requireTenant, async (req, res) => {
  try {
    const list = await db.get('SELECT * FROM guest_lists WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id])
    if (!list) return res.status(404).json({ error: 'Not found' })
    const listSettings = JSON.parse(list.settings || '{}')
    const passTypes = listSettings.pass_types || ['guestlist', 'backstage', 'aftershow', 'photo']
    const showInviter = listSettings.export_show_inviter !== false
    const showEmail   = listSettings.export_show_email   !== false
    const entries = await db.all(
      `SELECT gle.*, u.first_name as inviter_first_name, u.last_name as inviter_last_name
       FROM guest_list_entries gle
       LEFT JOIN users u ON u.id = gle.invited_by_user_id
       WHERE gle.guest_list_id = ? AND gle.tenant_id = ?
         AND gle.status NOT IN ('pending', 'rejected')
       ORDER BY gle.last_name ASC, gle.first_name ASC`,
      [req.params.id, req.tenant.id]
    )

    const headers = ['Nachname', 'Vorname', 'Firma',
      ...(showInviter ? ['Eingeladen von'] : []),
      ...(showEmail   ? ['E-Mail'] : []),
      'Status', ...passTypes, 'Gesamt', 'Notiz'
    ]
    const rows = entries.map(e => {
      const passes = JSON.parse(e.passes || '{}')
      const inviterName = e.invited_by_text || [e.inviter_first_name, e.inviter_last_name].filter(Boolean).join(' ') || ''
      const total = passTypes.reduce((s, t) => s + (parseInt(passes[t]) || 0), 0)
      return [
        e.last_name, e.first_name, e.company || '',
        ...(showInviter ? [inviterName] : []),
        ...(showEmail   ? [e.email || ''] : []),
        e.is_wish ? `Wunsch (${e.status})` : 'Fix',
        ...passTypes.map(t => parseInt(passes[t]) || 0),
        total, e.notes || ''
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')
    })

    const csv = [headers.join(';'), ...rows].join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="gaesteliste-${list.id}.csv"`)
    res.send('\uFEFF' + csv)
  } catch (e) {
    console.error('CSV export failed', e)
    res.status(500).json({ error: 'Failed' })
  }
})

// GET /api/guest-lists/:id/export/pdf
app.get('/api/guest-lists/:id/export/pdf', authenticateToken, requireTenant, async (req, res) => {
  try {
    const list = await db.get('SELECT * FROM guest_lists WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id])
    if (!list) return res.status(404).json({ error: 'Not found' })
    const listSettings = JSON.parse(list.settings || '{}')
    const passTypes = listSettings.pass_types || ['guestlist', 'backstage', 'aftershow', 'photo']
    const showInviter = listSettings.export_show_inviter !== false
    const showEmail   = listSettings.export_show_email   !== false
    const entries = await db.all(
      `SELECT gle.*, u.first_name as inviter_first_name, u.last_name as inviter_last_name
       FROM guest_list_entries gle
       LEFT JOIN users u ON u.id = gle.invited_by_user_id
       WHERE gle.guest_list_id = ? AND gle.tenant_id = ?
         AND gle.status NOT IN ('pending', 'rejected')
       ORDER BY gle.last_name ASC, gle.first_name ASC`,
      [req.params.id, req.tenant.id]
    )
    const { generateGuestListPdf } = require('./generate_guest_list_pdf')
    const termin = await db.get('SELECT * FROM termine WHERE id = ?', [list.termin_id])
    const parsedEntries = entries.map(e => ({ ...e, passes: JSON.parse(e.passes || '{}') }))
    const buf = await generateGuestListPdf({ list: { ...list, settings: listSettings }, entries: parsedEntries, passTypes, termin, showInviter, showEmail })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="gaesteliste-${list.id}.pdf"`)
    res.send(buf)
  } catch (e) {
    console.error('PDF export failed', e)
    res.status(500).json({ error: 'Failed' })
  }
})

// ============================================
// SUPERADMIN — globale User-Verwaltung (kein Tenant nötig)
// ============================================

const requireSuperadmin = (req, res, next) => {
  if (!req.user?.isSuperadmin) return res.status(403).json({ error: 'Superadmin erforderlich' })
  next()
}

// GET /api/superadmin/users — alle User global
app.get('/api/superadmin/users', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const users = await db.all(`
      SELECT
        u.id, u.email, u.first_name, u.last_name,
        u.is_superadmin,
        u.created_at,
        (SELECT COUNT(*) FROM user_tenants ut WHERE ut.user_id = u.id AND ut.status = 'active') AS tenant_count,
        (SELECT GROUP_CONCAT(t.name, ', ')
         FROM user_tenants ut2
         JOIN tenants t ON t.id = ut2.tenant_id
         WHERE ut2.user_id = u.id AND ut2.status = 'active'
        ) AS tenant_names
      FROM users u
      ORDER BY u.created_at DESC
    `)
    res.json({ users: users.map(u => ({
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      isSuperadmin: !!u.is_superadmin,
      createdAt: u.created_at,
      tenantCount: u.tenant_count || 0,
      tenantNames: u.tenant_names || '',
    })) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/superadmin/users/:userId/password — PW setzen (kein altes nötig)
app.put('/api/superadmin/users/:userId/password', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.userId)
    const { password } = req.body
    if (!password || password.length < 6) return res.status(400).json({ error: 'Passwort min. 6 Zeichen' })
    const user = await db.get('SELECT id FROM users WHERE id=?', [targetId])
    if (!user) return res.status(404).json({ error: 'User nicht gefunden' })
    const hash = await bcrypt.hash(password, 10)
    await db.run('UPDATE users SET password_hash=? WHERE id=?', [hash, targetId])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/superadmin/users/:userId — User global löschen
app.delete('/api/superadmin/users/:userId', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.userId)
    if (targetId === req.user.id) return res.status(400).json({ error: 'Sich selbst nicht löschbar' })
    const user = await db.get('SELECT id, is_superadmin FROM users WHERE id=?', [targetId])
    if (!user) return res.status(404).json({ error: 'User nicht gefunden' })
    if (user.is_superadmin) return res.status(400).json({ error: 'Superadmin nicht löschbar' })

    await db.run('BEGIN TRANSACTION')
    try {
      // user_id in contacts auf NULL setzen (Kontaktdaten bleiben erhalten)
      await db.run('UPDATE contacts SET user_id=NULL, invite_pending=0 WHERE user_id=?', [targetId])
      // Aus allen Tenants entfernen
      await db.run('DELETE FROM user_tenants WHERE user_id=?', [targetId])
      // Offene Invite-Tokens des Users löschen
      await db.run('DELETE FROM invite_tokens WHERE invited_by=? AND used_at IS NULL', [targetId])
      // User selbst löschen
      await db.run('DELETE FROM users WHERE id=?', [targetId])
      await db.run('COMMIT')
      res.json({ ok: true })
    } catch (err) {
      await db.run('ROLLBACK')
      throw err
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================
// START
// ============================================

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🎸 ProTouring Server running on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/health`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
