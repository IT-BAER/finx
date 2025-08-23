const User = require("../models/User");
const db = require("../config/db");

class UserService {
  static async getAllUsers(adminUserId) {
    // Check if user is admin
    const admin = await User.findById(adminUserId);
    if (!admin.isAdmin()) {
      throw new Error("Access denied. Admin only.");
    }

    // Get all users
    const query = `
      SELECT id, email, first_name, last_name, created_at, COALESCE(is_admin, false) AS is_admin
      FROM users
      ORDER BY created_at DESC;
    `;

    const result = await db.query(query);
    return result.rows;
  }

  static async createUser(adminUserId, userData) {
    const { email, password, first_name, last_name, is_admin } = userData;

    // Check if admin
    const admin = await User.findById(adminUserId);
    if (!admin.isAdmin()) {
      throw new Error("Access denied. Admin only.");
    }

    // Check if user exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new Error("User already exists");
    }

    // Create user
    return await User.create(
      email,
      password,
      first_name,
      last_name,
      !!is_admin
    );
  }

  static async updateUser(adminUserId, userId, updateData) {
    const { first_name, last_name, email, is_admin } = updateData;

    // Check if admin
    const admin = await User.findById(adminUserId);
    if (!admin.isAdmin()) {
      throw new Error("Access denied. Admin only.");
    }

    // Prevent admin from demoting themselves
    if (parseInt(userId) === adminUserId && is_admin === false) {
      throw new Error("You cannot remove your own admin privileges");
    }

    // If trying to demote user, check admin count
    if (is_admin === false) {
      const countQuery = `
        SELECT COUNT(*)::int AS count 
        FROM users 
        WHERE COALESCE(is_admin, false) = true
      `;
      const countResult = await db.query(countQuery);
      const adminCount = countResult.rows[0]?.count || 0;

      const target = await User.findById(userId);
      if (target.isAdmin() && adminCount <= 1) {
        throw new Error("Cannot remove admin privileges: at least one admin required");
      }
    }

    // Build update query
    const fields = [];
    const values = [];
    let idx = 1;
    
    if (first_name !== undefined) {
      fields.push(`first_name = $${idx++}`);
      values.push(first_name);
    }
    if (last_name !== undefined) {
      fields.push(`last_name = $${idx++}`);
      values.push(last_name);
    }
    if (email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(email);
    }
    if (is_admin !== undefined) {
      fields.push(`is_admin = $${idx++}`);
      values.push(is_admin);
    }

    if (fields.length === 0) {
      throw new Error("No updatable fields provided");
    }

    const query = `
      UPDATE users 
      SET ${fields.join(", ")} 
      WHERE id = $${idx} 
      RETURNING id, email, first_name, last_name, created_at, COALESCE(is_admin, false) AS is_admin
    `;
    values.push(userId);

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async deleteUser(adminUserId, userId) {
    // Check if admin
    const admin = await User.findById(adminUserId);
    if (!admin.isAdmin()) {
      throw new Error("Access denied. Admin only.");
    }

    // Prevent self-deletion
    if (parseInt(userId) === adminUserId) {
      throw new Error("You cannot delete yourself");
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Delete user
    const query = "DELETE FROM users WHERE id = $1 RETURNING *;";
    const result = await db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      throw new Error("User not found");
    }

    return result.rows[0];
  }
}

module.exports = UserService;
