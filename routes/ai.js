const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { getAiKey } = require("../controllers/aiController");

// GET /api/ai/key — returns managed OpenRouter API key for authenticated users
router.get("/key", auth, getAiKey);

module.exports = router;
