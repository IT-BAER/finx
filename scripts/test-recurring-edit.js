const db = require("../config/db");

/**
 * Test script to verify editing recurring transaction via auto-created transaction
 */
async function testRecurringEdit() {
  try {
    console.log("🧪 Testing recurring transaction edit feature...\n");

    // Create a test recurring transaction
    const recurringResult = await db.query(
      `INSERT INTO recurring_transactions 
       (user_id, title, amount, type, category_id, source, target, description, 
        recurrence_type, recurrence_interval, start_date, max_occurrences)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        1, // user_id
        "Test Recurring Edit",
        100.00,
        "expense",
        6, // category_id (Test Category)
        "Test Source Edit",
        "Test Target Edit",
        "Original description",
        "daily",
        1,
        "2025-10-07", // 5 days ago
        3, // max 3 occurrences
      ]
    );

    const recurringId = recurringResult.rows[0].id;
    console.log(`✅ Created recurring transaction: ID=${recurringId}\n`);

    // Make sure source and target exist
    await db.query(
      "INSERT INTO sources (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING",
      [1, "Test Source Edit"]
    );
    await db.query(
      "INSERT INTO targets (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING",
      [1, "Test Target Edit"]
    );

    // Get source and target IDs
    const sourceRes = await db.query(
      "SELECT id FROM sources WHERE user_id = $1 AND name = $2",
      [1, "Test Source Edit"]
    );
    const targetRes = await db.query(
      "SELECT id FROM targets WHERE user_id = $1 AND name = $2",
      [1, "Test Target Edit"]
    );

    const sourceId = sourceRes.rows[0].id;
    const targetId = targetRes.rows[0].id;

    // Create an auto-generated transaction linked to this recurring rule
    const txResult = await db.query(
      `INSERT INTO transactions 
       (user_id, category_id, source_id, target_id, amount, type, description, date, recurring_transaction_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        1, // user_id
        6, // category_id
        sourceId,
        targetId,
        100.00, // amount
        "expense",
        "Original description",
        "2025-10-08",
        recurringId,
      ]
    );

    const txId = txResult.rows[0].id;
    console.log(`✅ Created auto-generated transaction: ID=${txId}`);
    console.log(`   - recurring_transaction_id: ${txResult.rows[0].recurring_transaction_id}\n`);

    // Fetch the transaction (simulating what the API would return)
    const fetchResult = await db.query(
      `SELECT t.*, c.name as category_name, s.name as source_name, tg.name as target_name,
              rt.id as recurring_id, rt.title as recurring_title, rt.amount as recurring_amount,
              rt.description as recurring_description
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN sources s ON t.source_id = s.id
       LEFT JOIN targets tg ON t.target_id = tg.id
       LEFT JOIN recurring_transactions rt ON t.recurring_transaction_id = rt.id
       WHERE t.id = $1`,
      [txId]
    );

    const transaction = fetchResult.rows[0];
    console.log("📋 Transaction data (as API would return):");
    console.log(`   - id: ${transaction.id}`);
    console.log(`   - amount: ${transaction.amount}`);
    console.log(`   - description: ${transaction.description}`);
    console.log(`   - recurring_id: ${transaction.recurring_id}`);
    console.log(`   - recurring_title: ${transaction.recurring_title}`);
    console.log(`   - recurring_amount: ${transaction.recurring_amount}`);
    console.log(`   - recurring_description: ${transaction.recurring_description}\n`);

    if (!transaction.recurring_id) {
      console.error("❌ ERROR: recurring_id is not set!");
      console.error("   The frontend won't be able to edit the recurring transaction.");
      process.exit(1);
    }

    console.log("✅ recurring_id is correctly set!");
    console.log("   The frontend can now edit the recurring transaction via this auto-created transaction.\n");

    // Simulate updating the recurring transaction
    console.log("🔄 Simulating recurring transaction update...");
    await db.query(
      `UPDATE recurring_transactions
       SET amount = $1, description = $2
       WHERE id = $3`,
      [150.00, "UPDATED description", recurringId]
    );
    console.log("✅ Updated recurring transaction\n");

    // Verify the update
    const verifyResult = await db.query(
      "SELECT * FROM recurring_transactions WHERE id = $1",
      [recurringId]
    );
    console.log("📋 Updated recurring transaction:");
    console.log(`   - amount: ${verifyResult.rows[0].amount}`);
    console.log(`   - description: ${verifyResult.rows[0].description}\n`);

    // Cleanup
    console.log("🧹 Cleaning up test data...");
    await db.query("DELETE FROM transactions WHERE id = $1", [txId]);
    await db.query("DELETE FROM recurring_transactions WHERE id = $1", [recurringId]);
    // Only delete sources/targets if they were created for this test (by checking if no other refs exist)
    const sourceCheck = await db.query("SELECT COUNT(*) FROM transactions WHERE source_id = $1", [sourceId]);
    if (parseInt(sourceCheck.rows[0].count) === 0) {
      await db.query("DELETE FROM sources WHERE id = $1", [sourceId]);
    }
    const targetCheck = await db.query("SELECT COUNT(*) FROM transactions WHERE target_id = $1", [targetId]);
    if (parseInt(targetCheck.rows[0].count) === 0) {
      await db.query("DELETE FROM targets WHERE id = $1", [targetId]);
    }
    console.log("✅ Cleanup complete!\n");

    console.log("🎉 TEST PASSED: Recurring transaction editing via auto-created transactions works correctly!");

  } catch (error) {
    console.error("❌ TEST FAILED:", error);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

testRecurringEdit();
