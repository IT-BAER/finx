const db = require("../config/db");
const Transaction = require("../models/Transaction");
const RecurringTransaction = require("../models/RecurringTransaction");

/**
 * Test the getTransactionById API logic
 */
async function testGetTransactionById() {
  try {
    console.log("🧪 Testing getTransactionById with auto-created transaction...\n");

    // Create a test recurring transaction
    const recurringResult = await db.query(
      `INSERT INTO recurring_transactions 
       (user_id, title, amount, type, category_id, source, target, description, 
        recurrence_type, recurrence_interval, start_date, max_occurrences)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [1, "API Test Recurring", 200.00, "expense", 6, "API Test Source", "API Test Target", 
       "Test description", "monthly", 1, "2025-10-01", 3]
    );

    const recurringId = recurringResult.rows[0].id;
    console.log(`✅ Created recurring transaction: ID=${recurringId}`);

    // Create source and target
    await db.query(
      "INSERT INTO sources (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING",
      [1, "API Test Source"]
    );
    await db.query(
      "INSERT INTO targets (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING",
      [1, "API Test Target"]
    );
    const sourceRes = await db.query("SELECT id FROM sources WHERE user_id = $1 AND name = $2", [1, "API Test Source"]);
    const targetRes = await db.query("SELECT id FROM targets WHERE user_id = $1 AND name = $2", [1, "API Test Target"]);

    // Create an auto-created transaction
    const txResult = await db.query(
      `INSERT INTO transactions 
       (user_id, category_id, source_id, target_id, amount, type, description, date, recurring_transaction_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [1, 6, sourceRes.rows[0].id, targetRes.rows[0].id, 200.00, "expense", 
       "Test description", "2025-10-05", recurringId]
    );

    const txId = txResult.rows[0].id;
    console.log(`✅ Created auto-created transaction: ID=${txId}`);
    console.log(`   - recurring_transaction_id: ${txResult.rows[0].recurring_transaction_id}\n`);

    // Simulate the controller logic
    console.log("🔄 Simulating controller getTransactionById logic...\n");

    const transaction = await Transaction.findById(txId);
    console.log("Transaction object from findById:");
    console.log(`   - id: ${transaction.id}`);
    console.log(`   - recurring_transaction_id: ${transaction.recurring_transaction_id}`);

    // Check for associated recurring transaction
    let recurringTransaction = await RecurringTransaction.findByTransactionId(txId);
    console.log(`\nRecurringTransaction.findByTransactionId(${txId}):`, recurringTransaction ? "FOUND" : "NULL");
    
    if (!recurringTransaction && transaction.recurring_transaction_id) {
      console.log(`\nTransaction has recurring_transaction_id=${transaction.recurring_transaction_id}`);
      console.log("Fetching recurring transaction by ID...");
      recurringTransaction = await RecurringTransaction.findById(transaction.recurring_transaction_id);
      console.log("RecurringTransaction.findById result:", recurringTransaction ? "FOUND" : "NULL");
    }

    // Final response
    const response = {
      success: true,
      transaction: {
        ...transaction,
        recurring: recurringTransaction || null,
      },
    };

    console.log("\n📋 Final API Response:");
    console.log(JSON.stringify(response, null, 2));

    if (response.transaction.recurring) {
      console.log("\n✅ SUCCESS: transaction.recurring is populated!");
      console.log(`   - recurring.id: ${response.transaction.recurring.id}`);
      console.log(`   - recurring.title: ${response.transaction.recurring.title}`);
    } else {
      console.log("\n❌ ERROR: transaction.recurring is NULL!");
      console.log("   The frontend won't see the recurring data!");
    }

    // Cleanup
    console.log("\n🧹 Cleaning up...");
    await db.query("DELETE FROM transactions WHERE id = $1", [txId]);
    await db.query("DELETE FROM recurring_transactions WHERE id = $1", [recurringId]);
    const sourceCheck = await db.query("SELECT COUNT(*) FROM transactions WHERE source_id = $1", [sourceRes.rows[0].id]);
    if (parseInt(sourceCheck.rows[0].count) === 0) {
      await db.query("DELETE FROM sources WHERE id = $1", [sourceRes.rows[0].id]);
    }
    const targetCheck = await db.query("SELECT COUNT(*) FROM transactions WHERE target_id = $1", [targetRes.rows[0].id]);
    if (parseInt(targetCheck.rows[0].count) === 0) {
      await db.query("DELETE FROM targets WHERE id = $1", [targetRes.rows[0].id]);
    }
    console.log("✅ Cleanup complete!");

  } catch (error) {
    console.error("❌ TEST FAILED:", error);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

testGetTransactionById();
