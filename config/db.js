const dotenv = require("dotenv");
const { Pool } = require("pg");

dotenv.config();

// Use PostgreSQL database
if (process.env.DEBUG_SQL === "true") {
  console.log("Using PostgreSQL database");
}
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Test the connection in development to surface config issues early
if (process.env.NODE_ENV !== "production") {
  pool.query("SELECT NOW()", (err) => {
    if (err) {
      console.error("Database connection error:", err.stack);
    } else if (process.env.DEBUG_SQL === "true") {
      console.log("Database connected successfully");
    }
  });
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
