const express = require("express");
const {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  getBudgetProgress,
} = require("../controllers/categoryController");
const auth = require("../middleware/auth");

const router = express.Router();

// All routes are protected
router.use(auth);

// Get budget progress (categories with budget limits and spending)
router.get("/budget-progress", getBudgetProgress);

// Create category (per-user)
router.post("/", createCategory);

// Get categories (mine or accessible user via query)
router.get("/", getCategories);

// Update category (ownership enforced)
router.put("/:id", updateCategory);

// Delete category (ownership enforced)
router.delete("/:id", deleteCategory);

module.exports = router;
