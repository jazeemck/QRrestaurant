require('dotenv').config();
const { Pool } = require('pg');

// Set these via environment variables in production (.env file)
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'qr_restaurant',
  port: process.env.DB_PORT || 5432,
});

module.exports = pool;