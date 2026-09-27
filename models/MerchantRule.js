const db = require("../config/db");

class MerchantRule {
  static async findAllForUser(user_id) {
    const query = `
      SELECT id, merchant_normalized, category_id, source_name, target_name, type, updated_at
      FROM merchant_rules
      WHERE user_id = $1
      ORDER BY merchant_normalized
    `;
    const result = await db.query(query, [user_id]);
    return result.rows;
  }

  static async upsertForUser(user_id, key, { category_id, source_name, target_name, type }) {
    const query = `
      INSERT INTO merchant_rules (user_id, merchant_normalized, category_id, source_name, target_name, type, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id, merchant_normalized) DO UPDATE
        SET category_id = $3, source_name = $4, target_name = $5, type = $6, updated_at = NOW()
      RETURNING id, merchant_normalized, category_id, source_name, target_name, type, updated_at
    `;
    const values = [user_id, key, category_id, source_name, target_name, type];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async deleteForUser(user_id, key) {
    const query = `
      DELETE FROM merchant_rules
      WHERE user_id = $1 AND merchant_normalized = $2
      RETURNING id
    `;
    const result = await db.query(query, [user_id, key]);
    return result.rows[0] || null;
  }

  // Legacy bulk import. ON CONFLICT DO NOTHING = server wins over stale client rows.
  static async importForUser(user_id, rules) {
    if (rules.length === 0) return 0;
    const values = [];
    const rows = rules
      .map((rule, i) => {
        const base = i * 6;
        values.push(
          user_id,
          rule.merchant_normalized,
          rule.category_id,
          rule.source_name,
          rule.target_name,
          rule.type,
        );
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, NOW())`;
      })
      .join(", ");

    const query = `
      INSERT INTO merchant_rules (user_id, merchant_normalized, category_id, source_name, target_name, type, updated_at)
      VALUES ${rows}
      ON CONFLICT (user_id, merchant_normalized) DO NOTHING
      RETURNING id
    `;
    const result = await db.query(query, values);
    return result.rows.length;
  }

  static async categoryExists(category_id) {
    const result = await db.query("SELECT 1 FROM categories WHERE id = $1 LIMIT 1", [category_id]);
    return result.rows.length > 0;
  }
}

module.exports = MerchantRule;
