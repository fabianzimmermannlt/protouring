const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDatabase() {
  let connection;

  try {
    console.log('Connecting to MySQL...');
    
    // Connect to MySQL without specifying database first
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    console.log('Connected to MySQL server');

    // Create database if it doesn't exist
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`Database ${process.env.DB_NAME} created or already exists`);

    // Close connection and reconnect to the new database
    await connection.end();

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    console.log('Connected to database:', process.env.DB_NAME);

    // Create tables
    console.log('Creating tables...');

    // Artists table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS artists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        active BOOLEAN DEFAULT true,
        INDEX idx_username (username),
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tour data table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tour_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        artist_id INT NOT NULL,
        data_type VARCHAR(50) NOT NULL,
        title VARCHAR(255),
        content TEXT,
        metadata JSON,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_artist_data (artist_id, data_type),
        INDEX idx_artist_type (artist_id, data_type),
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Sessions table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        artist_id INT NOT NULL,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_token (session_token),
        INDEX idx_expires (expires_at),
        INDEX idx_artist (artist_id),
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('Tables created successfully');

    // Create default artist for testing
    const bcrypt = require('bcryptjs');
    const saltRounds = 10;
    const defaultPassword = await bcrypt.hash('demo123', saltRounds);

    await connection.execute(`
      INSERT IGNORE INTO artists (username, name, email, password_hash)
      VALUES (?, ?, ?, ?)
    `, ['demo', 'Demo Artist', 'demo@protouring.com', defaultPassword]);

    console.log('Default artist created: username=demo, password=demo123');

    await connection.end();
    console.log('MySQL database initialization completed!');

  } catch (error) {
    console.error('Database initialization error:', error);
    if (connection) await connection.end();
    process.exit(1);
  }
}

initDatabase();
