const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function cleanupSampleData() {
  try {
    console.log("Cleaning up sample data...");

    // Remove admin user ID check - delete all sample data regardless of owner

    // Delete all sample transactions
    await pool.query("DELETE FROM transactions WHERE is_sample = true");

    // Delete all sample categories
    await pool.query("DELETE FROM categories WHERE is_sample = true");

    // Delete all sample sources
    await pool.query("DELETE FROM sources WHERE is_sample = true");

    // Delete all sample targets
    await pool.query("DELETE FROM targets WHERE is_sample = true");

    // Also delete sample data from admin user's tables
    const adminUser = await pool.query(
      "SELECT id FROM users WHERE is_admin = true LIMIT 1",
    );
    const adminUserId = adminUser.rows[0]?.id;

    if (adminUserId) {
      await pool.query(
        "DELETE FROM transactions WHERE user_id = $1 AND is_sample = true",
        [adminUserId],
      );
      await pool.query(
        "DELETE FROM categories WHERE user_id = $1 AND is_sample = true",
        [adminUserId],
      );
      await pool.query(
        "DELETE FROM sources WHERE user_id = $1 AND is_sample = true",
        [adminUserId],
      );
      await pool.query(
        "DELETE FROM targets WHERE user_id = $1 AND is_sample = true",
        [adminUserId],
      );
    }

    console.log("Sample data cleanup completed!");
  } catch (error) {
    console.error("Error cleaning up sample data:", error);
  } finally {
    await pool.end();
  }
}

module.exports = cleanupSampleData;
