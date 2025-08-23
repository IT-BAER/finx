const Target = require("../models/Target");
const db = require("../config/db");
const { getAccessibleUserIds, validateAsUserId } = require("../utils/access");

// Create target
const createTarget = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    // Check if target already exists for this user
    const existingTarget = await Target.findByNameAndUserId(req.user.id, name);
    if (existingTarget) {
      return res.status(200).json({
        success: true,
        target: existingTarget,
      });
    }

    const target = await Target.create(req.user.id, name);

    res.status(201).json({
      success: true,
      target,
    });
  } catch (err) {
    console.error("Create target error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all targets (mine + shared to me by default, optional asUserId)
const getTargets = async (req, res) => {
  try {
    const { asUserId } = req.query;
    const validAsUserId = await validateAsUserId(req.user.id, asUserId, "all");

    if (validAsUserId) {
      const targets = await Target.findByUserId(validAsUserId);
      return res.json({
        success: true,
        targets: targets.map((target) => target.name),
      });
    }

    const accessibleUserIds = await getAccessibleUserIds(req.user.id, "all");
    const placeholders = accessibleUserIds
      .map((_, i) => `$${i + 1}`)
      .join(", ");
    const query = `
      SELECT DISTINCT name
      FROM targets
      WHERE user_id IN (${placeholders})
      ORDER BY name ASC
    `;
    const result = await db.query(query, accessibleUserIds);
    res.json({
      success: true,
      targets: result.rows.map((r) => r.name),
    });
  } catch (err) {
    console.error("Get targets error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Update target
const updateTarget = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    // Check if target exists and belongs to user
    const target = await Target.findById(id);
    if (!target || target.user_id !== req.user.id) {
      return res.status(404).json({ message: "Target not found" });
    }

    const updatedTarget = await Target.update(id, name);
    res.json({
      success: true,
      target: updatedTarget,
    });
  } catch (err) {
    console.error("Update target error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete target
const deleteTarget = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if target exists and belongs to user
    const target = await Target.findById(id);
    if (!target || target.user_id !== req.user.id) {
      return res.status(404).json({ message: "Target not found" });
    }

    const deletedTarget = await Target.delete(id);
    res.json({
      success: true,
      target: deletedTarget,
    });
  } catch (err) {
    console.error("Delete target error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createTarget,
  getTargets,
  updateTarget,
  deleteTarget,
};
