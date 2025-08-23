const db = require("../config/db");

class RecurringTransaction {
  static async create(
    user_id,
    title,
    amount,
    type,
    category_id,
    source,
    target,
    description,
    recurrence_type,
    recurrence_interval,
    start_date,
    end_date,
    max_occurrences,
    transaction_id,
  ) {
    const result = await db.query(
      `INSERT INTO recurring_transactions (
        user_id,
        title,
        amount,
        type,
        category_id,
        source,
        target,
        description,
        recurrence_type,
        recurrence_interval,
        start_date,
        end_date,
        max_occurrences,
        transaction_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        user_id,
        title,
        amount,
        type,
        category_id,
        source,
        target,
        description,
        recurrence_type,
        recurrence_interval,
        start_date,
        end_date,
        max_occurrences,
        transaction_id,
      ],
    );
    return result.rows[0];
  }

  static async markRun(id, runTimestamp) {
    const result = await db.query(
      `UPDATE recurring_transactions
       SET last_run = $1, occurrences_created = occurrences_created + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [runTimestamp, id],
    );
    return result.rows[0];
  }

  static async incrementOccurrences(id, count = 1) {
    const result = await db.query(
      `UPDATE recurring_transactions
       SET occurrences_created = occurrences_created + $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [count, id],
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await db.query(
      "SELECT * FROM recurring_transactions WHERE id = $1",
      [id],
    );
    return result.rows[0];
  }

  // Find recurring transaction by ID for a specific user (ownership enforced)
  static async findByIdForUser(id, user_id) {
    const result = await db.query(
      "SELECT * FROM recurring_transactions WHERE id = $1 AND user_id = $2",
      [id, user_id],
    );
    return result.rows[0] || null;
  }

  // Update recurring transaction for a specific user (ownership enforced)
  static async updateByUser(id, user_id, updates) {
    const allowed = [
      "title",
      "amount",
      "type",
      "category_id",
      "source",
      "target",
      "description",
      "recurrence_type",
      "recurrence_interval",
      "start_date",
      "end_date",
      "max_occurrences",
    ];

    const sets = [];
    const params = [];
    let idx = 1;
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        sets.push(`${key} = $${idx++}`);
        params.push(updates[key]);
      }
    }

    if (sets.length === 0) {
      // nothing to update; return current row
      const cur = await db.query(
        `SELECT * FROM recurring_transactions WHERE id = $1 AND user_id = $2`,
        [id, user_id],
      );
      return cur.rows[0] || null;
    }

    const result = await db.query(
      `UPDATE recurring_transactions
       SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${idx} AND user_id = $${idx + 1}
       RETURNING *`,
      [...params, id, user_id],
    );
    return result.rows[0] || null;
  }

  // Delete recurring transaction for a specific user (ownership enforced)
  static async deleteByUser(id, user_id) {
    const result = await db.query(
      "DELETE FROM recurring_transactions WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, user_id],
    );
    return result.rows[0] || null;
  }

  static async findByTransactionId(transactionId) {
    const result = await db.query(
      "SELECT * FROM recurring_transactions WHERE transaction_id = $1",
      [transactionId],
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  static async update(id, updates) {
    const allowed = [
      "title",
      "amount",
      "type",
      "category_id",
      "source",
      "target",
      "description",
      "recurrence_type",
      "recurrence_interval",
      "start_date",
      "end_date",
      "max_occurrences",
    ];

    const sets = [];
    const params = [];
    let idx = 1;
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        sets.push(`${key} = $${idx++}`);
        params.push(updates[key]);
      }
    }

    if (sets.length === 0) {
      const cur = await db.query(
        `SELECT * FROM recurring_transactions WHERE id = $1`,
        [id],
      );
      return cur.rows[0] || null;
    }

    const result = await db.query(
      `UPDATE recurring_transactions
       SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${idx}
       RETURNING *`,
      [...params, id],
    );
    return result.rows[0] || null;
  }

  static async delete(id) {
    const result = await db.query(
      "DELETE FROM recurring_transactions WHERE id = $1 RETURNING *",
      [id],
    );
    return result.rows[0];
  }
}

module.exports = RecurringTransaction;
