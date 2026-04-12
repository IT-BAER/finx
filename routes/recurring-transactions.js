const express = require("express");
const router = express.Router();
const {
  createRecurringTransaction,
  getAllRecurringTransactions,
  getRecurringTransactionById,
  updateRecurringTransaction,
  deleteRecurringTransaction,
  getUpcomingBills,
} = require("../controllers/recurringTransactionController");
const auth = require("../middleware/auth");

// Get upcoming bills (for dashboard widget)
router.get("/upcoming", auth, getUpcomingBills);

router.post("/", auth, createRecurringTransaction);
router.get("/", auth, getAllRecurringTransactions);
router.get("/:id", auth, getRecurringTransactionById);
router.put("/:id", auth, updateRecurringTransaction);
router.delete("/:id", auth, deleteRecurringTransaction);

module.exports = router;
