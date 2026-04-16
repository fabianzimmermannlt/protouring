-- ProTouring Multi-Tenant Database Schema
-- SQLite Schema for Tenant Management (Local Testing)

-- ============================================
-- 1. GLOBAL TABLES (Cross-Tenant)
-- ============================================

-- Global Users (unique across all tenants)
CREATE TABLE users (
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

-- Subscription Plans
CREATE TABLE subscription_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    monthly_price REAL,
    yearly_price REAL,
    features TEXT, -- JSON as TEXT
    max_users INTEGER DEFAULT 10,
    max_storage_mb INTEGER DEFAULT 1024,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add-ons
CREATE TABLE add_ons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL,
    billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly', 'once')),
    features TEXT, -- JSON as TEXT
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. TENANT TABLES
-- ============================================

-- Tenants (Artists/Organizations)
CREATE TABLE tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))) UNIQUE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    description TEXT,
    logo_url TEXT,
    website TEXT,
    social_links TEXT, -- JSON as TEXT
    status TEXT DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    trial_ends_at DATETIME,
    billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly'))
);

-- Tenant Subscriptions
CREATE TABLE tenant_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'trial')),
    current_period_start DATETIME,
    current_period_end DATETIME,
    cancelled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);

-- Tenant Add-on Subscriptions
CREATE TABLE tenant_add_ons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    add_on_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
    current_period_start DATETIME,
    current_period_end DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (add_on_id) REFERENCES add_ons(id)
);

-- ============================================
-- 3. USER-TENANT RELATIONSHIPS
-- ============================================

-- User-Tenant Assignments (Many-to-Many)
CREATE TABLE user_tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tenant_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
    permissions TEXT, -- JSON as TEXT
    invited_by INTEGER,
    invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    joined_at DATETIME,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'removed')),
    last_login_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(user_id, tenant_id)
);

-- ============================================
-- 4. TENANT-SPECIFIC DATA (Examples)
-- ============================================

-- Tour Data (per tenant)
CREATE TABLE tour_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    data_type TEXT NOT NULL,
    data TEXT NOT NULL, -- JSON as TEXT
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Events/Appointments (per tenant)
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    location TEXT,
    status TEXT DEFAULT 'confirmed',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Files (per tenant)
CREATE TABLE files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    user_id INTEGER,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    file_path TEXT,
    uploaded_by INTEGER,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- 5. INDEXES
-- ============================================

-- Global indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);

-- Tenant indexes
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_email ON tenants(email);

-- Subscription indexes
CREATE INDEX idx_tenant_subscriptions_tenant ON tenant_subscriptions(tenant_id);
CREATE INDEX idx_tenant_subscriptions_status ON tenant_subscriptions(status);

-- User-tenant relationship indexes
CREATE INDEX idx_user_tenants_user ON user_tenants(user_id);
CREATE INDEX idx_user_tenants_tenant ON user_tenants(tenant_id);
CREATE INDEX idx_user_tenants_status ON user_tenants(status);

-- Data indexes
CREATE INDEX idx_tour_data_tenant ON tour_data(tenant_id);
CREATE INDEX idx_tour_data_type ON tour_data(data_type);
CREATE INDEX idx_events_tenant ON events(tenant_id);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_files_tenant ON files(tenant_id);
CREATE INDEX idx_files_category ON files(category);

-- ============================================
-- 6. SAMPLE DATA
-- ============================================

-- Sample Subscription Plans
INSERT INTO subscription_plans (name, description, monthly_price, yearly_price, features, max_users, max_storage_mb) VALUES
('Starter', 'Perfect for solo artists', 29.00, 290.00, '["basic_features", "5gb_storage", "email_support"]', 5, 5120),
('Professional', 'For growing artists and bands', 79.00, 790.00, '["all_features", "50gb_storage", "priority_support", "advanced_analytics"]', 20, 51200),
('Enterprise', 'For established artists and labels', 199.00, 1990.00, '["unlimited_features", "unlimited_storage", "dedicated_support", "custom_integrations"]', -1, -1);

-- Sample Add-ons
INSERT INTO add_ons (name, description, price, billing_cycle, features) VALUES
('Extra Storage', 'Additional 100GB storage', 19.00, 'monthly', '["100gb_additional_storage"]'),
('Advanced Analytics', 'Detailed analytics and reporting', 29.00, 'monthly', '["advanced_analytics", "custom_reports", "data_export"]'),
('API Access', 'Full API access for integrations', 49.00, 'monthly', '["api_access", "webhooks", "technical_support"]');

-- ============================================
-- 7. TRIGGERS (SQLite compatible)
-- ============================================

-- Update updated_at timestamp
CREATE TRIGGER update_users_updated_at AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_tenants_updated_at AFTER UPDATE ON tenants
BEGIN
    UPDATE tenants SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_tenant_subscriptions_updated_at AFTER UPDATE ON tenant_subscriptions
BEGIN
    UPDATE tenant_subscriptions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_tour_data_updated_at AFTER UPDATE ON tour_data
BEGIN
    UPDATE tour_data SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_events_updated_at AFTER UPDATE ON events
BEGIN
    UPDATE events SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
