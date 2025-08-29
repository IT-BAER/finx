const db = require("../config/db");

class Source {
  static async create(user_id, name) {
    const query = `
      INSERT INTO sources (user_id, name)
      VALUES ($1, $2)
      RETURNING *
    `;
  const values = [user_id, String(name).trim()];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByUserId(user_id) {
    const query = `
      SELECT * FROM sources
      WHERE user_id = $1
      ORDER BY name
    `;
    const result = await db.query(query, [user_id]);
    return result.rows;
  }

  static async findById(id) {
    const query = `
      SELECT * FROM sources
      WHERE id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  // Find source by ID for a specific user (ownership enforced)
  static async findByIdForUser(id, user_id) {
    const query = `
      SELECT * FROM sources
      WHERE id = $1 AND user_id = $2
    `;
    const result = await db.query(query, [id, user_id]);
    return result.rows[0] || null;
  }

  // Delete source for a specific user (ownership enforced)
  static async deleteByUser(id, user_id) {
    const query = `
      DELETE FROM sources
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
    const result = await db.query(query, [id, user_id]);
    return result.rows[0] || null;
  }

  static async update(id, name) {
    const query = `
      UPDATE sources
      SET name = $1
      WHERE id = $2
      RETURNING *
    `;
  const values = [String(name).trim(), id];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async delete(id) {
    const query = `
      DELETE FROM sources
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async findByNameAndUserId(user_id, name) {
    const query = `
  SELECT * FROM sources
  WHERE user_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))
  LIMIT 1
    `;
    const result = await db.query(query, [user_id, name]);
    return result.rows[0];
  }
}

module.exports = Source;
