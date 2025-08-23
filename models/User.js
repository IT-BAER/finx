const db = require("../config/db");
const bcrypt = require("bcryptjs");

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
  }

  // Check if user is admin
  isAdmin() {
    return !!this.is_admin;
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
    const query = `
      INSERT INTO users (email, password_hash, first_name, last_name, income_tracking_disabled, is_admin)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [email, hashedPassword, firstName, lastName, false, isAdmin];
    const result = await db.query(query, values);
    return new User(result.rows[0]);
  }

  // Find user by email
  static async findByEmail(email) {
    // Select explicit columns including is_admin if present
    const query =
      "SELECT id, email, password_hash, first_name, last_name, income_tracking_disabled, theme, dark_mode, created_at, COALESCE(is_admin, false) AS is_admin, last_login FROM users WHERE email = $1";
    const result = await db.query(query, [email]);
    if (result.rows.length === 0) return null;
    return new User(result.rows[0]);
  }

  // Find user by ID
  static async findById(id) {
    // Select explicit columns including is_admin if present
    const query =
      "SELECT id, email, password_hash, first_name, last_name, income_tracking_disabled, theme, dark_mode, created_at, COALESCE(is_admin, false) AS is_admin, last_login FROM users WHERE id = $1";
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) return null;
    return new User(result.rows[0]);
  }

  // Compare password
  async comparePassword(password) {
    return bcrypt.compare(password, this.password_hash);
  }
}

module.exports = User;
