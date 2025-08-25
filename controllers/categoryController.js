const Category = require("../models/Category");
const db = require("../config/db");
const { getAccessibleUserIds, validateAsUserId } = require("../utils/access");

// Create category (per-user)
const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    // Create for this user if not exists
    const trimmed = name.trim();
    const existing = await Category.findByNameForUser(req.user.id, trimmed);
    if (existing) {
      return res.status(200).json({ success: true, category: existing });
    }
    const category = await Category.createForUser(req.user.id, trimmed);
    res.status(201).json({
      success: true,
      category,
    });
  } catch (err) {
    console.error("Create category error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get categories (global, deduped by name) with optional search
const getCategories = async (req, res) => {
  try {
    const { q } = req.query;
    const params = [];
    let where = "";
    if (q && q.trim()) {
      params.push(`%${q.trim()}%`);
      where = `WHERE name ILIKE $1`;
    }
    // Pull all categories (optionally filtered), then dedupe by lower(name)
    const result = await db.query(
      `SELECT id, name FROM categories ${where} ORDER BY name ASC`,
      params,
    );
    const seen = new Set();
    const deduped = [];
    for (const row of result.rows) {
      const key = String(row.name || "").trim().toLowerCase();
      if (!key) continue;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(row);
      }
    }
    res.json({ success: true, categories: deduped });
  } catch (err) {
    console.error("Get categories error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Update category (enforce ownership)
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    const cat = await Category.findByIdForUser(id, req.user.id);
    if (!cat) {
      return res.status(404).json({ message: "Category not found" });
    }
    const updatedCategory = await Category.updateForUser(id, req.user.id, name.trim());
    res.json({
      success: true,
      category: updatedCategory,
    });
  } catch (err) {
    console.error("Update category error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete category (ownership enforced). If in use, require reassignment client-side first.
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByIdForUser(id, req.user.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    const deletedCategory = await Category.deleteByUser(id, req.user.id);
    res.json({
      success: true,
      category: deletedCategory,
    });
  } catch (err) {
    console.error("Delete category error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
};
