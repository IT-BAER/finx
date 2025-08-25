const db = require("../config/db");

class Transaction {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.category_id = data.category_id;
    this.source_id = data.source_id;
    this.target_id = data.target_id;
    this.source_name = data.source_name || data.source; // For backward compatibility
    this.target_name = data.target_name || data.target; // For backward compatibility
    this.amount = data.amount;
    this.type = data.type;
    this.description = data.description;
    this.date = data.date;
    this.category_name = data.category_name; // For dashboard queries
  }

  // Create a new transaction
  static async create(
    user_id,
    category_id,
    source_id,
    target_id,
    amount,
    type,
    description,
    date,
  ) {
    const query = `
      INSERT INTO transactions (user_id, category_id, source_id, target_id, amount, type, description, date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [
      user_id,
      category_id,
      source_id,
      target_id,
      amount,
      type,
      description,
      date,
    ];
    const result = await db.query(query, values);
    return new Transaction(result.rows[0]);
  }

  // Get all transactions for a user
  static async findByUserId(user_id, limit = 100) {
    const query = `
      SELECT 
        t.*, 
        c.name as category_name, 
        s.name as source_name, 
        tg.name as target_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN sources s ON t.source_id = s.id
      LEFT JOIN targets tg ON t.target_id = tg.id
      WHERE t.user_id = $1
      ORDER BY t.date DESC, t.id DESC
      LIMIT $2;
    `;
    const result = await db.query(query, [user_id, limit]);
    // Owner context: editable
    return result.rows.map(
      (row) =>
        new Transaction({ ...row, owner_user_id: row.user_id, can_edit: true }),
    );
  }

  // Get transaction by ID
  static async findById(id) {
    const query = `
      SELECT t.*, c.name as category_name, s.name as source_name, tg.name as target_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN sources s ON t.source_id = s.id
      LEFT JOIN targets tg ON t.target_id = tg.id
      WHERE t.id = $1
    `;
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) return null;
    return new Transaction(result.rows[0]);
  }

  // Get transaction by ID for a specific user (ownership enforced)
  static async findByIdForUser(id, user_id) {
    const query = `
      SELECT t.*, c.name as category_name, s.name as source_name, tg.name as target_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN sources s ON t.source_id = s.id
      LEFT JOIN targets tg ON t.target_id = tg.id
      WHERE t.id = $1 AND t.user_id = $2
    `;
    const result = await db.query(query, [id, user_id]);
    if (result.rows.length === 0) return null;
    return new Transaction(result.rows[0]);
  }

  // Delete transaction for a specific user (ownership enforced)
  static async deleteByUser(id, user_id) {
    const query = `DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING *`;
    const result = await db.query(query, [id, user_id]);
    if (result.rows.length === 0) return null;
    return new Transaction(result.rows[0]);
  }

  // Update transaction for a specific user (ownership enforced)
  static async updateByUser(
    id,
    user_id,
    category_id,
    source_id,
    target_id,
    amount,
    type,
    description,
    date,
  ) {
    const query = `
      UPDATE transactions
      SET category_id = $1, source_id = $2, target_id = $3, amount = $4, type = $5, description = $6, date = $7
      WHERE id = $8 AND user_id = $9
      RETURNING *;
    `;
    const values = [
      category_id,
      source_id,
      target_id,
      amount,
      type,
      description,
      date,
      id,
      user_id,
    ];
    const result = await db.query(query, values);
    if (result.rows.length === 0) return null;
    return new Transaction(result.rows[0]);
  }

  // Update transaction
  static async update(
    id,
    category_id,
    source_id,
    target_id,
    amount,
    type,
    description,
    date,
  ) {
    const query = `
      UPDATE transactions
      SET category_id = $1, source_id = $2, target_id = $3, amount = $4, type = $5, description = $6, date = $7
      WHERE id = $8
      RETURNING *;
    `;
    const values = [
      category_id,
      source_id,
      target_id,
      amount,
      type,
      description,
      date,
      id,
    ];
    const result = await db.query(query, values);
    if (result.rows.length === 0) return null;
    return new Transaction(result.rows[0]);
  }

  // Delete transaction
  static async delete(id) {
    const query = "DELETE FROM transactions WHERE id = $1 RETURNING *";
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) return null;
    return new Transaction(result.rows[0]);
  }

  // Get summary data for dashboard
  static async getSummary(
    user_id,
    startDate = null,
    endDate = null,
    isIncomeTrackingDisabled = false,
  ) {
    let query;

    if (isIncomeTrackingDisabled) {
      // When income tracking is disabled, income is 0 and balance is negative expenses
      query = `
        SELECT
          0 as total_income,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
          -COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as balance
        FROM transactions
        WHERE user_id = $1 AND type = 'expense'
      `;
    } else {
      // Normal query with income and expenses
      query = `
        SELECT
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as balance
        FROM transactions
        WHERE user_id = $1
      `;
    }

    const values = [user_id];

    if (startDate && endDate) {
      query += ` AND date >= $2 AND date <= $3`;
      values.push(startDate, endDate);
    }

    const result = await db.query(query, values);
    return result.rows[0];
  }

  // Get recent transactions for dashboard
  static async getRecent(
    user_id,
    startDate = null,
    endDate = null,
    limit = 5,
    isIncomeTrackingDisabled = false,
  ) {
    let query = `
      SELECT t.*, c.name as category_name, s.name as source_name, tg.name as target_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN sources s ON t.source_id = s.id
      LEFT JOIN targets tg ON t.target_id = tg.id
      WHERE t.user_id = $1
    `;

    const values = [user_id];

    if (isIncomeTrackingDisabled) {
      query += ` AND t.type = 'expense'`;
    }

    if (startDate && endDate) {
      query += ` AND t.date >= $2 AND t.date <= $3`;
      values.push(startDate, endDate);
    }

    query += `
      ORDER BY t.date DESC, t.id DESC
      LIMIT $${values.length + 1};
    `;

    const result = await db.query(query, [...values, limit]);
    return result.rows.map((row) => new Transaction(row));
  }

  // Get expenses by category for dashboard
  static async getExpensesByCategory(
    user_id,
    startDate = null,
    endDate = null,
  ) {
    let query = `
      SELECT
        c.name as category_name,
        SUM(t.amount) as total
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = $1 AND t.type = 'expense'
    `;

    const values = [user_id];

    if (startDate && endDate) {
      query += ` AND t.date >= $2 AND t.date <= $3`;
      values.push(startDate, endDate);
    }

    query += `
      GROUP BY c.name, c.id
      ORDER BY total DESC;
    `;

    const result = await db.query(query, values);
    return result.rows;
  }

  // Get daily average expenses for a date range
  static async getDailyAverageExpenses(
    user_id,
    startDate = null,
    endDate = null,
  ) {
    let query;
    const values = [user_id];

    if (startDate && endDate) {
      // Use provided date range
      query = `
        WITH date_series AS (
          SELECT generate_series($2::date, $3::date, '1 day'::interval)::date AS date
        )
        SELECT
          ds.date,
          COALESCE(AVG(t.amount), 0) as average_amount
        FROM date_series ds
        LEFT JOIN transactions t ON ds.date = t.date
          AND t.user_id = $1
          AND t.type = 'expense'
        GROUP BY ds.date
        ORDER BY ds.date;
      `;
      values.push(startDate, endDate);
    } else {
      // Default to current week (exactly 7 days with current day as latest)
      query = `
        WITH date_series AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '6 days',
            CURRENT_DATE,
            '1 day'::interval
          )::date AS date
        )
        SELECT
          ds.date,
          COALESCE(AVG(t.amount), 0) as average_amount
        FROM date_series ds
        LEFT JOIN transactions t ON ds.date = t.date
          AND t.user_id = $1
          AND t.type = 'expense'
        GROUP BY ds.date
        ORDER BY ds.date;
      `;
    }

    const result = await db.query(query, values);
    return result.rows;
  }

  // Get total expenses for a date range
  static async getWeeklyExpenses(user_id, startDate = null, endDate = null) {
    let query;
    const values = [user_id];

    if (startDate && endDate) {
      // Use provided date range
      query = `
        WITH date_series AS (
          SELECT generate_series($2::date, $3::date, '1 day'::interval)::date AS date
        )
        SELECT
          COALESCE(SUM(t.amount), 0) as total_expenses,
          COUNT(DISTINCT t.date) as days_with_expenses
        FROM date_series ds
        LEFT JOIN transactions t ON ds.date = t.date
          AND t.user_id = $1
          AND t.type = 'expense';
      `;
      values.push(startDate, endDate);
    } else {
      // Default to current week (exactly 7 days with current day as latest)
      query = `
        WITH date_series AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '6 days',
            CURRENT_DATE,
            '1 day'::interval
          )::date AS date
        )
        SELECT
          COALESCE(SUM(t.amount), 0) as total_expenses,
          COUNT(DISTINCT t.date) as days_with_expenses
        FROM date_series ds
        LEFT JOIN transactions t ON ds.date = t.date
          AND t.user_id = $1
          AND t.type = 'expense';
      `;
    }

    const result = await db.query(query, values);
    return result.rows[0];
  }

  // Get daily expenses for a date range
  static async getDailyExpenses(user_id, startDate = null, endDate = null) {
    let query;
    const values = [user_id];

    if (startDate && endDate) {
      // Use provided date range
      query = `
        WITH date_series AS (
          SELECT generate_series($2::date, $3::date, '1 day'::interval)::date AS date
        )
        SELECT
          ds.date,
          COALESCE(SUM(t.amount), 0) as total
        FROM date_series ds
        LEFT JOIN transactions t ON ds.date = t.date
          AND t.user_id = $1
          AND t.type = 'expense'
        GROUP BY ds.date
        ORDER BY ds.date;
      `;
      values.push(startDate, endDate);
    } else {
      // Default to current week (exactly 7 days with current day as latest)
      query = `
        WITH date_series AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '6 days',
            CURRENT_DATE,
            '1 day'::interval
          )::date AS date
        )
        SELECT
          ds.date,
          COALESCE(SUM(t.amount), 0) as total
        FROM date_series ds
        LEFT JOIN transactions t ON ds.date = t.date
          AND t.user_id = $1
          AND t.type = 'expense'
        GROUP BY ds.date
        ORDER BY ds.date;
      `;
    }

    const result = await db.query(query, values);
    return result.rows;
  }

  // Get income by date for a date range
  static async getIncomeByDate(user_id, startDate = null, endDate = null) {
    let query;
    const values = [user_id];

    if (startDate && endDate) {
      // Use provided date range
      query = `
        SELECT
          date,
          SUM(amount) as total
        FROM transactions
        WHERE user_id = $1 AND type = 'income'
          AND date >= $2 AND date <= $3
        GROUP BY date
        ORDER BY date;
      `;
      values.push(startDate, endDate);
    } else {
      // Default to current week
      query = `
        SELECT
          date,
          SUM(amount) as total
        FROM transactions
        WHERE user_id = $1 AND type = 'income'
          AND date >= CURRENT_DATE - INTERVAL '6 days'
          AND date <= CURRENT_DATE
        GROUP BY date
        ORDER BY date;
      `;
    }

    const result = await db.query(query, values);
    return result.rows;
  }

  // Get transactions with sharing filter
  static async findByUserIdWithSharing(
    user_id,
    shared_with_user_id = null,
    limit = 100,
  ) {
    // Keep SQL simple for visibility, then post-process to compute can_edit including source_filter and robust writable levels
    let query = `
      SELECT 
        t.*, 
        c.name as category_name, 
        s.name as source_name, 
        tg.name as target_name,
        t.user_id as owner_user_id
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN sources s ON t.source_id = s.id
      LEFT JOIN targets tg ON t.target_id = tg.id
      WHERE t.user_id = $1
    `;
    const values = [user_id];
    if (shared_with_user_id) {
      // Visibility gate: require any sharing permission from owner to viewer (type flags deprecated)
      query += ` AND EXISTS (
        SELECT 1 FROM sharing_permissions sp 
        WHERE sp.owner_user_id = t.user_id 
          AND sp.shared_with_user_id = $2
      )`;
      values.push(shared_with_user_id);
    }
    query += `
      ORDER BY t.date DESC, t.id DESC
      LIMIT $${shared_with_user_id ? "3" : "2"};
    `;
    const result = await db.query(query, [...values, limit]);
    const rows = result.rows;

    // Owner context: if no shared_with_user_id, everything is editable by the owner
    if (!shared_with_user_id) {
      return rows.map((row) => new Transaction({ ...row, can_edit: true }));
    }

    // Load the single permission for owner->shared_with_user to compute can_edit including source_filter
    const permQuery = `
      SELECT permission_level, source_filter
      FROM sharing_permissions
      WHERE owner_user_id = $1 AND shared_with_user_id = $2
      LIMIT 1
    `;
    const permRes = await db.query(permQuery, [user_id, shared_with_user_id]);
    let writable = false;
    let allowedSourceIdsNum = null;
    let allowedSourceIdsStr = null;
  let allowedSourceNamesLower = null;

    if (permRes.rows.length > 0) {
      const pr = permRes.rows[0];
      const level = String(pr.permission_level || "")
        .trim()
        .toLowerCase();
      const writableLevels = new Set([
        "write",
        "edit",
        "read_write",
        "read-write",
        "rw",
        "readwrite",
        "full",
        "owner",
      ]);
      writable = writableLevels.has(level);
      // viewing is implied by permission existence; no type gating

      if (pr.source_filter) {
        try {
          const parsed = JSON.parse(pr.source_filter);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const nums = [];
            const strs = [];
            const nameCandidates = [];
            for (const x of parsed) {
              const sx = String(x).trim();
              const n = Number(sx);
              if (!Number.isNaN(n) && sx !== "") {
                nums.push(n);
                strs.push(sx);
              } else if (sx) {
                nameCandidates.push(sx.toLowerCase());
              }
            }
            allowedSourceIdsNum = nums.length > 0 ? nums : null;
            allowedSourceIdsStr = strs.length > 0 ? strs : null;
            allowedSourceNamesLower = nameCandidates.length > 0 ? nameCandidates : null;
            if (nums.length > 0) {
              try {
                const namesRes = await db.query(
                  `SELECT name FROM sources WHERE user_id = $1 AND id = ANY($2)`,
                  [user_id, nums],
                );
                allowedSourceNamesLower = namesRes.rows
                  .map((row) => String(row.name || "").trim().toLowerCase())
                  .filter((s) => s.length > 0)
                  .concat(allowedSourceNamesLower || [])
                  .filter((v, i, a) => a.indexOf(v) === i);
              } catch (e) {
                // ignore
              }
            }
          }
        } catch (e) {
          // ignore parsing errors
        }
      }
    }

    const computed = rows.map((row) => {
      // Visibility already ensured by SQL. Compute can_edit:
      let can_edit = false;
  if (writable) {
        const sidNum = row.source_id != null ? Number(row.source_id) : null;
        const tidNum = row.target_id != null ? Number(row.target_id) : null;
        const sidStr = row.source_id != null ? String(row.source_id) : null;
        const tidStr = row.target_id != null ? String(row.target_id) : null;

        const hasNum =
          Array.isArray(allowedSourceIdsNum) && allowedSourceIdsNum.length > 0;
        const hasStr =
          Array.isArray(allowedSourceIdsStr) && allowedSourceIdsStr.length > 0;

        if (hasNum || hasStr) {
          const numMatch =
            (hasNum &&
              sidNum != null &&
              allowedSourceIdsNum.includes(sidNum)) ||
            (hasNum && tidNum != null && allowedSourceIdsNum.includes(tidNum));
          const strMatch =
            (hasStr &&
              sidStr != null &&
              allowedSourceIdsStr.includes(sidStr)) ||
            (hasStr && tidStr != null && allowedSourceIdsStr.includes(tidStr));
          can_edit = !!(numMatch || strMatch);
          if (!can_edit && String(row.type).toLowerCase() === "income") {
            const tname = String(row.target_name || "").trim().toLowerCase();
            if (
              tname &&
              Array.isArray(allowedSourceNamesLower) &&
              allowedSourceNamesLower.includes(tname)
            ) {
              can_edit = true;
            }
          }
        } else {
          can_edit = true;
        }
      }
      return new Transaction({ ...row, can_edit });
    });

    return computed;
  }
}

module.exports = Transaction;
