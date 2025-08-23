const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  createSharingPermission,
  getMySharingPermissions,
  getSharedWithMe,
  updateSharingPermission,
  deleteSharingPermission,
  getSharedTransactions,
  getAllUsers,
  getUserSources,
} = require("../controllers/sharingController");

// All routes require authentication
router.use(auth);

// Sharing management routes
router.post("/", createSharingPermission);
router.get("/my-permissions", getMySharingPermissions);
router.get("/shared-with-me", getSharedWithMe);
router.put("/:id", updateSharingPermission);
router.delete("/:id", deleteSharingPermission);

// Shared data access routes
router.get("/transactions", getSharedTransactions);

// User selection route
router.get("/users", getAllUsers);

// User sources route
router.get("/sources", getUserSources);

module.exports = router;
