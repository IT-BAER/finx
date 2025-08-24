const jwt = require("jsonwebtoken");
const User = require("../models/User");
const db = require("../config/db");
const bcrypt = require("bcryptjs");

// Generate JWT token
const generateToken = (id, rememberMe = false) => {
  if (rememberMe) {
    // No expiration when "remember me" is checked
    return jwt.sign({ id }, process.env.JWT_SECRET);
  } else {
    // 1 day expiration when "remember me" is not checked
    return jwt.sign({ id }, process.env.JWT_SECRET, {
      expiresIn: 86400, // 1 day in seconds
    });
  }
};

// Register user
const register = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create user
    const user = await User.create(email, password);

    // Generate token with default expiration (1 day)
    const token = generateToken(user.id, false);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        income_tracking_disabled: user.income_tracking_disabled,
        theme: user.theme,
        dark_mode: user.dark_mode,
        is_admin: user.isAdmin(),
        last_login: user.last_login,
      },
    });
  } catch (err) {
    console.error("Registration error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Check if user exists
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Update last_login timestamp
    await db.query(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
      [user.id],
    );

    // Generate token
    const token = generateToken(user.id, rememberMe);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        income_tracking_disabled: user.income_tracking_disabled,
        theme: user.theme,
        dark_mode: user.dark_mode,
        is_admin: user.isAdmin(),
        last_login: user.last_login,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get current user
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        income_tracking_disabled: user.income_tracking_disabled,
        theme: user.theme,
        dark_mode: user.dark_mode,
        is_admin: user.isAdmin(),
        last_login: user.last_login,
      },
    });
  } catch (err) {
    console.error("Get user error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const {
      income_tracking_disabled,
      first_name,
      last_name,
      theme,
  dark_mode,
  email,
    } = req.body;

    // Build dynamic query based on provided fields
    const fields = [];
    const values = [];
    let index = 1;

    if (income_tracking_disabled !== undefined) {
      fields.push(`income_tracking_disabled = $${index}`);
      values.push(income_tracking_disabled);
      index++;
    }

    if (first_name !== undefined) {
      fields.push(`first_name = $${index}`);
      values.push(first_name);
      index++;
    }

    if (last_name !== undefined) {
      fields.push(`last_name = $${index}`);
      values.push(last_name);
      index++;
    }

    if (theme !== undefined) {
      fields.push(`theme = $${index}`);
      values.push(theme);
      index++;
    }

    if (dark_mode !== undefined) {
      fields.push(`dark_mode = $${index}`);
      values.push(dark_mode);
      index++;
    }

    // Handle email change (self-service): validate uniqueness
    if (email !== undefined) {
      const nextEmail = String(email).trim().toLowerCase();
      if (!nextEmail) {
        return res.status(400).json({ message: "Email is required" });
      }
      // Only check if different from current
      const current = await User.findById(req.user.id);
      if (!current) {
        return res.status(404).json({ message: "User not found" });
      }
      if (current.email.toLowerCase() !== nextEmail) {
        const existing = await User.findByEmail(nextEmail);
        if (existing && Number(existing.id) !== Number(req.user.id)) {
          return res.status(400).json({ message: "User already exists" });
        }
        fields.push(`email = $${index}`);
        values.push(nextEmail);
        index++;
      }
    }

    // If no fields to update, return current user data
    if (fields.length === 0) {
      const user = await User.findById(req.user.id);
      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          income_tracking_disabled: user.income_tracking_disabled,
          theme: user.theme,
          dark_mode: user.dark_mode,
          is_admin: user.isAdmin(),
          last_login: user.last_login,
        },
      });
    }

    // Add user ID to values
    values.push(req.user.id);

    // Update user in database
    const query = `
      UPDATE users
      SET ${fields.join(", ")}
      WHERE id = $${index}
      RETURNING *
    `;

  const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = new User(result.rows[0]);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        income_tracking_disabled: user.income_tracking_disabled,
        theme: user.theme,
        dark_mode: user.dark_mode,
        is_admin: user.isAdmin(),
        last_login: user.last_login,
      },
    });
  } catch (err) {
    console.error("Update user error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters long" });
    }

    // Get current user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if current password is correct
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      hashedPassword,
      req.user.id,
    ]);

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error("Change password error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete account
const deleteAccount = async (req, res) => {
  try {
    // Delete user from database
    const result = await db.query(
      "DELETE FROM users WHERE id = $1 RETURNING *",
      [req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ success: true, message: "Account deleted successfully" });
  } catch (err) {
    console.error("Delete account error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  updateUser,
  changePassword,
  deleteAccount,
};
