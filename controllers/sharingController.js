const SharingPermission = require("../models/SharingPermission");
const User = require("../models/User");
const db = require("../config/db");

const normalizePermissionLevel = (permissionLevel) =>
  permissionLevel === "read_write" ? "readwrite" : permissionLevel;

// Get my share code
const getMyShareCode = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ success: true, data: { share_code: user.share_code } });
  } catch (err) {
    console.error("Get share code error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Regenerate share code
const regenerateShareCode = async (req, res) => {
  try {
    const newCode = await User.regenerateShareCode(req.user.id);
    if (!newCode) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ success: true, data: { share_code: newCode } });
  } catch (err) {
    console.error("Regenerate share code error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Resolve share code to user info (limited: only name, no email)
const resolveShareCode = async (req, res) => {
  try {
    const { share_code } = req.body;
    if (!share_code) {
      return res.status(400).json({ message: "Share code is required" });
    }

    const user = await User.findByShareCode(share_code);
    if (!user) {
      return res.status(404).json({ message: "Invalid share code" });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ message: "This is your own share code" });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    });
  } catch (err) {
    console.error("Resolve share code error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Create sharing permission (using share code)
const createSharingPermission = async (req, res) => {
  try {
    const { share_code, permission_level, source_filter_ids } = req.body;

    // Resolve share code to user
    const targetUser = await User.findByShareCode(share_code);
    if (!targetUser) {
      return res.status(404).json({ message: "Invalid share code" });
    }

    // Validate that we're not sharing with ourselves
    if (req.user.id === targetUser.id) {
      return res
        .status(400)
        .json({ message: "You cannot share data with yourself" });
    }

    // Check if sharing permission already exists (by owner + recipient)
    const existingRes = await db.query(
      "SELECT 1 FROM sharing_permissions WHERE owner_user_id = $1 AND shared_with_user_id = $2",
      [req.user.id, targetUser.id],
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
      targetUser.id,
      normalizePermissionLevel(permission_level || "read"),
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
    const updates = { ...req.body };

    if (updates.permission_level) {
      updates.permission_level = normalizePermissionLevel(
        updates.permission_level,
      );
    }

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

// Get all sources for the current user including shared ones (respecting source_filter)
const getUserSources = async (req, res) => {
  try {
    /*
      We include:
        1. Owned sources (always)
        2. Sources of owners who shared with current user AND either:
             - source_filter is NULL (all sources shared)
             - OR the source id is contained in source_filter JSON array
      permission_level currently supports 'read' or 'read_write'. Either grants visibility.
    */
    const query = `
      WITH shared_sources AS (
        SELECT s.id, s.name, u.first_name AS owner_first_name, u.email AS owner_email
        FROM sharing_permissions sp
        JOIN sources s ON s.user_id = sp.owner_user_id
        JOIN users u ON u.id = sp.owner_user_id
        WHERE sp.shared_with_user_id = $1
          AND LOWER(TRIM(sp.permission_level)) IN ('read','readwrite','read_write')
          AND (
            sp.source_filter IS NULL
            OR s.id = ANY (
              SELECT jsonb_array_elements_text(sp.source_filter::jsonb)::int
            )
          )
      )
      SELECT DISTINCT id, name, 'owned' AS ownership_type, NULL AS owner_first_name, NULL AS owner_email
      FROM sources
      WHERE user_id = $1
      UNION ALL
      SELECT DISTINCT id, name, 'shared' AS ownership_type, owner_first_name, owner_email
      FROM shared_sources
      ORDER BY ownership_type, name;
    `;

    const result = await db.query(query, [req.user.id]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Get user sources error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getMyShareCode,
  regenerateShareCode,
  resolveShareCode,
  createSharingPermission,
  getMySharingPermissions,
  getSharedWithMe,
  updateSharingPermission,
  deleteSharingPermission,
  getSharedTransactions,
  getUserSources,
};
