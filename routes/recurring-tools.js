const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");
const { processRecurringJobs } = require("../services/recurringProcessor");

// Admin-only endpoint to trigger recurring processing manually
router.post("/run-now", auth, isAdmin, async (req, res) => {
  try {
    const stats = await processRecurringJobs();
    res.json({ success: true, stats });
  } catch (e) {
    res.status(500).json({ message: "Failed to run recurring processor" });
  }
});

module.exports = router;
