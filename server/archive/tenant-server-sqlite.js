const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://172.29.0.193:3001'],
  credentials: true
}));
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const category = req.params.category || 'general';
    const userId = req.params.userId || 'default';
    const uploadPath = path.join(__dirname, 'uploads', category, userId);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// Database Connection (SQLite)
let db;
async function initDatabase() {
  try {
    db = await open({
      filename: './protouring.db',
      driver: sqlite3.Database
    });
    
    console.log('SQLite database connected successfully');
  } catch (error) {
    console.error('SQLite connection error:', error);
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
    const row = await db.get('SELECT id FROM tenants WHERE slug = ?', [uniqueSlug]);
    if (!row) {
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

    // Start transaction
    await db.run('BEGIN TRANSACTION');

    // Check if user email already exists
    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [userEmail]);
    if (existingUser) {
      await db.run('ROLLBACK');
      return res.status(400).json({ error: 'User email already exists' });
    }

    // Check if tenant email already exists
    const existingTenant = await db.get('SELECT id FROM tenants WHERE email = ?', [tenantEmail]);
    if (existingTenant) {
      await db.run('ROLLBACK');
      return res.status(400).json({ error: 'Tenant email already exists' });
    }

    // Generate unique slug for tenant
    const slug = await generateUniqueSlug(tenantName);

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userResult = await db.run(
      'INSERT INTO users (email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?)',
      [userEmail, passwordHash, userFirstName, userLastName]
    );
    const userId = userResult.lastID;

    // Create tenant
    const tenantResult = await db.run(
      'INSERT INTO tenants (name, slug, email, trial_ends_at) VALUES (?, ?, ?, datetime("now", "+14 days"))',
      [tenantName, slug, tenantEmail]
    );
    const tenantId = tenantResult.lastID;

    // Create subscription
    await db.run(
      'INSERT INTO tenant_subscriptions (tenant_id, plan_id, current_period_start, current_period_end) VALUES (?, ?, datetime("now"), datetime("now", "+14 days"))',
      [tenantId, planId]
    );

    // Assign user as owner of tenant
    await db.run(
      'INSERT INTO user_tenants (user_id, tenant_id, role, status, joined_at) VALUES (?, ?, ?, ?, datetime("now"))',
      [userId, tenantId, 'owner', 'active']
    );

    // Get created user and tenant data
    const user = await db.get('SELECT id, email, first_name, last_name FROM users WHERE id = ?', [userId]);
    const tenant = await db.get('SELECT id, name, slug, email, status, trial_ends_at FROM tenants WHERE id = ?', [tenantId]);

    // Create JWT token
    const token = jwt.sign(
      { id: userId, email: userEmail },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    await db.run('COMMIT');

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
    await db.run('ROLLBACK');
    console.error('Tenant registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
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
    const user = await db.get(
      'SELECT id, email, password_hash, first_name, last_name FROM users WHERE email = ?',
      [email]
    );
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

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

    const tenants = await db.all(tenantQuery, queryParams);
    
    if (tenants.length === 0) {
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
      tenants: tenants,
      currentTenant: tenantSlug ? tenants[0] : tenants[0]
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
    const tenant = await db.get(`
      SELECT t.*, ut.role, ut.status as user_status
      FROM tenants t
      JOIN user_tenants ut ON t.id = ut.tenant_id
      WHERE t.slug = ? AND ut.user_id = ? AND ut.status = 'active'
    `, [slug, userId]);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found or access denied' });
    }

    // Get subscription info
    const subscription = await db.get(`
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
      subscription: subscription || null
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

    const tenants = await db.all(`
      SELECT t.id, t.name, t.slug, t.status, ut.role, ut.last_login_at
      FROM user_tenants ut
      JOIN tenants t ON ut.tenant_id = t.id
      WHERE ut.user_id = ? AND ut.status = 'active'
      ORDER BY ut.last_login_at DESC
    `, [userId]);

    res.json({ tenants });

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
    const plans = await db.all('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY monthly_price ASC');
    res.json({ plans });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Failed to get subscription plans' });
  }
});

// Get available add-ons
app.get('/api/add-ons', async (req, res) => {
  try {
    const addOns = await db.all('SELECT * FROM add_ons WHERE is_active = 1 ORDER BY price ASC');
    res.json({ addOns });
  } catch (error) {
    console.error('Get add-ons error:', error);
    res.status(500).json({ error: 'Failed to get add-ons' });
  }
});

// ============================================
// FILE UPLOAD ROUTES
// ============================================

// Get files for a category and user
app.get('/api/uploads/list/:category/:userId', async (req, res) => {
  try {
    const { category, userId } = req.params;
    const uploadPath = path.join(__dirname, 'uploads', category, userId);
    
    if (!fs.existsSync(uploadPath)) {
      return res.json({ files: [] });
    }
    
    const files = fs.readdirSync(uploadPath).map(filename => {
      const filePath = path.join(uploadPath, filename);
      const stats = fs.statSync(filePath);
      return {
        filename,
        originalname: filename,
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
app.post('/api/uploads/upload/:category/:userId', upload.array('files'), async (req, res) => {
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
app.delete('/api/uploads/delete/:category/:userId/:filename', async (req, res) => {
  try {
    const { category, userId, filename } = req.params;
    const filePath = path.join(__dirname, 'uploads', category, userId, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Rename file
app.put('/api/uploads/rename/:category/:userId/:oldName', async (req, res) => {
  try {
    const { category, userId, oldName } = req.params;
    const { newName } = req.body;
    const oldPath = path.join(__dirname, 'uploads', category, userId, oldName);
    const newPath = path.join(__dirname, 'uploads', category, userId, newName);
    
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
    }
    
    res.json({ message: 'File renamed successfully' });
  } catch (error) {
    console.error('Rename error:', error);
    res.status(500).json({ error: 'Rename failed' });
  }
});

// Get file
app.get('/api/uploads/file/:category/:userId/:filename', (req, res) => {
  try {
    const { category, userId, filename } = req.params;
    const filePath = path.join(__dirname, 'uploads', category, userId, filename);
    
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ error: 'Failed to get file' });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'ProTouring Tenant Server (SQLite)'
  });
});

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`ProTouring Tenant Server (SQLite) running on port ${PORT}`);
  });
}).catch(error => {
  console.error('Failed to start server:', error);
});
