const { processRecurringJobs } = require("../services/recurringProcessor");

/**
 * Manually trigger the recurring processor
 */
async function runProcessor() {
  try {
    console.log("🔄 Manually triggering recurring processor...\n");
    const stats = await processRecurringJobs();
    console.log("\n✅ Recurring processor completed successfully!");
    console.log("Stats:", stats);
    console.log("\n📊 Summary:");
    console.log(`   - Transactions created: ${stats.created}`);
    console.log(`   - Skipped (future): ${stats.skippedFuture}`);
    console.log(`   - Exhausted: ${stats.exhausted}`);
    console.log(`   - Errors: ${stats.errors}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error running recurring processor:", error);
    process.exit(1);
  }
}

runProcessor();
