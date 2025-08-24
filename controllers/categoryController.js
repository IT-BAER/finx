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

// Get all categories for the current user (optionally another accessible user)
const getCategories = async (req, res) => {
  try {
    const { asUserId, q } = req.query;
    const validAsUserId = await validateAsUserId(req.user.id, asUserId, "all");
    const ownerId = validAsUserId || req.user.id;
    const params = [ownerId];
    let where = "WHERE user_id = $1";
    if (q && q.trim()) {
      params.push(`%${q.trim()}%`);
      where += ` AND name ILIKE $${params.length}`;
    }
    const result = await db.query(
      `SELECT id, name FROM categories ${where} ORDER BY name ASC`,
      params,
    );
    res.json({ success: true, categories: result.rows });
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
