const db = require("../config/db");

class Category {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.user_id = data.user_id;
  }

  // Create a new category for a user
  static async createForUser(user_id, name) {
    const result = await db.query(
      `INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING id, user_id, name`,
      [user_id, name],
    );
    return result.rows.length ? new Category(result.rows[0]) : null;
  }

  // Find category by ID
  static async findById(id) {
    const result = await db.query(
      "SELECT id, user_id, name FROM categories WHERE id = $1",
      [id],
    );
    return result.rows.length ? new Category(result.rows[0]) : null;
  }

  // Find category by ID for a specific user (ownership enforced)
  static async findByIdForUser(id, user_id) {
    const result = await db.query(
      "SELECT id, user_id, name FROM categories WHERE id = $1 AND user_id = $2",
      [id, user_id],
    );
    return result.rows.length ? new Category(result.rows[0]) : null;
  }

  static async findByNameForUser(user_id, name) {
    const result = await db.query(
      `SELECT id, user_id, name FROM categories WHERE user_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
      [user_id, name],
    );
    return result.rows.length ? new Category(result.rows[0]) : null;
  }

  // Delete category for a specific user (ownership enforced)
  static async deleteByUser(id, user_id) {
    const result = await db.query(
      "DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING id, user_id, name",
      [id, user_id],
    );
    return result.rows.length ? new Category(result.rows[0]) : null;
  }

  // Update category for user
  static async updateForUser(id, user_id, name) {
    const result = await db.query(
      `UPDATE categories SET name = $3 WHERE id = $1 AND user_id = $2 RETURNING id, user_id, name`,
      [id, user_id, name],
    );
    return result.rows.length ? new Category(result.rows[0]) : null;
  }

}

module.exports = Category;
