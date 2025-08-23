const Source = require("../models/Source");
const db = require("../config/db");
const { getAccessibleUserIds, validateAsUserId } = require("../utils/access");

// Create source
const createSource = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    // Check if source already exists for this user
    const existingSource = await Source.findByNameAndUserId(req.user.id, name);
    if (existingSource) {
      return res.status(200).json({
        success: true,
        source: existingSource,
      });
    }

    const source = await Source.create(req.user.id, name);

    res.status(201).json({
      success: true,
      source,
    });
  } catch (err) {
    console.error("Create source error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all sources (mine + shared to me by default, optional asUserId)
const getSources = async (req, res) => {
  try {
    const { asUserId } = req.query;
    const validAsUserId = await validateAsUserId(req.user.id, asUserId, "all");

    if (validAsUserId) {
      const sources = await Source.findByUserId(validAsUserId);
      return res.json({
        success: true,
        sources: sources.map((source) => source.name),
      });
    }

    const accessibleUserIds = await getAccessibleUserIds(req.user.id, "all");
    const placeholders = accessibleUserIds
      .map((_, i) => `$${i + 1}`)
      .join(", ");
    const query = `
      SELECT DISTINCT name
      FROM sources
      WHERE user_id IN (${placeholders})
      ORDER BY name ASC
    `;
    const result = await db.query(query, accessibleUserIds);
    res.json({
      success: true,
      sources: result.rows.map((r) => r.name),
    });
  } catch (err) {
    console.error("Get sources error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Update source
const updateSource = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    // Check if source exists and belongs to user
    const source = await Source.findById(id);
    if (!source || source.user_id !== req.user.id) {
      return res.status(404).json({ message: "Source not found" });
    }

    const updatedSource = await Source.update(id, name);
    res.json({
      success: true,
      source: updatedSource,
    });
  } catch (err) {
    console.error("Update source error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete source
const deleteSource = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if source exists and belongs to user
    const source = await Source.findById(id);
    if (!source || source.user_id !== req.user.id) {
      return res.status(404).json({ message: "Source not found" });
    }

    const deletedSource = await Source.delete(id);
    res.json({
      success: true,
      source: deletedSource,
    });
  } catch (err) {
    console.error("Delete source error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createSource,
  getSources,
  updateSource,
  deleteSource,
};
