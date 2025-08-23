const Category = require("../models/Category");
const db = require("../config/db");
const { getAccessibleUserIds, validateAsUserId } = require("../utils/access");

/**
 * Categories are now global (no user_id). Creation is restricted to admins (enforced elsewhere).
 */
// Create category (global)
const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    // Global create via model helper that no longer takes user_id
    const category = await Category.createGlobal(name.trim());
    res.status(201).json({
      success: true,
      category,
    });
  } catch (err) {
    // likely unique violation on uq_categories_name_norm
    if (err?.code === "23505") {
      return res.status(409).json({ message: "Category name already exists" });
    }
    console.error("Create category error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all categories (global)
const getCategories = async (req, res) => {
  try {
    const { q } = req.query;
    let query = `
      SELECT id, name
      FROM categories
    `;
    const params = [];
    if (q && q.trim()) {
      params.push(`%${q.trim()}%`);
      query += ` WHERE name_norm LIKE LOWER(TRIM($${params.length}))`;
    }
    query += ` ORDER BY name ASC`;
    const result = await db.query(query, params);
    res.json({
      success: true,
      categories: result.rows,
    });
  } catch (err) {
    console.error("Get categories error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Update category (global)
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    const cat = await Category.findById(id);
    if (!cat) {
      return res.status(404).json({ message: "Category not found" });
    }
    const updatedCategory = await Category.updateGlobal(id, name.trim());
    res.json({
      success: true,
      category: updatedCategory,
    });
  } catch (err) {
    if (err?.code === "23505") {
      return res.status(409).json({ message: "Category name already exists" });
    }
    console.error("Update category error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete category (global). If in use, client should reassign first via Admin tool.
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    const deletedCategory = await Category.deleteGlobal(id);
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
