// Migration script to run database migrations
const { Pool } = require("pg");
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config();

// Database connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log("Running database migrations...");

    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get all migration files (gracefully handle missing directory)
    const migrationsDir = path.join(__dirname, "../database/migrations");
    let files = [];
    try {
      const stat = await fs.stat(migrationsDir);
      if (!stat.isDirectory()) {
        console.log(`Migrations path exists but is not a directory: ${migrationsDir}; skipping.`);
        console.log("No migrations to apply.");
        return;
      }
      files = await fs.readdir(migrationsDir);
    } catch (e) {
      if (e && e.code === "ENOENT") {
        console.log(`Migrations directory not found at ${migrationsDir}; skipping.`);
        console.log("No migrations to apply.");
        return;
      }
      throw e;
    }

    // Sort files to ensure they run in order
    const migrationFiles = files.filter((file) => file.endsWith(".sql")).sort();

    // Get already run migrations
    const ranMigrationsResult = await client.query(
      "SELECT name FROM migrations",
    );
    const ranMigrations = ranMigrationsResult.rows.map((row) => row.name);

    // Run each migration
    for (const file of migrationFiles) {
      if (ranMigrations.includes(file)) {
        console.log(`Skipping already run migration: ${file}`);
        continue;
      }

      console.log(`Running migration: ${file}`);
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = await fs.readFile(migrationPath, "utf8");

      try {
        await client.query("BEGIN");
        // Execute the migration
        await client.query(migrationSQL);
        // Add migration to migrations table
        await client.query("INSERT INTO migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Completed migration: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`Error running migration ${file}:`, err);
        throw err;
      }
    }

    console.log("All database migrations completed successfully!");
  } catch (error) {
    console.error("Error running database migrations:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migrations
runMigrations();
