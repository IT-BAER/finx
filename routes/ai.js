const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");
const { perUserHourly, perUserDaily } = require("../middleware/aiRateLimit");
const { parseNotification } = require("../controllers/aiController");

// 32 KB body cap applied before parsing JSON in this route.
const aiBodyJson = express.json({ limit: "32kb" });

// Admin-only by default. Set AI_ALLOW_NON_ADMIN=true to open to all users.
const allowAll = process.env.AI_ALLOW_NON_ADMIN === "true";
const gate = allowAll
  ? (_req, _res, next) => next()
  : (req, res, next) => isAdmin(req, res, next);

// POST /api/ai/parse — server-side AI notification parsing (key never leaves server)
router.post(
  "/parse",
  auth,
  gate,
  perUserHourly(),
  perUserDaily(),
  aiBodyJson,
  parseNotification,
);

module.exports = router;
