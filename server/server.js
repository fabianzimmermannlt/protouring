const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database Connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

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
  try {
    const { username, name, email, password } = req.body;

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM artists WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create artist
    const result = await pool.query(
      'INSERT INTO artists (username, name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, username, name, email',
      [username, name, email, passwordHash]
    );

    const artist = result.rows[0];
    
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
  }
});

// Artist Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find artist
    const result = await pool.query(
      'SELECT id, username, name, email, password_hash FROM artists WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const artist = result.rows[0];
    
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
  }
});

// Get Tour Data (e.g., Bühne Frei)
app.get('/api/tour-data/:dataType', authenticateToken, async (req, res) => {
  try {
    const { dataType } = req.params;
    const artistId = req.user.id;

    const result = await pool.query(
      'SELECT title, content, metadata FROM tour_data WHERE artist_id = $1 AND data_type = $2',
      [artistId, dataType]
    );

    if (result.rows.length === 0) {
      // Return default data if none exists
      return res.json({
        title: dataType === 'buhne_frei' ? 'Start der Live Saison 2026!' : '',
        content: dataType === 'buhne_frei' ? '🎸 Start der Live Saison 2026!\n\nWICHTIG: Adressänderung für Rechnungen' : '',
        metadata: {}
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Get tour data error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Save Tour Data
app.post('/api/tour-data/:dataType', authenticateToken, async (req, res) => {
  try {
    const { dataType } = req.params;
    const { title, content, metadata = {} } = req.body;
    const artistId = req.user.id;

    // Upsert data
    const result = await pool.query(`
      INSERT INTO tour_data (artist_id, data_type, title, content, metadata)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (artist_id, data_type)
      DO UPDATE SET 
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        metadata = EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, title, content, metadata
    `, [artistId, dataType, title, content, JSON.stringify(metadata)]);

    res.json({
      message: 'Data saved successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Save tour data error:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// Get Artist Profile
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const artistId = req.user.id;

    const result = await pool.query(
      'SELECT id, username, name, email, created_at FROM artists WHERE id = $1',
      [artistId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
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
app.listen(PORT, () => {
  console.log(`ProTouring server running on port ${PORT}`);
});
