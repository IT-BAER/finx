const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { validateBody } = require("../middleware/validation");
const {
  createSharingSchema,
  updateSharingSchema,
} = require("../middleware/validation/schemas");
const {
  getMyShareCode,
  regenerateShareCode,
  resolveShareCode,
  createSharingPermission,
  getMySharingPermissions,
  getSharedWithMe,
  updateSharingPermission,
  deleteSharingPermission,
  getSharedTransactions,
  getUserSources,
} = require("../controllers/sharingController");

// All routes require authentication
router.use(auth);

// Share code management
router.get("/my-code", getMyShareCode);
router.post("/regenerate-code", regenerateShareCode);
router.post("/resolve-code", resolveShareCode);

// Sharing management routes
router.post("/", validateBody(createSharingSchema), createSharingPermission);
router.get("/my-permissions", getMySharingPermissions);
router.get("/shared-with-me", getSharedWithMe);
router.put("/:id", validateBody(updateSharingSchema), updateSharingPermission);
router.delete("/:id", deleteSharingPermission);

// Shared data access routes
router.get("/transactions", getSharedTransactions);

// User sources route
router.get("/sources", getUserSources);

module.exports = router;
