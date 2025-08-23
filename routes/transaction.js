const express = require("express");
const {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getDashboardData,
} = require("../controllers/transactionController");
const auth = require("../middleware/auth");

const router = express.Router();

// All routes are protected
router.use(auth);

// Get dashboard data
router.get("/dashboard", getDashboardData);

// Create transaction
router.post("/", createTransaction);

// Get all transactions
router.get("/", getTransactions);

// Get transaction by ID
router.get("/:id", getTransactionById);

// Update transaction
router.put("/:id", updateTransaction);

// Delete transaction
router.delete("/:id", deleteTransaction);

module.exports = router;
