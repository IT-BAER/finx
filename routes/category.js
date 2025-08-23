const express = require("express");
const {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const auth = require("../middleware/auth");

const router = express.Router();

// All routes are protected
router.use(auth);

// Create category
router.post("/", createCategory);

// Get all categories
router.get("/", getCategories);

// Update category
router.put("/:id", updateCategory);

// Delete category
router.delete("/:id", deleteCategory);

module.exports = router;
