const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function cleanupIncomeSources() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log("🔍 Analyzing income source pollution...");
    
    // Step 1: Find sources that are ONLY used in income transactions
    // These were likely created incorrectly when adding income transactions
    const incomeOnlySourcesQuery = `
      SELECT DISTINCT s.id, s.name, s.user_id, 
             COUNT(t_income.id) as income_usage,
             COUNT(t_expense.id) as expense_usage
      FROM sources s
      LEFT JOIN transactions t_income ON s.id = t_income.source_id AND t_income.type = 'income'
      LEFT JOIN transactions t_expense ON s.id = t_expense.source_id AND t_expense.type = 'expense'
      WHERE s.is_sample = false
      GROUP BY s.id, s.name, s.user_id
      HAVING COUNT(t_income.id) > 0 AND COUNT(t_expense.id) = 0
      ORDER BY s.user_id, s.name;
    `;
    
    const incomeOnlySourcesResult = await client.query(incomeOnlySourcesQuery);
    const incomeOnlySources = incomeOnlySourcesResult.rows;
    
    console.log(`📊 Found ${incomeOnlySources.length} sources used ONLY in income transactions:`);
    incomeOnlySources.forEach(source => {
      console.log(`   - User ${source.user_id}: "${source.name}" (${source.income_usage} income transactions)`);
    });
    
    if (incomeOnlySources.length === 0) {
      console.log("✅ No income source pollution detected. Your installation is clean!");
      await client.query('ROLLBACK');
      return;
    }
    
    // Step 2: For each income-only source, check if there's a corresponding target with the same name
    // If so, these transactions should probably use the target instead
    console.log("\n🔄 Analyzing potential target matches...");
    
    let migratedCount = 0;
    let deletedSourcesCount = 0;
    
    for (const source of incomeOnlySources) {
      // Check if there's a target with the same name for this user
      const targetQuery = `
        SELECT id FROM targets 
        WHERE user_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))
        LIMIT 1;
      `;
      
      const targetResult = await client.query(targetQuery, [source.user_id, source.name]);
      
      if (targetResult.rows.length > 0) {
        const targetId = targetResult.rows[0].id;
        
        console.log(`   🔄 Migrating "${source.name}" from source to target for user ${source.user_id}`);
        
        // Update all income transactions that use this source to use the corresponding target instead
        // Since our frontend now swaps fields for income, we need to move from source_id to target_id
        const updateQuery = `
          UPDATE transactions 
          SET target_id = $1, source_id = NULL
          WHERE source_id = $2 AND type = 'income' AND user_id = $3;
        `;
        
        const updateResult = await client.query(updateQuery, [targetId, source.id, source.user_id]);
        migratedCount += updateResult.rowCount;
        
        console.log(`     ✅ Migrated ${updateResult.rowCount} transactions`);
        
        // Now delete the orphaned source
        const deleteSourceQuery = `DELETE FROM sources WHERE id = $1;`;
        await client.query(deleteSourceQuery, [source.id]);
        deletedSourcesCount++;
        
        console.log(`     🗑️  Deleted orphaned source "${source.name}"`);
        
      } else {
        // No matching target found - convert the source to a target
        console.log(`   📝 Converting source "${source.name}" to target for user ${source.user_id}`);
        
        // Create a new target with the same name
        const createTargetQuery = `
          INSERT INTO targets (user_id, name, is_sample)
          VALUES ($1, $2, false)
          RETURNING id;
        `;
        
        const newTargetResult = await client.query(createTargetQuery, [source.user_id, source.name]);
        const newTargetId = newTargetResult.rows[0].id;
        
        // Update transactions to use the new target
        const updateQuery = `
          UPDATE transactions 
          SET target_id = $1, source_id = NULL
          WHERE source_id = $2 AND type = 'income' AND user_id = $3;
        `;
        
        const updateResult = await client.query(updateQuery, [newTargetId, source.id, source.user_id]);
        migratedCount += updateResult.rowCount;
        
        console.log(`     ✅ Created target and migrated ${updateResult.rowCount} transactions`);
        
        // Delete the original source
        const deleteSourceQuery = `DELETE FROM sources WHERE id = $1;`;
        await client.query(deleteSourceQuery, [source.id]);
        deletedSourcesCount++;
        
        console.log(`     🗑️  Deleted original source "${source.name}"`);
      }
    }
    
    // Step 3: Check for any remaining inconsistencies
    console.log("\n🔍 Checking for remaining inconsistencies...");
    
    const remainingIssuesQuery = `
      SELECT COUNT(*) as count
      FROM transactions t
      JOIN sources s ON t.source_id = s.id
      WHERE t.type = 'income' AND t.source_id IS NOT NULL;
    `;
    
    const remainingResult = await client.query(remainingIssuesQuery);
    const remainingIssues = parseInt(remainingResult.rows[0].count);
    
    if (remainingIssues > 0) {
      console.log(`⚠️  Warning: ${remainingIssues} income transactions still have source_id set`);
      console.log("   This might be expected if these sources are also used for expenses");
    } else {
      console.log("✅ All income transactions now have proper field mapping");
    }
    
    await client.query('COMMIT');
    
    console.log("\n🎉 Migration completed successfully!");
    console.log(`📈 Summary:`);
    console.log(`   - Migrated ${migratedCount} income transactions`);
    console.log(`   - Deleted ${deletedSourcesCount} orphaned sources`);
    console.log(`   - Income sources no longer pollute expense source dropdowns`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Error during migration:", error);
    throw error;
  } finally {
    client.release();
  }
}

async function analyzeOnly() {
  try {
    console.log("🔍 ANALYSIS MODE - No changes will be made");
    console.log("=====================================\n");
    
    // Test database connection first
    const testClient = await pool.connect();
    testClient.release();
    
    // Find sources that are ONLY used in income transactions
    const incomeOnlySourcesQuery = `
      SELECT DISTINCT s.id, s.name, s.user_id, 
             COUNT(t_income.id) as income_usage,
             COUNT(t_expense.id) as expense_usage
      FROM sources s
      LEFT JOIN transactions t_income ON s.id = t_income.source_id AND t_income.type = 'income'
      LEFT JOIN transactions t_expense ON s.id = t_expense.source_id AND t_expense.type = 'expense'
      WHERE s.is_sample = false
      GROUP BY s.id, s.name, s.user_id
      HAVING COUNT(t_income.id) > 0 AND COUNT(t_expense.id) = 0
      ORDER BY s.user_id, s.name;
    `;
    
    const result = await pool.query(incomeOnlySourcesQuery);
    const problematicSources = result.rows;
    
    console.log(`📊 Found ${problematicSources.length} sources that are ONLY used in income transactions:`);
    
    if (problematicSources.length === 0) {
      console.log("✅ No income source pollution detected. Your installation is clean!");
      return;
    }
    
    console.log("\n🎯 Problematic sources (these should be targets instead):");
    problematicSources.forEach(source => {
      console.log(`   - User ${source.user_id}: "${source.name}" (used in ${source.income_usage} income transactions)`);
    });
    
    // Check total impact
    const totalImpactQuery = `
      SELECT COUNT(*) as total_transactions
      FROM transactions t
      JOIN sources s ON t.source_id = s.id
      LEFT JOIN transactions t_expense ON s.id = t_expense.source_id AND t_expense.type = 'expense'
      WHERE t.type = 'income' AND s.is_sample = false
      GROUP BY s.id
      HAVING COUNT(t_expense.id) = 0;
    `;
    
    const impactResult = await pool.query(`
      SELECT SUM(income_count) as total_affected_transactions
      FROM (
        SELECT COUNT(t_income.id) as income_count
        FROM sources s
        LEFT JOIN transactions t_income ON s.id = t_income.source_id AND t_income.type = 'income'
        LEFT JOIN transactions t_expense ON s.id = t_expense.source_id AND t_expense.type = 'expense'
        WHERE s.is_sample = false
        GROUP BY s.id
        HAVING COUNT(t_income.id) > 0 AND COUNT(t_expense.id) = 0
      ) subquery;
    `);
    
    const totalAffected = impactResult.rows[0]?.total_affected_transactions || 0;
    console.log(`\n📈 Impact: ${totalAffected} income transactions will be migrated`);
    
    console.log("\n💡 To fix these issues, run:");
    console.log("   node scripts/cleanup-income-sources.js --fix");
    
  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error("❌ Cannot connect to database. Make sure:");
      console.error("   - Database is running");
      console.error("   - Environment variables are set correctly");
      console.error("   - You're running this from the FinX server environment");
    } else {
      console.error("❌ Error during analysis:", error);
    }
  } finally {
    await pool.end();
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--fix') || args.includes('-f')) {
    cleanupIncomeSources()
      .then(() => {
        console.log("\n✅ Cleanup completed successfully!");
        process.exit(0);
      })
      .catch((error) => {
        console.error("\n❌ Cleanup failed:", error.message);
        process.exit(1);
      })
      .finally(() => {
        pool.end();
      });
  } else {
    analyzeOnly();
  }
}

module.exports = { cleanupIncomeSources, analyzeOnly };
