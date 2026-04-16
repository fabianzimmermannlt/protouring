-- ProTouring Multi-Tenant Database Schema
-- MySQL Schema for Tenant Management (Plesk Compatible)

-- ============================================
-- 1. GLOBAL TABLES (Cross-Tenant)
-- ============================================

-- Global Users (unique across all tenants)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Subscription Plans
CREATE TABLE subscription_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    monthly_price DECIMAL(10,2),
    yearly_price DECIMAL(10,2),
    features JSON,
    max_users INT DEFAULT 10,
    max_storage_mb INT DEFAULT 1024,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add-ons
CREATE TABLE add_ons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    billing_cycle ENUM('monthly', 'yearly', 'once'),
    features JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. TENANT TABLES
-- ============================================

-- Tenants (Artists/Organizations)
CREATE TABLE tenants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) DEFAULT (UUID()) UNIQUE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    description TEXT,
    logo_url VARCHAR(500),
    website VARCHAR(255),
    social_links JSON,
    status ENUM('trial', 'active', 'suspended', 'cancelled') DEFAULT 'trial',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    trial_ends_at TIMESTAMP NULL,
    billing_cycle ENUM('monthly', 'yearly') DEFAULT 'monthly'
);

-- Tenant Subscriptions
CREATE TABLE tenant_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    plan_id INT NOT NULL,
    status ENUM('active', 'cancelled', 'expired', 'trial') DEFAULT 'active',
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancelled_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);

-- Tenant Add-on Subscriptions
CREATE TABLE tenant_add_ons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    add_on_id INT NOT NULL,
    status ENUM('active', 'cancelled', 'expired') DEFAULT 'active',
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (add_on_id) REFERENCES add_ons(id)
);

-- ============================================
-- 3. USER-TENANT RELATIONSHIPS
-- ============================================

-- User-Tenant Assignments (Many-to-Many)
CREATE TABLE user_tenants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    tenant_id INT NOT NULL,
    role ENUM('owner', 'admin', 'manager', 'member', 'viewer') DEFAULT 'member',
    permissions JSON,
    invited_by INT NULL,
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    joined_at TIMESTAMP NULL,
    status ENUM('pending', 'active', 'inactive', 'removed') DEFAULT 'pending',
    last_login_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_user_tenant (user_id, tenant_id)
);

-- ============================================
-- 4. TENANT-SPECIFIC DATA (Examples)
-- ============================================

-- Tour Data (per tenant)
CREATE TABLE tour_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    data JSON NOT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Events/Appointments (per tenant)
CREATE TABLE events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    location VARCHAR(255),
    status VARCHAR(20) DEFAULT 'confirmed',
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Files (per tenant)
CREATE TABLE files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    category VARCHAR(50) NOT NULL,
    user_id INT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_size INT,
    mime_type VARCHAR(100),
    file_path VARCHAR(500),
    uploaded_by INT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
