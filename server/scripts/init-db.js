const { Pool } = require('pg');
require('dotenv').config();

async function initDatabase() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: 'postgres', // Connect to default database first
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    console.log('Creating database...');
    
    // Create the database
    await pool.query(`CREATE DATABASE ${process.env.DB_NAME}`);
    console.log(`Database ${process.env.DB_NAME} created successfully`);

    // Close connection and reconnect to new database
    await pool.end();

    const newPool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    console.log('Creating tables...');

    // Create artists table
    await newPool.query(`
      CREATE TABLE artists (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        active BOOLEAN DEFAULT true
      )
    `);

    // Create tour_data table
    await newPool.query(`
      CREATE TABLE tour_data (
        id SERIAL PRIMARY KEY,
        artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
        data_type VARCHAR(50) NOT NULL,
        title VARCHAR(255),
        content TEXT,
        metadata JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(artist_id, data_type)
      )
    `);

    // Create sessions table
    await newPool.query(`
      CREATE TABLE sessions (
        id SERIAL PRIMARY KEY,
        artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    await newPool.query('CREATE INDEX idx_tour_data_artist_type ON tour_data(artist_id, data_type)');
    await newPool.query('CREATE INDEX idx_sessions_token ON sessions(session_token)');
    await newPool.query('CREATE INDEX idx_sessions_expires ON sessions(expires_at)');

    console.log('Tables created successfully');

    // Create a default artist for testing
    const bcrypt = require('bcryptjs');
    const saltRounds = 10;
    const defaultPassword = await bcrypt.hash('demo123', saltRounds);

    await newPool.query(`
      INSERT INTO artists (username, name, email, password_hash)
      VALUES ($1, $2, $3, $4)
    `, ['demo', 'Demo Artist', 'demo@protouring.com', defaultPassword]);

    console.log('Default artist created: username=demo, password=demo123');

    await newPool.end();
    console.log('Database initialization completed!');

  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  }
}

initDatabase();
