const dotenv = require("dotenv");
const { Pool } = require("pg");
const fs = require("fs");
const logger = require("../utils/logger");

dotenv.config();

// Detect if running in Docker
const isDocker = fs.existsSync("/.dockerenv");

// Smart DB Host selection:
// If configured as 'finx-db' (docker service name) but NOT running in Docker,
// fallback to 'localhost' to allow local development/testing without changing .env
let dbHost = process.env.DB_HOST;
if (dbHost === "finx-db" && !isDocker) {
  logger.info("Detected local run with docker hostname. Switching DB_HOST to localhost.");
  dbHost = "localhost";
}

// Use PostgreSQL database
if (process.env.DEBUG_SQL === "true") {
  logger.info(`Using PostgreSQL database at ${dbHost}:${process.env.DB_PORT}`);
}

const pool = new Pool({
  user: process.env.DB_USER,
  host: dbHost,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Test the connection in development to surface config issues early
if (process.env.NODE_ENV !== "production") {
  pool.query("SELECT NOW()", (err) => {
    if (err) {
      logger.error("Database connection error: " + err.message, { stack: err.stack });
    } else if (process.env.DEBUG_SQL === "true") {
      logger.info("Database connected successfully");
    }
  });
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
