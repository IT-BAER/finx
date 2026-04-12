const express = require("express");
const router = express.Router();

const isAuthenticated = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");
const admin = require("../controllers/adminController");
const dashboard = require("../controllers/adminDashboardController");

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

// Admin Dashboard
router.get("/dashboard/stats", dashboard.getDashboardStats);
router.get("/dashboard/users", dashboard.getUsersOverview);
router.get("/dashboard/health", dashboard.getServerHealth);
router.get("/dashboard/audit-logs", dashboard.getAuditLogs);
router.get("/dashboard/error-logs", dashboard.getErrorLogs);
router.get("/dashboard/activity", dashboard.getActivityOverview);

module.exports = router;
