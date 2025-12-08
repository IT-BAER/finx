const db = require("../config/db");

class SharingPermission {
  constructor(data) {
    this.id = data.id;
    this.owner_user_id = data.owner_user_id;
    this.shared_with_user_id = data.shared_with_user_id;
    this.permission_level = data.permission_level;
    // can_view_* deprecated: viewing is implied by existence of a permission
    this.source_filter = data.source_filter;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Check if a user has permission to view another user's data
  static async hasPermission(owner_user_id, shared_with_user_id, required_level = 'read') {
    const query = `
      SELECT permission_level
      FROM sharing_permissions
      WHERE owner_user_id = $1 AND shared_with_user_id = $2
    `;
    const result = await db.query(query, [owner_user_id, shared_with_user_id]);

    if (result.rows.length === 0) return false;

    if (required_level === 'all') return true;

    const level = result.rows[0].permission_level;
    if (level === 'readwrite') return true; // readwrite covers everything

    return level === required_level;
  }

  // Create a new sharing permission
  static async create(
    owner_user_id,
    shared_with_user_id,
    permission_level,
    _can_view_income,
    _can_view_expenses,
    source_filter,
  ) {
    // keep signature to avoid ripple changes; ignore deprecated args
    const query = `
      INSERT INTO sharing_permissions 
      (owner_user_id, shared_with_user_id, permission_level, source_filter)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [
      owner_user_id,
      shared_with_user_id,
      permission_level,
      source_filter,
    ];
    const result = await db.query(query, values);
    return new SharingPermission(result.rows[0]);
  }

  // Get all sharing permissions for a user (as owner)
  static async findByOwnerUserId(owner_user_id) {
    const query = `
      SELECT sp.*, u.email as shared_with_email
      FROM sharing_permissions sp
      JOIN users u ON sp.shared_with_user_id = u.id
      WHERE sp.owner_user_id = $1
      ORDER BY sp.created_at DESC;
    `;

    const result = await db.query(query, [owner_user_id]);
    return result.rows.map((row) => new SharingPermission(row));
  }

  // Get all sharing permissions for a user (as recipient)
  static async findBySharedWithUserId(shared_with_user_id) {
    const query = `
      SELECT sp.*, u.email as owner_email
      FROM sharing_permissions sp
      JOIN users u ON sp.owner_user_id = u.id
      WHERE sp.shared_with_user_id = $1
      ORDER BY sp.created_at DESC;
    `;

    const result = await db.query(query, [shared_with_user_id]);
    return result.rows.map((row) => new SharingPermission(row));
  }

  // Get a specific sharing permission by ID
  static async findById(id) {
    const query = `
      SELECT sp.*, u.email as shared_with_email
      FROM sharing_permissions sp
      JOIN users u ON sp.shared_with_user_id = u.id
      WHERE sp.id = $1;
    `;

    const result = await db.query(query, [id]);
    return result.rows.length > 0
      ? new SharingPermission(result.rows[0])
      : null;
  }

  // Update a sharing permission
  static async update(id, updates) {
    const allowedFields = ["permission_level", "source_filter"];
    const fields = Object.keys(updates).filter((field) =>
      allowedFields.includes(field),
    );

    if (fields.length === 0) {
      throw new Error("No valid fields to update");
    }

    const setClause = fields
      .map((field, index) => `${field} = $${index + 2}`)
      .join(", ");
    const values = [id, ...fields.map((field) => updates[field])];

    const query = `
      UPDATE sharing_permissions 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;

    const result = await db.query(query, values);
    return result.rows.length > 0
      ? new SharingPermission(result.rows[0])
      : null;
  }

  // Delete a sharing permission
  static async delete(id) {
    const query = "DELETE FROM sharing_permissions WHERE id = $1 RETURNING *;";
    const result = await db.query(query, [id]);
    return result.rows.length > 0;
  }

  // Get shared transactions for a user with filtering
  static async getSharedTransactions(
    owner_user_id,
    shared_with_user_id,
    limit = 50,
  ) {
    // Get the sharing permission to check source filter
    const permissionQuery = `
      SELECT source_filter
      FROM sharing_permissions
      WHERE owner_user_id = $1 AND shared_with_user_id = $2
    `;
    const permissionResult = await db.query(permissionQuery, [
      owner_user_id,
      shared_with_user_id,
    ]);
    const permission = permissionResult.rows[0];

    // Build the query with source filtering
    let query = `
      SELECT t.*, c.name as category_name, s.name as source_name, tg.name as target_name
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      LEFT JOIN sources s ON t.source_id = s.id
      LEFT JOIN targets tg ON t.target_id = tg.id
      WHERE t.user_id = $1
    `;

    const values = [owner_user_id, shared_with_user_id];

    // Add source filter if it exists
    if (permission.source_filter) {
      try {
        const sourceIds = JSON.parse(permission.source_filter);
        if (Array.isArray(sourceIds) && sourceIds.length > 0) {
          query += ` AND (t.source_id = ANY($${values.length + 1}) OR t.target_id = ANY($${values.length + 1}))`;
          values.push(sourceIds);
        }
      } catch (err) {
        console.error("Error parsing source_filter:", err);
      }
    }

    query += `
      ORDER BY t.date DESC, t.id DESC
      LIMIT $${values.length + 1};
    `;
    values.push(limit);

    const result = await db.query(query, values);
    return result.rows;
  }
}

module.exports = SharingPermission;
