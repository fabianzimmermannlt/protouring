const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function setupDatabase() {
  try {
    console.log('Setting up ProTouring MySQL database...');

    // Connect to MySQL without database first
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });

    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'protouring';
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`Database ${dbName} created or already exists`);

    // Close the connection
    await connection.end();

    // Connect to the new database
    const dbConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      database: dbName,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    });

    // Read and execute schema
    const schema = fs.readFileSync('./database-schema-mysql.sql', 'utf8');
    
    // Execute the entire schema file
    try {
      await dbConnection.execute(schema);
      console.log('Database schema executed successfully');
    } catch (error) {
      if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.message.includes('already exists')) {
        console.log('Some tables already exist, continuing...');
      } else {
        console.error('Schema execution error:', error.message);
      }
    }

    console.log('MySQL database setup completed successfully!');
    await dbConnection.end();

  } catch (error) {
    console.error('Database setup error:', error);
    if (error.code === 'ECONNREFUSED') {
      console.log('MySQL connection refused. Please ensure MySQL is running and credentials are correct.');
    }
  }
}

setupDatabase();
