const express = require("express");
const {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getDashboardData,
  getNetWorth,
  getSafeToSpend,
  getSpendingPace,
} = require("../controllers/transactionController");
const auth = require("../middleware/auth");
const { validateBody, validateQuery } = require("../middleware/validation");
const {
  createTransactionSchema,
  updateTransactionSchema,
  getTransactionsQuerySchema,
  dashboardQuerySchema,
} = require("../middleware/validation/schemas");

const router = express.Router();

// All routes are protected
router.use(auth);

// Get dashboard data
router.get("/dashboard", validateQuery(dashboardQuerySchema), getDashboardData);

// Get net worth data (all-time income - expenses with trend)
router.get("/net-worth", getNetWorth);

// Get safe to spend (remaining budget for the month)
router.get("/safe-to-spend", getSafeToSpend);

// Get spending pace (daily spending rate vs last month)
router.get("/spending-pace", getSpendingPace);

// Create transaction
router.post("/", validateBody(createTransactionSchema), createTransaction);

// Get all transactions
router.get("/", validateQuery(getTransactionsQuerySchema), getTransactions);

// Get transaction by ID
router.get("/:id", getTransactionById);

// Update transaction
router.put("/:id", validateBody(updateTransactionSchema), updateTransaction);

// Delete transaction
router.delete("/:id", deleteTransaction);

module.exports = router;
