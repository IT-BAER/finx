const express = require("express");
const router = express.Router();
const goalController = require("../controllers/goalController");
const auth = require("../middleware/auth");

// All routes require authentication
router.use(auth);

// Get goals summary statistics
router.get("/summary", goalController.getSummary);

// Get all goals for the authenticated user
router.get("/", goalController.getGoals);

// Get a single goal by ID
router.get("/:id", goalController.getGoalById);

// Create a new goal
router.post("/", goalController.createGoal);

// Update a goal
router.put("/:id", goalController.updateGoal);

// Delete a goal
router.delete("/:id", goalController.deleteGoal);

// Add a contribution to a goal
router.post("/:id/contributions", goalController.addContribution);

// Get contributions for a goal
router.get("/:id/contributions", goalController.getContributions);

// Delete a contribution
router.delete("/contributions/:contributionId", goalController.deleteContribution);

// Set current amount directly (for manual adjustments)
router.put("/:id/amount", goalController.setCurrentAmount);

module.exports = router;
