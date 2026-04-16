-- ProTouring Multi-Tenant Database Schema
-- PostgreSQL Schema for Tenant Management

-- ============================================
-- 1. GLOBAL TABLES (Cross-Tenant)
-- ============================================

-- Global Users (unique across all tenants)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Subscription Plans
CREATE TABLE subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    monthly_price DECIMAL(10,2),
    yearly_price DECIMAL(10,2),
    features JSONB, -- Array of features
    max_users INTEGER DEFAULT 10,
    max_storage_mb INTEGER DEFAULT 1024,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add-ons
CREATE TABLE add_ons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'yearly', 'once')),
    features JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. TENANT TABLES
-- ============================================

-- Tenants (Artists/Organizations)
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() UNIQUE, -- For public identification
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL, -- URL-friendly identifier
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    description TEXT,
    logo_url VARCHAR(500),
    website VARCHAR(255),
    social_links JSONB, -- Social media links
    status VARCHAR(20) DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trial_ends_at TIMESTAMP,
    billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly'))
);

-- Tenant Subscriptions
CREATE TABLE tenant_subscriptions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES subscription_plans(id),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'trial')),
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tenant Add-on Subscriptions
CREATE TABLE tenant_add_ons (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    add_on_id INTEGER REFERENCES add_ons(id),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. USER-TENANT RELATIONSHIPS
-- ============================================

-- User-Tenant Assignments (Many-to-Many)
CREATE TABLE user_tenants (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
    permissions JSONB, -- Additional permissions
    invited_by INTEGER REFERENCES users(id),
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    joined_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'removed')),
    last_login_at TIMESTAMP,
    UNIQUE(user_id, tenant_id)
);

-- ============================================
-- 4. TENANT-SPECIFIC DATA (Examples)
-- ============================================

-- These would be created for each tenant
-- Using tenant_id as foreign key for data isolation

-- Example: Tour Data (per tenant)
CREATE TABLE tour_data (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    data_type VARCHAR(50) NOT NULL, -- 'hotels', 'vehicles', 'contacts', etc.
    data JSONB NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Example: Events/Appointments (per tenant)
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    location VARCHAR(255),
    status VARCHAR(20) DEFAULT 'confirmed',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Example: Files (per tenant)
CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- 'general', 'personal', 'contracts', etc.
    user_id INTEGER REFERENCES users(id),
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    file_path VARCHAR(500),
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
-- 7. TRIGGERS AND FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenant_subscriptions_updated_at BEFORE UPDATE ON tenant_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tour_data_updated_at BEFORE UPDATE ON tour_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
