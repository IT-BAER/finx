const db = require("../config/db");

class Goal {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.name = data.name;
    this.target_amount = parseFloat(data.target_amount);
    this.current_amount = parseFloat(data.current_amount || 0);
    this.deadline = data.deadline;
    this.icon = data.icon || "savings";
    this.color = data.color || "#06b6d4";
    this.is_completed = data.is_completed || false;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Calculate progress percentage
  get progress() {
    if (this.target_amount <= 0) return 0;
    return Math.min(100, (this.current_amount / this.target_amount) * 100);
  }

  // Create a new goal
  static async create(user_id, name, target_amount, deadline = null, icon = "savings", color = "#06b6d4") {
    const query = `
      INSERT INTO goals (user_id, name, target_amount, deadline, icon, color)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [user_id, name, target_amount, deadline, icon, color];
    const result = await db.query(query, values);
    return new Goal(result.rows[0]);
  }

  // Get all goals for a user
  static async findByUserId(user_id, includeCompleted = true) {
    let query = `
      SELECT * FROM goals
      WHERE user_id = $1
    `;
    const values = [user_id];

    if (!includeCompleted) {
      query += ` AND is_completed = FALSE`;
    }

    query += ` ORDER BY is_completed ASC, deadline ASC NULLS LAST, created_at DESC`;

    const result = await db.query(query, values);
    return result.rows.map((row) => new Goal(row));
  }

  // Get goal by ID
  static async findById(id) {
    const query = `SELECT * FROM goals WHERE id = $1`;
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) return null;
    return new Goal(result.rows[0]);
  }

  // Get goal by ID for a specific user (ownership enforced)
  static async findByIdForUser(id, user_id) {
    const query = `SELECT * FROM goals WHERE id = $1 AND user_id = $2`;
    const result = await db.query(query, [id, user_id]);
    if (result.rows.length === 0) return null;
    return new Goal(result.rows[0]);
  }

  // Update goal
  static async updateByUser(id, user_id, updates) {
    const allowed = ["name", "target_amount", "deadline", "icon", "color", "is_completed"];
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
      return await Goal.findByIdForUser(id, user_id);
    }

    const query = `
      UPDATE goals
      SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${idx} AND user_id = $${idx + 1}
      RETURNING *
    `;
    const result = await db.query(query, [...params, id, user_id]);
    if (result.rows.length === 0) return null;
    return new Goal(result.rows[0]);
  }

  // Delete goal for a specific user
  static async deleteByUser(id, user_id) {
    const query = `DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING *`;
    const result = await db.query(query, [id, user_id]);
    if (result.rows.length === 0) return null;
    return new Goal(result.rows[0]);
  }

  // Add contribution to a goal
  static async addContribution(goal_id, user_id, amount, note = null) {
    // First verify the goal belongs to the user
    const goalCheck = await db.query(
      `SELECT id FROM goals WHERE id = $1 AND user_id = $2`,
      [goal_id, user_id]
    );
    if (goalCheck.rows.length === 0) return null;

    const query = `
      INSERT INTO goal_contributions (goal_id, amount, note)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await db.query(query, [goal_id, amount, note]);
    return result.rows[0];
  }

  // Get contributions for a goal
  static async getContributions(goal_id, user_id) {
    const query = `
      SELECT gc.* 
      FROM goal_contributions gc
      JOIN goals g ON gc.goal_id = g.id
      WHERE gc.goal_id = $1 AND g.user_id = $2
      ORDER BY gc.contributed_at DESC
    `;
    const result = await db.query(query, [goal_id, user_id]);
    return result.rows;
  }

  // Delete a contribution
  static async deleteContribution(contribution_id, user_id) {
    const query = `
      DELETE FROM goal_contributions gc
      USING goals g
      WHERE gc.id = $1 
        AND gc.goal_id = g.id 
        AND g.user_id = $2
      RETURNING gc.*
    `;
    const result = await db.query(query, [contribution_id, user_id]);
    if (result.rows.length === 0) return null;
    return result.rows[0];
  }

  // Update current_amount directly (bypasses trigger, for manual adjustments)
  static async setCurrentAmount(id, user_id, amount) {
    const query = `
      UPDATE goals
      SET current_amount = $1,
          is_completed = $1 >= target_amount,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND user_id = $3
      RETURNING *
    `;
    const result = await db.query(query, [amount, id, user_id]);
    if (result.rows.length === 0) return null;
    return new Goal(result.rows[0]);
  }

  // Get summary stats for user goals
  static async getSummary(user_id) {
    const query = `
      SELECT
        COUNT(*) as total_goals,
        COUNT(*) FILTER (WHERE is_completed = TRUE) as completed_goals,
        COUNT(*) FILTER (WHERE is_completed = FALSE) as active_goals,
        COALESCE(SUM(target_amount), 0) as total_target,
        COALESCE(SUM(current_amount), 0) as total_saved,
        COALESCE(SUM(target_amount) - SUM(current_amount), 0) as total_remaining
      FROM goals
      WHERE user_id = $1
    `;
    const result = await db.query(query, [user_id]);
    return result.rows[0];
  }
}

module.exports = Goal;
