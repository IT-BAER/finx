// Script to initialize the database with sample data
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Database connection - uses environment variables from .env with defaults
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  port: process.env.DB_PORT || 5432,
  ssl: process.env.DB_SSL === "true",
});

// Initial seed admin (use env if provided)
const defaultAdminEmail = process.env.DEV_MODE_ADMIN_EMAIL || "admin@finx.local";
const defaultAdminPassword =
  process.env.DEV_MODE_ADMIN_PASSWORD || require("crypto").randomBytes(16).toString("hex");
const seedUsers = [
  {
    email: defaultAdminEmail,
    password: defaultAdminPassword,
    is_admin: true,
  },
];

const sampleCategories = [
  { name: "Essen" }, // Food in German
  { name: "Transport" },
  { name: "Unterhaltung" }, // Entertainment in German
  { name: "Versorgung" }, // Utilities in German
  { name: "Einkaufen" }, // Shopping in German
];

const sampleSources = [
  { name: "Arbeitgeber" }, // Employer in German
  { name: "Bank" }, // Bank as source for expenses
];

const sampleTargets = [
  { name: "Supermarkt" }, // Supermarket in German
  { name: "Restaurant" },
  { name: "Tankstelle" }, // Gas station in German
  { name: "ÖPNV" }, // Public transportation in German
  { name: "Kino" }, // Cinema in German
  { name: "Veranstaltungsort" }, // Venue in German
  { name: "Energieversorger" }, // Energy provider in German
  { name: "Bank" }, // Bank as target
];

const sampleTransactions = [
  // Current month transactions
  {
    user_id: 1,
    category_name: "Essen",
    source_name: "Bank",
    target_name: "Supermarkt",
    amount: 50.0,
    type: "expense",
    description: "Wöchentliche Lebensmittel",
    date: new Date().toISOString().split("T")[0],
  }, // Weekly groceries in German
  {
    user_id: 1,
    category_name: "Essen",
    source_name: "Bank",
    target_name: "Restaurant",
    amount: 30.0,
    type: "expense",
    description: "Essen mit Freunden",
    date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
  }, // Dinner with friends in German
  {
    user_id: 1,
    category_name: "Transport",
    source_name: "Bank",
    target_name: "Tankstelle",
    amount: 40.0,
    type: "expense",
    description: "Benzin für Auto",
    date: new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0],
  }, // Gas for car in German
  {
    user_id: 1,
    category_name: "Transport",
    source_name: "Bank",
    target_name: "ÖPNV",
    amount: 25.0,
    type: "expense",
    description: "Monatliche Fahrkarte",
    date: new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0],
  }, // Monthly transit pass in German
  {
    user_id: 1,
    category_name: "Unterhaltung",
    source_name: "Bank",
    target_name: "Kino",
    amount: 20.0,
    type: "expense",
    description: "Kinokarten",
    date: new Date(Date.now() - 4 * 86400000).toISOString().split("T")[0],
  }, // Movie tickets in German
  {
    user_id: 1,
    category_name: "Unterhaltung",
    source_name: "Bank",
    target_name: "Veranstaltungsort",
    amount: 100.0,
    type: "expense",
    description: "Konzertkarten",
    date: new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0],
  }, // Concert tickets in German
  {
    user_id: 1,
    category_name: "Versorgung",
    source_name: "Bank",
    target_name: "Energieversorger",
    amount: 80.0,
    type: "expense",
    description: "Stromrechnung",
    date: new Date(Date.now() - 6 * 86400000).toISOString().split("T")[0],
  }, // Electricity bill in German
  // Previous month transactions
  {
    user_id: 1,
    category_name: "Essen",
    source_name: "Bank",
    target_name: "Supermarkt",
    amount: 45.0,
    type: "expense",
    description: "Wöchentliche Lebensmittel",
    date: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
  }, // Weekly groceries in German
  {
    user_id: 1,
    category_name: "Transport",
    source_name: "Bank",
    target_name: "Tankstelle",
    amount: 38.0,
    type: "expense",
    description: "Benzin für Auto",
    date: new Date(Date.now() - 31 * 86400000).toISOString().split("T")[0],
  }, // Gas for car in German
  {
    user_id: 1,
    category_name: "Essen",
    source_name: "Arbeitgeber",
    target_name: "Bank",
    amount: 1500.0,
    type: "income",
    description: "Gehalt",
    date: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
  }, // Salary in German
];

async function initDatabase() {
  const credentials = [];
  try {
    console.log("Initializing database with schema and sample data...");

    // 1) Ensure base schema exists (run init.sql if present) for brand-new installs only
    try {
      const fsSync = require("fs");
      const path = require("path");
      const initSqlPath = path.join(__dirname, "../database/init.sql");
      if (fsSync.existsSync(initSqlPath)) {
        // Check if 'users' table exists; if it does, skip init.sql to avoid destructive statements
        const usersTable = await pool.query(
          `SELECT 1 FROM information_schema.tables WHERE table_name = 'users' LIMIT 1`,
        );
        if (usersTable.rowCount === 0) {
          console.log(
            "Applying base schema from database/init.sql (fresh install detected)...",
          );
          const initSql = fsSync.readFileSync(initSqlPath, "utf8");
          await pool.query(initSql);
          console.log("Base schema applied.");
        } else {
          console.log(
            "Users table exists; skipping base schema application (init.sql)",
          );
        }
      } else {
        console.log("No database/init.sql found, skipping base schema step.");
      }
    } catch (e) {
      console.log(
        "Base schema step encountered an issue; continuing...",
        e.message,
      );
    }

    // 2) Run migrations to ensure all required tables/columns exist (idempotent)
    try {
      console.log("Running migrations to ensure latest schema...");
      const { execFile } = require("child_process");
      const path = require("path");
      await new Promise((resolve, reject) => {
        const nodePath = process.execPath;
        const migrateScript = path.join(__dirname, "migrate-db.js");
        execFile(
          nodePath,
          [migrateScript],
          { cwd: path.join(__dirname, "..") },
          (error, stdout, stderr) => {
            if (stdout) process.stdout.write(stdout);
            if (stderr) process.stderr.write(stderr);
            if (error) return reject(error);
            resolve();
          },
        );
      });
      console.log("Migrations completed.");
    } catch (e) {
      console.warn(
        "Migration step failed; continuing with seeding if possible:",
        e.message,
      );
    }

    console.log("Initializing database with sample data...");

    const adminUser = seedUsers[0];

    // Check if any admin user already exists
    let isEmptyDatabase = true;
    let existingAdmin = { rowCount: 0 };

    try {
      const userCount = await pool.query("SELECT COUNT(*) FROM users");
      isEmptyDatabase = parseInt(userCount.rows[0].count) === 0;

      if (!isEmptyDatabase) {
        console.log("Checking if database initialization is required...");
        console.log("Running query: SELECT 1 FROM users WHERE is_admin = true");
        existingAdmin = await pool.query(
          "SELECT 1 FROM users WHERE is_admin = true",
        );
      }
    } catch (error) {
      // If users table doesn't exist (error code 42P01), treat as empty database
      if (error.code === "42P01") {
        console.log("Users table not found - treating as empty database");
        isEmptyDatabase = true;
      } else {
        throw error;
      }
    }

    // Ensure an admin user exists; prefer the env-specified email/password if provided
  if (isEmptyDatabase || existingAdmin.rowCount === 0) {
      console.log("No admin user found. Creating admin user...");
      const hashedPassword = await bcrypt.hash(adminUser.password, 12);

      try {
        await pool.query(
          `INSERT INTO users (email, password_hash, is_admin)
           VALUES ($1, $2, $3)`,
          [adminUser.email, hashedPassword, adminUser.is_admin],
        );
      } catch (error) {
        console.error("Error creating admin user:", error.message);
        // Still return credentials if they were generated
        process.stdout.write(JSON.stringify(credentials));
        return credentials;
      }

      credentials.push({
        email: adminUser.email,
        password: adminUser.password,
      });

      // Output credentials in user-friendly format
      console.log("\n📝 Admin Credentials:");
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Password: ${adminUser.password}\n`);
    } else {
      console.log("Admin user already exists - ensuring dev admin credentials (development only)");
      // In development, ensure the configured dev admin exists and has the expected password
      if ((process.env.NODE_ENV || "development") !== "production" && process.env.DEV_MODE_ADMIN_EMAIL) {
        const email = process.env.DEV_MODE_ADMIN_EMAIL;
        const pwd = defaultAdminPassword;
        const existingEnvAdmin = await pool.query(
          "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
          [email],
        );
        const hashed = await bcrypt.hash(pwd, 12);
        try {
          if (existingEnvAdmin.rowCount === 0) {
            console.log(`Creating dev admin ${email} from environment...`);
            await pool.query(
              `INSERT INTO users (email, password_hash, is_admin)
               VALUES ($1, $2, true)`,
              [email, hashed],
            );
          } else {
            console.log(`Resetting password for dev admin ${email} (development only)...`);
            await pool.query(
              `UPDATE users SET password_hash = $2, is_admin = true WHERE LOWER(email) = LOWER($1)`,
              [email, hashed],
            );
          }
          credentials.push({ email, password: pwd });
          console.log("\n📝 Dev Admin Credentials:");
          console.log(`   Email: ${email}`);
          console.log(`   Password: ${pwd}\n`);
        } catch (e) {
          console.error("Error ensuring dev admin credentials:", e.message);
        }
      }
    }

    // Removed duplicate credentials display

    // Get admin user ID for sample data
    const adminUserResult = await pool.query(
      "SELECT id FROM users WHERE is_admin = true LIMIT 1",
    );
    const adminUserId = adminUserResult.rows[0]?.id;
    // Use admin user ID for sample data
    const sampleUserId = adminUserId;

    // Only create sample data if database was empty
    if (isEmptyDatabase) {
      console.log("Creating sample categories...");
      for (const category of sampleCategories) {
        try {
          await pool.query(
            "INSERT INTO categories (user_id, name, is_sample) VALUES ($1, $2, true) ON CONFLICT DO NOTHING",
            [sampleUserId, category.name],
          );
        } catch (error) {
          console.error("Error creating sample category:", error.message);
        }
      }

      console.log("Creating sample sources...");
      for (const source of sampleSources) {
        try {
          await pool.query(
            "INSERT INTO sources (user_id, name, is_sample) VALUES ($1, $2, true) ON CONFLICT DO NOTHING",
            [sampleUserId, source.name],
          );
        } catch (error) {
          console.error("Error creating sample source:", error.message);
        }
      }

      console.log("Creating sample targets...");
      for (const target of sampleTargets) {
        try {
          await pool.query(
            "INSERT INTO targets (user_id, name, is_sample) VALUES ($1, $2, true) ON CONFLICT DO NOTHING",
            [sampleUserId, target.name],
          );
        } catch (error) {
          console.error("Error creating sample target:", error.message);
        }
      }
    }

    // Get category IDs for admin user
    const categoryResult = await pool.query(
      "SELECT id, name FROM categories WHERE user_id = $1",
      [sampleUserId],
    );
    const categoryMap = {};
    categoryResult.rows.forEach((row) => {
      categoryMap[row.name] = row.id;
    });

    // Get source IDs for admin user
    const sourceResult = await pool.query(
      "SELECT id, name FROM sources WHERE user_id = $1",
      [sampleUserId],
    );
    const sourceMap = {};
    sourceResult.rows.forEach((row) => {
      sourceMap[row.name] = row.id;
    });

    // Get target IDs for admin user
    const targetResult = await pool.query(
      "SELECT id, name FROM targets WHERE user_id = $1",
      [sampleUserId],
    );
    const targetMap = {};
    targetResult.rows.forEach((row) => {
      targetMap[row.name] = row.id;
    });

    // Only create sample transactions if database was empty
    if (isEmptyDatabase) {
      console.log("Creating sample transactions...");
      for (const transaction of sampleTransactions) {
        // Map category names to IDs
        const categoryId = categoryMap[transaction.category_name];
        const sourceId = sourceMap[transaction.source_name];
        const targetId = targetMap[transaction.target_name];

        if (categoryId && sourceId && targetId) {
          await pool.query(
            "INSERT INTO transactions (user_id, category_id, source_id, target_id, amount, type, description, date, is_sample) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) ON CONFLICT DO NOTHING",
            [
              sampleUserId,
              categoryId,
              sourceId,
              targetId,
              transaction.amount,
              transaction.type,
              transaction.description,
              transaction.date,
            ],
          );
        } else {
          console.warn(
            `Sample category ${transaction.category_name}, source ${transaction.source_name}, or target ${transaction.target_name} not found, skipping transaction`,
          );
        }
      }
    }

    console.log("Database initialized successfully!");
  } catch (error) {
    console.error("Error initializing database:", error);
  } finally {
    await pool.end();
  }

  return credentials;
}

// Run the initialization
initDatabase();
