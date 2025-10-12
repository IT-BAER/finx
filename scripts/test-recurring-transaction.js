const db = require("../config/db");
const RecurringTransaction = require("../models/RecurringTransaction");

/**
 * Create a test recurring transaction that will auto-create after 1 minute
 * This is for testing/debugging the recurring processor fix
 */
async function createTestRecurringTransaction() {
  try {
    console.log("Creating test recurring transaction...");

    // Find the first user (or you can specify a user_id)
    const userResult = await db.query("SELECT id, email FROM users LIMIT 1");
    if (userResult.rows.length === 0) {
      console.error("No users found in the database. Please create a user first.");
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log(`Using user: ${user.email} (ID: ${user.id})`);

    // Find or create a test category
    let categoryResult = await db.query(
      "SELECT id, name FROM categories WHERE user_id = $1 AND name = $2 LIMIT 1",
      [user.id, "Test Category"],
    );

    let category_id;
    if (categoryResult.rows.length > 0) {
      category_id = categoryResult.rows[0].id;
      console.log(`Using existing category: ${categoryResult.rows[0].name} (ID: ${category_id})`);
    } else {
      const newCategory = await db.query(
        "INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING id, name",
        [user.id, "Test Category"],
      );
      category_id = newCategory.rows[0].id;
      console.log(`Created new category: ${newCategory.rows[0].name} (ID: ${category_id})`);
    }

    // Create recurring transaction with daily recurrence and 1-minute interval (for testing)
    // Set start_date to 5 days ago so we can test multiple sequential auto-created transactions
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const startDateStr = fiveDaysAgo.toISOString().split("T")[0]; // YYYY-MM-DD format

    const recurringTx = await RecurringTransaction.create(
      user.id,
      "Test Recurring Transaction", // title
      99.99, // amount
      "expense", // type
      category_id, // category_id
      "Test Source", // source (name)
      "Test Target", // target (name)
      "This is a test recurring transaction to verify category/source/target are properly created", // description
      "daily", // recurrence_type
      1, // recurrence_interval
      startDateStr, // start_date (2 minutes ago, so it's eligible for processing)
      null, // end_date
      5, // max_occurrences (create 5 test transactions)
      null, // transaction_id
    );

    console.log("\n✅ Test recurring transaction created successfully!");
    console.log("Details:");
    console.log(`  - ID: ${recurringTx.id}`);
    console.log(`  - Title: ${recurringTx.title}`);
    console.log(`  - Amount: ${recurringTx.amount}`);
    console.log(`  - Type: ${recurringTx.type}`);
    console.log(`  - Category ID: ${recurringTx.category_id}`);
    console.log(`  - Source: ${recurringTx.source}`);
    console.log(`  - Target: ${recurringTx.target}`);
    console.log(`  - Recurrence: ${recurringTx.recurrence_type} (every ${recurringTx.recurrence_interval} day)`);
    console.log(`  - Start Date: ${recurringTx.start_date}`);
    console.log(`  - Max Occurrences: ${recurringTx.max_occurrences}`);
    console.log(`  - Occurrences Created: ${recurringTx.occurrences_created || 0}`);

    console.log("\n📋 Next Steps:");
    console.log("  1. The recurring processor should pick this up within the next minute");
    console.log("  2. Watch the backend logs for: 'Recurring processor: created transaction...'");
    console.log("  3. Check that the created transaction has category_id, source_id, and target_id set");
    console.log("  4. You can also query the database:");
    console.log(`     SELECT id, category_id, source_id, target_id, amount, description, date`);
    console.log(`     FROM transactions WHERE user_id = ${user.id} ORDER BY id DESC LIMIT 5;`);

    console.log("\n🧹 Cleanup:");
    console.log(`  To remove this test recurring transaction, run:`);
    console.log(`  DELETE FROM recurring_transactions WHERE id = ${recurringTx.id};`);

  } catch (error) {
    console.error("Error creating test recurring transaction:", error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Run the script
createTestRecurringTransaction();
