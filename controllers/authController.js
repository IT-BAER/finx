const jwt = require("jsonwebtoken");
const User = require("../models/User");
const db = require("../config/db");
const bcrypt = require("bcryptjs");
const refreshTokenUtil = require("../utils/refreshToken");
const logger = require("../utils/logger");

// Access token lifetime: 15 minutes (short-lived for security)
const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60;

// Generate JWT access token (short-lived)
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS });
};

// Register user
const register = async (req, res) => {
  try {
    const { email, password, deviceId, deviceName, deviceType } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create user
    const user = await User.create(email, password);

    // Generate access token (short-lived)
    const accessToken = generateToken(user.id);

    // Prepare device info for multi-device token storage
    const deviceInfo = {
      deviceId: deviceId || `web-${Date.now()}`,
      deviceName: deviceName || req.get('User-Agent')?.substring(0, 50) || 'Unknown Device',
      deviceType: deviceType || 'web',
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
    };

    // Generate refresh token (long-lived) with device info
    const refreshData = await refreshTokenUtil.createRefreshToken(user.id, deviceInfo);

    res.status(201).json({
      success: true,
      token: accessToken,
      refreshToken: refreshData.token,
      refreshTokenFamily: refreshData.family,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
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
    const { email, password, deviceId, deviceName, deviceType } = req.body;

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

    // Generate access token (short-lived)
    const accessToken = generateToken(user.id);

    // Prepare device info for multi-device token storage
    const deviceInfo = {
      deviceId: deviceId || `web-${Date.now()}`,
      deviceName: deviceName || req.get('User-Agent')?.substring(0, 50) || 'Unknown Device',
      deviceType: deviceType || 'web',
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
    };

    // Generate refresh token (long-lived) with device info
    const refreshData = await refreshTokenUtil.createRefreshToken(user.id, deviceInfo);

    res.json({
      success: true,
      token: accessToken,
      refreshToken: refreshData.token,
      refreshTokenFamily: refreshData.family,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
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
    logger.error("Login error:", err.message);
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
    logger.error("Delete account error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Refresh access token using refresh token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token, refreshTokenFamily: family, userId, deviceId, deviceName, deviceType } = req.body;

    logger.info(`[Refresh] Attempt for user ${userId} - token present: ${!!token}, family present: ${!!family}`);

    // Validate required fields
    if (!token || !family || !userId) {
      logger.warn(`[Refresh] Missing required fields - token: ${!!token}, family: ${!!family}, userId: ${!!userId}`);
      return res.status(400).json({
        message: "Refresh token, token family, and user ID are required"
      });
    }

    // Validate user ID is a number
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId)) {
      logger.warn(`[Refresh] Invalid user ID: ${userId}`);
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Prepare device info for tracking
    const deviceInfo = {
      deviceId: deviceId,
      deviceName: deviceName,
      deviceType: deviceType,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
    };

    // Validate and rotate the refresh token
    const result = await refreshTokenUtil.validateAndRotateToken(
      parsedUserId,
      token,
      family,
      deviceInfo
    );

    if (!result.valid) {
      // Log the security event with full details
      logger.warn(`[Refresh] Token validation failed for user ${parsedUserId}: ${result.error}`);
      return res.status(401).json({ message: result.error });
    }

    // Get user to verify they still exist
    const user = await User.findById(parsedUserId);
    if (!user) {
      await refreshTokenUtil.revokeRefreshToken(parsedUserId, family);
      return res.status(401).json({ message: "User not found" });
    }

    // Generate new access token
    const accessToken = generateToken(user.id);

    res.json({
      success: true,
      token: accessToken,
      refreshToken: result.newToken,
      refreshTokenFamily: result.newFamily,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
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
    logger.error("Refresh token error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Logout - revoke refresh token for this device only
const logout = async (req, res) => {
  try {
    const { refreshTokenFamily } = req.body;
    
    // If token family is provided, only revoke that specific session
    // Otherwise revoke all sessions for this user (backward compatibility)
    if (refreshTokenFamily) {
      await refreshTokenUtil.revokeRefreshToken(req.user.id, refreshTokenFamily);
      logger.info(`User ${req.user.id} logged out from device with token family ${refreshTokenFamily.substring(0, 8)}...`);
    } else {
      await refreshTokenUtil.revokeRefreshToken(req.user.id);
      logger.info(`User ${req.user.id} logged out from all devices`);
    }
    
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    logger.error("Logout error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Logout from all devices
const logoutAll = async (req, res) => {
  try {
    await refreshTokenUtil.revokeRefreshToken(req.user.id);
    logger.info(`User ${req.user.id} logged out from all devices`);
    res.json({ success: true, message: "Logged out from all devices" });
  } catch (err) {
    logger.error("Logout all error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get active sessions for the user
const getSessions = async (req, res) => {
  try {
    const sessions = await refreshTokenUtil.getActiveSessions(req.user.id);
    res.json({ success: true, sessions });
  } catch (err) {
    logger.error("Get sessions error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Revoke a specific session
const revokeSession = async (req, res) => {
  try {
    const { tokenFamily } = req.body;
    
    if (!tokenFamily) {
      return res.status(400).json({ message: "Token family is required" });
    }
    
    await refreshTokenUtil.revokeRefreshToken(req.user.id, tokenFamily);
    logger.info(`User ${req.user.id} revoked session with token family ${tokenFamily.substring(0, 8)}...`);
    res.json({ success: true, message: "Session revoked" });
  } catch (err) {
    logger.error("Revoke session error:", err.message);
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
  refreshToken,
  logout,
  logoutAll,
  getSessions,
  revokeSession,
};
