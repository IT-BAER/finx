const SharingPermission = require("../models/SharingPermission");
const User = require("../models/User");
const db = require("../config/db");

// Create sharing permission
const createSharingPermission = async (req, res) => {
  try {
    const { shared_with_user_id, permission_level, source_filter_ids } =
      req.body;

    // Validate that we're not sharing with ourselves
    if (req.user.id === shared_with_user_id) {
      return res
        .status(400)
        .json({ message: "You cannot share data with yourself" });
    }

    // Validate that the user exists
    const user = await User.findById(shared_with_user_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if sharing permission already exists (by owner + recipient)
    const existingRes = await db.query(
      "SELECT 1 FROM sharing_permissions WHERE owner_user_id = $1 AND shared_with_user_id = $2",
      [req.user.id, shared_with_user_id],
    );
    if (existingRes.rows.length > 0) {
      return res
        .status(409)
        .json({ message: "Sharing permission already exists" });
    }

    // Validate and normalize source_filter_ids (array of numeric source IDs owned by sharer)
    let normalizedSourceFilter = null;
    if (source_filter_ids) {
      if (!Array.isArray(source_filter_ids)) {
        return res.status(400).json({
          message: "source_filter_ids must be an array of numeric source IDs",
        });
      }
      const ids = source_filter_ids
        .map((x) => Number(x))
        .filter((n) => !Number.isNaN(n));
      if (ids.length === 0) {
        return res
          .status(400)
          .json({ message: "source_filter_ids cannot be empty" });
      }
      // Verify ownership of all IDs by the sharer (owner)
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ");
      const verifyQuery = `
        SELECT id FROM sources WHERE user_id = $1 AND id IN (${placeholders})
      `;
      const verifyRes = await db.query(verifyQuery, [req.user.id, ...ids]);
      if (verifyRes.rows.length !== ids.length) {
        return res.status(400).json({
          message: "One or more source IDs are invalid for this owner",
        });
      }
      normalizedSourceFilter = JSON.stringify(Array.from(new Set(ids)));
    }

    // Create the sharing permission
    const sharingPermission = await SharingPermission.create(
      req.user.id,
      shared_with_user_id,
      permission_level || "read",
      // can_view_* deprecated; always viewable when source is shared
      true,
      true,
      normalizedSourceFilter,
    );

    // Return success response
    res.status(201).json({
      success: true,
      message: "Sharing permission created successfully",
      data: sharingPermission,
    });
  } catch (err) {
    console.error("Create sharing permission error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all sharing permissions (as owner)
const getMySharingPermissions = async (req, res) => {
  try {
    // Get all sharing permissions where owner_user_id = req.user.id
    const query = `
      SELECT sp.*, u.email as shared_with_email, u.first_name as shared_with_first_name, u.last_name as shared_with_last_name
      FROM sharing_permissions sp
      JOIN users u ON sp.shared_with_user_id = u.id
      WHERE sp.owner_user_id = $1
      ORDER BY sp.created_at DESC;
    `;

    const result = await db.query(query, [req.user.id]);

    // Format the data to include shared user full name
    const permissions = result.rows.map((permission) => ({
      ...permission,
      shared_with_full_name:
        permission.shared_with_first_name && permission.shared_with_last_name
          ? `${permission.shared_with_first_name} ${permission.shared_with_last_name}`
          : permission.shared_with_first_name ||
            permission.shared_with_last_name ||
            permission.shared_with_email,
    }));

    res.json({
      success: true,
      data: permissions,
    });
  } catch (err) {
    console.error("Get my sharing permissions error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all sharing permissions (shared with me)
const getSharedWithMe = async (req, res) => {
  try {
    // Get all sharing permissions where shared_with_user_id = req.user.id
    const query = `
      SELECT sp.*, u.email as owner_email, u.first_name as owner_first_name, u.last_name as owner_last_name
      FROM sharing_permissions sp
      JOIN users u ON sp.owner_user_id = u.id
      WHERE sp.shared_with_user_id = $1
      ORDER BY sp.created_at DESC;
    `;

    const result = await db.query(query, [req.user.id]);

    // Format the data to include owner full name
    const permissions = result.rows.map((permission) => ({
      ...permission,
      owner_full_name:
        permission.owner_first_name && permission.owner_last_name
          ? `${permission.owner_first_name} ${permission.owner_last_name}`
          : permission.owner_first_name ||
            permission.owner_last_name ||
            permission.owner_email,
    }));

    res.json({
      success: true,
      data: permissions,
    });
  } catch (err) {
    console.error("Get shared with me error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Update sharing permission
const updateSharingPermission = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Verify ownership of the sharing permission
    const permission = await SharingPermission.findById(id);
    if (!permission) {
      return res.status(404).json({ message: "Sharing permission not found" });
    }

    if (permission.owner_user_id !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Accept source_filter_ids for updates; validate to numeric IDs owned by owner
    if (Object.prototype.hasOwnProperty.call(updates, "source_filter_ids")) {
      const incoming = updates.source_filter_ids;
      if (incoming) {
        if (!Array.isArray(incoming)) {
          return res.status(400).json({
            message: "source_filter_ids must be an array of numeric source IDs",
          });
        }
        const ids = incoming
          .map((x) => Number(x))
          .filter((n) => !Number.isNaN(n));
        if (ids.length === 0) {
          return res
            .status(400)
            .json({ message: "source_filter_ids cannot be empty" });
        }
        const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ");
        const verifyQuery = `
          SELECT id FROM sources WHERE user_id = $1 AND id IN (${placeholders})
        `;
        const verifyRes = await db.query(verifyQuery, [req.user.id, ...ids]);
        if (verifyRes.rows.length !== ids.length) {
          return res.status(400).json({
            message: "One or more source IDs are invalid for this owner",
          });
        }
        updates.source_filter = JSON.stringify(Array.from(new Set(ids)));
      } else {
        updates.source_filter = null;
      }
      // Remove client-facing convenience field
      delete updates.source_filter_ids;
    }

    // Update the sharing permission
    const updatedPermission = await SharingPermission.update(id, updates);

    // Return updated permission
    res.json({
      success: true,
      message: "Sharing permission updated successfully",
      data: updatedPermission,
    });
  } catch (err) {
    console.error("Update sharing permission error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete sharing permission
const deleteSharingPermission = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership of the sharing permission
    const permission = await SharingPermission.findById(id);
    if (!permission) {
      return res.status(404).json({ message: "Sharing permission not found" });
    }

    if (permission.owner_user_id !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Delete the sharing permission
    await SharingPermission.delete(id);

    // Return success response
    res.json({
      success: true,
      message: "Sharing permission deleted successfully",
    });
  } catch (err) {
    console.error("Delete sharing permission error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get shared transactions
const getSharedTransactions = async (req, res) => {
  try {
    const { owner_user_id } = req.query;

    if (!owner_user_id) {
      return res.status(400).json({ message: "Owner user ID is required" });
    }

    // Verify sharing permission
    const hasPermission = await SharingPermission.hasPermission(
      owner_user_id,
      req.user.id,
      "all",
    );
    if (!hasPermission) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Get transactions that are shared with the current user
    const transactions = await SharingPermission.getSharedTransactions(
      owner_user_id,
      req.user.id,
    );

    // Return transactions
    res.json({
      success: true,
      data: transactions,
    });
  } catch (err) {
    console.error("Get shared transactions error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all users (for user selection interface)
const getAllUsers = async (req, res) => {
  try {
    // Get all users except the current user
    const query = `
      SELECT id, email
      FROM users
      WHERE id != $1
      ORDER BY email;
    `;

    const result = await db.query(query, [req.user.id]);

    // Format the data to include full name
    const users = result.rows.map((user) => ({
      ...user,
      full_name: user.email,
    }));

    res.json({
      success: true,
      data: users,
    });
  } catch (err) {
    console.error("Get all users error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all sources for the current user
const getUserSources = async (req, res) => {
  try {
    const query = `
    SELECT id, name
    FROM sources
    WHERE user_id = $1
    ORDER BY name;
  `;

    const result = await db.query(query, [req.user.id]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error("Get user sources error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createSharingPermission,
  getMySharingPermissions,
  getSharedWithMe,
  updateSharingPermission,
  deleteSharingPermission,
  getSharedTransactions,
  getAllUsers,
  getUserSources,
};
