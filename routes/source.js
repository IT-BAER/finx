const express = require("express");
const router = express.Router();
const {
  createSource,
  getSources,
  updateSource,
  deleteSource,
} = require("../controllers/sourceController");
const auth = require("../middleware/auth");

// All routes require authentication
router.use(auth);

// Create source
router.post("/", createSource);

// Get all sources for user
router.get("/", getSources);

// Update source
router.put("/:id", updateSource);

// Delete source
router.delete("/:id", deleteSource);

module.exports = router;
