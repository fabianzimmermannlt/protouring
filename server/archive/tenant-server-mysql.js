const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://172.29.0.193:3001'],
  credentials: true
}));
app.use(express.json());

// Database Connection (MySQL)
let pool;
async function initDatabase() {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME || 'protouring',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    // Test connection
    const connection = await pool.getConnection();
    console.log('MySQL database connected successfully');
    connection.release();
  } catch (error) {
    console.error('MySQL connection error:', error);
    console.log('Please check your database credentials in .env file');
  }
}

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
    const [rows] = await pool.execute('SELECT id FROM tenants WHERE slug = ?', [uniqueSlug]);
    if (rows.length === 0) {
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
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
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
      await connection.rollback();
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user email already exists
    const [existingUsers] = await connection.execute('SELECT id FROM users WHERE email = ?', [userEmail]);
    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'User email already exists' });
    }

    // Check if tenant email already exists
    const [existingTenants] = await connection.execute('SELECT id FROM tenants WHERE email = ?', [tenantEmail]);
    if (existingTenants.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Tenant email already exists' });
    }

    // Generate unique slug for tenant
    const slug = await generateUniqueSlug(tenantName);

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const [userResult] = await connection.execute(
      'INSERT INTO users (email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?)',
      [userEmail, passwordHash, userFirstName, userLastName]
    );
    const userId = userResult.insertId;

    // Create tenant
    const [tenantResult] = await connection.execute(
      'INSERT INTO tenants (name, slug, email, trial_ends_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 14 DAY))',
      [tenantName, slug, tenantEmail]
    );
    const tenantId = tenantResult.insertId;

    // Create subscription
    await connection.execute(
      'INSERT INTO tenant_subscriptions (tenant_id, plan_id, current_period_start, current_period_end) VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 14 DAY))',
      [tenantId, planId]
    );

    // Assign user as owner of tenant
    await connection.execute(
      'INSERT INTO user_tenants (user_id, tenant_id, role, status, joined_at) VALUES (?, ?, ?, ?, NOW())',
      [userId, tenantId, 'owner', 'active']
    );

    // Get created user and tenant data
    const [userRows] = await connection.execute(
      'SELECT id, email, first_name, last_name FROM users WHERE id = ?',
      [userId]
    );
    const [tenantRows] = await connection.execute(
      'SELECT id, name, slug, email, status, trial_ends_at FROM tenants WHERE id = ?',
      [tenantId]
    );

    // Create JWT token
    const token = jwt.sign(
      { id: userId, email: userEmail },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    await connection.commit();

    res.json({
      message: 'Tenant registered successfully',
      token,
      user: {
        id: userRows[0].id,
        email: userRows[0].email,
        firstName: userRows[0].first_name,
        lastName: userRows[0].last_name
      },
      tenant: {
        id: tenantRows[0].id,
        name: tenantRows[0].name,
        slug: tenantRows[0].slug,
        email: tenantRows[0].email,
        status: tenantRows[0].status,
        trialEndsAt: tenantRows[0].trial_ends_at
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Tenant registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    connection.release();
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
    const [userRows] = await pool.execute(
      'SELECT id, email, password_hash, first_name, last_name FROM users WHERE email = ?',
      [email]
    );
    if (userRows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userRows[0];

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
        WHERE ut.user_id = ? AND t.slug = ? AND ut.status = 'active'
      `;
      queryParams = [user.id, tenantSlug];
    } else {
      // Get all user's tenants
      tenantQuery = `
        SELECT t.id, t.name, t.slug, t.status, ut.role, ut.status as user_status
        FROM user_tenants ut
        JOIN tenants t ON ut.tenant_id = t.id
        WHERE ut.user_id = ? AND ut.status = 'active'
      `;
      queryParams = [user.id];
    }

    const [tenantRows] = await pool.execute(tenantQuery, queryParams);
    
    if (tenantRows.length === 0) {
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
      tenants: tenantRows,
      currentTenant: tenantSlug ? tenantRows[0] : tenantRows[0]
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
    const [tenantRows] = await pool.execute(`
      SELECT t.*, ut.role, ut.status as user_status
      FROM tenants t
      JOIN user_tenants ut ON t.id = ut.tenant_id
      WHERE t.slug = ? AND ut.user_id = ? AND ut.status = 'active'
    `, [slug, userId]);

    if (tenantRows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found or access denied' });
    }

    const tenant = tenantRows[0];

    // Get subscription info
    const [subscriptionRows] = await pool.execute(`
      SELECT ts.*, sp.name as plan_name, sp.features, sp.max_users, sp.max_storage_mb
      FROM tenant_subscriptions ts
      JOIN subscription_plans sp ON ts.plan_id = sp.id
      WHERE ts.tenant_id = ? AND ts.status = 'active'
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
      subscription: subscriptionRows[0] || null
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

    const [rows] = await pool.execute(`
      SELECT t.id, t.name, t.slug, t.status, ut.role, ut.last_login_at
      FROM user_tenants ut
      JOIN tenants t ON ut.tenant_id = t.id
      WHERE ut.user_id = ? AND ut.status = 'active'
      ORDER BY ut.last_login_at DESC
    `, [userId]);

    res.json({ tenants: rows });

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
    const [rows] = await pool.execute('SELECT * FROM subscription_plans WHERE is_active = true ORDER BY monthly_price ASC');
    res.json({ plans: rows });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Failed to get subscription plans' });
  }
});

// Get available add-ons
app.get('/api/add-ons', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM add_ons WHERE is_active = true ORDER BY price ASC');
    res.json({ addOns: rows });
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
    service: 'ProTouring Tenant Server (MySQL)'
  });
});

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`ProTouring Tenant Server (MySQL) running on port ${PORT}`);
  });
}).catch(error => {
  console.error('Failed to start server:', error);
});
