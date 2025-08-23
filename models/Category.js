const db = require("../config/db");

class Category {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
  }

  // Create a new category (global)
  static async createGlobal(name) {
    const query = `
      INSERT INTO categories (name)
      VALUES ($1)
      ON CONFLICT ON CONSTRAINT uq_categories_name_norm DO NOTHING
      RETURNING *;
    `;
    const result = await db.query(query, [name]);
    if (result.rows.length > 0) {
      return new Category(result.rows[0]);
    }
    // If no row returned, fetch existing by normalized name
    const existing = await db.query(
      `SELECT id, name FROM categories WHERE name_norm = LOWER(TRIM($1)) LIMIT 1`,
      [name],
    );
    return existing.rows.length ? new Category(existing.rows[0]) : null;
  }

  // Find category by ID
  static async findById(id) {
    const result = await db.query(
      "SELECT id, name FROM categories WHERE id = $1",
      [id],
    );
    return result.rows.length ? new Category(result.rows[0]) : null;
  }

  // Find category by ID for a specific user (ownership enforced)
  static async findByIdForUser(id, user_id) {
    const result = await db.query(
      "SELECT id, name FROM categories WHERE id = $1 AND user_id = $2",
      [id, user_id],
    );
    return result.rows.length ? new Category(result.rows[0]) : null;
  }

  // Delete category for a specific user (ownership enforced)
  static async deleteByUser(id, user_id) {
    const result = await db.query(
      "DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING id, name",
      [id, user_id],
    );
    return result.rows.length ? new Category(result.rows[0]) : null;
  }

  // Update category (global)
  static async updateGlobal(id, name) {
    const query = `
      UPDATE categories
      SET name = $2
      WHERE id = $1
      RETURNING id, name;
    `;
    const result = await db.query(query, [id, name]);
    return result.rows.length ? new Category(result.rows[0]) : null;
  }

  // Delete category (global)
  static async deleteGlobal(id) {
    const result = await db.query(
      "DELETE FROM categories WHERE id = $1 RETURNING id, name",
      [id],
    );
    return result.rows.length ? new Category(result.rows[0]) : null;
  }
}

module.exports = Category;
