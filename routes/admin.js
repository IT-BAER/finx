const express = require("express");
const router = express.Router();

const isAuthenticated = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");
const admin = require("../controllers/adminController");

// All admin routes require auth + admin
router.use(isAuthenticated, isAdmin);

// Categories
router.get("/categories", admin.listCategories);
router.patch("/categories/:id", admin.renameCategory);
router.post("/categories/:id/merge", admin.mergeCategory);
router.delete("/categories/:id", admin.deleteCategory);

// Sources
router.get("/sources", admin.listSources);
router.patch("/sources/:id", admin.renameSource);
router.delete("/sources/:id", admin.deleteSource);

// Targets
router.get("/targets", admin.listTargets);
router.patch("/targets/:id", admin.renameTarget);
router.delete("/targets/:id", admin.deleteTarget);

// System stats and cleanup
router.get("/system-stats", admin.getSystemStats);
router.post("/remove-sample-data", admin.cleanupSampleData);

module.exports = router;
