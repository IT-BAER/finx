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

// Map body-parser entity.too.large to our standard 413 response so the
// 32KB cap is enforced for chunked/no-Content-Length uploads too.
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err && (err.type === "entity.too.large" || err.status === 413)) {
    return res
      .status(413)
      .json({ message: "Payload too large", code: "AI_PAYLOAD_TOO_LARGE" });
  }
  return next(err);
});

module.exports = router;
