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
    CREATE TABLE IF NOT EXISTS schedule_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      not_final BOOLEAN NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_schedule_templates_tenant ON schedule_templates(tenant_id);
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
    `ALTER TABLE users ADD COLUMN ui_language TEXT DEFAULT 'de'`,
    // users: Format-Einstellungen (user-global)
    `ALTER TABLE users ADD COLUMN format_language TEXT DEFAULT 'de-DE'`,
    `ALTER TABLE users ADD COLUMN format_timezone TEXT DEFAULT 'Europe/Berlin'`,
    `ALTER TABLE users ADD COLUMN format_currency TEXT DEFAULT 'EUR'`,
    // Superadmin
    `ALTER TABLE users ADD COLUMN is_superadmin INTEGER DEFAULT 0`,
    // iCal Feed Token
    `ALTER TABLE users ADD COLUMN ical_token TEXT`,
    // Globales Profil: specification
    `ALTER TABLE users ADD COLUMN specification TEXT`,
    // Feedback: Bemerkung des Superadmins
    `ALTER TABLE feedback_items ADD COLUMN bemerkung TEXT`,
    // Equipment-Modul: Kürzel pro Tenant (global unique für Case IDs)
    `ALTER TABLE tenants ADD COLUMN equipment_kuerzel TEXT DEFAULT NULL`,
    `ALTER TABLE tenants ADD COLUMN carnet_ata_enabled INTEGER DEFAULT 0`,
    `ALTER TABLE tenants ADD COLUMN modules_enabled TEXT DEFAULT '[]'`,
    `ALTER TABLE tenants ADD COLUMN label_tour_name TEXT DEFAULT NULL`,
    `ALTER TABLE tenants ADD COLUMN label_use_artist_name INTEGER DEFAULT 1`,
    `ALTER TABLE tenants ADD COLUMN label_logo_path TEXT DEFAULT NULL`,
    `ALTER TABLE tenants ADD COLUMN label_template TEXT DEFAULT NULL`,
    // Rename wert_zeitwert → wert_zollwert, wert_wiederbeschaffung → wert_wiederbeschaffungswert
    `ALTER TABLE equipment_materials RENAME COLUMN wert_zeitwert TO wert_zollwert`,
    `ALTER TABLE equipment_materials RENAME COLUMN wert_wiederbeschaffung TO wert_wiederbeschaffungswert`,
    // Items: name→bezeichnung, neue Felder
    `ALTER TABLE equipment_items RENAME COLUMN name TO bezeichnung`,
    `ALTER TABLE equipment_items ADD COLUMN typ_custom TEXT`,
    `ALTER TABLE equipment_items ADD COLUMN position_custom TEXT`,
    `ALTER TABLE equipment_items ADD COLUMN label_color TEXT`,
    `ALTER TABLE equipment_items ADD COLUMN standort_status TEXT`,
    `ALTER TABLE equipment_items ADD COLUMN gruppe_name TEXT`,
    // Carnet: Kontaktperson aufgeteilt + Vertreter-Kontaktperson
    `ALTER TABLE carnets ADD COLUMN inhaber_kontaktperson_vorname TEXT`,
    `ALTER TABLE carnets ADD COLUMN vertreter_kontaktperson_vorname TEXT`,
    `ALTER TABLE carnets ADD COLUMN vertreter_kontaktperson_name TEXT`,
    // Material: Spalten umbenennen
    `ALTER TABLE equipment_materials RENAME COLUMN hersteller TO marke`,
    `ALTER TABLE equipment_materials RENAME COLUMN produkt TO modell`,
    `ALTER TABLE equipment_materials RENAME COLUMN info TO bezeichnung`,
    `ALTER TABLE equipment_materials RENAME COLUMN herstellungsland TO ursprungsland`,
    // Material: neue Spalten
    `ALTER TABLE equipment_materials ADD COLUMN mat_id TEXT`,
    `ALTER TABLE equipment_materials ADD COLUMN owner_id INTEGER REFERENCES equipment_owners(id) ON DELETE SET NULL`,
    // Venues: GPS-Koordinaten
    `ALTER TABLE venues ADD COLUMN latitude TEXT`,
    `ALTER TABLE venues ADD COLUMN longitude TEXT`,
  ]) { try { await db.run(sql) } catch { /* already exists */ } }

  // equipment_materials.modell: NOT NULL Constraint entfernen (war produkt TEXT NOT NULL)
  // SQLite unterstützt kein ALTER COLUMN → Table Recreation
  const matTableInfo = await db.all(`PRAGMA table_info(equipment_materials)`)
  const modellCol = matTableInfo.find(c => c.name === 'modell')
  if (modellCol && modellCol.notnull === 1) {
    await db.run('BEGIN')
    try {
      await db.run(`CREATE TABLE equipment_materials_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES equipment_items(id) ON DELETE SET NULL,
        marke TEXT,
        modell TEXT,
        bezeichnung TEXT,
        mat_id TEXT,
        category_id INTEGER REFERENCES equipment_categories(id) ON DELETE SET NULL,
        owner_id INTEGER REFERENCES equipment_owners(id) ON DELETE SET NULL,
        typ TEXT NOT NULL DEFAULT 'bulk',
        unit_count INTEGER,
        ursprungsland TEXT,
        wert_zollwert REAL,
        wert_wiederbeschaffungswert REAL,
        waehrung TEXT DEFAULT 'EUR',
        gewicht_kg REAL,
        anschaffungsdatum TEXT,
        notiz TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`)
      await db.run(`INSERT INTO equipment_materials_new
        SELECT id, tenant_id, item_id,
          COALESCE(marke,'') AS marke, COALESCE(modell,'') AS modell, bezeichnung,
          mat_id, category_id, owner_id, COALESCE(typ,'bulk') AS typ, unit_count,
          ursprungsland, wert_zollwert, wert_wiederbeschaffungswert, waehrung,
          gewicht_kg, anschaffungsdatum, notiz, created_by, created_at, updated_at
        FROM equipment_materials`)
      await db.run(`DROP TABLE equipment_materials`)
      await db.run(`ALTER TABLE equipment_materials_new RENAME TO equipment_materials`)
      await db.run('COMMIT')
      console.log('✅ equipment_materials.modell NOT NULL Constraint entfernt')
    } catch (e) {
      await db.run('ROLLBACK')
      console.error('Migration equipment_materials fehlgeschlagen:', e.message)
    }
  }

  // equipment_kuerzel: Partial UNIQUE INDEX (nur wenn gesetzt)
  await db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_equipment_kuerzel ON tenants(equipment_kuerzel) WHERE equipment_kuerzel IS NOT NULL`)

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

  // Einmalige Migration: globale Profildaten aus aktuellstem Kontakt in users-Tabelle schreiben
  // (nur Felder die noch leer sind, damit bestehende user-Daten nicht überschrieben werden)
  await db.run(`
    UPDATE users SET
      phone         = COALESCE(NULLIF(phone,''),         (SELECT NULLIF(c.phone,'')          FROM contacts c WHERE c.user_id=users.id AND NULLIF(c.phone,'')          IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1)),
      mobile        = COALESCE(NULLIF(mobile,''),        (SELECT NULLIF(c.mobile,'')         FROM contacts c WHERE c.user_id=users.id AND NULLIF(c.mobile,'')         IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1)),
      address       = COALESCE(NULLIF(address,''),       (SELECT NULLIF(c.address,'')        FROM contacts c WHERE c.user_id=users.id AND NULLIF(c.address,'')        IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1)),
      postal_code   = COALESCE(NULLIF(postal_code,''),   (SELECT NULLIF(c.postal_code,'')    FROM contacts c WHERE c.user_id=users.id AND NULLIF(c.postal_code,'')    IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1)),
      residence     = COALESCE(NULLIF(residence,''),     (SELECT NULLIF(c.residence,'')      FROM contacts c WHERE c.user_id=users.id AND NULLIF(c.residence,'')      IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1)),
      birth_date    = COALESCE(NULLIF(birth_date,''),    (SELECT NULLIF(c.birth_date,'')     FROM contacts c WHERE c.user_id=users.id AND NULLIF(c.birth_date,'')     IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1)),
      gender        = COALESCE(NULLIF(gender,''),        (SELECT NULLIF(c.gender,'')         FROM contacts c WHERE c.user_id=users.id AND NULLIF(c.gender,'')         IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1)),
      diet          = COALESCE(NULLIF(diet,''),          (SELECT NULLIF(c.diet,'')           FROM contacts c WHERE c.user_id=users.id AND NULLIF(c.diet,'')           IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1)),
      allergies     = COALESCE(NULLIF(allergies,''),     (SELECT NULLIF(c.allergies,'')      FROM contacts c WHERE c.user_id=users.id AND NULLIF(c.allergies,'')      IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1)),
      shirt_size    = COALESCE(NULLIF(shirt_size,''),    (SELECT NULLIF(c.shirt_size,'')     FROM contacts c WHERE c.user_id=users.id AND NULLIF(c.shirt_size,'')     IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1)),
      hoodie_size   = COALESCE(NULLIF(hoodie_size,''),   (SELECT NULLIF(c.hoodie_size,'')    FROM contacts c WHERE c.user_id=users.id AND NULLIF(c.hoodie_size,'')    IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1)),
      pants_size    = COALESCE(NULLIF(pants_size,''),    (SELECT NULLIF(c.pants_size,'')     FROM contacts c WHERE c.user_id=users.id AND NULLIF(c.pants_size,'')     IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1)),
      shoe_size     = COALESCE(NULLIF(shoe_size,''),     (SELECT NULLIF(c.shoe_size,'')      FROM contacts c WHERE c.user_id=users.id AND NULLIF(c.shoe_size,'')      IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1)),
      hotel_info    = COALESCE(NULLIF(hotel_info,''),    (SELECT NULLIF(c.hotel_info,'')     FROM contacts c WHERE c.user_id=users.id AND NULLIF(c.hotel_info,'')     IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1)),
      hotel_alias   = COALESCE(NULLIF(hotel_alias,''),   (SELECT NULLIF(c.hotel_alias,'')    FROM contacts c WHERE c.user_id=users.id AND NULLIF(c.hotel_alias,'')    IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1)),
      bank_iban     = COALESCE(NULLIF(bank_iban,''),     (SELECT NULLIF(c.bank_iban,'')      FROM contacts c WHERE c.user_id=users.id AND NULLIF(c.bank_iban,'')      IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1)),
      bank_bic      = COALESCE(NULLIF(bank_bic,''),      (SELECT NULLIF(c.bank_bic,'')       FROM contacts c WHERE c.user_id=users.id AND NULLIF(c.bank_bic,'')       IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1)),
      special_notes = COALESCE(NULLIF(special_notes,''), (SELECT NULLIF(c.notes,'')          FROM contacts c WHERE c.user_id=users.id AND NULLIF(c.notes,'')          IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1)),
      specification = COALESCE(NULLIF(specification,''), (SELECT NULLIF(c.specification,'')  FROM contacts c WHERE c.user_id=users.id AND NULLIF(c.specification,'')  IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1))
    WHERE id IN (SELECT DISTINCT user_id FROM contacts WHERE user_id IS NOT NULL)
  `)

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

  // Artist member fields merged into contacts (contact_type='artist')
  try { await db.run(`ALTER TABLE contacts ADD COLUMN always_in_travelparty INTEGER NOT NULL DEFAULT 0`) } catch {}
  try { await db.run(`ALTER TABLE contacts ADD COLUMN member_roles TEXT NOT NULL DEFAULT '[]'`) } catch {}
  try { await db.run(`ALTER TABLE contacts ADD COLUMN member_sort_order INTEGER NOT NULL DEFAULT 0`) } catch {}
  // Migration tracking: which contact was created from an artist_member row
  try { await db.run(`ALTER TABLE artist_members ADD COLUMN contact_id INTEGER REFERENCES contacts(id)`) } catch {}
  // termin_artist_members: contact_id as new primary reference (replaces artist_member_id join)
  try { await db.run(`ALTER TABLE termin_artist_members ADD COLUMN contact_id INTEGER REFERENCES contacts(id)`) } catch {}

  // One-time migration: copy artist_members → contacts, set contact_id back-reference
  {
    const unmigrated = await db.all(`SELECT * FROM artist_members WHERE contact_id IS NULL`)
    for (const am of unmigrated) {
      const r = await db.run(
        `INSERT INTO contacts (tenant_id, first_name, last_name, email, phone, notes,
           contact_type, always_in_travelparty, member_roles, member_sort_order, crew_tool_active)
         VALUES (?, ?, ?, ?, ?, ?, 'artist', ?, ?, ?, 1)`,
        [am.tenant_id, am.first_name, am.last_name, am.email || '', am.phone || '',
         am.notes || '', am.always_in_travelparty, am.roles || '[]', am.sort_order || 0]
      )
      await db.run(`UPDATE artist_members SET contact_id=? WHERE id=?`, [r.lastID, am.id])
    }
    // Populate termin_artist_members.contact_id from artist_members.contact_id
    await db.run(`
      UPDATE termin_artist_members SET contact_id = (
        SELECT contact_id FROM artist_members WHERE artist_members.id = termin_artist_members.artist_member_id
      ) WHERE contact_id IS NULL AND artist_member_id IS NOT NULL
    `)
  }

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

  // Advancing
  await db.run(`
    CREATE TABLE IF NOT EXISTS advancing_areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      termin_id INTEGER NOT NULL REFERENCES termine(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.run(`
    CREATE TABLE IF NOT EXISTS advancing_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      area_id INTEGER NOT NULL REFERENCES advancing_areas(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Migration: sort_order in advancing_areas + advancing_entries (falls Spalte fehlt)
  const areasInfo = await db.all("PRAGMA table_info(advancing_areas)").catch(() => [])
  if (areasInfo.length && !areasInfo.find(c => c.name === 'sort_order')) {
    await db.run('ALTER TABLE advancing_areas ADD COLUMN sort_order INTEGER DEFAULT 0')
    console.log('✅ Migration: advancing_areas.sort_order hinzugefügt')
  }
  const entriesInfo = await db.all("PRAGMA table_info(advancing_entries)").catch(() => [])
  if (entriesInfo.length && !entriesInfo.find(c => c.name === 'sort_order')) {
    await db.run('ALTER TABLE advancing_entries ADD COLUMN sort_order INTEGER DEFAULT 0')
    console.log('✅ Migration: advancing_entries.sort_order hinzugefügt')
  }

  // ── Equipment-Modul ──────────────────────────────────────────────────────────

  // Kategorienstamm (pro Tenant)
  await db.run(`
    CREATE TABLE IF NOT EXISTS equipment_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      kuerzel TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Partner-Typen (pro Tenant, konfigurierbar)
  await db.run(`
    CREATE TABLE IF NOT EXISTS partner_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      visible INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  // Migration: visible-Spalte nachrüsten falls Tabelle schon existiert
  try { await db.run('ALTER TABLE partner_types ADD COLUMN visible INTEGER DEFAULT 1') } catch {}

  // Gegenstände (Cases, Flightcases, Dollies…)
  await db.run(`
    CREATE TABLE IF NOT EXISTS equipment_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      case_id TEXT NOT NULL,
      seq_number INTEGER NOT NULL,
      name TEXT NOT NULL,
      category_id INTEGER REFERENCES equipment_categories(id) ON DELETE SET NULL,
      typ TEXT DEFAULT 'case',
      position TEXT,
      load_order INTEGER,
      height_cm REAL,
      width_cm REAL,
      depth_cm REAL,
      weight_empty_kg REAL,
      notiz TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, seq_number)
    )
  `)

  // Sequenz-Tracker pro Tenant (nächste nie vergebene Nummer)
  await db.run(`
    CREATE TABLE IF NOT EXISTS equipment_seq (
      tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      next_number INTEGER NOT NULL DEFAULT 10000
    )
  `)

  // Freigegebene (gelöschte) Nummern — werden vor next_number bevorzugt
  await db.run(`
    CREATE TABLE IF NOT EXISTS equipment_freed_seq (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      seq_number INTEGER NOT NULL,
      freed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Material / Ausrüstungs-Einträge
  await db.run(`
    CREATE TABLE IF NOT EXISTS equipment_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      item_id INTEGER REFERENCES equipment_items(id) ON DELETE SET NULL,
      hersteller TEXT,
      produkt TEXT NOT NULL,
      info TEXT,
      category_id INTEGER REFERENCES equipment_categories(id) ON DELETE SET NULL,
      anzahl INTEGER NOT NULL DEFAULT 1,
      seriennummer TEXT,
      herstellungsland TEXT,
      wert_zollwert REAL,
      wert_wiederbeschaffungswert REAL,
      waehrung TEXT DEFAULT 'EUR',
      gewicht_kg REAL,
      anschaffungsdatum TEXT,
      notiz TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Migrations: equipment_materials typ-Spalte
  try { await db.run(`ALTER TABLE equipment_materials ADD COLUMN typ TEXT DEFAULT 'bulk'`) } catch {}

  // Einheiten für Serienartikel (eine Zeile pro physisches Gerät)
  await db.run(`
    CREATE TABLE IF NOT EXISTS equipment_material_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      material_id INTEGER NOT NULL REFERENCES equipment_materials(id) ON DELETE CASCADE,
      seriennummer TEXT NOT NULL,
      notiz TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Case-Inhalte (Verknüpfung: was ist in welchem Gegenstand)
  await db.run(`
    CREATE TABLE IF NOT EXISTS equipment_case_contents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES equipment_items(id) ON DELETE CASCADE,
      -- Bulk: material_id + anzahl
      material_id INTEGER REFERENCES equipment_materials(id) ON DELETE CASCADE,
      anzahl INTEGER NOT NULL DEFAULT 1,
      -- Serial: material_unit_id (statt anzahl)
      material_unit_id INTEGER REFERENCES equipment_material_units(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Eigentümer
  await db.run(`
    CREATE TABLE IF NOT EXISTS equipment_owners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      typ TEXT NOT NULL DEFAULT 'sonstiges',
      adresse TEXT,
      plz TEXT,
      stadt TEXT,
      land TEXT,
      kontaktperson_vorname TEXT,
      kontaktperson_name TEXT,
      telefon TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Carnets
  await db.run(`
    CREATE TABLE IF NOT EXISTS carnets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      carnet_id TEXT NOT NULL,          -- C-ABC123
      status TEXT NOT NULL DEFAULT 'draft', -- draft / active / closed
      verwendungszweck TEXT,
      startdatum TEXT,
      enddatum TEXT,
      ziellaender TEXT,
      zusaetzliche_laender TEXT,
      kommentar TEXT,
      -- Inhaber
      inhaber_id TEXT NOT NULL,         -- I-ABC123
      inhaber_name TEXT,
      inhaber_adresse TEXT,
      inhaber_plz TEXT,
      inhaber_stadt TEXT,
      inhaber_land TEXT,
      inhaber_ust_id TEXT,
      inhaber_kontaktperson TEXT,
      inhaber_telefon TEXT,
      inhaber_email TEXT,
      -- Vertreter
      vertreter_id TEXT NOT NULL,       -- V-ABC123
      vertreter_name TEXT,
      vertreter_firma TEXT,
      vertreter_adresse TEXT,
      vertreter_plz TEXT,
      vertreter_stadt TEXT,
      vertreter_land TEXT,
      vertreter_telefon TEXT,
      vertreter_email TEXT,
      vertreter_rolle TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.run(`
    CREATE TABLE IF NOT EXISTS carnet_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      carnet_id INTEGER NOT NULL REFERENCES carnets(id) ON DELETE CASCADE,
      material_id INTEGER NOT NULL REFERENCES equipment_materials(id) ON DELETE CASCADE,
      anzahl INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(carnet_id, material_id)
    )
  `)

  // ── Ende Equipment-Modul ─────────────────────────────────────────────────────

  // Venue-Ansprechpartner
  await db.run(`
    CREATE TABLE IF NOT EXISTS venue_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '',
      role TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_venue_contacts_venue ON venue_contacts(venue_id)`)

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

  // Artist Members (Bandmitglieder)
  await db.run(`
    CREATE TABLE IF NOT EXISTS artist_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      roles TEXT NOT NULL DEFAULT '[]',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      always_in_travelparty INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Artist Members per Termin (Auto-Sync + Soft-Delete)
  await db.run(`
    CREATE TABLE IF NOT EXISTS termin_artist_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      termin_id INTEGER NOT NULL REFERENCES termine(id) ON DELETE CASCADE,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      artist_member_id INTEGER NOT NULL REFERENCES artist_members(id) ON DELETE CASCADE,
      excluded INTEGER NOT NULL DEFAULT 0,
      role1 TEXT NOT NULL DEFAULT '',
      role2 TEXT NOT NULL DEFAULT '',
      role3 TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(termin_id, artist_member_id)
    )
  `)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_termin_artist_members_termin ON termin_artist_members(termin_id)`)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_termin_artist_members_artist ON termin_artist_members(artist_member_id)`)

  // ── Crew Briefing ────────────────────────────────────────────────────────────

  // Gewerke (Gruppen von Crew-Mitgliedern per Funktion)
  await db.run(`
    CREATE TABLE IF NOT EXISTS gewerke (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      can_write INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_gewerke_tenant ON gewerke(tenant_id)`)

  // Zuordnung Funktion → Gewerk (M:N, Funktion kann in mehreren Gewerken sein)
  await db.run(`
    CREATE TABLE IF NOT EXISTS gewerk_funktionen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gewerk_id INTEGER NOT NULL REFERENCES gewerke(id) ON DELETE CASCADE,
      funktion_name TEXT NOT NULL,
      UNIQUE(gewerk_id, funktion_name)
    )
  `)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_gewerk_funktionen_gewerk ON gewerk_funktionen(gewerk_id)`)

  // Ein Briefing pro Termin + Gewerk
  await db.run(`
    CREATE TABLE IF NOT EXISTS crew_briefings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      termin_id INTEGER NOT NULL REFERENCES termine(id) ON DELETE CASCADE,
      gewerk_id INTEGER NOT NULL REFERENCES gewerke(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(termin_id, gewerk_id)
    )
  `)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_crew_briefings_termin ON crew_briefings(termin_id)`)

  // Text-Blöcke innerhalb eines Briefings
  await db.run(`
    CREATE TABLE IF NOT EXISTS crew_briefing_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      briefing_id INTEGER NOT NULL REFERENCES crew_briefings(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_briefing_sections_briefing ON crew_briefing_sections(briefing_id)`)

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

    const token = jwt.sign({ id: userId, email: userEmail }, JWT_SECRET, { expiresIn: '30d' });

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
      'SELECT id, email, password_hash, first_name, last_name, is_superadmin, ui_language FROM users WHERE email = ?',
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
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, isSuperadmin: !!user.is_superadmin, uiLanguage: user.ui_language || 'de' },
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

    // Globale Felder aus users-Tabelle überlagern (Quelle der Wahrheit)
    const user = await db.get(`SELECT ${USER_GLOBAL_SELECT.replace(/\n/g,' ')} FROM users u WHERE u.id = ?`, [req.user.id])
    const merged = user ? applyUserGlobals({ ...contact, ...Object.fromEntries(Object.entries(user).map(([k,v]) => [k,v])) }) : contact
    res.json({ contact: contactFromRow(merged) });
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

    // 1. Globale Felder in users-Tabelle schreiben (Quelle der Wahrheit)
    await db.run(`
      UPDATE users SET
        first_name=?, last_name=?, phone=?, mobile=?,
        address=?, postal_code=?, residence=?, tax_id=?, website=?,
        birth_date=?, gender=?, pronouns=?, birth_place=?, nationality=?,
        id_number=?, social_security=?, diet=?, gluten_free=?, lactose_free=?,
        allergies=?, emergency_contact=?, emergency_phone=?,
        shirt_size=?, hoodie_size=?, pants_size=?, shoe_size=?,
        hotel_info=?, hotel_alias=?, languages=?, drivers_license=?, railcard=?, frequent_flyer=?,
        bank_account=?, bank_iban=?, bank_bic=?, tax_number=?, vat_id=?,
        specification=?, special_notes=?
      WHERE id = ?`,
      [
        b.firstName, b.lastName, b.phone, b.mobile,
        b.address, b.postalCode, b.residence, b.taxId, b.website,
        b.birthDate, b.gender, b.pronouns, b.birthPlace, b.nationality,
        b.idNumber, b.socialSecurity, b.diet, b.glutenFree ? 1 : 0, b.lactoseFree ? 1 : 0,
        b.allergies, b.emergencyContact, b.emergencyPhone,
        b.shirtSize, b.hoodieSize, b.pantsSize, b.shoeSize,
        b.hotelInfo, b.hotelAlias, b.languages, b.driversLicense, b.railcard, b.frequentFlyer,
        b.bankAccount, b.bankIban, b.bankBic, b.taxNumber, b.vatId,
        b.specification, b.notes,
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

    const updated = await db.get(`
      SELECT c.*, ut.role AS tenant_role, ${USER_GLOBAL_SELECT}
      FROM contacts c
      LEFT JOIN user_tenants ut ON ut.user_id = c.user_id AND ut.tenant_id = c.tenant_id AND ut.status = 'active'
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.id = ?`, [contact.id]);
    res.json({ contact: contactFromRow(applyUserGlobals(updated)) });
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
  latitude: row.latitude || '',
  longitude: row.longitude || '',
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
        parking, nightliner_parking, loading_path, notes, latitude, longitude, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.tenant.id, v.name, v.street, v.postalCode, v.city, v.state, v.country, v.website,
      v.arrival, v.arrivalStreet, v.arrivalPostalCode, v.arrivalCity,
      v.capacity, v.capacitySeated, v.stageDimensions, v.clearanceHeight,
      v.merchandiseFee, v.merchandiseStand, v.wardrobe, v.showers, v.wifi,
      v.parking, v.nightlinerParking, v.loadingPath, v.notes, v.latitude, v.longitude, req.user.id
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
        latitude = ?, longitude = ?,
        updated_at = datetime('now')
      WHERE id = ? AND tenant_id = ?
    `, [
      v.name, v.street, v.postalCode, v.city, v.state, v.country, v.website,
      v.arrival, v.arrivalStreet, v.arrivalPostalCode, v.arrivalCity,
      v.capacity, v.capacitySeated, v.stageDimensions, v.clearanceHeight,
      v.merchandiseFee, v.merchandiseStand, v.wardrobe, v.showers, v.wifi,
      v.parking, v.nightlinerParking, v.loadingPath, v.notes,
      v.latitude, v.longitude,
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

// GET single venue
app.get('/api/venues/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const row = await db.get('SELECT * FROM venues WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!row) return res.status(404).json({ error: 'Venue not found' });
    res.json({ venue: venueFromRow(row) });
  } catch (error) {
    console.error('Get venue error:', error);
    res.status(500).json({ error: 'Failed to get venue' });
  }
});

// GET vergangene Shows an diesem Venue
app.get('/api/venues/:id/shows', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT id, date, title, city, status_booking FROM termine
       WHERE tenant_id = ? AND venue_id = ?
       ORDER BY date DESC LIMIT 50`,
      [req.tenant.id, req.params.id]
    );
    res.json({ shows: rows });
  } catch (error) {
    console.error('Get venue shows error:', error);
    res.status(500).json({ error: 'Failed to get venue shows' });
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
  alwaysInTravelparty: !!r.always_in_travelparty,
  memberRoles: JSON.parse(r.member_roles || '[]'),
  memberSortOrder: r.member_sort_order || 0,
});

// Globale User-Felder die in users-Tabelle gespeichert werden (Quelle der Wahrheit)
// Per-Tenant bleiben: function1/2/3, access_rights, contact_type, invite_pending, crew_tool_active, hourly_rate, daily_rate
const USER_GLOBAL_SELECT = `
  u.first_name AS u_first_name, u.last_name AS u_last_name,
  u.phone AS u_phone, u.mobile AS u_mobile,
  u.address AS u_address, u.postal_code AS u_postal_code, u.residence AS u_residence,
  u.birth_date AS u_birth_date, u.gender AS u_gender, u.pronouns AS u_pronouns,
  u.birth_place AS u_birth_place, u.nationality AS u_nationality,
  u.id_number AS u_id_number, u.tax_id AS u_tax_id,
  u.social_security AS u_social_security, u.tax_number AS u_tax_number, u.vat_id AS u_vat_id,
  u.diet AS u_diet, u.gluten_free AS u_gluten_free, u.lactose_free AS u_lactose_free,
  u.allergies AS u_allergies, u.emergency_contact AS u_emergency_contact,
  u.emergency_phone AS u_emergency_phone, u.shirt_size AS u_shirt_size,
  u.hoodie_size AS u_hoodie_size, u.pants_size AS u_pants_size, u.shoe_size AS u_shoe_size,
  u.hotel_info AS u_hotel_info, u.hotel_alias AS u_hotel_alias,
  u.languages AS u_languages, u.drivers_license AS u_drivers_license,
  u.railcard AS u_railcard, u.frequent_flyer AS u_frequent_flyer,
  u.bank_account AS u_bank_account, u.bank_iban AS u_bank_iban, u.bank_bic AS u_bank_bic,
  u.website AS u_website, u.specification AS u_specification, u.special_notes AS u_notes
`

// Liest globale User-Felder aus dem u_* JOIN; Fallback auf contacts-Felder (für Guest-Kontakte ohne user_id)
const applyUserGlobals = (r) => {
  if (!r.user_id || r.u_first_name === undefined) return r // kein JOIN oder kein User
  const g = (uVal, cVal) => (uVal !== undefined && uVal !== null && uVal !== '') ? uVal : (cVal ?? '')
  const gb = (uVal, cVal) => (uVal !== undefined && uVal !== null) ? uVal : (cVal ?? 0)
  return {
    ...r,
    first_name:        g(r.u_first_name, r.first_name),
    last_name:         g(r.u_last_name,  r.last_name),
    phone:             g(r.u_phone, r.phone),
    mobile:            g(r.u_mobile, r.mobile),
    address:           g(r.u_address, r.address),
    postal_code:       g(r.u_postal_code, r.postal_code),
    residence:         g(r.u_residence, r.residence),
    birth_date:        g(r.u_birth_date, r.birth_date),
    gender:            g(r.u_gender, r.gender),
    pronouns:          g(r.u_pronouns, r.pronouns),
    birth_place:       g(r.u_birth_place, r.birth_place),
    nationality:       g(r.u_nationality, r.nationality),
    id_number:         g(r.u_id_number, r.id_number),
    tax_id:            g(r.u_tax_id, r.tax_id),
    social_security:   g(r.u_social_security, r.social_security),
    tax_number:        g(r.u_tax_number, r.tax_number),
    vat_id:            g(r.u_vat_id, r.vat_id),
    diet:              g(r.u_diet, r.diet),
    gluten_free:       gb(r.u_gluten_free, r.gluten_free),
    lactose_free:      gb(r.u_lactose_free, r.lactose_free),
    allergies:         g(r.u_allergies, r.allergies),
    emergency_contact: g(r.u_emergency_contact, r.emergency_contact),
    emergency_phone:   g(r.u_emergency_phone, r.emergency_phone),
    shirt_size:        g(r.u_shirt_size, r.shirt_size),
    hoodie_size:       g(r.u_hoodie_size, r.hoodie_size),
    pants_size:        g(r.u_pants_size, r.pants_size),
    shoe_size:         g(r.u_shoe_size, r.shoe_size),
    hotel_info:        g(r.u_hotel_info, r.hotel_info),
    hotel_alias:       g(r.u_hotel_alias, r.hotel_alias),
    languages:         g(r.u_languages, r.languages),
    drivers_license:   g(r.u_drivers_license, r.drivers_license),
    railcard:          g(r.u_railcard, r.railcard),
    frequent_flyer:    g(r.u_frequent_flyer, r.frequent_flyer),
    bank_account:      g(r.u_bank_account, r.bank_account),
    bank_iban:         g(r.u_bank_iban, r.bank_iban),
    bank_bic:          g(r.u_bank_bic, r.bank_bic),
    website:           g(r.u_website, r.website),
    specification:     g(r.u_specification, r.specification),
    notes:             g(r.u_notes, r.notes),
  }
}

app.get('/api/contacts', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT c.*, ut.role AS tenant_role, ${USER_GLOBAL_SELECT}
      FROM contacts c
      LEFT JOIN user_tenants ut ON ut.user_id = c.user_id AND ut.tenant_id = c.tenant_id AND ut.status = 'active'
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.tenant_id = ?
        AND (u.is_superadmin IS NULL OR u.is_superadmin = 0)
      ORDER BY c.last_name, c.first_name
    `, [req.tenant.id]);
    res.json({ contacts: rows.map(r => contactFromRow(applyUserGlobals(r))) });
  } catch (e) { res.status(500).json({ error: 'Failed to get contacts' }); }
});

app.get('/api/contacts/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const row = await db.get(`
      SELECT c.*, ut.role AS tenant_role, ${USER_GLOBAL_SELECT}
      FROM contacts c
      LEFT JOIN user_tenants ut ON ut.user_id = c.user_id AND ut.tenant_id = c.tenant_id AND ut.status = 'active'
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.id = ? AND c.tenant_id = ?
    `, [req.params.id, req.tenant.id])
    if (!row) return res.status(404).json({ error: 'Kontakt nicht gefunden' })
    res.json({ contact: contactFromRow(applyUserGlobals(row)) })
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
    const existing = await db.get('SELECT id, user_id FROM contacts WHERE id = ? AND tenant_id = ?', [id, req.tenant.id]);
    if (!existing) return res.status(404).json({ error: 'Contact not found' });

    // Tenant-spezifische Felder in contacts schreiben
    await db.run(`
      UPDATE contacts SET first_name=?, last_name=?, function1=?, function2=?, function3=?,
        specification=?, access_rights=?, email=?, phone=?, mobile=?, address=?, postal_code=?,
        residence=?, tax_id=?, website=?, birth_date=?, gender=?, pronouns=?, birth_place=?,
        nationality=?, id_number=?, social_security=?, diet=?, gluten_free=?, lactose_free=?,
        allergies=?, emergency_contact=?, emergency_phone=?, shirt_size=?, hoodie_size=?,
        pants_size=?, shoe_size=?, hotel_info=?, hotel_alias=?, languages=?, drivers_license=?,
        railcard=?, frequent_flyer=?, bank_account=?, bank_iban=?, bank_bic=?,
        tax_number=?, vat_id=?, crew_tool_active=?, hourly_rate=?, daily_rate=?, notes=?,
        updated_at=datetime('now')
      WHERE id=? AND tenant_id=?
    `, [c.firstName||'', c.lastName||'', c.function1||'', c.function2||'', c.function3||'',
        c.specification||'', c.accessRights||'', c.email||'', c.phone||'', c.mobile||'',
        c.address||'', c.postalCode||'', c.residence||'', c.taxId||'', c.website||'',
        c.birthDate||'', c.gender||'', c.pronouns||'', c.birthPlace||'', c.nationality||'',
        c.idNumber||'', c.socialSecurity||'', c.diet||'', c.glutenFree?1:0, c.lactoseFree?1:0,
        c.allergies||'', c.emergencyContact||'', c.emergencyPhone||'', c.shirtSize||'',
        c.hoodieSize||'', c.pantsSize||'', c.shoeSize||'',
        c.hotelInfo||'', c.hotelAlias||'', c.languages||'', c.driversLicense||'',
        c.railcard||'', c.frequentFlyer||'', c.bankAccount||'', c.bankIban||'', c.bankBic||'',
        c.taxNumber||'', c.vatId||'', c.crewToolActive!==false?1:0, c.hourlyRate||0, c.dailyRate||0,
        c.notes||'', id, req.tenant.id]);

    // Wenn User-Konto verknüpft: globale Felder auch in users schreiben
    if (existing.user_id) {
      await db.run(`
        UPDATE users SET
          first_name=?, last_name=?, phone=?, mobile=?, address=?, postal_code=?,
          residence=?, tax_id=?, website=?, birth_date=?, gender=?, pronouns=?,
          birth_place=?, nationality=?, id_number=?, social_security=?,
          diet=?, gluten_free=?, lactose_free=?, allergies=?,
          emergency_contact=?, emergency_phone=?, shirt_size=?, hoodie_size=?,
          pants_size=?, shoe_size=?, hotel_info=?, hotel_alias=?, languages=?,
          drivers_license=?, railcard=?, frequent_flyer=?,
          bank_account=?, bank_iban=?, bank_bic=?, tax_number=?, vat_id=?,
          specification=?, special_notes=?
        WHERE id=?`,
        [c.firstName||'', c.lastName||'', c.phone||'', c.mobile||'',
         c.address||'', c.postalCode||'', c.residence||'', c.taxId||'', c.website||'',
         c.birthDate||'', c.gender||'', c.pronouns||'', c.birthPlace||'', c.nationality||'',
         c.idNumber||'', c.socialSecurity||'', c.diet||'', c.glutenFree?1:0, c.lactoseFree?1:0,
         c.allergies||'', c.emergencyContact||'', c.emergencyPhone||'',
         c.shirtSize||'', c.hoodieSize||'', c.pantsSize||'', c.shoeSize||'',
         c.hotelInfo||'', c.hotelAlias||'', c.languages||'', c.driversLicense||'',
         c.railcard||'', c.frequentFlyer||'', c.bankAccount||'', c.bankIban||'', c.bankBic||'',
         c.taxNumber||'', c.vatId||'', c.specification||'', c.notes||'',
         existing.user_id])
    }

    const row = await db.get(`
      SELECT c.*, ut.role AS tenant_role, ${USER_GLOBAL_SELECT}
      FROM contacts c
      LEFT JOIN user_tenants ut ON ut.user_id = c.user_id AND ut.tenant_id = c.tenant_id AND ut.status = 'active'
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.id = ?`, [id])
    res.json({ contact: contactFromRow(applyUserGlobals(row)) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to update contact' }); }
});

app.delete('/api/contacts/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const existing = await db.get('SELECT id, user_id FROM contacts WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!existing) return res.status(404).json({ error: 'Contact not found' });
    // Hat der Kontakt einen verknüpften User-Account? → user_tenants-Eintrag ebenfalls entfernen
    if (existing.user_id) {
      await db.run('DELETE FROM user_tenants WHERE user_id = ? AND tenant_id = ?', [existing.user_id, req.tenant.id]);
    }
    await db.run('DELETE FROM contacts WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    res.json({ message: 'Contact removed' });
  } catch (e) { res.status(500).json({ error: 'Failed to remove contact' }); }
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

app.get('/api/hotels/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const row = await db.get('SELECT * FROM hotels WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!row) return res.status(404).json({ error: 'Hotel not found' });
    res.json({ hotel: hotelFromRow(row) });
  } catch (e) { res.status(500).json({ error: 'Failed to get hotel' }); }
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

app.get('/api/vehicles/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const row = await db.get('SELECT * FROM vehicles WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!row) return res.status(404).json({ error: 'Vehicle not found' });
    res.json({ vehicle: vehicleFromRow(row) });
  } catch (e) { res.status(500).json({ error: 'Failed to get vehicle' }); }
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

app.get('/api/partners/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const row = await db.get('SELECT * FROM partners WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id]);
    if (!row) return res.status(404).json({ error: 'Partner not found' });
    res.json({ partner: partnerFromRow(row) });
  } catch (e) { res.status(500).json({ error: 'Failed to get partner' }); }
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

// GET /api/chat/recent?hours=48  → Letzte Nachrichten aus allen Termin-Chats (für Schreibtisch)
app.get('/api/chat/recent', authenticateToken, requireTenant, async (req, res) => {
  try {
    const hours = Math.min(parseInt(req.query.hours) || 48, 168); // max 7 Tage
    const messages = await db.all(
      `SELECT
         cm.id, cm.entity_id, cm.user_id, cm.user_name, cm.text, cm.created_at,
         t.title as termin_title, t.date as termin_date, t.city as termin_city
       FROM chat_messages cm
       LEFT JOIN termine t ON t.id = CAST(cm.entity_id AS INTEGER) AND t.tenant_id = cm.tenant_id
       WHERE cm.tenant_id = ?
         AND cm.entity_type = 'termin'
         AND cm.created_at >= datetime('now', '-' || ? || ' hours')
       ORDER BY cm.created_at DESC
       LIMIT 50`,
      [req.tenant.id, hours]
    );
    res.json({ messages });
  } catch (err) {
    console.error('GET /api/chat/recent error:', err);
    res.status(500).json({ error: 'Failed to get recent messages' });
  }
});

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
    const { terminId } = req.params;
    const tenantId = req.tenant.id;

    // Auto-sync: artist contacts (contact_type='artist', always_in_travelparty=1) not yet in termin_artist_members
    const missingArtists = await db.all(`
      SELECT c.* FROM contacts c
      WHERE c.tenant_id = ? AND c.contact_type = 'artist' AND c.always_in_travelparty = 1
        AND c.id NOT IN (
          SELECT contact_id FROM termin_artist_members
          WHERE termin_id = ? AND tenant_id = ? AND contact_id IS NOT NULL
        )
    `, [tenantId, terminId, tenantId]);
    for (const am of missingArtists) {
      const roles = JSON.parse(am.member_roles || '[]');
      await db.run(
        `INSERT OR IGNORE INTO termin_artist_members (termin_id, tenant_id, contact_id, role1, role2, role3, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [terminId, tenantId, am.id, roles[0] || '', roles[1] || '', roles[2] || '', am.member_sort_order || 0]
      );
    }

    // Crew members (contacts)
    const crewRows = await db.all(`
      SELECT
        tp.id, tp.termin_id, tp.tenant_id, tp.contact_id,
        tp.role1, tp.role2, tp.role3, tp.specification, tp.sort_order,
        c.first_name, c.last_name, c.email, c.phone, c.mobile,
        c.postal_code, c.residence,
        c.function1, c.function2, c.function3,
        c.user_id, c.contact_type,
        av.status AS availability_status,
        0 AS is_artist_member,
        0 AS excluded,
        NULL AS artist_member_id
      FROM termin_travel_party tp
      JOIN contacts c ON c.id = tp.contact_id
      LEFT JOIN termin_availability av
        ON av.termin_id = tp.termin_id AND av.user_id = c.user_id
      WHERE tp.termin_id = ? AND tp.tenant_id = ?
      ORDER BY tp.sort_order ASC, tp.id ASC
    `, [terminId, tenantId]);

    // Artist members (including excluded, so frontend can show restore option)
    const artistRows = await db.all(`
      SELECT
        tam.id, tam.termin_id, tam.tenant_id,
        tam.contact_id,
        tam.role1, tam.role2, tam.role3,
        '' AS specification, tam.sort_order,
        c.first_name, c.last_name, c.email, c.phone,
        '' AS mobile, '' AS postal_code, '' AS residence,
        c.member_roles AS _roles_json,
        c.user_id, 'artist_member' AS contact_type,
        'available' AS availability_status,
        1 AS is_artist_member,
        tam.excluded,
        tam.contact_id AS artist_member_id
      FROM termin_artist_members tam
      JOIN contacts c ON c.id = tam.contact_id
      WHERE tam.termin_id = ? AND tam.tenant_id = ? AND tam.contact_id IS NOT NULL
      ORDER BY tam.sort_order ASC, c.last_name COLLATE NOCASE ASC
    `, [terminId, tenantId]);

    // Parse member_roles → function1/2/3
    const parsedArtistRows = artistRows.map(r => {
      const roles = JSON.parse(r._roles_json || '[]');
      const { _roles_json, ...rest } = r;
      return { ...rest, function1: roles[0] || '', function2: roles[1] || '', function3: roles[2] || '' };
    });

    const activeArtistRows = parsedArtistRows.filter(r => !r.excluded)
    const excludedArtistRows = parsedArtistRows.filter(r => r.excluded)
    res.json({ members: [...activeArtistRows, ...crewRows], excludedBandMembers: excludedArtistRows });
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
      WHERE c.tenant_id = ? AND (c.contact_type IS NULL OR c.contact_type != 'artist')
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
    const { role1 = '', role2 = '', role3 = '', specification = '', sort_order, is_artist_member } = req.body;
    if (is_artist_member) {
      // Update termin_artist_members
      await db.run(
        `UPDATE termin_artist_members
         SET role1=?, role2=?, role3=?, sort_order=COALESCE(?,sort_order), updated_at=CURRENT_TIMESTAMP
         WHERE id=? AND tenant_id=?`,
        [role1, role2, role3, sort_order ?? null, req.params.id, req.tenant.id]
      );
      const tam = await db.get(`
        SELECT tam.*, c.first_name, c.last_name, c.email, c.phone, c.user_id,
               c.member_roles AS _roles_json,
               1 AS is_artist_member, tam.contact_id AS artist_member_id
        FROM termin_artist_members tam
        JOIN contacts c ON c.id = tam.contact_id
        WHERE tam.id = ?
      `, [req.params.id]);
      if (!tam) return res.status(404).json({ error: 'Not found' });
      const roles = JSON.parse(tam._roles_json || '[]');
      const { _roles_json, ...rest } = tam;
      return res.json({ member: { ...rest, contact_type: 'artist_member', function1: roles[0]||'', function2: roles[1]||'', function3: roles[2]||'', availability_status: 'available', excluded: tam.excluded } });
    }
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
             av.status AS availability_status,
             0 AS is_artist_member, 0 AS excluded, NULL AS artist_member_id
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

// Soft-delete artist member from termin (set excluded=1)
app.delete('/api/termine/:terminId/travel-party/artist/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    await db.run(
      'UPDATE termin_artist_members SET excluded=1, updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?',
      [req.params.id, req.tenant.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to exclude artist member' });
  }
});

// Restore excluded artist member for termin
app.post('/api/termine/:terminId/travel-party/artist/:id/restore', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    await db.run(
      'UPDATE termin_artist_members SET excluded=0, updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?',
      [req.params.id, req.tenant.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore artist member' });
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

    // Advancing
    if (sections.includes('advancing')) {
      try {
        const areas = await db.all(
          'SELECT * FROM advancing_areas WHERE termin_id = ? AND tenant_id = ? ORDER BY sort_order ASC, id ASC',
          [terminId, tenant.id]
        );
        data.advancing = await Promise.all(areas.map(async area => {
          const entries = await db.all(
            'SELECT * FROM advancing_entries WHERE area_id = ? ORDER BY sort_order ASC, id ASC',
            [area.id]
          );
          return { ...area, entries };
        }));
      } catch (e) {
        console.error('[advance-sheet] advancing section error:', e.message);
        data.advancing = [];
      }
    }

    // Sonstiges (boards)
    if (sections.includes('sonstiges')) {
      try {
        data.sonstiges = await db.all(
          `SELECT * FROM boards WHERE entity_type = 'termin_sonstiges' AND entity_id = ? AND tenant_id = ? ORDER BY sort_order ASC, id ASC`,
          [String(terminId), tenant.id]
        );
      } catch (e) {
        console.error('[advance-sheet] sonstiges section error:', e.message);
        data.sonstiges = [];
      }
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

// GET /api/termine/:terminId/call-sheet/pdf — Call Sheet (Crew-Perspektive)
app.get('/api/termine/:terminId/call-sheet/pdf', async (req, res) => {
  try {
    // Auth (identisch zum Advance Sheet)
    const tokenStr = (req.headers['authorization']?.split(' ')[1]) || req.query.token;
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
      tenant = await db.get(`SELECT t.id FROM tenants t JOIN user_tenants ut ON t.id = ut.tenant_id WHERE t.slug = ? AND ut.user_id = ? AND ut.status = 'active'`, [tenantSlug, user.id]);
    }
    if (!tenant) return res.status(403).json({ error: 'No access to this tenant' });

    const terminId = req.params.terminId;
    const sectionsParam = req.query.sections || 'travelparty,schedules,travel,hotel,catering,contacts';
    const sections = sectionsParam.split(',').map(s => s.trim());

    const termin = await db.get('SELECT t.*, v.name AS venue_name FROM termine t LEFT JOIN venues v ON v.id = t.venue_id WHERE t.id = ? AND t.tenant_id = ?', [terminId, tenant.id]);
    if (!termin) return res.status(404).json({ error: 'Termin not found' });

    const data = {};

    if (sections.includes('travelparty')) {
      data.travelParty = await db.all(`SELECT tp.*, c.first_name, c.last_name, c.function1, c.function2, c.function3, c.email, c.phone FROM termin_travel_party tp JOIN contacts c ON c.id = tp.contact_id WHERE tp.termin_id = ? AND tp.tenant_id = ? ORDER BY c.last_name COLLATE NOCASE ASC`, [terminId, tenant.id]);
    }
    if (sections.includes('schedules')) {
      data.schedules = await db.all('SELECT * FROM termin_schedules WHERE termin_id = ? AND tenant_id = ? ORDER BY sort_order ASC, id ASC', [terminId, tenant.id]);
    }
    if (sections.includes('travel')) {
      const legRows = await db.all(`SELECT ${LEG_FIELDS} FROM termin_travel_legs tl LEFT JOIN vehicles v ON v.id = tl.vehicle_id WHERE tl.termin_id = ? AND tl.tenant_id = ? ORDER BY tl.leg_type ASC, tl.sort_order ASC, tl.id ASC`, [terminId, tenant.id]);
      data.legs = await Promise.all(legRows.map(async leg => {
        const persons = await db.all(`SELECT tlp.id, c.first_name, c.last_name FROM termin_travel_leg_persons tlp JOIN termin_travel_party tp ON tp.id = tlp.travel_party_member_id JOIN contacts c ON c.id = tp.contact_id WHERE tlp.leg_id = ? ORDER BY c.last_name COLLATE NOCASE ASC`, [leg.id]);
        return { ...leg, persons };
      }));
    }
    if (sections.includes('hotel')) {
      const stayRows = await db.all(`SELECT hs.*, h.name AS hotel_name, h.city AS hotel_city, h.street AS hotel_street, h.postal_code AS hotel_postal_code, h.phone AS hotel_phone, h.website AS hotel_website FROM termin_hotel_stays hs LEFT JOIN hotels h ON h.id = hs.hotel_id WHERE hs.termin_id = ? AND hs.tenant_id = ? ORDER BY hs.sort_order ASC`, [terminId, tenant.id]);
      data.hotelStays = await Promise.all(stayRows.map(async stay => {
        const rooms = await db.all('SELECT * FROM termin_hotel_rooms WHERE stay_id = ? ORDER BY id ASC', [stay.id]);
        const roomsWithPersons = await Promise.all(rooms.map(async room => {
          const persons = await db.all(`SELECT c.first_name, c.last_name FROM termin_hotel_room_persons hrp JOIN termin_travel_party tp ON tp.id = hrp.travel_party_member_id JOIN contacts c ON c.id = tp.contact_id WHERE hrp.room_id = ? ORDER BY c.last_name COLLATE NOCASE ASC`, [room.id]);
          return { ...room, persons };
        }));
        return { ...stay, rooms: roomsWithPersons };
      }));
    }
    if (sections.includes('catering')) {
      data.catering = await db.get('SELECT * FROM termin_catering WHERE termin_id = ? AND tenant_id = ?', [terminId, tenant.id]);
      if (data.catering) {
        data.cateringOrders = await db.all('SELECT * FROM termin_catering_orders WHERE termin_id = ? AND tenant_id = ? ORDER BY id ASC', [terminId, tenant.id]);
      }
    }
    if (sections.includes('contacts')) {
      data.localContacts = await db.all('SELECT * FROM termin_contacts WHERE termin_id = ? AND tenant_id = ? ORDER BY sort_order ASC, id ASC', [terminId, tenant.id]);
    }

    // Sonstiges (boards)
    if (sections.includes('sonstiges')) {
      data.sonstiges = await db.all(
        `SELECT * FROM boards WHERE entity_type = 'termin_sonstiges' AND entity_id = ? AND tenant_id = ? ORDER BY sort_order ASC, id ASC`,
        [String(terminId), tenant.id]
      );
    }

    const { generateCallSheetPdf } = require('./generate_call_sheet');
    const pdf = await generateCallSheetPdf({ termin, sections, data });

    const safeName = `callsheet_${(termin.city || termin.title || 'crew').replace(/[^a-zA-Z0-9_\-]/g, '_')}_${(termin.date || '').replace(/-/g, '')}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.end(pdf);
  } catch (err) {
    console.error('call-sheet-pdf error:', err.message, err.stack);
    res.status(500).json({ error: err.message || 'Failed to generate PDF' });
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
// SCHEDULE TEMPLATES
// ============================================

app.get('/api/templates/schedules', authenticateToken, requireTenant, async (req, res) => {
  try {
    const templates = await db.all(
      'SELECT * FROM schedule_templates WHERE tenant_id = ? ORDER BY sort_order ASC, id ASC',
      [req.tenant.id]
    );
    res.json({ templates });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load schedule templates' });
  }
});

app.post('/api/templates/schedules', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { name = '', content = '', not_final = 0, sort_order = 0 } = req.body;
    const result = await db.run(
      'INSERT INTO schedule_templates (tenant_id, name, content, not_final, sort_order) VALUES (?, ?, ?, ?, ?)',
      [req.tenant.id, name, content, not_final ? 1 : 0, sort_order]
    );
    const template = await db.get('SELECT * FROM schedule_templates WHERE id = ?', [result.lastID]);
    res.json({ template });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create schedule template' });
  }
});

app.put('/api/templates/schedules/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { name, content, not_final, sort_order } = req.body;
    await db.run(
      `UPDATE schedule_templates SET
        name = COALESCE(?, name),
        content = COALESCE(?, content),
        not_final = COALESCE(?, not_final),
        sort_order = COALESCE(?, sort_order),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [name ?? null, content ?? null, not_final != null ? (not_final ? 1 : 0) : null, sort_order ?? null, req.params.id, req.tenant.id]
    );
    const template = await db.get('SELECT * FROM schedule_templates WHERE id = ?', [req.params.id]);
    res.json({ template });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update schedule template' });
  }
});

app.delete('/api/templates/schedules/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    await db.run(
      'DELETE FROM schedule_templates WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.tenant.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete schedule template' });
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
app.post('/api/termine/:terminId/catering/orders', authenticateToken, requireTenant, async (req, res) => {
  try {
    const isEditor = ['admin', 'agency', 'tourmanagement'].includes(req.tenant.role)
    let { contact_id, contact_name, order_text } = req.body
    if (!isEditor) {
      // Crew: nur eigenen Kontakt erlaubt
      const myContact = await db.get(
        'SELECT id, first_name, last_name FROM contacts WHERE user_id=? AND tenant_id=?',
        [req.user.id, req.tenant.id]
      )
      if (!myContact) return res.status(403).json({ error: 'Kein Kontakt gefunden' })
      contact_id   = myContact.id
      contact_name = `${myContact.first_name} ${myContact.last_name}`.trim()
    }
    const result = await db.run(
      `INSERT INTO termin_catering_orders (tenant_id, termin_id, contact_id, contact_name, order_text)
       VALUES (?,?,?,?,?)`,
      [req.tenant.id, req.params.terminId, contact_id ?? null, contact_name ?? null, order_text ?? '']
    )
    const row = await db.get('SELECT * FROM termin_catering_orders WHERE id=?', [result.lastID])
    res.status(201).json(row)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/termine/:terminId/catering/orders/:orderId
app.put('/api/termine/:terminId/catering/orders/:orderId', authenticateToken, requireTenant, async (req, res) => {
  try {
    const isEditor = ['admin', 'agency', 'tourmanagement'].includes(req.tenant.role)
    const { order_text } = req.body
    if (!isEditor) {
      // Crew: nur eigene Zeile bearbeitbar
      const myContact = await db.get(
        'SELECT id FROM contacts WHERE user_id=? AND tenant_id=?',
        [req.user.id, req.tenant.id]
      )
      const order = await db.get(
        'SELECT contact_id FROM termin_catering_orders WHERE id=? AND tenant_id=?',
        [req.params.orderId, req.tenant.id]
      )
      if (!myContact || !order || order.contact_id !== myContact.id) {
        return res.status(403).json({ error: 'Keine Berechtigung' })
      }
    }
    await db.run(
      'UPDATE termin_catering_orders SET order_text=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?',
      [order_text, req.params.orderId, req.tenant.id]
    )
    const row = await db.get('SELECT * FROM termin_catering_orders WHERE id=?', [req.params.orderId])
    res.json(row)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /api/termine/:terminId/catering/orders/:orderId
app.delete('/api/termine/:terminId/catering/orders/:orderId', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    await db.run('DELETE FROM termin_catering_orders WHERE id=? AND tenant_id=?', [req.params.orderId, req.tenant.id])
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ============================================
// ROUTES: ADVANCING
// ============================================

// GET all areas for a termin
app.get('/api/termine/:terminId/advancing/areas', authenticateToken, requireTenant, async (req, res) => {
  try {
    const areas = await db.all(
      `SELECT a.*, COUNT(e.id) as entry_count
       FROM advancing_areas a
       LEFT JOIN advancing_entries e ON e.area_id = a.id
       WHERE a.tenant_id = ? AND a.termin_id = ?
       GROUP BY a.id ORDER BY a.sort_order, a.created_at`,
      [req.tenant.id, req.params.terminId]
    )
    res.json({ areas })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST create area
app.post('/api/termine/:terminId/advancing/areas', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { name, sort_order = 0 } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Name fehlt' })
    const result = await db.run(
      `INSERT INTO advancing_areas (tenant_id, termin_id, name, sort_order, created_by) VALUES (?,?,?,?,?)`,
      [req.tenant.id, req.params.terminId, name.trim(), sort_order, req.user.id]
    )
    const area = await db.get('SELECT * FROM advancing_areas WHERE id=?', [result.lastID])
    res.status(201).json({ area })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT update area (rename / reorder)
app.put('/api/termine/:terminId/advancing/areas/:areaId', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { name, sort_order } = req.body
    await db.run(
      `UPDATE advancing_areas SET name=COALESCE(?,name), sort_order=COALESCE(?,sort_order) WHERE id=? AND tenant_id=?`,
      [name ?? null, sort_order ?? null, req.params.areaId, req.tenant.id]
    )
    const area = await db.get('SELECT * FROM advancing_areas WHERE id=?', [req.params.areaId])
    res.json({ area })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE area (cascades entries)
app.delete('/api/termine/:terminId/advancing/areas/:areaId', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    await db.run('DELETE FROM advancing_areas WHERE id=? AND tenant_id=?', [req.params.areaId, req.tenant.id])
    res.json({ message: 'ok' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET entries for area
app.get('/api/termine/:terminId/advancing/areas/:areaId/entries', authenticateToken, requireTenant, async (req, res) => {
  try {
    const entries = await db.all(
      `SELECT e.*, u.first_name, u.last_name FROM advancing_entries e
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.area_id=? AND e.tenant_id=? ORDER BY e.created_at`,
      [req.params.areaId, req.tenant.id]
    )
    res.json({ entries })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST create entry
app.post('/api/termine/:terminId/advancing/areas/:areaId/entries', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { type = 'info', title, details = '', status = 'open' } = req.body
    if (!title?.trim()) return res.status(400).json({ error: 'Titel fehlt' })
    const result = await db.run(
      `INSERT INTO advancing_entries (tenant_id, area_id, type, title, details, status, created_by) VALUES (?,?,?,?,?,?,?)`,
      [req.tenant.id, req.params.areaId, type, title.trim(), details, status, req.user.id]
    )
    const entry = await db.get('SELECT * FROM advancing_entries WHERE id=?', [result.lastID])
    res.status(201).json({ entry })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT update entry
app.put('/api/termine/:terminId/advancing/areas/:areaId/entries/:entryId', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { type, title, details, status } = req.body
    await db.run(
      `UPDATE advancing_entries SET
         type=COALESCE(?,type), title=COALESCE(?,title),
         details=COALESCE(?,details), status=COALESCE(?,status),
         updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND tenant_id=?`,
      [type ?? null, title ?? null, details ?? null, status ?? null, req.params.entryId, req.tenant.id]
    )
    const entry = await db.get('SELECT * FROM advancing_entries WHERE id=?', [req.params.entryId])
    res.json({ entry })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE entry
app.delete('/api/termine/:terminId/advancing/areas/:areaId/entries/:entryId', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    await db.run('DELETE FROM advancing_entries WHERE id=? AND tenant_id=?', [req.params.entryId, req.tenant.id])
    res.json({ message: 'ok' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

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
    const { email, role = 'crew', contact_id, first_name, last_name } = req.body
    if (!email) return res.status(400).json({ error: 'E-Mail fehlt' })
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Ungültige Rolle' })

    // Prüfen: ist dieser User schon Mitglied?
    const existing = await db.get(
      `SELECT ut.id FROM user_tenants ut JOIN users u ON u.id=ut.user_id
       WHERE u.email=? AND ut.tenant_id=? AND ut.status='active'`,
      [email, req.tenant.id]
    )
    if (existing) return res.status(409).json({ error: 'User ist bereits Mitglied' })

    // Falls User bereits im System existiert: seine eigenen Namen nehmen
    const existingUser = await db.get('SELECT first_name, last_name FROM users WHERE email=?', [email])
    const resolvedFirstName = (existingUser?.first_name || first_name || '').trim()
    const resolvedLastName  = (existingUser?.last_name  || last_name  || '').trim()

    // Alten Pending-Token für diese E-Mail + Tenant löschen
    await db.run('DELETE FROM invite_tokens WHERE email=? AND tenant_id=? AND used_at IS NULL', [email, req.tenant.id])

    // Kontakt anlegen/aktualisieren (damit er sofort in der Liste erscheint)
    let resolvedContactId = contact_id ?? null
    if (!resolvedContactId) {
      const existingContact = await db.get(
        'SELECT id FROM contacts WHERE email=? AND tenant_id=?', [email, req.tenant.id]
      )
      if (existingContact) {
        resolvedContactId = existingContact.id
        // Namen aktualisieren wenn vorhanden
        if (resolvedFirstName || resolvedLastName) {
          await db.run(
            'UPDATE contacts SET first_name=?, last_name=?, invite_pending=1 WHERE id=?',
            [resolvedFirstName, resolvedLastName, resolvedContactId]
          )
        } else {
          await db.run('UPDATE contacts SET invite_pending=1 WHERE id=?', [resolvedContactId])
        }
      } else {
        const newContact = await db.run(
          `INSERT INTO contacts (tenant_id, email, first_name, last_name, contact_type, invite_pending, crew_tool_active)
           VALUES (?, ?, ?, ?, 'crew', 1, 0)`,
          [req.tenant.id, email, resolvedFirstName, resolvedLastName]
        )
        resolvedContactId = newContact.lastID
      }
    } else {
      // contact_id explizit angegeben (vom Kontakt-Modal): Namen ebenfalls updaten
      if (resolvedFirstName || resolvedLastName) {
        await db.run(
          'UPDATE contacts SET first_name=?, last_name=?, invite_pending=1 WHERE id=? AND tenant_id=?',
          [resolvedFirstName, resolvedLastName, resolvedContactId, req.tenant.id]
        )
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

        // Für bestehende User: Profildaten aus einem anderen Tenant-Kontakt übernehmen
        // (außer function1/2/3 und access_rights — die sind tenant-spezifisch)
        if (existingUser) {
          const sourceContact = await db.get(`
            SELECT first_name, last_name, phone, mobile, address, postal_code, residence,
                   birth_date, gender, pronouns, birth_place, nationality, id_number,
                   tax_id, social_security, tax_number, vat_id, diet, gluten_free,
                   lactose_free, allergies, emergency_contact, emergency_phone,
                   shirt_size, hoodie_size, pants_size, shoe_size, languages,
                   drivers_license, railcard, frequent_flyer, bank_account, bank_iban,
                   bank_bic, specification, notes, hotel_info, hotel_alias, crew_tool_active
            FROM contacts
            WHERE user_id=? AND tenant_id != ?
            ORDER BY updated_at DESC
            LIMIT 1
          `, [userId, row.tenant_id])

          if (sourceContact) {
            await db.run(`
              UPDATE contacts SET
                first_name=?, last_name=?, phone=?, mobile=?, address=?, postal_code=?,
                residence=?, birth_date=?, gender=?, pronouns=?, birth_place=?, nationality=?,
                id_number=?, tax_id=?, social_security=?, tax_number=?, vat_id=?,
                diet=?, gluten_free=?, lactose_free=?, allergies=?, emergency_contact=?,
                emergency_phone=?, shirt_size=?, hoodie_size=?, pants_size=?, shoe_size=?,
                languages=?, drivers_license=?, railcard=?, frequent_flyer=?, bank_account=?,
                bank_iban=?, bank_bic=?, specification=?, notes=?, hotel_info=?, hotel_alias=?,
                crew_tool_active=?, updated_at=CURRENT_TIMESTAMP
              WHERE id=?
            `, [
              sourceContact.first_name, sourceContact.last_name,
              sourceContact.phone, sourceContact.mobile,
              sourceContact.address, sourceContact.postal_code, sourceContact.residence,
              sourceContact.birth_date, sourceContact.gender, sourceContact.pronouns,
              sourceContact.birth_place, sourceContact.nationality, sourceContact.id_number,
              sourceContact.tax_id, sourceContact.social_security, sourceContact.tax_number,
              sourceContact.vat_id, sourceContact.diet, sourceContact.gluten_free,
              sourceContact.lactose_free, sourceContact.allergies, sourceContact.emergency_contact,
              sourceContact.emergency_phone, sourceContact.shirt_size, sourceContact.hoodie_size,
              sourceContact.pants_size, sourceContact.shoe_size, sourceContact.languages,
              sourceContact.drivers_license, sourceContact.railcard, sourceContact.frequent_flyer,
              sourceContact.bank_account, sourceContact.bank_iban, sourceContact.bank_bic,
              sourceContact.specification, sourceContact.notes, sourceContact.hotel_info,
              sourceContact.hotel_alias, sourceContact.crew_tool_active,
              row.contact_id
            ])
          }
        }
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
      const jwtToken = jwt.sign({ id: userId, email: user.email }, JWT_SECRET, { expiresIn: '30d' })
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
      rows = await db.all(`
        SELECT t.id, COALESCE(NULLIF(t.display_name,''), t.name) AS name, t.slug, t.status, t.trial_ends_at, t.modules_enabled, 'admin' AS role
        FROM tenants t
        ORDER BY name
      `)
    } else {
      rows = await db.all(`
        SELECT t.id, COALESCE(NULLIF(t.display_name,''), t.name) AS name, t.slug, t.status, t.trial_ends_at, t.modules_enabled, ut.role
        FROM user_tenants ut
        JOIN tenants t ON ut.tenant_id = t.id
        WHERE ut.user_id = ? AND ut.status = 'active'
        ORDER BY name
      `, [req.user.id])
    }
    res.json({ tenants: rows.map(r => ({ ...r, modules_enabled: JSON.parse(r.modules_enabled || '[]') })) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/tenant/settings — Artist-Einstellungen des aktuellen Tenants lesen
app.get('/api/tenant/settings', authenticateToken, requireTenant, async (req, res) => {
  try {
    const row = await db.get(
      'SELECT name, display_name, short_code, homebase, genre, email, phone, website, equipment_kuerzel FROM tenants WHERE id = ?',
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
    const { displayName = '', shortCode = '', homebase = '', genre = '', email = '', phone = '', website = '', equipmentKuerzel } = req.body

    // equipmentKuerzel validieren (3 Zeichen, beginnt mit Buchstabe, alphanumerisch)
    if (equipmentKuerzel !== undefined && equipmentKuerzel !== null && equipmentKuerzel !== '') {
      const k = equipmentKuerzel.trim().toUpperCase()
      if (!/^[A-Z][A-Z0-9]{2}$/.test(k)) {
        return res.status(400).json({ error: 'Kürzel muss genau 3 Zeichen haben, mit Buchstabe beginnen, nur A-Z und 0-9.' })
      }
      // Global-Unique prüfen (anderer Tenant hat es bereits)
      const existing = await db.get(
        'SELECT id FROM tenants WHERE equipment_kuerzel = ? AND id != ?',
        [k, req.tenant.id]
      )
      if (existing) return res.status(409).json({ error: `Kürzel "${k}" ist bereits vergeben.` })
      await db.run(
        `UPDATE tenants SET display_name=?, short_code=?, homebase=?, genre=?, email=?, phone=?, website=?, equipment_kuerzel=?, updated_at=datetime('now') WHERE id=?`,
        [displayName, shortCode, homebase, genre, email, phone, website, k, req.tenant.id]
      )
    } else {
      await db.run(
        `UPDATE tenants SET display_name=?, short_code=?, homebase=?, genre=?, email=?, phone=?, website=?, updated_at=datetime('now') WHERE id=?`,
        [displayName, shortCode, homebase, genre, email, phone, website, req.tenant.id]
      )
    }

    const row = await db.get(
      'SELECT name, display_name, short_code, homebase, genre, email, phone, website, equipment_kuerzel FROM tenants WHERE id = ?',
      [req.tenant.id]
    )
    res.json({ settings: row })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/equipment/init — generiert automatisch ein eindeutiges Kürzel für den Tenant
app.post('/api/equipment/init', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    // Falls bereits gesetzt, einfach zurückgeben
    const existing = await db.get('SELECT equipment_kuerzel FROM tenants WHERE id = ?', [req.tenant.id])
    if (existing?.equipment_kuerzel) return res.json({ kuerzel: existing.equipment_kuerzel })

    // Eindeutigen 3-Zeichen-Code generieren (Buchstabe + 2× alphanumerisch)
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // ohne I und O (verwechslungsgefahr)
    const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
    let kuerzel = null
    for (let attempts = 0; attempts < 200; attempts++) {
      const candidate =
        CHARS[Math.floor(Math.random() * CHARS.length)] +
        ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)] +
        ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)]
      const taken = await db.get('SELECT id FROM tenants WHERE equipment_kuerzel = ?', [candidate])
      if (!taken) { kuerzel = candidate; break }
    }
    if (!kuerzel) return res.status(500).json({ error: 'Kein freier Code gefunden' })

    await db.run(`UPDATE tenants SET equipment_kuerzel=?, updated_at=datetime('now') WHERE id=?`, [kuerzel, req.tenant.id])
    res.json({ kuerzel })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Equipment: Settings ──────────────────────────────────────────────────────

// GET /api/equipment/settings
app.get('/api/equipment/settings', authenticateToken, requireTenant, async (req, res) => {
  try {
    const row = await db.get(
      'SELECT carnet_ata_enabled, label_tour_name, label_use_artist_name, label_logo_path FROM tenants WHERE id = ?',
      [req.tenant.id]
    )
    res.json({
      carnet_ata_enabled: !!row?.carnet_ata_enabled,
      label_tour_name: row?.label_tour_name ?? null,
      label_use_artist_name: row?.label_use_artist_name !== 0,
      label_logo_path: row?.label_logo_path ?? null,
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/equipment/settings
app.put('/api/equipment/settings', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { carnet_ata_enabled, label_tour_name, label_use_artist_name } = req.body
    await db.run(
      `UPDATE tenants SET carnet_ata_enabled=?, label_tour_name=?, label_use_artist_name=?, updated_at=datetime('now') WHERE id=?`,
      [carnet_ata_enabled ? 1 : 0, label_tour_name || null, label_use_artist_name ? 1 : 0, req.tenant.id]
    )
    const row = await db.get(
      'SELECT carnet_ata_enabled, label_tour_name, label_use_artist_name, label_logo_path FROM tenants WHERE id = ?',
      [req.tenant.id]
    )
    res.json({
      carnet_ata_enabled: !!row?.carnet_ata_enabled,
      label_tour_name: row?.label_tour_name ?? null,
      label_use_artist_name: row?.label_use_artist_name !== 0,
      label_logo_path: row?.label_logo_path ?? null,
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/equipment/settings/logo  (Logo-Upload)
const equipmentLogoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads', 'equipment-logos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `logo_${Date.now()}${ext}`);
  },
});
const equipmentLogoUpload = multer({ storage: equipmentLogoStorage, limits: { fileSize: 5 * 1024 * 1024 } });

app.post('/api/equipment/settings/logo', authenticateToken, requireTenant,
  equipmentLogoUpload.single('logo'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Keine Datei' });
      // Delete old logo if any
      const old = await db.get('SELECT label_logo_path FROM tenants WHERE id = ?', [req.tenant.id]);
      if (old?.label_logo_path && fs.existsSync(old.label_logo_path)) {
        try { fs.unlinkSync(old.label_logo_path); } catch {}
      }
      const logoPath = req.file.path;
      await db.run(`UPDATE tenants SET label_logo_path=?, updated_at=datetime('now') WHERE id=?`,
        [logoPath, req.tenant.id]);
      res.json({ label_logo_path: logoPath, filename: req.file.filename });
    } catch (e) { res.status(500).json({ error: e.message }) }
  }
)

// DELETE /api/equipment/settings/logo
app.delete('/api/equipment/settings/logo', authenticateToken, requireTenant, async (req, res) => {
  try {
    const old = await db.get('SELECT label_logo_path FROM tenants WHERE id = ?', [req.tenant.id]);
    if (old?.label_logo_path && fs.existsSync(old.label_logo_path)) {
      try { fs.unlinkSync(old.label_logo_path); } catch {}
    }
    await db.run(`UPDATE tenants SET label_logo_path=NULL, updated_at=datetime('now') WHERE id=?`, [req.tenant.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/equipment/label-template
app.get('/api/equipment/label-template', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { DEFAULT_TEMPLATE } = require('./generate_equipment_label');
    const row = await db.get('SELECT label_template FROM tenants WHERE id = ?', [req.tenant.id]);
    const saved = row?.label_template ? JSON.parse(row.label_template) : {};
    res.json({ ...DEFAULT_TEMPLATE, ...saved });
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/equipment/label-template
app.put('/api/equipment/label-template', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { DEFAULT_TEMPLATE } = require('./generate_equipment_label');
    const tpl = { ...DEFAULT_TEMPLATE, ...req.body };
    await db.run(
      `UPDATE tenants SET label_template=?, updated_at=datetime('now') WHERE id=?`,
      [JSON.stringify(tpl), req.tenant.id]
    );
    res.json(tpl);
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Equipment: Kategorien ────────────────────────────────────────────────────

// GET /api/equipment/categories
app.get('/api/equipment/categories', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all(
      'SELECT * FROM equipment_categories WHERE tenant_id = ? ORDER BY sort_order, name',
      [req.tenant.id]
    )
    res.json({ categories: rows })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/equipment/categories
app.post('/api/equipment/categories', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    const { name, kuerzel, sort_order = 0 } = req.body
    if (!name || !kuerzel) return res.status(400).json({ error: 'Name und Kürzel sind Pflicht' })
    const k = kuerzel.trim().toUpperCase().slice(0, 5)
    const result = await db.run(
      'INSERT INTO equipment_categories (tenant_id, name, kuerzel, sort_order) VALUES (?, ?, ?, ?)',
      [req.tenant.id, name.trim(), k, sort_order]
    )
    const row = await db.get('SELECT * FROM equipment_categories WHERE id = ?', [result.lastID])
    res.json({ category: row })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/equipment/categories/:id
app.put('/api/equipment/categories/:id', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    const { name, kuerzel, sort_order } = req.body
    const k = kuerzel ? kuerzel.trim().toUpperCase().slice(0, 5) : undefined
    await db.run(
      `UPDATE equipment_categories SET name=COALESCE(?,name), kuerzel=COALESCE(?,kuerzel), sort_order=COALESCE(?,sort_order) WHERE id=? AND tenant_id=?`,
      [name?.trim() ?? null, k ?? null, sort_order ?? null, req.params.id, req.tenant.id]
    )
    const row = await db.get('SELECT * FROM equipment_categories WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id])
    res.json({ category: row })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/equipment/categories/:id
app.delete('/api/equipment/categories/:id', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    await db.run('DELETE FROM equipment_categories WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Partner-Typen ────────────────────────────────────────────────────────────

const DEFAULT_PARTNER_TYPES = [
  'Autovermietung', 'Backline-Firma', 'Booking', 'Booking Agentur', 'Brand',
  'Catering', 'Catering-Firma', 'Endorser', 'Label', 'Management',
  'Marketing', 'Medien-/Videoproduktion', 'Merchandise', 'Merchandise-Dienstleister',
  'Organizer', 'Press / PR', 'Production', 'Promoter', 'Publisher', 'Reisebüro',
  'Sicherheits-Firma', 'Studio', 'Support-Band', 'Technik-Lieferant',
  'Ticketing-Dienstleister', 'Transport', 'Trucking-Firma', 'Zulieferer Sonstiges', 'Other',
]

// GET /api/partner-types  (seeds fehlende Defaults nach)
app.get('/api/partner-types', authenticateToken, requireTenant, async (req, res) => {
  try {
    let rows = await db.all('SELECT * FROM partner_types WHERE tenant_id = ? ORDER BY sort_order, name', [req.tenant.id])
    // Fehlende Defaults immer nachsäen
    const existingNames = rows.map(r => r.name.toLowerCase())
    let seeded = false
    for (let i = 0; i < DEFAULT_PARTNER_TYPES.length; i++) {
      if (!existingNames.includes(DEFAULT_PARTNER_TYPES[i].toLowerCase())) {
        await db.run(
          'INSERT INTO partner_types (tenant_id, name, visible, sort_order) VALUES (?, ?, 1, ?)',
          [req.tenant.id, DEFAULT_PARTNER_TYPES[i], 1000 + i]
        )
        seeded = true
      }
    }
    if (seeded) {
      rows = await db.all('SELECT * FROM partner_types WHERE tenant_id = ? ORDER BY sort_order, name', [req.tenant.id])
    }
    res.json({ types: rows })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/partner-types
app.post('/api/partner-types', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  const { name, sort_order = 0 } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name erforderlich' })
  try {
    const result = await db.run(
      'INSERT INTO partner_types (tenant_id, name, visible, sort_order) VALUES (?, ?, 1, ?)',
      [req.tenant.id, name.trim(), sort_order]
    )
    const row = await db.get('SELECT * FROM partner_types WHERE id = ?', [result.lastID])
    res.json({ type: row })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PATCH /api/partner-types/:id/visible
app.patch('/api/partner-types/:id/visible', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  const { visible } = req.body
  try {
    await db.run('UPDATE partner_types SET visible = ? WHERE id = ? AND tenant_id = ?', [visible ? 1 : 0, req.params.id, req.tenant.id])
    const row = await db.get('SELECT * FROM partner_types WHERE id = ?', [req.params.id])
    res.json({ type: row })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/partner-types/:id
app.delete('/api/partner-types/:id', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    await db.run('DELETE FROM partner_types WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

/// ── Artist Members ────────────────────────────────────────────────────────────

// Helper: format contact row as ArtistMember response shape
function fmtArtistMember(row) {
  return {
    ...row,
    roles: JSON.parse(row.roles || row.member_roles || '[]'),
    sort_order: row.sort_order ?? row.member_sort_order ?? 0,
    always_in_travelparty: !!row.always_in_travelparty,
  }
}

const ARTIST_MEMBER_SELECT = `
  SELECT id, tenant_id, first_name, last_name, email, phone, notes,
         always_in_travelparty, member_roles AS roles, member_sort_order AS sort_order,
         user_id, contact_type, created_at, updated_at
  FROM contacts WHERE contact_type = 'artist'`

app.get('/api/artist-members', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all(
      `${ARTIST_MEMBER_SELECT} AND tenant_id = ? ORDER BY member_sort_order, last_name, first_name`,
      [req.tenant.id]
    )
    res.json({ members: rows.map(r => ({ ...r, roles: JSON.parse(r.roles || '[]'), always_in_travelparty: !!r.always_in_travelparty })) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/artist-members', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  const { first_name = '', last_name = '', roles = [], email = '', phone = '', notes = '', always_in_travelparty = true, sort_order = 0 } = req.body
  try {
    const rolesJson = JSON.stringify(Array.isArray(roles) ? roles : [])
    const r = await db.run(
      `INSERT INTO contacts (tenant_id, first_name, last_name, email, phone, notes,
         contact_type, always_in_travelparty, member_roles, member_sort_order, crew_tool_active)
       VALUES (?,?,?,?,?,?,'artist',?,?,?,1)`,
      [req.tenant.id, first_name, last_name, email, phone, notes, always_in_travelparty ? 1 : 0, rolesJson, sort_order]
    )
    const row = await db.get(`${ARTIST_MEMBER_SELECT} AND id = ?`, [r.lastID])
    res.json({ member: { ...row, roles: JSON.parse(row.roles || '[]'), always_in_travelparty: !!row.always_in_travelparty } })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/artist-members/:id', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  const { first_name, last_name, roles, email, phone, notes, always_in_travelparty, sort_order } = req.body
  try {
    const rolesJson = JSON.stringify(Array.isArray(roles) ? roles : [])
    await db.run(
      `UPDATE contacts SET first_name=?, last_name=?, email=?, phone=?, notes=?,
         always_in_travelparty=?, member_roles=?, member_sort_order=?,
         updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND tenant_id=? AND contact_type='artist'`,
      [first_name, last_name, email, phone, notes, always_in_travelparty ? 1 : 0, rolesJson, sort_order ?? 0, req.params.id, req.tenant.id]
    )
    const row = await db.get(`${ARTIST_MEMBER_SELECT} AND id = ?`, [req.params.id])
    res.json({ member: { ...row, roles: JSON.parse(row.roles || '[]'), always_in_travelparty: !!row.always_in_travelparty } })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/artist-members/:id', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    // Remove from all termin_artist_members
    await db.run('DELETE FROM termin_artist_members WHERE contact_id = ? AND tenant_id = ?', [req.params.id, req.tenant.id])
    // Delete contact row
    await db.run(`DELETE FROM contacts WHERE id = ? AND tenant_id = ? AND contact_type = 'artist'`, [req.params.id, req.tenant.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Equipment: Gegenstände (Items) ───────────────────────────────────────────

// Hilfsfunktion: nächste Case-ID für Tenant ermitteln
async function getNextCaseId(tenantId) {
  const tenant = await db.get('SELECT equipment_kuerzel FROM tenants WHERE id = ?', [tenantId])
  if (!tenant?.equipment_kuerzel) throw new Error('Kein Equipment-Kürzel konfiguriert. Bitte zuerst in Einstellungen → Artist setzen.')

  // 1. Gibt es freigegebene Nummern?
  const freed = await db.get(
    'SELECT id, seq_number FROM equipment_freed_seq WHERE tenant_id = ? ORDER BY seq_number ASC LIMIT 1',
    [tenantId]
  )
  if (freed) {
    await db.run('DELETE FROM equipment_freed_seq WHERE id = ?', [freed.id])
    const caseId = `G${tenant.equipment_kuerzel}${String(freed.seq_number).padStart(5, '0')}`
    return { caseId, seqNumber: freed.seq_number }
  }

  // 2. Nächste nie vergebene Nummer
  let seq = await db.get('SELECT next_number FROM equipment_seq WHERE tenant_id = ?', [tenantId])
  if (!seq) {
    await db.run('INSERT INTO equipment_seq (tenant_id, next_number) VALUES (?, 10000)', [tenantId])
    seq = { next_number: 10000 }
  }
  const seqNumber = seq.next_number
  await db.run('INSERT OR REPLACE INTO equipment_seq (tenant_id, next_number) VALUES (?, ?)', [tenantId, seqNumber + 1])
  const caseId = `G${tenant.equipment_kuerzel}${String(seqNumber).padStart(5, '0')}`
  return { caseId, seqNumber }
}

// GET /api/equipment/items
app.get('/api/equipment/items', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT ei.*, ec.name AS category_name, ec.kuerzel AS category_kuerzel,
        (SELECT COUNT(*) FROM equipment_case_contents WHERE item_id = ei.id) AS material_count,
        (SELECT COALESCE(SUM(
          CASE WHEN ecc.material_unit_id IS NOT NULL
            THEN COALESCE(em2.wert_zollwert, 0)
            ELSE COALESCE(em.wert_zollwert, 0) * ecc.anzahl
          END
        ), 0)
        FROM equipment_case_contents ecc
        LEFT JOIN equipment_materials em ON em.id = ecc.material_id
        LEFT JOIN equipment_material_units emu ON emu.id = ecc.material_unit_id
        LEFT JOIN equipment_materials em2 ON em2.id = emu.material_id
        WHERE ecc.item_id = ei.id) AS material_wert,
        (SELECT COALESCE(SUM(
          CASE WHEN ecc.material_unit_id IS NOT NULL
            THEN COALESCE(em2.gewicht_kg, 0)
            ELSE COALESCE(em.gewicht_kg, 0) * ecc.anzahl
          END
        ), 0)
        FROM equipment_case_contents ecc
        LEFT JOIN equipment_materials em ON em.id = ecc.material_id
        LEFT JOIN equipment_material_units emu ON emu.id = ecc.material_unit_id
        LEFT JOIN equipment_materials em2 ON em2.id = emu.material_id
        WHERE ecc.item_id = ei.id) AS material_gewicht
       FROM equipment_items ei
       LEFT JOIN equipment_categories ec ON ec.id = ei.category_id
       WHERE ei.tenant_id = ?
       ORDER BY ei.load_order ASC NULLS LAST, ei.case_id ASC`,
      [req.tenant.id]
    )
    res.json({ items: rows })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/equipment/items
app.post('/api/equipment/items', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    const { bezeichnung, category_id, typ, typ_custom, position, position_custom, load_order, height_cm, width_cm, depth_cm, weight_empty_kg, label_color, standort_status, gruppe_name, notiz } = req.body
    if (!bezeichnung) return res.status(400).json({ error: 'Bezeichnung ist Pflicht' })
    const { caseId, seqNumber } = await getNextCaseId(req.tenant.id)
    const result = await db.run(
      `INSERT INTO equipment_items (tenant_id, case_id, seq_number, bezeichnung, category_id, typ, typ_custom, position, position_custom, load_order, height_cm, width_cm, depth_cm, weight_empty_kg, label_color, standort_status, gruppe_name, notiz, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.tenant.id, caseId, seqNumber, bezeichnung, category_id || null, typ || 'case', typ_custom || null,
       position || null, position_custom || null, load_order || null, height_cm || null, width_cm || null,
       depth_cm || null, weight_empty_kg || null, label_color || null, standort_status || null, gruppe_name || null, notiz || null, req.user.id]
    )
    const row = await db.get(
      `SELECT ei.*, ec.name AS category_name FROM equipment_items ei LEFT JOIN equipment_categories ec ON ec.id=ei.category_id WHERE ei.id=?`,
      [result.lastID]
    )
    res.json({ item: row })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/equipment/items/:id
app.put('/api/equipment/items/:id', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    const { bezeichnung, category_id, typ, typ_custom, position, position_custom, load_order, height_cm, width_cm, depth_cm, weight_empty_kg, label_color, standort_status, gruppe_name, notiz } = req.body
    if (!bezeichnung) return res.status(400).json({ error: 'Bezeichnung ist Pflicht' })
    await db.run(
      `UPDATE equipment_items SET bezeichnung=?, category_id=?, typ=?, typ_custom=?, position=?, position_custom=?, load_order=?, height_cm=?, width_cm=?, depth_cm=?, weight_empty_kg=?, label_color=?, standort_status=?, gruppe_name=?, notiz=?, updated_at=datetime('now')
       WHERE id=? AND tenant_id=?`,
      [bezeichnung, category_id || null, typ || 'case', typ_custom || null, position || null, position_custom || null,
       load_order || null, height_cm || null, width_cm || null, depth_cm || null, weight_empty_kg || null,
       label_color || null, standort_status || null, gruppe_name || null, notiz || null,
       req.params.id, req.tenant.id]
    )
    const row = await db.get(
      `SELECT ei.*, ec.name AS category_name FROM equipment_items ei LEFT JOIN equipment_categories ec ON ec.id=ei.category_id WHERE ei.id=? AND ei.tenant_id=?`,
      [req.params.id, req.tenant.id]
    )
    res.json({ item: row })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/equipment/items/:id
app.delete('/api/equipment/items/:id', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    const item = await db.get('SELECT seq_number FROM equipment_items WHERE id=? AND tenant_id=?', [req.params.id, req.tenant.id])
    if (!item) return res.status(404).json({ error: 'Nicht gefunden' })
    // Nummer für spätere Wiederverwendung freigeben
    await db.run('INSERT INTO equipment_freed_seq (tenant_id, seq_number) VALUES (?,?)', [req.tenant.id, item.seq_number])
    await db.run('DELETE FROM equipment_items WHERE id=? AND tenant_id=?', [req.params.id, req.tenant.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Equipment: Material ──────────────────────────────────────────────────────

// GET /api/equipment/materials
app.get('/api/equipment/materials', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT em.*,
        ec.name AS category_name,
        (SELECT COUNT(*) FROM equipment_material_units WHERE material_id = em.id) AS unit_count,
        (SELECT COUNT(*) FROM equipment_material_units emu
         WHERE emu.material_id = em.id
         AND NOT EXISTS (SELECT 1 FROM equipment_case_contents ecc WHERE ecc.material_unit_id = emu.id)) AS free_unit_count,
        (SELECT COALESCE(SUM(anzahl),0) FROM equipment_case_contents WHERE material_id = em.id AND material_unit_id IS NULL) AS anzahl_gepackt
       FROM equipment_materials em
       LEFT JOIN equipment_categories ec ON ec.id = em.category_id
       WHERE em.tenant_id = ?
       ORDER BY em.bezeichnung`,
      [req.tenant.id]
    )
    res.json({ materials: rows })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/equipment/materials
app.post('/api/equipment/materials', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    const { bezeichnung, marke, modell, category_id, owner_id, ursprungsland, wert_zollwert, waehrung, gewicht_kg, anschaffungsdatum, notiz } = req.body
    if (!bezeichnung) return res.status(400).json({ error: 'Bezeichnung ist Pflicht' })
    const mat_id = req.body.mat_id?.trim() || generateId('M')
    const result = await db.run(
      `INSERT INTO equipment_materials (tenant_id, mat_id, bezeichnung, marke, modell, category_id, owner_id, typ, ursprungsland, wert_zollwert, waehrung, gewicht_kg, anschaffungsdatum, notiz, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.tenant.id, mat_id, bezeichnung, marke||null, modell||'', category_id||null, owner_id||null,
       req.body.typ||'bulk', ursprungsland||null, wert_zollwert||null,
       waehrung||'EUR', gewicht_kg||null, anschaffungsdatum||null, notiz||null, req.user.id]
    )
    const row = await db.get(
      `SELECT em.*, ec.name AS category_name,
        (SELECT COUNT(*) FROM equipment_material_units WHERE material_id = em.id) AS unit_count,
        (SELECT COALESCE(SUM(anzahl),0) FROM equipment_case_contents WHERE material_id = em.id AND material_unit_id IS NULL) AS anzahl_gepackt
       FROM equipment_materials em LEFT JOIN equipment_categories ec ON ec.id=em.category_id WHERE em.id=?`,
      [result.lastID]
    )
    res.json({ material: row })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/equipment/materials/:id
app.put('/api/equipment/materials/:id', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    const { bezeichnung, marke, modell, category_id, owner_id, typ, ursprungsland, wert_zollwert, waehrung, gewicht_kg, anschaffungsdatum, notiz } = req.body
    if (!bezeichnung) return res.status(400).json({ error: 'Bezeichnung ist Pflicht' })
    await db.run(
      `UPDATE equipment_materials SET bezeichnung=?, marke=?, modell=?, category_id=?, owner_id=?, typ=COALESCE(?,typ), ursprungsland=?, wert_zollwert=?, waehrung=?, gewicht_kg=?, anschaffungsdatum=?, notiz=?, updated_at=datetime('now')
       WHERE id=? AND tenant_id=?`,
      [bezeichnung, marke||null, modell||'', category_id||null, owner_id||null, typ||null, ursprungsland||null, wert_zollwert||null, waehrung||'EUR', gewicht_kg||null, anschaffungsdatum||null, notiz||null, req.params.id, req.tenant.id]
    )
    const row = await db.get(
      `SELECT em.*, ec.name AS category_name,
        (SELECT COUNT(*) FROM equipment_material_units WHERE material_id = em.id) AS unit_count,
        (SELECT COALESCE(SUM(anzahl),0) FROM equipment_case_contents WHERE material_id = em.id AND material_unit_id IS NULL) AS anzahl_gepackt
       FROM equipment_materials em LEFT JOIN equipment_categories ec ON ec.id=em.category_id WHERE em.id=? AND em.tenant_id=?`,
      [req.params.id, req.tenant.id]
    )
    res.json({ material: row })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/equipment/materials/:id
app.delete('/api/equipment/materials/:id', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    await db.run('DELETE FROM equipment_materials WHERE id=? AND tenant_id=?', [req.params.id, req.tenant.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Equipment: Material-Typ Update ───────────────────────────────────────────
// PUT /api/equipment/materials/:id/typ — nur typ ändern (serial/bulk)
// (Der PUT /api/equipment/materials/:id bleibt für die restlichen Felder)

// ── Equipment: Material-Einheiten (Serienartikel) ────────────────────────────

// GET /api/equipment/materials/:id/units
app.get('/api/equipment/materials/:id/units', authenticateToken, requireTenant, async (req, res) => {
  try {
    const units = await db.all(
      `SELECT u.*, ecc.item_id,
              ei.case_id AS in_case_id, ei.bezeichnung AS in_case_name
       FROM equipment_material_units u
       LEFT JOIN equipment_case_contents ecc ON ecc.material_unit_id = u.id
       LEFT JOIN equipment_items ei ON ei.id = ecc.item_id
       WHERE u.material_id = ? AND u.tenant_id = ?
       ORDER BY u.seriennummer`,
      [req.params.id, req.tenant.id]
    )
    res.json({ units })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/equipment/materials/:id/units
app.post('/api/equipment/materials/:id/units', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    const { seriennummer, notiz } = req.body
    if (!seriennummer) return res.status(400).json({ error: 'Seriennummer ist Pflicht' })
    const result = await db.run(
      `INSERT INTO equipment_material_units (tenant_id, material_id, seriennummer, notiz) VALUES (?,?,?,?)`,
      [req.tenant.id, req.params.id, seriennummer.trim(), notiz||null]
    )
    const unit = await db.get(
      `SELECT u.*, ecc.item_id, ei.case_id AS in_case_id, ei.bezeichnung AS in_case_name
       FROM equipment_material_units u
       LEFT JOIN equipment_case_contents ecc ON ecc.material_unit_id = u.id
       LEFT JOIN equipment_items ei ON ei.id = ecc.item_id
       WHERE u.id = ?`,
      [result.lastID]
    )
    res.json({ unit })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/equipment/materials/units/:unitId
app.put('/api/equipment/materials/units/:unitId', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    const { seriennummer, notiz } = req.body
    await db.run(
      `UPDATE equipment_material_units SET seriennummer=COALESCE(?,seriennummer), notiz=? WHERE id=? AND tenant_id=?`,
      [seriennummer||null, notiz||null, req.params.unitId, req.tenant.id]
    )
    const unit = await db.get(
      `SELECT u.*, ecc.item_id, ei.case_id AS in_case_id, ei.bezeichnung AS in_case_name
       FROM equipment_material_units u
       LEFT JOIN equipment_case_contents ecc ON ecc.material_unit_id = u.id
       LEFT JOIN equipment_items ei ON ei.id = ecc.item_id
       WHERE u.id = ? AND u.tenant_id = ?`,
      [req.params.unitId, req.tenant.id]
    )
    res.json({ unit })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/equipment/materials/units/:unitId
app.delete('/api/equipment/materials/units/:unitId', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    await db.run('DELETE FROM equipment_material_units WHERE id=? AND tenant_id=?', [req.params.unitId, req.tenant.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Equipment: Gegenstand-Detail ─────────────────────────────────────────────

// GET /api/equipment/items/:id — Einzelner Gegenstand mit berechneten Werten
app.get('/api/equipment/items/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const item = await db.get(
      `SELECT ei.*, ec.name AS category_name,
        (SELECT COUNT(*) FROM equipment_case_contents WHERE item_id = ei.id AND tenant_id = ei.tenant_id) AS content_count,
        (SELECT COALESCE(SUM(
          CASE WHEN ecc.material_unit_id IS NOT NULL
            THEN COALESCE(em2.gewicht_kg, 0)
            ELSE COALESCE(em.gewicht_kg, 0) * ecc.anzahl
          END
        ), 0)
        FROM equipment_case_contents ecc
        LEFT JOIN equipment_materials em ON em.id = ecc.material_id
        LEFT JOIN equipment_material_units emu ON emu.id = ecc.material_unit_id
        LEFT JOIN equipment_materials em2 ON em2.id = emu.material_id
        WHERE ecc.item_id = ei.id) AS content_gewicht,
        (SELECT COALESCE(SUM(
          CASE WHEN ecc.material_unit_id IS NOT NULL
            THEN COALESCE(em2.wert_zollwert, 0)
            ELSE COALESCE(em.wert_zollwert, 0) * ecc.anzahl
          END
        ), 0)
        FROM equipment_case_contents ecc
        LEFT JOIN equipment_materials em ON em.id = ecc.material_id
        LEFT JOIN equipment_material_units emu ON emu.id = ecc.material_unit_id
        LEFT JOIN equipment_materials em2 ON em2.id = emu.material_id
        WHERE ecc.item_id = ei.id) AS content_wert
       FROM equipment_items ei
       LEFT JOIN equipment_categories ec ON ec.id = ei.category_id
       WHERE ei.id = ? AND ei.tenant_id = ?`,
      [req.params.id, req.tenant.id]
    )
    if (!item) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json({ item })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Equipment: Case-Inhalte ───────────────────────────────────────────────────

// GET /api/equipment/items/:id/contents
app.get('/api/equipment/items/:id/contents', authenticateToken, requireTenant, async (req, res) => {
  try {
    const contents = await db.all(
      `SELECT ecc.id, ecc.item_id, ecc.material_id, ecc.anzahl, ecc.material_unit_id,
              em.bezeichnung, em.marke, em.modell, em.typ, em.ursprungsland,
              em.wert_zollwert, em.waehrung, em.gewicht_kg,
              ec.name AS category_name,
              emu.seriennummer
       FROM equipment_case_contents ecc
       LEFT JOIN equipment_materials em ON em.id = COALESCE(ecc.material_id,
         (SELECT material_id FROM equipment_material_units WHERE id = ecc.material_unit_id))
       LEFT JOIN equipment_material_units emu ON emu.id = ecc.material_unit_id
       LEFT JOIN equipment_categories ec ON ec.id = em.category_id
       WHERE ecc.item_id = ? AND ecc.tenant_id = ?
       ORDER BY em.bezeichnung, em.marke, emu.seriennummer`,
      [req.params.id, req.tenant.id]
    )
    res.json({ contents })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/equipment/items/:id/contents — Material zu Case hinzufügen
app.post('/api/equipment/items/:id/contents', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    const { material_id, material_unit_ids, anzahl } = req.body
    const inserted = []

    if (material_unit_ids && Array.isArray(material_unit_ids) && material_unit_ids.length > 0) {
      // Serienartikel: eine Zeile pro Einheit
      for (const unitId of material_unit_ids) {
        // Prüfen ob Einheit schon in einem anderen Case
        const existing = await db.get(
          `SELECT ecc.id, ei.case_id FROM equipment_case_contents ecc
           JOIN equipment_items ei ON ei.id = ecc.item_id
           WHERE ecc.material_unit_id = ? AND ecc.item_id != ?`,
          [unitId, req.params.id]
        )
        if (existing) return res.status(409).json({ error: `Einheit bereits in Case ${existing.case_id} vorhanden` })

        const r = await db.run(
          `INSERT INTO equipment_case_contents (tenant_id, item_id, material_unit_id, anzahl) VALUES (?,?,?,1)`,
          [req.tenant.id, req.params.id, unitId]
        )
        inserted.push(r.lastID)
      }
    } else if (material_id) {
      // Bulk: prüfen ob schon vorhanden (dann nur anzahl erhöhen)
      const existing = await db.get(
        `SELECT id, anzahl FROM equipment_case_contents WHERE item_id=? AND material_id=? AND material_unit_id IS NULL AND tenant_id=?`,
        [req.params.id, material_id, req.tenant.id]
      )
      if (existing) {
        await db.run(
          `UPDATE equipment_case_contents SET anzahl=? WHERE id=?`,
          [existing.anzahl + (anzahl || 1), existing.id]
        )
        inserted.push(existing.id)
      } else {
        const r = await db.run(
          `INSERT INTO equipment_case_contents (tenant_id, item_id, material_id, anzahl) VALUES (?,?,?,?)`,
          [req.tenant.id, req.params.id, material_id, anzahl || 1]
        )
        inserted.push(r.lastID)
      }
    } else {
      return res.status(400).json({ error: 'material_id oder material_unit_ids erforderlich' })
    }

    res.json({ ok: true, inserted })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/equipment/items/contents/:contentId — Anzahl ändern (Bulk)
app.put('/api/equipment/items/contents/:contentId', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    const { anzahl } = req.body
    await db.run(
      `UPDATE equipment_case_contents SET anzahl=? WHERE id=? AND tenant_id=?`,
      [anzahl, req.params.contentId, req.tenant.id]
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/equipment/items/contents/:contentId
app.delete('/api/equipment/items/contents/:contentId', authenticateToken, requireTenant, async (req, res) => {
  if (!['admin','agency','tourmanagement'].includes(req.tenant.role)) return res.status(403).json({ error: 'Keine Berechtigung' })
  try {
    await db.run('DELETE FROM equipment_case_contents WHERE id=? AND tenant_id=?', [req.params.contentId, req.tenant.id])
    res.json({ ok: true })
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


// GET /api/me/language — UI-Sprache des Users laden
app.get('/api/me/language', authenticateToken, async (req, res) => {
  try {
    const row = await db.get('SELECT ui_language FROM users WHERE id = ?', [req.user.id])
    res.json({ language: row?.ui_language || 'de' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/me/language — UI-Sprache speichern
app.put('/api/me/language', authenticateToken, async (req, res) => {
  try {
    const { language } = req.body
    if (!['de', 'en'].includes(language)) return res.status(400).json({ error: 'Invalid language' })
    await db.run('UPDATE users SET ui_language = ? WHERE id = ?', [language, req.user.id])
    res.json({ language })
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
// ICAL FEED
// ============================================

// GET /api/me/ical-token — eigenen iCal-Token abrufen (oder generieren)
app.get('/api/me/ical-token', authenticateToken, async (req, res) => {
  try {
    let user = await db.get('SELECT ical_token FROM users WHERE id=?', [req.user.id])
    if (!user.ical_token) {
      const token = crypto.randomBytes(24).toString('hex')
      await db.run('UPDATE users SET ical_token=? WHERE id=?', [token, req.user.id])
      user = { ical_token: token }
    }
    res.json({ token: user.ical_token })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/me/ical-token/regenerate — neuen Token generieren (invalidiert alten Link)
app.post('/api/me/ical-token/regenerate', authenticateToken, async (req, res) => {
  try {
    const token = crypto.randomBytes(24).toString('hex')
    await db.run('UPDATE users SET ical_token=? WHERE id=?', [token, req.user.id])
    res.json({ token })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/ical/:token — öffentlicher iCal Feed (kein Auth nötig, .ics-Suffix optional)
app.get('/api/ical/:token', async (req, res) => {
  try {
    const rawToken = req.params.token.replace(/\.ics$/, '')
    const user = await db.get('SELECT id, first_name, last_name FROM users WHERE ical_token=?', [rawToken])
    if (!user) return res.status(404).send('Feed nicht gefunden')

    const rows = await db.all(`
      SELECT DISTINCT
        t.id, t.date, t.title, t.city, t.art,
        ten.name AS tenant_name,
        v.name AS venue_name
      FROM termine t
      JOIN tenants ten ON t.tenant_id = ten.id
      JOIN termin_travel_party ttp ON ttp.termin_id = t.id
      JOIN contacts c ON ttp.contact_id = c.id
      LEFT JOIN venues v ON t.venue_id = v.id
      WHERE c.user_id = ?
      ORDER BY t.date ASC
    `, [user.id])

    const escIcal = s => (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
    const fmtDate = dateStr => dateStr ? dateStr.replace(/-/g, '') : null

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ProTouring//ProTouring//DE',
      'X-WR-CALNAME:ProTouring',
      'X-WR-CALDESC:Bestätigte Termine aus ProTouring',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-TIMEZONE:Europe/Berlin',
    ]

    for (const t of rows) {
      const dateStr = fmtDate(t.date)
      if (!dateStr) continue
      const summary = [t.tenant_name, t.title || t.art || 'Termin'].filter(Boolean).join(' – ')
      const location = [t.venue_name, t.city].filter(Boolean).join(', ')
      lines.push('BEGIN:VEVENT')
      lines.push(`DTSTART;VALUE=DATE:${dateStr}`)
      lines.push(`DTEND;VALUE=DATE:${dateStr}`)
      lines.push(`SUMMARY:${escIcal(summary)}`)
      if (location) lines.push(`LOCATION:${escIcal(location)}`)
      lines.push(`UID:protouring-${t.id}-${user.id}@protouring.de`)
      lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`)
      lines.push('END:VEVENT')
    }
    lines.push('END:VCALENDAR')

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', 'inline; filename="protouring.ics"')
    res.send(lines.join('\r\n'))
  } catch (err) {
    console.error('iCal feed error:', err)
    res.status(500).send(`Fehler: ${err.message}`)
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

// GET /api/superadmin/tenants — alle Tenants mit Trial-Info + Module
app.get('/api/superadmin/tenants', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const tenants = await db.all(`
      SELECT t.id, COALESCE(NULLIF(t.display_name,''), t.name) AS name, t.slug, t.status,
             t.trial_ends_at, t.modules_enabled,
             (SELECT COUNT(*) FROM user_tenants ut WHERE ut.tenant_id=t.id AND ut.status='active') AS user_count
      FROM tenants t
      ORDER BY t.created_at DESC
    `)
    res.json({ tenants: tenants.map(t => ({
      id: t.id, name: t.name, slug: t.slug, status: t.status,
      trialEndsAt: t.trial_ends_at, userCount: t.user_count,
      modulesEnabled: JSON.parse(t.modules_enabled || '[]'),
    })) })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/superadmin/tenants/:id/modules — Addon-Module setzen
app.put('/api/superadmin/tenants/:id/modules', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const { modules } = req.body
    if (!Array.isArray(modules)) return res.status(400).json({ error: 'modules muss ein Array sein' })
    await db.run(`UPDATE tenants SET modules_enabled=? WHERE id=?`, [JSON.stringify(modules), req.params.id])
    res.json({ modulesEnabled: modules })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/superadmin/tenants/:id/trial — Trial verlängern
app.put('/api/superadmin/tenants/:id/trial', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const { days } = req.body
    if (!days || isNaN(parseInt(days))) return res.status(400).json({ error: 'days erforderlich' })
    const d = parseInt(days)
    // trial_ends_at: wenn noch in Zukunft → von dort verlängern, sonst ab heute
    const tenant = await db.get('SELECT trial_ends_at FROM tenants WHERE id=?', [req.params.id])
    if (!tenant) return res.status(404).json({ error: 'Tenant nicht gefunden' })
    const base = tenant.trial_ends_at && new Date(tenant.trial_ends_at) > new Date()
      ? tenant.trial_ends_at : 'now'
    const newDate = base === 'now'
      ? `datetime('now', '+${d} days')`
      : `datetime('${tenant.trial_ends_at}', '+${d} days')`
    await db.run(`UPDATE tenants SET trial_ends_at=${newDate}, status='trial' WHERE id=?`, [req.params.id])
    await db.run(`UPDATE tenant_subscriptions SET status='trial', current_period_end=${newDate} WHERE tenant_id=?`, [req.params.id])
    const updated = await db.get('SELECT trial_ends_at FROM tenants WHERE id=?', [req.params.id])
    res.json({ trialEndsAt: updated.trial_ends_at })
  } catch (err) { res.status(500).json({ error: err.message }) }
})


// ── Equipment: Label PDF ─────────────────────────────────────────────────────

// GET /api/equipment/items/:id/label-pdf
app.get('/api/equipment/items/:id/label-pdf', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { generateEquipmentLabel } = require('./generate_equipment_label');

    // Load item
    const item = await db.get(
      `SELECT ei.*, t.display_name, t.name AS tenant_name,
              t.label_tour_name, t.label_use_artist_name, t.label_logo_path, t.label_template
       FROM equipment_items ei
       JOIN tenants t ON t.id = ei.tenant_id
       WHERE ei.id = ? AND ei.tenant_id = ?`,
      [req.params.id, req.tenant.id]
    );
    if (!item) return res.status(404).json({ error: 'Gegenstand nicht gefunden' });

    // Compute Gesamtgewicht
    const weightRow = await db.get(
      `SELECT
        COALESCE(SUM(
          CASE
            WHEN ecc.material_unit_id IS NOT NULL THEN COALESCE(em.gewicht_kg, 0)
            ELSE COALESCE(em.gewicht_kg, 0) * COALESCE(ecc.anzahl, 1)
          END
        ), 0) AS content_gewicht
       FROM equipment_case_contents ecc
       LEFT JOIN equipment_materials em ON em.id = COALESCE(ecc.material_id,
         (SELECT material_id FROM equipment_material_units WHERE id = ecc.material_unit_id))
       WHERE ecc.item_id = ? AND ecc.tenant_id = ?`,
      [req.params.id, req.tenant.id]
    );
    const gesamtgewicht = (item.weight_empty_kg ?? 0) + (weightRow?.content_gewicht ?? 0);

    // Compute Gruppe info (all items in same gruppe_name, sorted by load_order)
    let gruppeName = null;
    let gruppeXY   = null;
    if (item.gruppe_name) {
      const gruppe = await db.all(
        `SELECT id FROM equipment_items WHERE tenant_id=? AND gruppe_name=? ORDER BY load_order ASC NULLS LAST, case_id ASC`,
        [req.tenant.id, item.gruppe_name]
      );
      const idx = gruppe.findIndex(r => r.id === item.id);
      if (idx >= 0) {
        gruppeName = item.gruppe_name;
        gruppeXY   = `${idx + 1}/${gruppe.length}`;
      }
    }

    const artistName = item.display_name || item.tenant_name || '';
    const { DEFAULT_TEMPLATE } = require('./generate_equipment_label');
    const savedTemplate = item.label_template ? JSON.parse(item.label_template) : {};
    const template = { ...DEFAULT_TEMPLATE, ...savedTemplate };

    const pdfBuffer = await generateEquipmentLabel({
      artistName,
      logoPath: item.label_logo_path || null,
      useArtistName: item.label_use_artist_name !== 0,
      tourName: item.label_tour_name || '',
      caseId: item.case_id || '',
      bezeichnung: item.bezeichnung || '',
      loadOrder: item.load_order ?? null,
      position: item.position ?? null,
      positionCustom: item.position_custom ?? null,
      gruppeName,
      gruppeXY,
      gesamtgewicht: gesamtgewicht > 0 ? gesamtgewicht : null,
      typ:      item.typ ?? null,
      heightCm: item.height_cm ?? null,
      widthCm:  item.width_cm ?? null,
      depthCm:  item.depth_cm ?? null,
      template,
    });

    const safeName = (item.case_id || 'label').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="label_${safeName}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (e) {
    console.error('label-pdf error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Equipment: Eigentümer ────────────────────────────────────────────────────

// GET /api/equipment/owners
app.get('/api/equipment/owners', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all(
      'SELECT * FROM equipment_owners WHERE tenant_id = ? ORDER BY name',
      [req.tenant.id]
    )
    res.json({ owners: rows })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/equipment/owners
app.post('/api/equipment/owners', authenticateToken, requireTenant, async (req, res) => {
  try {
    const owner_id = generateId('E')
    const { name, typ = 'sonstiges', adresse, plz, stadt, land,
            kontaktperson_vorname, kontaktperson_name, telefon, email } = req.body
    const result = await db.run(
      `INSERT INTO equipment_owners
        (tenant_id, owner_id, name, typ, adresse, plz, stadt, land,
         kontaktperson_vorname, kontaktperson_name, telefon, email)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.tenant.id, owner_id, name, typ,
       adresse||null, plz||null, stadt||null, land||null,
       kontaktperson_vorname||null, kontaktperson_name||null,
       telefon||null, email||null]
    )
    const row = await db.get('SELECT * FROM equipment_owners WHERE id = ?', [result.lastID])
    res.json({ owner: row })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/equipment/owners/:id
app.put('/api/equipment/owners/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { name, typ, adresse, plz, stadt, land,
            kontaktperson_vorname, kontaktperson_name, telefon, email } = req.body
    await db.run(
      `UPDATE equipment_owners SET
        name=?, typ=COALESCE(?,typ), adresse=?, plz=?, stadt=?, land=?,
        kontaktperson_vorname=?, kontaktperson_name=?, telefon=?, email=?,
        updated_at=datetime('now')
       WHERE id = ? AND tenant_id = ?`,
      [name, typ||null, adresse||null, plz||null, stadt||null, land||null,
       kontaktperson_vorname||null, kontaktperson_name||null,
       telefon||null, email||null,
       req.params.id, req.tenant.id]
    )
    const row = await db.get('SELECT * FROM equipment_owners WHERE id = ?', [req.params.id])
    res.json({ owner: row })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/equipment/owners/:id
app.delete('/api/equipment/owners/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    await db.run('DELETE FROM equipment_owners WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.tenant.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Equipment: Carnets ───────────────────────────────────────────────────────

function generateId(prefix) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) result += chars[Math.floor(Math.random() * chars.length)]
  return `${prefix}-${result}`
}

// GET /api/carnets
app.get('/api/carnets', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT c.*,
        (SELECT COUNT(*) FROM carnet_materials cm WHERE cm.carnet_id = c.id) AS material_count
       FROM carnets c
       WHERE c.tenant_id = ?
       ORDER BY c.created_at DESC`,
      [req.tenant.id]
    )
    res.json({ carnets: rows })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/carnets
app.post('/api/carnets', authenticateToken, requireTenant, async (req, res) => {
  try {
    const carnet_id = generateId('C')
    const inhaber_id = generateId('I')
    const vertreter_id = generateId('V')
    const {
      status = 'draft',
      verwendungszweck, startdatum, enddatum, ziellaender, zusaetzliche_laender, kommentar,
      inhaber_name, inhaber_adresse, inhaber_plz, inhaber_stadt, inhaber_land,
      inhaber_ust_id, inhaber_kontaktperson_vorname, inhaber_kontaktperson, inhaber_telefon, inhaber_email,
      vertreter_name, vertreter_firma, vertreter_adresse, vertreter_plz, vertreter_stadt,
      vertreter_land, vertreter_telefon, vertreter_email, vertreter_rolle,
      vertreter_kontaktperson_vorname, vertreter_kontaktperson_name
    } = req.body
    const result = await db.run(
      `INSERT INTO carnets (
        tenant_id, carnet_id, inhaber_id, vertreter_id, status,
        verwendungszweck, startdatum, enddatum, ziellaender, zusaetzliche_laender, kommentar,
        inhaber_name, inhaber_adresse, inhaber_plz, inhaber_stadt, inhaber_land,
        inhaber_ust_id, inhaber_kontaktperson_vorname, inhaber_kontaktperson, inhaber_telefon, inhaber_email,
        vertreter_name, vertreter_firma, vertreter_adresse, vertreter_plz, vertreter_stadt,
        vertreter_land, vertreter_telefon, vertreter_email, vertreter_rolle,
        vertreter_kontaktperson_vorname, vertreter_kontaktperson_name,
        created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.tenant.id, carnet_id, inhaber_id, vertreter_id, status,
        verwendungszweck||null, startdatum||null, enddatum||null, ziellaender||null,
        zusaetzliche_laender||null, kommentar||null,
        inhaber_name||null, inhaber_adresse||null, inhaber_plz||null, inhaber_stadt||null,
        inhaber_land||null, inhaber_ust_id||null, inhaber_kontaktperson_vorname||null,
        inhaber_kontaktperson||null, inhaber_telefon||null, inhaber_email||null,
        vertreter_name||null, vertreter_firma||null, vertreter_adresse||null,
        vertreter_plz||null, vertreter_stadt||null, vertreter_land||null,
        vertreter_telefon||null, vertreter_email||null, vertreter_rolle||null,
        vertreter_kontaktperson_vorname||null, vertreter_kontaktperson_name||null,
        req.user.id
      ]
    )
    const row = await db.get('SELECT * FROM carnets WHERE id = ?', [result.lastID])
    res.json({ carnet: row })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/carnets/:id
app.get('/api/carnets/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const carnet = await db.get(
      'SELECT * FROM carnets WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.tenant.id]
    )
    if (!carnet) return res.status(404).json({ error: 'Nicht gefunden' })
    const materials = await db.all(
      `SELECT cm.*, em.mat_id, em.bezeichnung, em.marke, em.modell, em.typ, em.ursprungsland,
              em.wert_zollwert, em.waehrung, em.gewicht_kg, em.category_id,
              ec.name AS category_name
       FROM carnet_materials cm
       JOIN equipment_materials em ON em.id = cm.material_id
       LEFT JOIN equipment_categories ec ON ec.id = em.category_id
       WHERE cm.carnet_id = ?
       ORDER BY em.bezeichnung`,
      [carnet.id]
    )
    res.json({ carnet, materials })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/carnets/:id
app.put('/api/carnets/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const {
      status, verwendungszweck, startdatum, enddatum, ziellaender, zusaetzliche_laender, kommentar,
      inhaber_name, inhaber_adresse, inhaber_plz, inhaber_stadt, inhaber_land,
      inhaber_ust_id, inhaber_kontaktperson_vorname, inhaber_kontaktperson, inhaber_telefon, inhaber_email,
      vertreter_name, vertreter_firma, vertreter_adresse, vertreter_plz, vertreter_stadt,
      vertreter_land, vertreter_telefon, vertreter_email, vertreter_rolle,
      vertreter_kontaktperson_vorname, vertreter_kontaktperson_name
    } = req.body
    await db.run(
      `UPDATE carnets SET
        status=COALESCE(?,status),
        verwendungszweck=?, startdatum=?, enddatum=?, ziellaender=?,
        zusaetzliche_laender=?, kommentar=?,
        inhaber_name=?, inhaber_adresse=?, inhaber_plz=?, inhaber_stadt=?, inhaber_land=?,
        inhaber_ust_id=?, inhaber_kontaktperson_vorname=?, inhaber_kontaktperson=?,
        inhaber_telefon=?, inhaber_email=?,
        vertreter_name=?, vertreter_firma=?, vertreter_adresse=?, vertreter_plz=?,
        vertreter_stadt=?, vertreter_land=?, vertreter_telefon=?, vertreter_email=?,
        vertreter_rolle=?, vertreter_kontaktperson_vorname=?, vertreter_kontaktperson_name=?,
        updated_at=datetime('now')
       WHERE id = ? AND tenant_id = ?`,
      [
        status||null,
        verwendungszweck||null, startdatum||null, enddatum||null, ziellaender||null,
        zusaetzliche_laender||null, kommentar||null,
        inhaber_name||null, inhaber_adresse||null, inhaber_plz||null, inhaber_stadt||null,
        inhaber_land||null, inhaber_ust_id||null, inhaber_kontaktperson_vorname||null,
        inhaber_kontaktperson||null, inhaber_telefon||null, inhaber_email||null,
        vertreter_name||null, vertreter_firma||null, vertreter_adresse||null,
        vertreter_plz||null, vertreter_stadt||null, vertreter_land||null,
        vertreter_telefon||null, vertreter_email||null, vertreter_rolle||null,
        vertreter_kontaktperson_vorname||null, vertreter_kontaktperson_name||null,
        req.params.id, req.tenant.id
      ]
    )
    const row = await db.get('SELECT * FROM carnets WHERE id = ?', [req.params.id])
    res.json({ carnet: row })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/carnets/:id
app.delete('/api/carnets/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    await db.run('DELETE FROM carnets WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/carnets/:id/materials
app.post('/api/carnets/:id/materials', authenticateToken, requireTenant, async (req, res) => {
  try {
    const carnet = await db.get('SELECT id FROM carnets WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id])
    if (!carnet) return res.status(404).json({ error: 'Nicht gefunden' })
    const { material_id, anzahl = 1 } = req.body
    await db.run(
      `INSERT INTO carnet_materials (carnet_id, material_id, anzahl) VALUES (?,?,?)
       ON CONFLICT(carnet_id, material_id) DO UPDATE SET anzahl=excluded.anzahl`,
      [carnet.id, material_id, anzahl]
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/carnets/:id/materials/:materialId
app.delete('/api/carnets/:id/materials/:materialId', authenticateToken, requireTenant, async (req, res) => {
  try {
    await db.run(
      'DELETE FROM carnet_materials WHERE carnet_id = ? AND material_id = ?',
      [req.params.id, req.params.materialId]
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ============================================
// VENUE CONTACTS
// ============================================

// GET /api/venues/:id/contacts
app.get('/api/venues/:id/contacts', authenticateToken, requireTenant, async (req, res) => {
  try {
    const rows = await db.all(
      'SELECT * FROM venue_contacts WHERE venue_id = ? AND tenant_id = ? ORDER BY created_at ASC',
      [req.params.id, req.tenant.id]
    )
    res.json({ contacts: rows.map(r => ({
      id: String(r.id), venueId: String(r.venue_id),
      name: r.name || '', role: r.role || '',
      phone: r.phone || '', email: r.email || '', notes: r.notes || '',
      createdAt: r.created_at,
    })) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/venues/:id/contacts
app.post('/api/venues/:id/contacts', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { name, role, phone, email, notes } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Name erforderlich' })
    const result = await db.run(
      `INSERT INTO venue_contacts (venue_id, tenant_id, name, role, phone, email, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, req.tenant.id, name, role || '', phone || '', email || '', notes || '']
    )
    const row = await db.get('SELECT * FROM venue_contacts WHERE id = ?', [result.lastID])
    res.status(201).json({ contact: {
      id: String(row.id), venueId: String(row.venue_id),
      name: row.name, role: row.role || '', phone: row.phone || '',
      email: row.email || '', notes: row.notes || '', createdAt: row.created_at,
    }})
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/venues/:venueId/contacts/:contactId
app.put('/api/venues/:venueId/contacts/:contactId', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const { name, role, phone, email, notes } = req.body
    await db.run(
      `UPDATE venue_contacts SET name=?, role=?, phone=?, email=?, notes=?
       WHERE id=? AND venue_id=? AND tenant_id=?`,
      [name, role || '', phone || '', email || '', notes || '',
       req.params.contactId, req.params.venueId, req.tenant.id]
    )
    const row = await db.get('SELECT * FROM venue_contacts WHERE id = ?', [req.params.contactId])
    if (!row) return res.status(404).json({ error: 'Nicht gefunden' })
    res.json({ contact: {
      id: String(row.id), venueId: String(row.venue_id),
      name: row.name, role: row.role || '', phone: row.phone || '',
      email: row.email || '', notes: row.notes || '', createdAt: row.created_at,
    }})
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/venues/:venueId/contacts/:contactId
app.delete('/api/venues/:venueId/contacts/:contactId', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    await db.run(
      'DELETE FROM venue_contacts WHERE id = ? AND venue_id = ? AND tenant_id = ?',
      [req.params.contactId, req.params.venueId, req.tenant.id]
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ============================================
// CREW BRIEFING – GEWERK SETTINGS
// ============================================

// Helper: Ist der User ein Editor (Rollen 1-3)?
function isEditor(role) {
  return ['admin', 'agency', 'tourmanagement'].includes(role)
}

// Helper: Ermittle die Gewerke eines Users anhand seiner Funktion
async function getUserGewerke(tenantId, userId) {
  // Kontakt des Users in diesem Tenant finden
  const contact = await db.get(
    'SELECT function1, function2, function3 FROM contacts WHERE tenant_id = ? AND user_id = ?',
    [tenantId, userId]
  )
  if (!contact) return []
  const fns = [contact.function1, contact.function2, contact.function3].filter(Boolean)
  if (fns.length === 0) return []
  const placeholders = fns.map(() => '?').join(',')
  return db.all(
    `SELECT DISTINCT g.* FROM gewerke g
     JOIN gewerk_funktionen gf ON gf.gewerk_id = g.id
     WHERE g.tenant_id = ? AND gf.funktion_name IN (${placeholders})`,
    [tenantId, ...fns]
  )
}

// GET /api/settings/gewerke
app.get('/api/settings/gewerke', authenticateToken, requireTenant, async (req, res) => {
  try {
    const gewerke = await db.all(
      'SELECT * FROM gewerke WHERE tenant_id = ? ORDER BY sort_order, name',
      [req.tenant.id]
    )
    // Funktionen zu jedem Gewerk laden
    for (const g of gewerke) {
      const fns = await db.all('SELECT funktion_name FROM gewerk_funktionen WHERE gewerk_id = ?', [g.id])
      g.funktionen = fns.map(f => f.funktion_name)
    }
    res.json({ gewerke })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/settings/gewerke
app.post('/api/settings/gewerke', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  const { name, color = '#6366f1', can_write = 0, sort_order = 0, funktionen = [] } = req.body
  if (!name) return res.status(400).json({ error: 'Name fehlt' })
  try {
    const result = await db.run(
      'INSERT INTO gewerke (tenant_id, name, color, can_write, sort_order) VALUES (?,?,?,?,?)',
      [req.tenant.id, name, color, can_write ? 1 : 0, sort_order]
    )
    const gewerk_id = result.lastID
    for (const fn of funktionen) {
      await db.run('INSERT OR IGNORE INTO gewerk_funktionen (gewerk_id, funktion_name) VALUES (?,?)', [gewerk_id, fn])
    }
    const g = await db.get('SELECT * FROM gewerke WHERE id = ?', [gewerk_id])
    g.funktionen = funktionen
    res.json({ gewerk: g })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/settings/gewerke/:id
app.put('/api/settings/gewerke/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  const { name, color, can_write, sort_order, funktionen } = req.body
  try {
    const g = await db.get('SELECT * FROM gewerke WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id])
    if (!g) return res.status(404).json({ error: 'Nicht gefunden' })
    await db.run(
      `UPDATE gewerke SET name=?, color=?, can_write=?, sort_order=? WHERE id=?`,
      [name ?? g.name, color ?? g.color, can_write !== undefined ? (can_write ? 1 : 0) : g.can_write, sort_order ?? g.sort_order, g.id]
    )
    if (Array.isArray(funktionen)) {
      await db.run('DELETE FROM gewerk_funktionen WHERE gewerk_id = ?', [g.id])
      for (const fn of funktionen) {
        await db.run('INSERT OR IGNORE INTO gewerk_funktionen (gewerk_id, funktion_name) VALUES (?,?)', [g.id, fn])
      }
    }
    const updated = await db.get('SELECT * FROM gewerke WHERE id = ?', [g.id])
    const fns = await db.all('SELECT funktion_name FROM gewerk_funktionen WHERE gewerk_id = ?', [g.id])
    updated.funktionen = fns.map(f => f.funktion_name)
    res.json({ gewerk: updated })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/settings/gewerke/:id
app.delete('/api/settings/gewerke/:id', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  try {
    const g = await db.get('SELECT id FROM gewerke WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenant.id])
    if (!g) return res.status(404).json({ error: 'Nicht gefunden' })
    await db.run('DELETE FROM gewerke WHERE id = ?', [g.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ============================================
// CREW BRIEFING – BRIEFINGS PRO TERMIN
// ============================================

// GET /api/termine/:terminId/briefings
// Gibt alle Gewerke zurück die der User sehen darf, mit Briefing-Daten wenn vorhanden
app.get('/api/termine/:terminId/briefings', authenticateToken, requireTenant, async (req, res) => {
  const terminId = parseInt(req.params.terminId)
  try {
    let visibleGewerke
    if (isEditor(req.tenant.role)) {
      // Admins/Editors sehen alle Gewerke des Tenants
      visibleGewerke = await db.all(
        'SELECT * FROM gewerke WHERE tenant_id = ? ORDER BY sort_order, name',
        [req.tenant.id]
      )
    } else {
      // Crew sieht nur Gewerke wo ihre Funktion drin ist
      visibleGewerke = await getUserGewerke(req.tenant.id, req.user.id)
    }

    const result = []
    for (const gewerk of visibleGewerke) {
      const fns = await db.all('SELECT funktion_name FROM gewerk_funktionen WHERE gewerk_id = ?', [gewerk.id])
      gewerk.funktionen = fns.map(f => f.funktion_name)

      // Briefing + Sections laden (falls vorhanden)
      const briefing = await db.get(
        'SELECT * FROM crew_briefings WHERE termin_id = ? AND gewerk_id = ?',
        [terminId, gewerk.id]
      )
      if (briefing) {
        briefing.sections = await db.all(
          'SELECT * FROM crew_briefing_sections WHERE briefing_id = ? ORDER BY sort_order, id',
          [briefing.id]
        )
        // Dateien via files-Tabelle
        briefing.files = await db.all(
          `SELECT f.*, u.first_name || ' ' || u.last_name AS uploaded_by_name
           FROM files f LEFT JOIN users u ON u.id = f.uploaded_by
           WHERE f.entity_type = 'crew_briefing' AND f.entity_id = ? AND f.tenant_id = ?
           ORDER BY f.created_at`,
          [briefing.id, req.tenant.id]
        )
      }
      result.push({ gewerk, briefing: briefing || null })
    }
    res.json({ items: result })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/termine/:terminId/briefings/:gewerkId/sections
app.post('/api/termine/:terminId/briefings/:gewerkId/sections', authenticateToken, requireTenant, async (req, res) => {
  const terminId = parseInt(req.params.terminId)
  const gewerkId = parseInt(req.params.gewerkId)
  const { title = '', content = '', sort_order = 0 } = req.body
  try {
    // Schreibrecht prüfen
    const gewerk = await db.get('SELECT * FROM gewerke WHERE id = ? AND tenant_id = ?', [gewerkId, req.tenant.id])
    if (!gewerk) return res.status(404).json({ error: 'Gewerk nicht gefunden' })
    if (!isEditor(req.tenant.role)) {
      if (!gewerk.can_write) return res.status(403).json({ error: 'Keine Schreibberechtigung' })
      const myGewerke = await getUserGewerke(req.tenant.id, req.user.id)
      if (!myGewerke.find(g => g.id === gewerkId)) return res.status(403).json({ error: 'Kein Zugriff auf dieses Gewerk' })
    }
    // Briefing anlegen falls nicht vorhanden
    let briefing = await db.get('SELECT * FROM crew_briefings WHERE termin_id = ? AND gewerk_id = ?', [terminId, gewerkId])
    if (!briefing) {
      const r = await db.run(
        'INSERT INTO crew_briefings (tenant_id, termin_id, gewerk_id) VALUES (?,?,?)',
        [req.tenant.id, terminId, gewerkId]
      )
      briefing = await db.get('SELECT * FROM crew_briefings WHERE id = ?', [r.lastID])
    }
    const r2 = await db.run(
      'INSERT INTO crew_briefing_sections (tenant_id, briefing_id, title, content, sort_order) VALUES (?,?,?,?,?)',
      [req.tenant.id, briefing.id, title, content, sort_order]
    )
    const section = await db.get('SELECT * FROM crew_briefing_sections WHERE id = ?', [r2.lastID])
    res.json({ section, briefingId: briefing.id })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/termine/:terminId/briefings/:gewerkId/sections/:sectionId
app.put('/api/termine/:terminId/briefings/:gewerkId/sections/:sectionId', authenticateToken, requireTenant, async (req, res) => {
  const gewerkId = parseInt(req.params.gewerkId)
  const sectionId = parseInt(req.params.sectionId)
  const { title, content, sort_order } = req.body
  try {
    const gewerk = await db.get('SELECT * FROM gewerke WHERE id = ? AND tenant_id = ?', [gewerkId, req.tenant.id])
    if (!gewerk) return res.status(404).json({ error: 'Gewerk nicht gefunden' })
    if (!isEditor(req.tenant.role)) {
      if (!gewerk.can_write) return res.status(403).json({ error: 'Keine Schreibberechtigung' })
      const myGewerke = await getUserGewerke(req.tenant.id, req.user.id)
      if (!myGewerke.find(g => g.id === gewerkId)) return res.status(403).json({ error: 'Kein Zugriff' })
    }
    const s = await db.get('SELECT * FROM crew_briefing_sections WHERE id = ? AND tenant_id = ?', [sectionId, req.tenant.id])
    if (!s) return res.status(404).json({ error: 'Section nicht gefunden' })
    await db.run(
      `UPDATE crew_briefing_sections SET title=?, content=?, sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [title ?? s.title, content ?? s.content, sort_order ?? s.sort_order, sectionId]
    )
    const updated = await db.get('SELECT * FROM crew_briefing_sections WHERE id = ?', [sectionId])
    res.json({ section: updated })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/termine/:terminId/briefings/:gewerkId/sections/:sectionId
app.delete('/api/termine/:terminId/briefings/:gewerkId/sections/:sectionId', authenticateToken, requireTenant, async (req, res) => {
  const gewerkId = parseInt(req.params.gewerkId)
  const sectionId = parseInt(req.params.sectionId)
  try {
    const gewerk = await db.get('SELECT * FROM gewerke WHERE id = ? AND tenant_id = ?', [gewerkId, req.tenant.id])
    if (!gewerk) return res.status(404).json({ error: 'Gewerk nicht gefunden' })
    if (!isEditor(req.tenant.role)) {
      if (!gewerk.can_write) return res.status(403).json({ error: 'Keine Schreibberechtigung' })
      const myGewerke = await getUserGewerke(req.tenant.id, req.user.id)
      if (!myGewerke.find(g => g.id === gewerkId)) return res.status(403).json({ error: 'Kein Zugriff' })
    }
    await db.run('DELETE FROM crew_briefing_sections WHERE id = ? AND tenant_id = ?', [sectionId, req.tenant.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/termine/:terminId/briefings/:gewerkId/sections/reorder
app.put('/api/termine/:terminId/briefings/:gewerkId/sections/reorder', authenticateToken, requireTenant, requireEditor, async (req, res) => {
  const { order } = req.body // Array von { id, sort_order }
  try {
    for (const item of order) {
      await db.run('UPDATE crew_briefing_sections SET sort_order=? WHERE id=? AND tenant_id=?',
        [item.sort_order, item.id, req.tenant.id])
    }
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ============================================
// GLOBAL SEARCH
// ============================================

app.get('/api/search', authenticateToken, requireTenant, async (req, res) => {
  const q = (req.query.q || '').trim()
  if (q.length < 2) return res.json({ results: [] })
  const like = `%${q}%`
  const tid = req.tenant.id

  try {
    const [events, contacts, venues, partners, hotels, vehicles] = await Promise.all([
      db.all(`
        SELECT 'event' as type, t.id, t.date as subtitle,
               COALESCE(NULLIF(t.title,''), v.name, t.city, '–') as label,
               t.title, t.city, v.name as venue_name
        FROM termine t LEFT JOIN venues v ON t.venue_id = v.id
        WHERE t.tenant_id = ?
          AND (t.title LIKE ? OR t.city LIKE ? OR v.name LIKE ? OR t.art LIKE ?)
        ORDER BY t.date DESC LIMIT 8
      `, [tid, like, like, like, like]),

      db.all(`
        SELECT 'contact' as type, c.id,
               (c.first_name || ' ' || c.last_name) as label,
               c.function1 as subtitle
        FROM contacts c
        WHERE c.tenant_id = ?
          AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.function1 LIKE ? OR c.email LIKE ?)
        ORDER BY c.last_name LIMIT 8
      `, [tid, like, like, like, like]),

      db.all(`
        SELECT 'venue' as type, v.id, v.name as label,
               (COALESCE(v.city,'') || CASE WHEN v.city IS NOT NULL AND v.country IS NOT NULL THEN ', ' ELSE '' END || COALESCE(v.country,'')) as subtitle
        FROM venues v
        WHERE v.tenant_id = ?
          AND (v.name LIKE ? OR v.city LIKE ? OR v.country LIKE ?)
        ORDER BY v.name LIMIT 5
      `, [tid, like, like, like]),

      db.all(`
        SELECT 'partner' as type, p.id, p.company_name as label, p.city as subtitle
        FROM partners p
        WHERE p.tenant_id = ?
          AND (p.company_name LIKE ? OR p.city LIKE ?)
        ORDER BY p.company_name LIMIT 5
      `, [tid, like, like]),

      db.all(`
        SELECT 'hotel' as type, h.id, h.name as label, h.city as subtitle
        FROM hotels h
        WHERE h.tenant_id = ?
          AND (h.name LIKE ? OR h.city LIKE ?)
        ORDER BY h.name LIMIT 5
      `, [tid, like, like]),

      db.all(`
        SELECT 'vehicle' as type, v.id, v.designation as label, v.vehicle_type as subtitle
        FROM vehicles v
        WHERE v.tenant_id = ?
          AND (v.designation LIKE ? OR v.vehicle_type LIKE ?)
        ORDER BY v.designation LIMIT 5
      `, [tid, like, like]),
    ])

    res.json({ results: [...events, ...contacts, ...venues, ...partners, ...hotels, ...vehicles] })
  } catch (e) {
    console.error('Search error:', e)
    res.status(500).json({ error: 'Search failed' })
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
