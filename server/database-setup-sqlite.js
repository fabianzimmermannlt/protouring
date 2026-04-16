const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fs = require('fs');
require('dotenv').config();

async function setupDatabase() {
  try {
    console.log('Setting up ProTouring SQLite database...');

    // Create/open database
    const db = await open({
      filename: './protouring.db',
      driver: sqlite3.Database
    });

    // Read and execute schema
    const schema = fs.readFileSync('./database-schema-sqlite.sql', 'utf8');
    
    // Execute the schema
    try {
      await db.exec(schema);
      console.log('SQLite database schema executed successfully');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('Some tables already exist, continuing...');
      } else {
        console.error('Schema execution error:', error.message);
      }
    }

    console.log('SQLite database setup completed successfully!');
    await db.close();

  } catch (error) {
    console.error('Database setup error:', error);
  }
}

setupDatabase();
