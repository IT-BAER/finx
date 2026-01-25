const Goal = require("../models/Goal");
const { getUsersSharedWithOwner } = require("../utils/access");

// Get all goals for the authenticated user
exports.getGoals = async (req, res) => {
  try {
    const user_id = req.user.id;
    const includeCompleted = req.query.includeCompleted !== "false";
    const goals = await Goal.findByUserId(user_id, includeCompleted);
    res.json({ goals });
  } catch (error) {
    console.error("Error fetching goals:", error);
    res.status(500).json({ error: "Failed to fetch goals" });
  }
};

// Get a single goal by ID
exports.getGoalById = async (req, res) => {
  try {
    const user_id = req.user.id;
    const goal = await Goal.findByIdForUser(req.params.id, user_id);
    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }
    res.json({ goal });
  } catch (error) {
    console.error("Error fetching goal:", error);
    res.status(500).json({ error: "Failed to fetch goal" });
  }
};

// Create a new goal
exports.createGoal = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { name, target_amount, deadline, icon, color } = req.body;

    if (!name || !target_amount) {
      return res.status(400).json({ error: "Name and target amount are required" });
    }

    if (parseFloat(target_amount) <= 0) {
      return res.status(400).json({ error: "Target amount must be greater than 0" });
    }

    const goal = await Goal.create(
      user_id,
      name,
      parseFloat(target_amount),
      deadline || null,
      icon || "savings",
      color || "#06b6d4"
    );

    res.status(201).json({ goal });
  } catch (error) {
    console.error("Error creating goal:", error);
    res.status(500).json({ error: "Failed to create goal" });
  }
};

// Update a goal
exports.updateGoal = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;
    const updates = req.body;

    // Validate target_amount if provided
    if (updates.target_amount !== undefined && parseFloat(updates.target_amount) <= 0) {
      return res.status(400).json({ error: "Target amount must be greater than 0" });
    }

    const goal = await Goal.updateByUser(id, user_id, updates);
    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    res.json({ goal });
  } catch (error) {
    console.error("Error updating goal:", error);
    res.status(500).json({ error: "Failed to update goal" });
  }
};

// Delete a goal
exports.deleteGoal = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;

    const goal = await Goal.deleteByUser(id, user_id);
    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    res.json({ message: "Goal deleted successfully", goal });
  } catch (error) {
    console.error("Error deleting goal:", error);
    res.status(500).json({ error: "Failed to delete goal" });
  }
};

// Add a contribution to a goal
exports.addContribution = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;
    const { amount, note } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: "Contribution amount must be greater than 0" });
    }

    const contribution = await Goal.addContribution(id, user_id, parseFloat(amount), note);
    if (!contribution) {
      return res.status(404).json({ error: "Goal not found" });
    }

    // Get the updated goal
    const goal = await Goal.findByIdForUser(id, user_id);

    res.status(201).json({ contribution, goal });
  } catch (error) {
    console.error("Error adding contribution:", error);
    res.status(500).json({ error: "Failed to add contribution" });
  }
};

// Get contributions for a goal
exports.getContributions = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;

    // Verify goal exists and belongs to user
    const goal = await Goal.findByIdForUser(id, user_id);
    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const contributions = await Goal.getContributions(id, user_id);
    res.json({ contributions });
  } catch (error) {
    console.error("Error fetching contributions:", error);
    res.status(500).json({ error: "Failed to fetch contributions" });
  }
};

// Delete a contribution
exports.deleteContribution = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { contributionId } = req.params;

    const contribution = await Goal.deleteContribution(contributionId, user_id);
    if (!contribution) {
      return res.status(404).json({ error: "Contribution not found" });
    }

    res.json({ message: "Contribution deleted successfully", contribution });
  } catch (error) {
    console.error("Error deleting contribution:", error);
    res.status(500).json({ error: "Failed to delete contribution" });
  }
};

// Set current amount directly (for manual adjustments)
exports.setCurrentAmount = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;
    const { amount } = req.body;

    if (amount === undefined || parseFloat(amount) < 0) {
      return res.status(400).json({ error: "Amount must be 0 or greater" });
    }

    const goal = await Goal.setCurrentAmount(id, user_id, parseFloat(amount));
    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    res.json({ goal });
  } catch (error) {
    console.error("Error setting current amount:", error);
    res.status(500).json({ error: "Failed to set current amount" });
  }
};

// Get goals summary statistics
exports.getSummary = async (req, res) => {
  try {
    const user_id = req.user.id;
    const summary = await Goal.getSummary(user_id);
    res.json({ summary });
  } catch (error) {
    console.error("Error fetching goals summary:", error);
    res.status(500).json({ error: "Failed to fetch goals summary" });
  }
};
