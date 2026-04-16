const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'postgres', // Connect to default database first
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function setupDatabase() {
  try {
    console.log('Setting up ProTouring database...');

    // Create database if it doesn't exist
    await pool.query(`CREATE DATABASE ${process.env.DB_NAME || 'protouring'}`);
    console.log(`Database ${process.env.DB_NAME || 'protouring'} created successfully`);

    // Connect to the new database
    const dbPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'protouring',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
    });

    // Read and execute schema
    const schema = fs.readFileSync('./database-schema.sql', 'utf8');
    
    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        await dbPool.query(statement);
        console.log('Executed:', statement.substring(0, 50) + '...');
      } catch (error) {
        // Ignore errors for statements that might already exist
        if (!error.message.includes('already exists') && !error.message.includes('does not exist')) {
          console.error('Error executing statement:', error.message);
        }
      }
    }

    console.log('Database setup completed successfully!');
    await dbPool.end();

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('Database already exists, skipping creation');
    } else {
      console.error('Database setup error:', error);
    }
  } finally {
    await pool.end();
  }
}

setupDatabase();
