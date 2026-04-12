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
      `SELECT id, TRIM(name) AS name FROM categories ${where} ORDER BY TRIM(name) ASC`,
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
    const { name, budget_limit } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    const cat = await Category.findByIdForUser(id, req.user.id);
    if (!cat) {
      return res.status(404).json({ message: "Category not found" });
    }
    // Parse budget_limit: null clears it, undefined leaves it unchanged, number sets it
    const parsedLimit = budget_limit === null ? null : budget_limit !== undefined ? parseFloat(budget_limit) : undefined;
    if (parsedLimit !== undefined && parsedLimit !== null && (isNaN(parsedLimit) || parsedLimit < 0)) {
      return res.status(400).json({ message: "Budget limit must be a positive number or null" });
    }
    const updatedCategory = await Category.updateForUser(id, req.user.id, name.trim(), parsedLimit);
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

// Get budget progress for categories with budget limits
const getBudgetProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthEndStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, "0")}-${String(monthEnd.getDate()).padStart(2, "0")}`;

    // Get all categories with budget limits and their current month spending
    const result = await db.query(
      `SELECT 
        c.id, c.name, c.budget_limit,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS spent
      FROM categories c
      LEFT JOIN transactions t ON t.category_id = c.id 
        AND t.user_id = $1 
        AND t.date >= $2 
        AND t.date <= $3
      WHERE c.user_id = $1 AND c.budget_limit IS NOT NULL
      GROUP BY c.id, c.name, c.budget_limit
      ORDER BY c.name`,
      [userId, monthStart, monthEndStr]
    );

    const budgets = result.rows.map(row => {
      const spent = parseFloat(row.spent);
      const limit = parseFloat(row.budget_limit);
      const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      let status = 'healthy';
      if (percent > 100) status = 'overspent';
      else if (percent >= 80) status = 'caution';

      return {
        id: row.id,
        name: row.name,
        budget_limit: limit,
        spent,
        remaining: Math.max(0, limit - spent),
        percent,
        status,
      };
    });

    res.json({
      success: true,
      data: {
        budgets,
        month: monthStart.substring(0, 7),
        totalBudget: budgets.reduce((sum, b) => sum + b.budget_limit, 0),
        totalSpent: budgets.reduce((sum, b) => sum + b.spent, 0),
      }
    });
  } catch (err) {
    console.error("Get budget progress error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  getBudgetProgress,
};
