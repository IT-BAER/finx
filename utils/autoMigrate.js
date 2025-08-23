// Run database migrations automatically on boot (idempotent)
// Uses the existing scripts/migrate-db.js
const path = require("path");
const fs = require("fs").promises;
const { execFile } = require("child_process");

async function runAutoMigrations() {
  const shouldRun = (process.env.AUTO_MIGRATE || "true").toLowerCase() !== "false";
  if (!shouldRun) {
    console.info("AUTO_MIGRATE is disabled; skipping automatic migrations.");
    return;
  }

  // Pre-check: if there is no migrations directory or no .sql files, skip quietly
  const repoRoot = path.join(__dirname, "..");
  const migrationsDir = path.join(repoRoot, "database", "migrations");
  try {
    const stat = await fs.stat(migrationsDir);
    if (!stat.isDirectory()) {
      console.info(`Migrations path exists but is not a directory: ${migrationsDir}; skipping automatic migrations.`);
      return;
    }
    const files = await fs.readdir(migrationsDir);
    const hasSql = files.some((f) => f.toLowerCase().endsWith(".sql"));
    if (!hasSql) {
      console.info("No migration files found; skipping automatic migrations.");
      return;
    }
  } catch (e) {
    if (e && e.code === "ENOENT") {
      console.info(`Migrations directory not found at ${migrationsDir}; skipping automatic migrations.`);
      return;
    }
    // Unexpected error while checking for migrations – log and continue to attempt running the script
    console.warn("Warning: unable to verify migrations directory:", e.message || e);
  }

  // Run the migration script
  await new Promise((resolve, reject) => {
    const nodePath = process.execPath;
    const migrateScript = path.join(__dirname, "..", "scripts", "migrate-db.js");
    console.info("Running automatic database migrations...");
    execFile(
      nodePath,
      [migrateScript],
      { cwd: repoRoot },
      (error, stdout, stderr) => {
        if (stdout) process.stdout.write(stdout);
        if (stderr) process.stderr.write(stderr);
        if (error) {
          // Treat missing migrations as non-fatal even if the child erred
          const msg = (error.message || "") + "\n" + (stderr || "");
          if (msg.includes("ENOENT") && msg.includes("database/migrations")) {
            console.info("No migrations present; skipping automatic migrations.");
            return resolve();
          }
          return reject(error);
        }
        console.info("Automatic migrations completed.");
        resolve();
      },
    );
  });
}

module.exports = { runAutoMigrations };
