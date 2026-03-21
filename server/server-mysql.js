const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database Connection
let pool;

async function initDatabase() {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test connection
    const connection = await pool.getConnection();
    console.log('MySQL Database connected successfully');
    connection.release();

  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Routes

// Artist Registration
app.post('/api/register', async (req, res) => {
  let connection;
  try {
    const { username, name, email, password } = req.body;

    connection = await pool.getConnection();

    // Check if user exists
    const [existingUsers] = await connection.execute(
      'SELECT id FROM artists WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create artist
    const [result] = await connection.execute(
      'INSERT INTO artists (username, name, email, password_hash) VALUES (?, ?, ?, ?)',
      [username, name, email, passwordHash]
    );

    // Get created artist data
    const [artists] = await connection.execute(
      'SELECT id, username, name, email FROM artists WHERE id = ?',
      [result.insertId]
    );

    const artist = artists[0];
    
    // Create JWT token
    const token = jwt.sign(
      { id: artist.id, username: artist.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Artist registered successfully',
      token,
      artist: { id: artist.id, username: artist.username, name: artist.name, email: artist.email }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    if (connection) connection.release();
  }
});

// Artist Login
app.post('/api/login', async (req, res) => {
  let connection;
  try {
    const { username, password } = req.body;

    connection = await pool.getConnection();

    // Find artist
    const [artists] = await connection.execute(
      'SELECT id, username, name, email, password_hash FROM artists WHERE username = ?',
      [username]
    );

    if (artists.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const artist = artists[0];
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, artist.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: artist.id, username: artist.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login successful',
      token,
      artist: { id: artist.id, username: artist.username, name: artist.name, email: artist.email }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  } finally {
    if (connection) connection.release();
  }
});

// Get Tour Data (e.g., Bühne Frei)
app.get('/api/tour-data/:dataType', authenticateToken, async (req, res) => {
  let connection;
  try {
    const { dataType } = req.params;
    const artistId = req.user.id;

    connection = await pool.getConnection();

    const [tourData] = await connection.execute(
      'SELECT title, content, metadata FROM tour_data WHERE artist_id = ? AND data_type = ?',
      [artistId, dataType]
    );

    if (tourData.length === 0) {
      // Return default data if none exists
      const defaultData = {
        title: dataType === 'buhne_frei' ? 'Start der Live Saison 2026!' : '',
        content: dataType === 'buhne_frei' ? '🎸 Start der Live Saison 2026!\n\nWICHTIG: Adressänderung für Rechnungen' : '',
        metadata: {}
      };
      return res.json(defaultData);
    }

    // Parse JSON metadata
    const data = tourData[0];
    if (data.metadata && typeof data.metadata === 'string') {
      try {
        data.metadata = JSON.parse(data.metadata);
      } catch (e) {
        data.metadata = {};
      }
    }

    res.json(data);

  } catch (error) {
    console.error('Get tour data error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  } finally {
    if (connection) connection.release();
  }
});

// Save Tour Data
app.post('/api/tour-data/:dataType', authenticateToken, async (req, res) => {
  let connection;
  try {
    const { dataType } = req.params;
    const { title, content, metadata = {} } = req.body;
    const artistId = req.user.id;

    connection = await pool.getConnection();

    // Upsert data using REPLACE INTO (MySQL specific)
    const [result] = await connection.execute(
      `REPLACE INTO tour_data (artist_id, data_type, title, content, metadata, updated_at) 
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [artistId, dataType, title, content, JSON.stringify(metadata)]
    );

    res.json({
      message: 'Data saved successfully',
      data: { id: result.insertId, title, content, metadata }
    });

  } catch (error) {
    console.error('Save tour data error:', error);
    res.status(500).json({ error: 'Failed to save data' });
  } finally {
    if (connection) connection.release();
  }
});

// Get Artist Profile
app.get('/api/profile', authenticateToken, async (req, res) => {
  let connection;
  try {
    const artistId = req.user.id;

    connection = await pool.getConnection();

    const [artists] = await connection.execute(
      'SELECT id, username, name, email, created_at FROM artists WHERE id = ?',
      [artistId]
    );

    if (artists.length === 0) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    res.json(artists[0]);

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  } finally {
    if (connection) connection.release();
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`ProTouring MySQL server running on port ${PORT}`);
  });
}

startServer();
