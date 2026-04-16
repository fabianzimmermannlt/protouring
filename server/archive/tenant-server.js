const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://172.29.0.193:3001'],
  credentials: true
}));
app.use(express.json());

// Database Connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'protouring',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

// Helper function to generate slug
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

// Helper function to generate unique slug
const generateUniqueSlug = async (name) => {
  let slug = generateSlug(name);
  let counter = 1;
  let uniqueSlug = slug;
  
  while (true) {
    const result = await pool.query('SELECT id FROM tenants WHERE slug = $1', [uniqueSlug]);
    if (result.rows.length === 0) {
      break;
    }
    uniqueSlug = `${slug}-${counter}`;
    counter++;
  }
  
  return uniqueSlug;
};

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'default_secret', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ============================================
// TENANT REGISTRATION
// ============================================

// Register new tenant
app.post('/api/tenants/register', async (req, res) => {
  const client = await pool.connect();
  try {
    const { 
      tenantName, 
      tenantEmail, 
      userFirstName, 
      userLastName, 
      userEmail, 
      password,
      planId = 1 // Default to Starter plan
    } = req.body;

    // Validate input
    if (!tenantName || !tenantEmail || !userFirstName || !userLastName || !userEmail || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    await client.query('BEGIN');

    // Check if user email already exists
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [userEmail]);
    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'User email already exists' });
    }

    // Check if tenant email already exists
    const existingTenant = await client.query('SELECT id FROM tenants WHERE email = $1', [tenantEmail]);
    if (existingTenant.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Tenant email already exists' });
    }

    // Generate unique slug for tenant
    const slug = await generateUniqueSlug(tenantName);

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userResult = await client.query(
      'INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name',
      [userEmail, passwordHash, userFirstName, userLastName]
    );
    const user = userResult.rows[0];

    // Create tenant
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, slug, email, trial_ends_at) 
       VALUES ($1, $2, $3, NOW() + INTERVAL '14 days') 
       RETURNING id, name, slug, email, status, trial_ends_at`,
      [tenantName, slug, tenantEmail]
    );
    const tenant = tenantResult.rows[0];

    // Create subscription
    await client.query(
      `INSERT INTO tenant_subscriptions (tenant_id, plan_id, current_period_start, current_period_end)
       VALUES ($1, $2, NOW(), NOW() + INTERVAL '14 days')`,
      [tenant.id, planId]
    );

    // Assign user as owner of tenant
    await client.query(
      'INSERT INTO user_tenants (user_id, tenant_id, role, status, joined_at) VALUES ($1, $2, $3, $4, NOW())',
      [user.id, tenant.id, 'owner', 'active']
    );

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    await client.query('COMMIT');

    res.json({
      message: 'Tenant registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        email: tenant.email,
        status: tenant.status,
        trialEndsAt: tenant.trial_ends_at
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Tenant registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

// ============================================
// USER AUTHENTICATION
// ============================================

// User login (multi-tenant aware)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, tenantSlug } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const userResult = await pool.query('SELECT id, email, password_hash, first_name, last_name FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get user's tenant associations
    let tenantQuery;
    let queryParams;

    if (tenantSlug) {
      // Login to specific tenant
      tenantQuery = `
        SELECT t.id, t.name, t.slug, t.status, ut.role, ut.status as user_status
        FROM user_tenants ut
        JOIN tenants t ON ut.tenant_id = t.id
        WHERE ut.user_id = $1 AND t.slug = $2 AND ut.status = 'active'
      `;
      queryParams = [user.id, tenantSlug];
    } else {
      // Get all user's tenants
      tenantQuery = `
        SELECT t.id, t.name, t.slug, t.status, ut.role, ut.status as user_status
        FROM user_tenants ut
        JOIN tenants t ON ut.tenant_id = t.id
        WHERE ut.user_id = $1 AND ut.status = 'active'
      `;
      queryParams = [user.id];
    }

    const tenantResult = await pool.query(tenantQuery, queryParams);
    
    if (tenantResult.rows.length === 0) {
      return res.status(401).json({ error: 'No active tenant access found' });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      },
      tenants: tenantResult.rows,
      currentTenant: tenantSlug ? tenantResult.rows[0] : tenantResult.rows[0]
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================================
// TENANT MANAGEMENT
// ============================================

// Get tenant info
app.get('/api/tenants/:slug', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id;

    // Check if user has access to this tenant
    const tenantResult = await pool.query(`
      SELECT t.*, ut.role, ut.status as user_status
      FROM tenants t
      JOIN user_tenants ut ON t.id = ut.tenant_id
      WHERE t.slug = $1 AND ut.user_id = $2 AND ut.status = 'active'
    `, [slug, userId]);

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found or access denied' });
    }

    const tenant = tenantResult.rows[0];

    // Get subscription info
    const subscriptionResult = await pool.query(`
      SELECT ts.*, sp.name as plan_name, sp.features, sp.max_users, sp.max_storage_mb
      FROM tenant_subscriptions ts
      JOIN subscription_plans sp ON ts.plan_id = sp.id
      WHERE ts.tenant_id = $1 AND ts.status = 'active'
    `, [tenant.id]);

    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        email: tenant.email,
        status: tenant.status,
        trialEndsAt: tenant.trial_ends_at,
        role: tenant.role
      },
      subscription: subscriptionResult.rows[0] || null
    });

  } catch (error) {
    console.error('Get tenant error:', error);
    res.status(500).json({ error: 'Failed to get tenant info' });
  }
});

// Get user's tenants
app.get('/api/users/tenants', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT t.id, t.name, t.slug, t.status, ut.role, ut.last_login_at
      FROM user_tenants ut
      JOIN tenants t ON ut.tenant_id = t.id
      WHERE ut.user_id = $1 AND ut.status = 'active'
      ORDER BY ut.last_login_at DESC NULLS LAST
    `, [userId]);

    res.json({ tenants: result.rows });

  } catch (error) {
    console.error('Get user tenants error:', error);
    res.status(500).json({ error: 'Failed to get user tenants' });
  }
});

// ============================================
// SUBSCRIPTION PLANS
// ============================================

// Get available subscription plans
app.get('/api/subscription-plans', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM subscription_plans WHERE is_active = true ORDER BY monthly_price ASC');
    res.json({ plans: result.rows });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Failed to get subscription plans' });
  }
});

// Get available add-ons
app.get('/api/add-ons', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM add_ons WHERE is_active = true ORDER BY price ASC');
    res.json({ addOns: result.rows });
  } catch (error) {
    console.error('Get add-ons error:', error);
    res.status(500).json({ error: 'Failed to get add-ons' });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'ProTouring Tenant Server'
  });
});

app.listen(PORT, () => {
  console.log(`ProTouring Tenant Server running on port ${PORT}`);
});
