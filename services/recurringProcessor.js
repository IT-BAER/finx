const db = require("../config/db");
const RecurringTransaction = require("../models/RecurringTransaction");
const Transaction = require("../models/Transaction");

/**
 * Compute the next occurrence date for a recurring entry based on recurrence_type and interval
 * recurrence_type: 'daily' | 'weekly' | 'monthly' | 'yearly'
 */
function computeNextDate(
  startDate,
  occurrencesCreated,
  recurrenceType,
  interval,
) {
  const base = new Date(startDate);
  let next = new Date(base);
  if (!Number.isInteger(occurrencesCreated)) occurrencesCreated = 0;
  const step = Number(interval) || 1;
  switch ((recurrenceType || "").toLowerCase()) {
    case "daily":
      next.setUTCDate(base.getUTCDate() + occurrencesCreated * step + step);
      break;
    case "weekly":
      next.setUTCDate(base.getUTCDate() + (occurrencesCreated * step + step) * 7);
      break;
    case "monthly":
      // Add months
      next.setUTCMonth(base.getUTCMonth() + occurrencesCreated * step + step);
      // Check for overflow (e.g., Oct 31 -> Dec 1)
      if (next.getUTCDate() !== base.getUTCDate()) {
        next.setUTCDate(0);
      }
      break;
    case "yearly":
      next.setUTCFullYear(base.getUTCFullYear() + occurrencesCreated * step + step);
      break;
    default:
      // default to monthly
      next.setUTCMonth(base.getUTCMonth() + occurrencesCreated * step + step);
      if (next.getUTCDate() !== base.getUTCDate()) {
        next.setUTCDate(0);
      }
      break;
  }
  // Normalize time to start of day
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

async function processRecurringJobs(app = null) {
  console.log("Recurring processor: scanning for due recurring entries...");

  // Process recurring rules in batches to avoid loading all rows into memory.
  // Only consider rules that could be due (start_date <= today, not ended, not exhausted).
  const now = new Date();
  const BATCH_SIZE = 200;
  let offset = 0;

  let createdCount = 0;
  let skippedFuture = 0;
  let exhausted = 0;
  let errors = 0;

  while (true) {
    const res = await db.query(
      `SELECT *
       FROM recurring_transactions
       WHERE start_date <= CURRENT_DATE
         AND (end_date IS NULL OR end_date >= CURRENT_DATE)
         AND (max_occurrences IS NULL OR occurrences_created < max_occurrences)
       ORDER BY id
       LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset],
    );

    const rows = res.rows;
    if (!rows || rows.length === 0) break;

    for (const r of rows) {
      try {
        const occurrences = r.occurrences_created || 0;
        const nextDate = computeNextDate(
          r.start_date,
          occurrences,
          r.recurrence_type,
          r.recurrence_interval || 1,
        );

        // skip if nextDate in future
        if (nextDate > now) {
          skippedFuture++;
          continue;
        }

        // check end_date and max_occurrences defensively (extra safety)
        if (r.end_date && new Date(r.end_date) < nextDate) {
          exhausted++;
          continue;
        }
        if (r.max_occurrences && occurrences >= r.max_occurrences) {
          exhausted++;
          continue;
        }

        // Check whether a transaction for this recurring id and occurrence date already exists
        const existsQ = await db.query(
          "SELECT 1 FROM transactions WHERE user_id = $1 AND amount = $2 AND date = $3 LIMIT 1",
          [r.user_id, r.amount, nextDate],
        );
        if (existsQ.rows.length > 0) {
          // Avoid duplicate creation; increment occurrences and set last_run
          await RecurringTransaction.markRun(r.id, now);
          continue;
        }

        // Create a new transaction record for this occurrence
        // Handle category: verify it exists and is valid for this user
        let category_id = null;
        if (r.category_id) {
          const categoryResult = await db.query(
            "SELECT id FROM categories WHERE id = $1 AND user_id = $2 LIMIT 1",
            [r.category_id, r.user_id],
          );
          if (categoryResult.rows.length > 0) {
            category_id = categoryResult.rows[0].id;
          } else {
            // Category was deleted or invalid; log warning and skip category
            console.error(
              `CRITICAL: Category ${r.category_id} mismatch for User ${r.user_id}, creating transaction without category`,
            );
          }
        }

        // Handle source: look up or create from name
        let source_id = null;
        if (r.source) {
          const sourceResult = await db.query(
            "SELECT id FROM sources WHERE user_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) LIMIT 1",
            [r.user_id, r.source],
          );
          if (sourceResult.rows.length > 0) {
            source_id = sourceResult.rows[0].id;
          } else {
            const newSource = await db.query(
              "INSERT INTO sources (user_id, name) VALUES ($1, $2) RETURNING id",
              [r.user_id, r.source],
            );
            source_id = newSource.rows[0].id;
          }
        }

        // Handle target: look up or create from name
        let target_id = null;
        if (r.target) {
          const targetResult = await db.query(
            "SELECT id FROM targets WHERE user_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) LIMIT 1",
            [r.user_id, r.target],
          );
          if (targetResult.rows.length > 0) {
            target_id = targetResult.rows[0].id;
          } else {
            const newTarget = await db.query(
              "INSERT INTO targets (user_id, name) VALUES ($1, $2) RETURNING id",
              [r.user_id, r.target],
            );
            target_id = newTarget.rows[0].id;
          }
        }

        const created = await Transaction.create(
          r.user_id,
          category_id,
          source_id,
          target_id,
          r.amount,
          r.type,
          r.description,
          nextDate,
          r.id, // recurring_transaction_id - links back to the recurring rule
        );

        // Link the created transaction to the recurring rule by setting transaction_id for initial record
        // Only set transaction_id if recurring.record.transaction_id is null
        if (!r.transaction_id) {
          await db.query(
            "UPDATE recurring_transactions SET transaction_id = $1 WHERE id = $2",
            [created.id, r.id],
          );
        }

        // Mark the run (increment occurrences_created and set last_run)
        await RecurringTransaction.markRun(r.id, now);
        createdCount++;

        console.log(
          `Recurring processor: created transaction ${created.id} for recurring ${r.id} on ${nextDate.toISOString().substring(0, 10)} (category: ${category_id || "none"}, source: ${source_id || "none"}, target: ${target_id || "none"})`,
        );
        // Notify via SSE (best-effort)
        try {
          const sse = app && app.get ? app.get("sse") : null;
          if (sse) {
            sse.broadcastToUser(r.user_id, { type: "transaction:create", transactionId: created.id, ownerId: r.user_id, at: Date.now(), source: "recurring" });
            sse.broadcast({ type: "dashboard:summaryHint", ownerId: r.user_id, at: Date.now() });
          }
        } catch (e) { }
      } catch (e) {
        console.error("Error processing recurring entry", r.id, e);
        errors++;
      }
    }

    // If we received less than a full batch, we've reached the end.
    if (rows.length < BATCH_SIZE) break;
    offset += rows.length;
  }
  return { created: createdCount, skippedFuture, exhausted, errors };
}

module.exports = {
  processRecurringJobs,
  computeNextDate,
};
