const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { parseNotification } = require("../controllers/aiController");

// POST /api/ai/parse — server-side AI notification parsing (key never leaves server)
router.post("/parse", auth, parseNotification);

module.exports = router;
