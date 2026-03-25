const db = require("../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// Characters for share codes (excluding ambiguous: 0/O, 1/I/L)
const SHARE_CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const SHARE_CODE_LENGTH = 8;

class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.password_hash = data.password_hash;
    this.first_name = data.first_name || "";
    this.last_name = data.last_name || "";
    this.income_tracking_disabled = data.income_tracking_disabled || false;
    this.theme = data.theme || "default";
    this.dark_mode = data.dark_mode === null ? null : data.dark_mode || false;
    // Use DB boolean column is_admin
    this.is_admin = typeof data.is_admin === "boolean" ? data.is_admin : false;
    this.created_at = data.created_at;
    this.last_login = data.last_login || null;
    this.share_code = data.share_code || null;
  }

  // Check if user is admin
  isAdmin() {
    return !!this.is_admin;
  }

  // Generate a unique share code
  static generateShareCode() {
    let code = "";
    const bytes = crypto.randomBytes(SHARE_CODE_LENGTH);
    for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
      code += SHARE_CODE_CHARSET[bytes[i] % SHARE_CODE_CHARSET.length];
    }
    return code;
  }

  // Generate a unique share code with collision check
  static async generateUniqueShareCode() {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = User.generateShareCode();
      const existing = await db.query(
        "SELECT 1 FROM users WHERE share_code = $1",
        [code],
      );
      if (existing.rows.length === 0) return code;
    }
    throw new Error("Failed to generate unique share code after 10 attempts");
  }

  // Create a new user
  static async create(
    email,
    password,
    firstName = "",
    lastName = "",
    isAdmin = false,
  ) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const shareCode = await User.generateUniqueShareCode();
    const query = `
      INSERT INTO users (email, password_hash, first_name, last_name, income_tracking_disabled, is_admin, share_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [email, hashedPassword, firstName, lastName, false, isAdmin, shareCode];
    const result = await db.query(query, values);
    return new User(result.rows[0]);
  }

  // Find user by email
  static async findByEmail(email) {
    const query =
      "SELECT id, email, password_hash, first_name, last_name, income_tracking_disabled, theme, dark_mode, created_at, COALESCE(is_admin, false) AS is_admin, last_login, share_code FROM users WHERE email = $1";
    const result = await db.query(query, [email]);
    if (result.rows.length === 0) return null;
    return new User(result.rows[0]);
  }

  // Find user by ID
  static async findById(id) {
    const query =
      "SELECT id, email, password_hash, first_name, last_name, income_tracking_disabled, theme, dark_mode, created_at, COALESCE(is_admin, false) AS is_admin, last_login, share_code FROM users WHERE id = $1";
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) return null;
    return new User(result.rows[0]);
  }

  // Find user by share code
  static async findByShareCode(shareCode) {
    const query =
      "SELECT id, email, first_name, last_name, share_code FROM users WHERE share_code = $1";
    const result = await db.query(query, [shareCode.toUpperCase()]);
    if (result.rows.length === 0) return null;
    return new User(result.rows[0]);
  }

  // Regenerate share code for a user
  static async regenerateShareCode(userId) {
    const newCode = await User.generateUniqueShareCode();
    const query = "UPDATE users SET share_code = $1 WHERE id = $2 RETURNING share_code";
    const result = await db.query(query, [newCode, userId]);
    return result.rows[0]?.share_code || null;
  }

  // Compare password
  async comparePassword(password) {
    return bcrypt.compare(password, this.password_hash);
  }
}

module.exports = User;
