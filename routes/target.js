const {
  createTarget,
  getTargets,
  updateTarget,
  deleteTarget,
} = require("../controllers/targetController");
const auth = require("../middleware/auth");

const express = require("express");
const router = express.Router();

// All routes require authentication
router.use(auth);

router.post("/", createTarget);
router.get("/", getTargets);
router.put("/:id", updateTarget);
router.delete("/:id", deleteTarget);

module.exports = router;
