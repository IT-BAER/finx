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
